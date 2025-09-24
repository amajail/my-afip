const DirectInvoiceService = require('../../../src/services/DirectInvoiceService');
const MockFactory = require('../../helpers/mock-factory');
const AssertionHelpers = require('../../helpers/assertion-helpers');

// Mock dependencies
jest.mock('../../../src/utils/DatabaseOrderTracker');
jest.mock('../../../src/services/AfipService');

describe('DirectInvoiceService', () => {
  let service;
  let mockDbTracker;
  let mockAfipService;

  beforeEach(() => {
    // Create fresh mocks for each test
    mockDbTracker = {
      initialize: jest.fn().mockResolvedValue(),
      getUnprocessedOrders: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(),
      db: {
        markOrderProcessed: jest.fn().mockResolvedValue()
      }
    };

    mockAfipService = MockFactory.mockAfipService();

    // Mock the require calls
    const DatabaseOrderTracker = require('../../../src/utils/DatabaseOrderTracker');
    const AfipService = require('../../../src/services/AfipService');

    DatabaseOrderTracker.mockImplementation(() => mockDbTracker);
    AfipService.mockImplementation(() => mockAfipService);

    service = new DirectInvoiceService({
      cuit: '20283536638',
      environment: 'testing'
    });
  });

  describe('calculateInvoiceDate', () => {
    it('should use actual order date when within 10 days', () => {
      // Test with 5 days ago
      const fiveDaysAgo = MockFactory.createDateDaysAgo(5);
      const result = service.calculateInvoiceDate(fiveDaysAgo);

      const expectedDate = new Date(parseInt(fiveDaysAgo)).toISOString().split('T')[0];
      expect(result).toBe(expectedDate);
      expect(result).toBeValidAfipDate();
    });

    it('should use actual order date when today', () => {
      const today = Date.now().toString();
      const result = service.calculateInvoiceDate(today);

      const expectedDate = new Date(parseInt(today)).toISOString().split('T')[0];
      expect(result).toBe(expectedDate);
      expect(result).toBeValidAfipDate();
    });

    it('should use 10-day limit for orders older than 10 days', () => {
      // Test with 15 days ago
      const fifteenDaysAgo = MockFactory.createDateDaysAgo(15);
      const result = service.calculateInvoiceDate(fifteenDaysAgo);

      const today = new Date();
      const tenDaysAgo = new Date(today);
      tenDaysAgo.setDate(today.getDate() - 10);
      const expectedDate = tenDaysAgo.toISOString().split('T')[0];

      expect(result).toBe(expectedDate);
      expect(result).toBeValidAfipDate();
    });

    it('should use 10-day limit for very old orders', () => {
      // Test with 30 days ago
      const thirtyDaysAgo = MockFactory.createDateDaysAgo(30);
      const result = service.calculateInvoiceDate(thirtyDaysAgo);

      const today = new Date();
      const tenDaysAgo = new Date(today);
      tenDaysAgo.setDate(today.getDate() - 10);
      const expectedDate = tenDaysAgo.toISOString().split('T')[0];

      expect(result).toBe(expectedDate);
      expect(result).toBeValidAfipDate();
    });

    it('should handle edge case of exactly 10 days ago', () => {
      const exactlyTenDaysAgo = MockFactory.createDateDaysAgo(10);
      const result = service.calculateInvoiceDate(exactlyTenDaysAgo);

      // Should use the actual date since it's exactly at the limit
      const expectedDate = new Date(parseInt(exactlyTenDaysAgo)).toISOString().split('T')[0];
      expect(result).toBe(expectedDate);
      expect(result).toBeValidAfipDate();
    });

    it('should handle invalid timestamp gracefully', () => {
      expect(() => {
        service.calculateInvoiceDate('invalid');
      }).not.toThrow();
    });
  });

  describe('convertOrderToInvoice', () => {
    it('should convert Binance order to Invoice format correctly', () => {
      const order = MockFactory.createBinanceOrder({
        total_price: '150000.50',
        create_time: MockFactory.createDateDaysAgo(3)
      });

      const invoice = service.convertOrderToInvoice(order);

      expect(invoice.docType).toBe(11); // Type C for monotributistas
      expect(invoice.concept).toBe(1); // Products
      expect(invoice.currency).toBe('PES');
      expect(invoice.exchange).toBe(1);
      expect(invoice.netAmount).toBe(150001); // Rounded
      expect(invoice.totalAmount).toBe(150001); // Rounded
      expect(invoice.vatAmount).toBe(0);
      expect(invoice.orderNumber).toBe(order.order_number);

      // Date should follow AFIP 10-day rule
      AssertionHelpers.expectDateWithinAfipLimit(invoice.docDate, order.create_time);
    });

    it('should handle decimal amounts properly', () => {
      const order = MockFactory.createBinanceOrder({
        total_price: '1234.56'
      });

      const invoice = service.convertOrderToInvoice(order);

      expect(invoice.netAmount).toBe(1235); // Rounded
      expect(invoice.totalAmount).toBe(1235); // Rounded
    });

    it('should preserve order reference', () => {
      const order = MockFactory.createBinanceOrder({
        order_number: 'test_12345'
      });

      const invoice = service.convertOrderToInvoice(order);

      expect(invoice.orderNumber).toBe('test_12345');
    });
  });

  describe('processUnprocessedOrders', () => {
    it('should return zero counts when no orders to process', async () => {
      mockDbTracker.getUnprocessedOrders.mockResolvedValue([]);

      const result = await service.processUnprocessedOrders();

      expect(result).toEqual({
        processed: 0,
        successful: 0,
        failed: 0
      });
    });

    it('should process orders successfully', async () => {
      const orders = [
        MockFactory.createDatabaseOrder({ order_number: 'order_1' }),
        MockFactory.createDatabaseOrder({ order_number: 'order_2' })
      ];

      mockDbTracker.getUnprocessedOrders.mockResolvedValue(orders);
      mockAfipService.createMultipleInvoices.mockResolvedValue([
        MockFactory.createAfipSuccessResponse({ voucherNumber: 21 }),
        MockFactory.createAfipSuccessResponse({ voucherNumber: 22 })
      ]);

      const result = await service.processUnprocessedOrders();

      expect(result.processed).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockAfipService.createMultipleInvoices).toHaveBeenCalledTimes(1);
      expect(mockDbTracker.db.markOrderProcessed).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed success and failure results', async () => {
      const orders = [
        MockFactory.createDatabaseOrder({ order_number: 'order_1' }),
        MockFactory.createDatabaseOrder({ order_number: 'order_2' })
      ];

      mockDbTracker.getUnprocessedOrders.mockResolvedValue(orders);
      mockAfipService.createMultipleInvoices.mockResolvedValue([
        MockFactory.createAfipSuccessResponse({ voucherNumber: 21 }),
        MockFactory.createAfipErrorResponse('AFIP error')
      ]);

      const result = await service.processUnprocessedOrders();

      expect(result.processed).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('should handle database errors gracefully', async () => {
      const orders = [MockFactory.createDatabaseOrder({ order_number: 'order_1' })];

      mockDbTracker.getUnprocessedOrders.mockResolvedValue(orders);
      mockAfipService.createMultipleInvoices.mockResolvedValue([
        MockFactory.createAfipSuccessResponse()
      ]);
      mockDbTracker.db.markOrderProcessed.mockRejectedValue(new Error('DB error'));

      const result = await service.processUnprocessedOrders();

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);
    });
  });

  describe('initialization', () => {
    it('should initialize dependencies correctly', async () => {
      await service.initialize();

      expect(mockDbTracker.initialize).toHaveBeenCalledTimes(1);
      expect(mockAfipService.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup', () => {
    it('should close database connection', async () => {
      await service.close();

      expect(mockDbTracker.close).toHaveBeenCalledTimes(1);
    });
  });
});