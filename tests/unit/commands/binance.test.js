const { testBinanceConnection, fetchBinanceOrders, fetchBinanceMonth } = require('../../../src/commands/binance');
const BinanceOrderFetcher = require('../../../scripts/fetchBinanceOrders');
const logger = require('../../../src/utils/logger');

// Mock dependencies
jest.mock('../../../scripts/fetchBinanceOrders');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/services/DirectInvoiceService');
jest.mock('../../../src/utils/DatabaseOrderTracker');

const DirectInvoiceService = require('../../../src/services/DirectInvoiceService');
const DatabaseOrderTracker = require('../../../src/utils/DatabaseOrderTracker');

describe('Binance Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('testBinanceConnection', () => {
    it('should warn when Binance credentials are missing', async () => {
      const mockBinanceService = {
        initialize: jest.fn(),
        testConnection: jest.fn()
      };
      const config = {
        binanceApiKey: '',
        binanceSecretKey: ''
      };

      await testBinanceConnection(mockBinanceService, config);

      expect(logger.warn).toHaveBeenCalledWith(
        'Binance API credentials not configured. Please set BINANCE_API_KEY and BINANCE_SECRET_KEY in your .env file',
        { event: 'binance_credentials_missing' }
      );
      expect(mockBinanceService.initialize).not.toHaveBeenCalled();
    });

    it('should test connection successfully with valid credentials', async () => {
      const mockBinanceService = {
        initialize: jest.fn(),
        testConnection: jest.fn().mockResolvedValue({ success: true })
      };
      const config = {
        binanceApiKey: 'test_key',
        binanceSecretKey: 'test_secret'
      };

      await testBinanceConnection(mockBinanceService, config);

      expect(mockBinanceService.initialize).toHaveBeenCalled();
      expect(mockBinanceService.testConnection).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Binance API connection successful - API Key configured correctly',
        { event: 'binance_connection_test_success' }
      );
    });

    it('should handle connection test failure', async () => {
      const mockBinanceService = {
        initialize: jest.fn(),
        testConnection: jest.fn().mockResolvedValue({
          success: false,
          error: 'API key invalid'
        })
      };
      const config = {
        binanceApiKey: 'test_key',
        binanceSecretKey: 'test_secret'
      };

      await testBinanceConnection(mockBinanceService, config);

      expect(logger.error).toHaveBeenCalledWith(
        'Binance API connection failed',
        { error: 'API key invalid', event: 'binance_connection_test_failed' }
      );
    });

    it('should handle connection test exception', async () => {
      const mockBinanceService = {
        initialize: jest.fn(),
        testConnection: jest.fn().mockRejectedValue(new Error('Network error'))
      };
      const config = {
        binanceApiKey: 'test_key',
        binanceSecretKey: 'test_secret'
      };

      await testBinanceConnection(mockBinanceService, config);

      expect(logger.error).toHaveBeenCalledWith(
        'Binance API test failed',
        { error: 'Network error', event: 'binance_test_exception' }
      );
    });
  });

  describe('fetchBinanceOrders', () => {
    let mockFetcherInstance;

    beforeEach(() => {
      mockFetcherInstance = {
        initialize: jest.fn().mockResolvedValue(),
        fetchToDatabase: jest.fn(),
        binanceService: {
          getCurrentMonthP2POrders: jest.fn()
        }
      };
      BinanceOrderFetcher.mockImplementation(() => mockFetcherInstance);
    });

    it('should fetch orders successfully without auto-processing', async () => {
      const mockBinanceService = {};
      mockFetcherInstance.fetchToDatabase.mockResolvedValue({
        success: true,
        ordersCount: 10,
        newOrdersCount: 3
      });

      const result = await fetchBinanceOrders(mockBinanceService, 7, 'SELL', false);

      expect(BinanceOrderFetcher).toHaveBeenCalled();
      expect(mockFetcherInstance.initialize).toHaveBeenCalled();
      expect(mockFetcherInstance.fetchToDatabase).toHaveBeenCalledWith({
        days: 7,
        tradeType: 'SELL'
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Successfully fetched Binance orders',
        { ordersCount: 10, newOrdersCount: 3, event: 'binance_fetch_success' }
      );
      expect(result.success).toBe(true);
    });

    it('should fetch and auto-process new orders when autoProcess is true', async () => {
      const mockBinanceService = {};
      const mockConfig = { test: 'config' };
      const mockAfipService = { test: 'afip' };

      mockFetcherInstance.fetchToDatabase.mockResolvedValue({
        success: true,
        ordersCount: 10,
        newOrdersCount: 5
      });

      // Mock DirectInvoiceService
      const mockDirectInvoiceService = {
        initialize: jest.fn().mockResolvedValue(),
        processUnprocessedOrders: jest.fn().mockResolvedValue({
          processed: 5,
          successful: 4,
          failed: 1
        }),
        close: jest.fn().mockResolvedValue()
      };
      DirectInvoiceService.mockImplementation(() => mockDirectInvoiceService);

      const result = await fetchBinanceOrders(
        mockBinanceService,
        7,
        'SELL',
        true,
        mockConfig,
        mockAfipService
      );

      // Verify fetching
      expect(mockFetcherInstance.fetchToDatabase).toHaveBeenCalled();

      // Verify auto-processing was triggered
      expect(DirectInvoiceService).toHaveBeenCalledWith(mockConfig, mockAfipService);
      expect(mockDirectInvoiceService.initialize).toHaveBeenCalled();
      expect(mockDirectInvoiceService.processUnprocessedOrders).toHaveBeenCalled();
      expect(mockDirectInvoiceService.close).toHaveBeenCalled();

      // Verify logging
      expect(logger.info).toHaveBeenCalledWith(
        'Auto-processing new orders to AFIP invoices',
        { newOrdersCount: 5, event: 'auto_process_start' }
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Processing summary',
        { processed: 5, successful: 4, failed: 1, event: 'auto_process_complete' }
      );

      expect(result.success).toBe(true);
    });

    it('should not auto-process when there are no new orders', async () => {
      const mockBinanceService = {};
      mockFetcherInstance.fetchToDatabase.mockResolvedValue({
        success: true,
        ordersCount: 10,
        newOrdersCount: 0
      });

      await fetchBinanceOrders(mockBinanceService, 7, 'SELL', true);

      expect(DirectInvoiceService).not.toHaveBeenCalled();
    });

    it('should handle fetch failure', async () => {
      const mockBinanceService = {};
      mockFetcherInstance.fetchToDatabase.mockResolvedValue({
        success: false,
        error: 'API connection failed'
      });

      const result = await fetchBinanceOrders(mockBinanceService, 7, 'SELL', false);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to fetch orders',
        { error: 'API connection failed', event: 'binance_fetch_failed' }
      );
      expect(result.success).toBe(false);
    });

    it('should handle fetch exception', async () => {
      const mockBinanceService = {};
      mockFetcherInstance.initialize.mockRejectedValue(new Error('Connection timeout'));

      const result = await fetchBinanceOrders(mockBinanceService, 7, 'SELL', false);

      expect(logger.error).toHaveBeenCalledWith(
        'Binance fetch error',
        { error: 'Connection timeout', event: 'binance_fetch_exception' }
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');
    });

    it('should use default parameters', async () => {
      const mockBinanceService = {};
      mockFetcherInstance.fetchToDatabase.mockResolvedValue({
        success: true,
        ordersCount: 5,
        newOrdersCount: 0
      });

      await fetchBinanceOrders(mockBinanceService);

      expect(mockFetcherInstance.fetchToDatabase).toHaveBeenCalledWith({
        days: 7,
        tradeType: 'SELL'
      });
    });
  });

  describe('fetchBinanceMonth', () => {
    let mockFetcherInstance;
    let mockProcessOrders;

    beforeEach(() => {
      mockProcessOrders = jest.fn().mockResolvedValue();

      mockFetcherInstance = {
        initialize: jest.fn().mockResolvedValue(),
        binanceService: {
          getCurrentMonthP2POrders: jest.fn(),
          convertP2POrderToInternalFormat: jest.fn()
        }
      };
      BinanceOrderFetcher.mockImplementation(() => mockFetcherInstance);
    });

    it('should fetch current month orders and process them', async () => {
      const mockOrders = [
        { orderNumber: '123', amount: '100', tradeType: 'SELL' },
        { orderNumber: '456', amount: '200', tradeType: 'SELL' }
      ];

      mockFetcherInstance.binanceService.getCurrentMonthP2POrders.mockResolvedValue({
        data: mockOrders
      });

      mockFetcherInstance.binanceService.convertP2POrderToInternalFormat
        .mockImplementation(order => ({ ...order, converted: true }));

      // Mock DatabaseOrderTracker
      const mockDbTracker = {
        initialize: jest.fn().mockResolvedValue(),
        insertOrders: jest.fn().mockResolvedValue(2),
        close: jest.fn().mockResolvedValue()
      };
      DatabaseOrderTracker.mockImplementation(() => mockDbTracker);

      await fetchBinanceMonth('SELL', mockProcessOrders);

      expect(mockFetcherInstance.initialize).toHaveBeenCalled();
      expect(mockFetcherInstance.binanceService.getCurrentMonthP2POrders)
        .toHaveBeenCalledWith('SELL');
      expect(mockDbTracker.initialize).toHaveBeenCalled();
      expect(mockDbTracker.insertOrders).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ converted: true })
        ])
      );
      expect(mockProcessOrders).toHaveBeenCalled();
      expect(mockDbTracker.close).toHaveBeenCalled();

      expect(logger.info).toHaveBeenCalledWith(
        'Fetched current month orders',
        { totalOrders: 2, newOrdersStored: 2, event: 'binance_month_fetch_success' }
      );
    });

    it('should not process orders when no new orders are inserted', async () => {
      const mockOrders = [
        { orderNumber: '123', amount: '100', tradeType: 'SELL' }
      ];

      mockFetcherInstance.binanceService.getCurrentMonthP2POrders.mockResolvedValue({
        data: mockOrders
      });

      mockFetcherInstance.binanceService.convertP2POrderToInternalFormat
        .mockImplementation(order => order);

      const mockDbTracker = {
        initialize: jest.fn().mockResolvedValue(),
        insertOrders: jest.fn().mockResolvedValue(0), // No new orders
        close: jest.fn().mockResolvedValue()
      };
      DatabaseOrderTracker.mockImplementation(() => mockDbTracker);

      await fetchBinanceMonth('SELL', mockProcessOrders);

      expect(mockProcessOrders).not.toHaveBeenCalled();
    });

    it('should handle empty response from Binance', async () => {
      mockFetcherInstance.binanceService.getCurrentMonthP2POrders.mockResolvedValue({
        data: []
      });

      await fetchBinanceMonth('SELL', mockProcessOrders);

      expect(logger.info).toHaveBeenCalledWith(
        'No orders found for current month',
        { event: 'binance_month_no_orders' }
      );
      expect(mockProcessOrders).not.toHaveBeenCalled();
    });

    it('should handle null response from Binance', async () => {
      mockFetcherInstance.binanceService.getCurrentMonthP2POrders.mockResolvedValue({
        data: null
      });

      await fetchBinanceMonth('SELL', mockProcessOrders);

      expect(logger.info).toHaveBeenCalledWith(
        'No orders found for current month',
        { event: 'binance_month_no_orders' }
      );
    });

    it('should handle fetch failure', async () => {
      mockFetcherInstance.binanceService.getCurrentMonthP2POrders
        .mockRejectedValue(new Error('API error'));

      await fetchBinanceMonth('SELL', mockProcessOrders);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to fetch current month orders',
        { error: 'API error', event: 'binance_month_fetch_failed' }
      );
      expect(mockProcessOrders).not.toHaveBeenCalled();
    });

    it('should close database connection even on error', async () => {
      const mockOrders = [{ orderNumber: '123', amount: '100' }];

      mockFetcherInstance.binanceService.getCurrentMonthP2POrders.mockResolvedValue({
        data: mockOrders
      });

      mockFetcherInstance.binanceService.convertP2POrderToInternalFormat
        .mockImplementation(order => order);

      const mockDbTracker = {
        initialize: jest.fn().mockResolvedValue(),
        insertOrders: jest.fn().mockRejectedValue(new Error('DB error')),
        close: jest.fn().mockResolvedValue()
      };
      DatabaseOrderTracker.mockImplementation(() => mockDbTracker);

      await fetchBinanceMonth('SELL', mockProcessOrders);

      expect(mockDbTracker.close).toHaveBeenCalled();
    });
  });
});
