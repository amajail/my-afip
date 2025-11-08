const DatabaseOrderTracker = require('../../../src/utils/DatabaseOrderTracker');
const MockFactory = require('../../helpers/mock-factory');

// Mock the Database dependency
jest.mock('../../../src/database/Database');

describe('DatabaseOrderTracker', () => {
  let tracker;
  let mockDb;

  beforeEach(() => {
    // Create mock database with actual methods used by DatabaseOrderTracker
    mockDb = {
      initialize: jest.fn().mockResolvedValue(),
      close: jest.fn().mockResolvedValue(),
      insertOrder: jest.fn().mockResolvedValue(1),
      getSuccessfullyProcessedOrders: jest.fn().mockResolvedValue([]),
      markOrderProcessed: jest.fn().mockResolvedValue(),
      markOrderManual: jest.fn().mockResolvedValue(1),
      getOrderStats: jest.fn().mockResolvedValue({
        total_orders: 0,
        processed_orders: 0,
        successful_orders: 0,
        failed_orders: 0,
        manual_orders: 0,
        automatic_orders: 0,
        total_invoiced_amount: 0
      }),
      getProcessedOrders: jest.fn().mockResolvedValue([]),
      getUnprocessedOrders: jest.fn().mockResolvedValue([]),
      getOrdersByStatus: jest.fn().mockResolvedValue([]),
      getCurrentMonthOrders: jest.fn().mockResolvedValue([]),
      getCurrentMonthStats: jest.fn().mockResolvedValue({})
    };

    const Database = require('../../../src/database/Database');
    Database.mockImplementation(() => mockDb);

    tracker = new DatabaseOrderTracker();
  });

  describe('initialization', () => {
    it('should initialize database connection', async () => {
      await tracker.initialize();

      expect(mockDb.initialize).toHaveBeenCalledTimes(1);
      expect(tracker.initialized).toBe(true);
    });

    it('should not initialize twice', async () => {
      await tracker.initialize();
      await tracker.initialize();

      expect(mockDb.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('insertOrders', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should insert multiple orders successfully', async () => {
      const orders = [
        MockFactory.createBinanceOrder({ orderNumber: 'order_1' }),
        MockFactory.createBinanceOrder({ orderNumber: 'order_2' })
      ];

      mockDb.insertOrder.mockResolvedValue(1);

      const count = await tracker.insertOrders(orders);

      expect(count).toBe(2);
      expect(mockDb.insertOrder).toHaveBeenCalledTimes(2);
      expect(mockDb.insertOrder).toHaveBeenCalledWith(orders[0]);
      expect(mockDb.insertOrder).toHaveBeenCalledWith(orders[1]);
    });

    it('should handle insertion errors gracefully', async () => {
      const orders = [
        MockFactory.createBinanceOrder({ orderNumber: 'order_1' }),
        MockFactory.createBinanceOrder({ orderNumber: 'order_2' })
      ];

      // First succeeds, second fails
      mockDb.insertOrder
        .mockResolvedValueOnce(1)
        .mockRejectedValueOnce(new Error('UNIQUE constraint failed'));

      const count = await tracker.insertOrders(orders);

      // Should continue despite error and return count of successful insertions
      expect(count).toBe(1);
    });

    it('should insert single order', async () => {
      const order = MockFactory.createBinanceOrder();
      mockDb.insertOrder.mockResolvedValue(1);

      const count = await tracker.insertOrders([order]);

      expect(count).toBe(1);
      expect(mockDb.insertOrder).toHaveBeenCalledWith(order);
    });
  });

  describe('filterNewOrders', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should filter out successfully processed orders', async () => {
      const orders = [
        MockFactory.createBinanceOrder({ orderNumber: 'new_order_1' }),
        MockFactory.createBinanceOrder({ orderNumber: 'processed_order' }),
        MockFactory.createBinanceOrder({ orderNumber: 'new_order_2' })
      ];

      mockDb.insertOrder.mockResolvedValue(1);
      mockDb.getSuccessfullyProcessedOrders.mockResolvedValue([
        { order_number: 'processed_order', success: true, cae: '12345', processed_at: new Date(), processing_method: 'automatic' }
      ]);

      const result = await tracker.filterNewOrders(orders);

      expect(result.newOrders).toHaveLength(2);
      expect(result.newOrders.map(o => o.orderNumber)).toEqual(['new_order_1', 'new_order_2']);
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].orderNumber).toBe('processed_order');
    });

    it('should return all orders as new when none are processed', async () => {
      const orders = [
        MockFactory.createBinanceOrder(),
        MockFactory.createBinanceOrder()
      ];

      mockDb.insertOrder.mockResolvedValue(1);
      mockDb.getSuccessfullyProcessedOrders.mockResolvedValue([]);

      const result = await tracker.filterNewOrders(orders);

      expect(result.newOrders).toHaveLength(2);
      expect(result.duplicates).toHaveLength(0);
    });
  });

  describe('saveResults', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should save successful invoice results', async () => {
      const results = [
        MockFactory.createAfipSuccessResponse({ cae: 'CAE_123' })
      ];
      const orderNumbers = ['order_123'];

      mockDb.markOrderProcessed.mockResolvedValue();

      await tracker.saveResults(results, orderNumbers);

      expect(mockDb.markOrderProcessed).toHaveBeenCalledWith(
        'order_123',
        results[0],
        'automatic'
      );
    });

    it('should save multiple results', async () => {
      const results = [
        MockFactory.createAfipSuccessResponse(),
        MockFactory.createAfipErrorResponse()
      ];
      const orderNumbers = ['order_1', 'order_2'];

      mockDb.markOrderProcessed.mockResolvedValue();

      await tracker.saveResults(results, orderNumbers);

      expect(mockDb.markOrderProcessed).toHaveBeenCalledTimes(2);
    });

    it('should handle errors in saveResults gracefully', async () => {
      const results = [MockFactory.createAfipSuccessResponse()];
      const orderNumbers = ['order_123'];

      mockDb.markOrderProcessed.mockRejectedValue(new Error('Database error'));

      // Should not throw, just log error
      await expect(tracker.saveResults(results, orderNumbers)).resolves.toBeUndefined();
    });
  });

  describe('markManualInvoice', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should mark order as manually processed', async () => {
      mockDb.markOrderManual.mockResolvedValue(1);

      const result = await tracker.markManualInvoice('order_123', 'CAE_MANUAL', 99, 'Manual note');

      expect(result).toBe(true);
      expect(mockDb.markOrderManual).toHaveBeenCalledWith(
        'order_123',
        'CAE_MANUAL',
        99,
        'Manual note'
      );
    });

    it('should return false for non-existent order', async () => {
      mockDb.markOrderManual.mockResolvedValue(0);

      const result = await tracker.markManualInvoice('non_existent', 'CAE', 1);

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockDb.markOrderManual.mockRejectedValue(new Error('Database error'));

      const result = await tracker.markManualInvoice('order_123', 'CAE', 1);

      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should return order statistics', async () => {
      const mockStats = {
        total_orders: 100,
        processed_orders: 75,
        successful_orders: 70,
        failed_orders: 5,
        manual_orders: 10,
        automatic_orders: 65,
        total_invoiced_amount: 1500000
      };

      mockDb.getOrderStats.mockResolvedValue(mockStats);

      const stats = await tracker.getStats();

      expect(stats).toEqual(mockStats);
      expect(mockDb.getOrderStats).toHaveBeenCalled();
    });
  });

  describe('getProcessedOrders', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should return processed orders', async () => {
      const mockOrders = [
        MockFactory.createDatabaseOrder({ order_number: 'order_1', success: true }),
        MockFactory.createDatabaseOrder({ order_number: 'order_2', success: true })
      ];

      mockDb.getProcessedOrders.mockResolvedValue(mockOrders);

      const orders = await tracker.getProcessedOrders();

      expect(orders).toEqual(mockOrders);
      expect(mockDb.getProcessedOrders).toHaveBeenCalled();
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

      mockDb.getUnprocessedOrders.mockResolvedValue(mockOrders);

      const orders = await tracker.getUnprocessedOrders();

      expect(orders).toEqual(mockOrders);
      expect(mockDb.getUnprocessedOrders).toHaveBeenCalled();
    });

    it('should return empty array when no unprocessed orders', async () => {
      mockDb.getUnprocessedOrders.mockResolvedValue([]);

      const orders = await tracker.getUnprocessedOrders();

      expect(orders).toEqual([]);
    });
  });

  describe('getOrdersByStatus', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should return orders by success status', async () => {
      const mockOrders = [
        MockFactory.createDatabaseOrder({ success: true })
      ];

      mockDb.getOrdersByStatus.mockResolvedValue(mockOrders);

      const orders = await tracker.getOrdersByStatus(true);

      expect(orders).toEqual(mockOrders);
      expect(mockDb.getOrdersByStatus).toHaveBeenCalledWith(true);
    });

    it('should return failed orders', async () => {
      const mockOrders = [
        MockFactory.createDatabaseOrder({ success: false })
      ];

      mockDb.getOrdersByStatus.mockResolvedValue(mockOrders);

      const orders = await tracker.getOrdersByStatus(false);

      expect(orders).toEqual(mockOrders);
      expect(mockDb.getOrdersByStatus).toHaveBeenCalledWith(false);
    });
  });

  describe('getCurrentMonthOrders', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should return current month orders', async () => {
      const mockOrders = [
        MockFactory.createDatabaseOrder()
      ];

      mockDb.getCurrentMonthOrders.mockResolvedValue(mockOrders);

      const orders = await tracker.getCurrentMonthOrders();

      expect(orders).toEqual(mockOrders);
      expect(mockDb.getCurrentMonthOrders).toHaveBeenCalled();
    });
  });

  describe('getCurrentMonthStats', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should return current month statistics', async () => {
      const mockStats = {
        total_orders: 30,
        total_amount: 500000
      };

      mockDb.getCurrentMonthStats.mockResolvedValue(mockStats);

      const stats = await tracker.getCurrentMonthStats();

      expect(stats).toEqual(mockStats);
      expect(mockDb.getCurrentMonthStats).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should close database connection', async () => {
      await tracker.initialize();
      await tracker.close();

      expect(mockDb.close).toHaveBeenCalledTimes(1);
    });

    it('should handle close when database not initialized', async () => {
      const freshTracker = new DatabaseOrderTracker();

      // Should not throw
      await expect(freshTracker.close()).resolves.toBeUndefined();
    });
  });

  describe('integration scenarios', () => {
    it('should handle full workflow: insert -> filter -> save results', async () => {
      await tracker.initialize();

      // Step 1: Insert orders
      const orders = [
        MockFactory.createBinanceOrder({ orderNumber: 'new_1' }),
        MockFactory.createBinanceOrder({ orderNumber: 'new_2' })
      ];

      mockDb.insertOrder.mockResolvedValue(1);
      mockDb.getSuccessfullyProcessedOrders.mockResolvedValue([]);

      const count = await tracker.insertOrders(orders);
      expect(count).toBe(2);

      // Step 2: Filter orders
      const filtered = await tracker.filterNewOrders(orders);
      expect(filtered.newOrders).toHaveLength(2);

      // Step 3: Save results
      const results = [
        MockFactory.createAfipSuccessResponse(),
        MockFactory.createAfipSuccessResponse()
      ];
      mockDb.markOrderProcessed.mockResolvedValue();

      await tracker.saveResults(results, ['new_1', 'new_2']);
      expect(mockDb.markOrderProcessed).toHaveBeenCalledTimes(2);
    });
  });
});
