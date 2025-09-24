const DatabaseOrderTracker = require('../../../src/utils/DatabaseOrderTracker');
const MockFactory = require('../../helpers/mock-factory');

// Mock the Database dependency
jest.mock('../../../src/database/Database');

describe('DatabaseOrderTracker', () => {
  let tracker;
  let mockDb;

  beforeEach(() => {
    mockDb = MockFactory.mockDatabase();

    const Database = require('../../../src/database/Database');
    Database.mockImplementation(() => mockDb);

    tracker = new DatabaseOrderTracker();
  });

  describe('initialization', () => {
    it('should initialize database connection', async () => {
      await tracker.initialize();

      expect(mockDb.initialize).toHaveBeenCalledTimes(1);
      expect(tracker.db).toBe(mockDb);
    });
  });

  describe('addOrder', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should add new order to database', async () => {
      const order = MockFactory.createBinanceOrder();

      // Mock successful insertion
      mockDb.db.run.mockImplementation((sql, params, callback) => {
        callback(null);
      });

      await tracker.addOrder(order);

      expect(mockDb.db.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO orders'),
        expect.arrayContaining([
          order.order_number,
          order.amount,
          order.price,
          order.total_price,
          order.asset,
          order.fiat,
          order.trade_type,
          order.create_time,
          order.buyer_nickname,
          order.seller_nickname
        ]),
        expect.any(Function)
      );
    });

    it('should handle duplicate orders gracefully', async () => {
      const order = MockFactory.createBinanceOrder();

      // Mock constraint error (duplicate)
      mockDb.db.run.mockImplementation((sql, params, callback) => {
        const error = new Error('UNIQUE constraint failed');
        error.code = 'SQLITE_CONSTRAINT_UNIQUE';
        callback(error);
      });

      // Should not throw, just log the duplicate
      await expect(tracker.addOrder(order)).resolves.toBeUndefined();
    });

    it('should throw on other database errors', async () => {
      const order = MockFactory.createBinanceOrder();

      mockDb.db.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Database connection failed'));
      });

      await expect(tracker.addOrder(order)).rejects.toThrow('Database connection failed');
    });
  });

  describe('getUnprocessedOrders', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should return unprocessed orders', async () => {
      const mockOrders = [
        MockFactory.createDatabaseOrder({ order_number: 'order_1', success: null }),
        MockFactory.createDatabaseOrder({ order_number: 'order_2', success: null })
      ];

      mockDb.db.all.mockImplementation((sql, params, callback) => {
        callback(null, mockOrders);
      });

      const result = await tracker.getUnprocessedOrders();

      expect(result).toEqual(mockOrders);
      expect(mockDb.db.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE success IS NULL OR success = 0'),
        [],
        expect.any(Function)
      );
    });

    it('should return empty array when no unprocessed orders', async () => {
      mockDb.db.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      const result = await tracker.getUnprocessedOrders();

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockDb.db.all.mockImplementation((sql, params, callback) => {
        callback(new Error('Database query failed'));
      });

      await expect(tracker.getUnprocessedOrders()).rejects.toThrow('Database query failed');
    });
  });

  describe('markOrderProcessed', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should mark order as successfully processed', async () => {
      const orderNumber = 'test_order_123';
      const result = MockFactory.createAfipSuccessResponse({
        cae: '75398279001644',
        voucherNumber: 21
      });

      mockDb.db.run.mockImplementation((sql, params, callback) => {
        callback(null);
      });

      await tracker.markOrderProcessed(orderNumber, result, 'automatic');

      expect(mockDb.db.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE orders SET'),
        expect.arrayContaining([
          true,
          '75398279001644',
          21,
          'automatic',
          null, // No error message
          expect.any(String), // Timestamp
          orderNumber
        ]),
        expect.any(Function)
      );
    });

    it('should mark order as failed', async () => {
      const orderNumber = 'test_order_123';
      const result = MockFactory.createAfipErrorResponse('AFIP validation failed');

      mockDb.db.run.mockImplementation((sql, params, callback) => {
        callback(null);
      });

      await tracker.markOrderProcessed(orderNumber, result, 'automatic');

      expect(mockDb.db.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE orders SET'),
        expect.arrayContaining([
          false,
          null, // No CAE
          null, // No voucher number
          'automatic',
          'AFIP validation failed',
          expect.any(String), // Timestamp
          orderNumber
        ]),
        expect.any(Function)
      );
    });

    it('should handle manual processing', async () => {
      const orderNumber = 'test_order_123';
      const result = {
        success: true,
        cae: 'manual_cae_123',
        voucherNumber: 99,
        manual: true
      };

      mockDb.db.run.mockImplementation((sql, params, callback) => {
        callback(null);
      });

      await tracker.markOrderProcessed(orderNumber, result, 'manual');

      const updateCall = mockDb.db.run.mock.calls[0];
      expect(updateCall[1]).toContain('manual'); // Processing method
      expect(updateCall[1]).toContain('manual_cae_123'); // Manual CAE
      expect(updateCall[1]).toContain(99); // Manual voucher number
    });
  });

  describe('getOrderByNumber', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should return order by number', async () => {
      const expectedOrder = MockFactory.createDatabaseOrder({
        order_number: 'test_order_123'
      });

      mockDb.db.get.mockImplementation((sql, params, callback) => {
        callback(null, expectedOrder);
      });

      const result = await tracker.getOrderByNumber('test_order_123');

      expect(result).toEqual(expectedOrder);
      expect(mockDb.db.get).toHaveBeenCalledWith(
        expect.stringContaining('WHERE order_number = ?'),
        ['test_order_123'],
        expect.any(Function)
      );
    });

    it('should return null for non-existent order', async () => {
      mockDb.db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const result = await tracker.getOrderByNumber('non_existent');

      expect(result).toBeNull();
    });
  });

  describe('getProcessingStatistics', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should return processing statistics', async () => {
      const mockStats = [
        { success: null, count: 5 }, // Pending
        { success: 1, count: 15 },   // Successful
        { success: 0, count: 2 }     // Failed
      ];

      mockDb.db.all.mockImplementation((sql, params, callback) => {
        callback(null, mockStats);
      });

      const result = await tracker.getProcessingStatistics();

      expect(result).toEqual({
        total: 22,
        pending: 5,
        successful: 15,
        failed: 2,
        successRate: 15 / 17 // Successful / (Successful + Failed)
      });
    });

    it('should handle zero processed orders', async () => {
      mockDb.db.all.mockImplementation((sql, params, callback) => {
        callback(null, [{ success: null, count: 10 }]);
      });

      const result = await tracker.getProcessingStatistics();

      expect(result).toEqual({
        total: 10,
        pending: 10,
        successful: 0,
        failed: 0,
        successRate: 0
      });
    });
  });

  describe('cleanup', () => {
    it('should close database connection', async () => {
      await tracker.initialize();
      await tracker.close();

      expect(mockDb.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should handle database connection loss', async () => {
      mockDb.db.run.mockImplementation((sql, params, callback) => {
        callback(new Error('database is locked'));
      });

      const order = MockFactory.createBinanceOrder();

      await expect(tracker.addOrder(order)).rejects.toThrow('database is locked');
    });

    it('should handle malformed data gracefully', async () => {
      // Test with missing required fields
      const incompleteOrder = {
        order_number: 'test_123'
        // Missing other required fields
      };

      mockDb.db.run.mockImplementation((sql, params, callback) => {
        callback(null);
      });

      await expect(tracker.addOrder(incompleteOrder)).resolves.toBeUndefined();
    });
  });
});