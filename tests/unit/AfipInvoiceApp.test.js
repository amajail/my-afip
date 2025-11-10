// Mock all dependencies BEFORE imports
jest.mock('sqlite3', () => ({
  verbose: jest.fn(() => ({
    Database: jest.fn()
  }))
}));
jest.mock('facturajs', () => ({
  AfipServices: jest.fn()
}));
jest.mock('../../src/config', () => ({
  afip: {
    cuit: '20123456789',
    certPath: '/path/to/cert.crt',
    keyPath: '/path/to/key.key',
    environment: 'production'
  },
  app: {
    invoiceInputPath: './input/invoices.csv',
    invoiceOutputPath: './output/invoices.json'
  },
  binance: {
    apiKey: 'test_api_key',
    secretKey: 'test_secret_key'
  }
}));
jest.mock('../../src/services/AfipService');
jest.mock('../../src/services/BinanceService');
jest.mock('../../src/services/DirectInvoiceService');
jest.mock('../../src/database/Database');
jest.mock('../../src/utils/DatabaseOrderTracker');
jest.mock('../../src/utils/validators');
jest.mock('../../src/commands/binance');
jest.mock('../../src/commands/report');
jest.mock('fs');

const AfipInvoiceApp = require('../../src/AfipInvoiceApp');
const config = require('../../src/config');
const AfipService = require('../../src/services/AfipService');
const BinanceService = require('../../src/services/BinanceService');
const DirectInvoiceService = require('../../src/services/DirectInvoiceService');
const { ConfigValidator } = require('../../src/utils/validators');
const { testBinanceConnection, fetchBinanceOrders, fetchBinanceMonth } = require('../../src/commands/binance');
const { showCurrentMonthReport } = require('../../src/commands/report');
const fs = require('fs');

describe('AfipInvoiceApp', () => {
  let app;
  let mockAfipService;
  let mockBinanceService;
  let mockDirectInvoiceService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock AfipService
    mockAfipService = {
      initialize: jest.fn().mockResolvedValue(),
      createInvoice: jest.fn()
    };
    AfipService.mockImplementation(() => mockAfipService);

    // Mock BinanceService
    mockBinanceService = {
      initialize: jest.fn(),
      testConnection: jest.fn()
    };
    BinanceService.mockImplementation(() => mockBinanceService);

    // Mock DirectInvoiceService
    mockDirectInvoiceService = {
      initialize: jest.fn().mockResolvedValue(),
      processUnprocessedOrders: jest.fn().mockResolvedValue({
        processed: 5,
        successful: 4,
        failed: 1
      }),
      close: jest.fn().mockResolvedValue()
    };
    DirectInvoiceService.mockImplementation(() => mockDirectInvoiceService);

    // Mock validators
    ConfigValidator.validateStartupOrThrow = jest.fn();

    // Mock fs
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.mkdirSync = jest.fn();

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Create app instance
    app = new AfipInvoiceApp();
  });

  describe('constructor', () => {
    it('should initialize with configuration from config module', () => {
      expect(app.config).toEqual({
        cuit: '20123456789',
        certPath: '/path/to/cert.crt',
        keyPath: '/path/to/key.key',
        environment: 'production',
        inputPath: './input/invoices.csv',
        outputPath: './output/invoices.json',
        binanceApiKey: 'test_api_key',
        binanceSecretKey: 'test_secret_key'
      });
    });

    it('should create AfipService instance', () => {
      expect(AfipService).toHaveBeenCalledWith(app.config);
      expect(app.afipService).toBe(mockAfipService);
    });

    it('should create BinanceService instance with API credentials', () => {
      expect(BinanceService).toHaveBeenCalledWith({
        apiKey: 'test_api_key',
        secretKey: 'test_secret_key'
      });
      expect(app.binanceService).toBe(mockBinanceService);
    });
  });

  describe('initialize', () => {
    it('should validate configuration and initialize services', async () => {
      await app.initialize();

      expect(ConfigValidator.validateStartupOrThrow).toHaveBeenCalledWith(config);
      expect(mockAfipService.initialize).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('🚀 Starting AFIP Invoice Application...');
      expect(console.log).toHaveBeenCalledWith('🔍 Validating configuration...');
      expect(console.log).toHaveBeenCalledWith('✅ Configuration validated successfully');
      expect(console.log).toHaveBeenCalledWith('✅ Application initialized successfully');
    });

    it('should create output directory if it does not exist', async () => {
      fs.existsSync.mockReturnValue(false);

      await app.initialize();

      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
    });

    it('should not create directory if it already exists', async () => {
      fs.existsSync.mockReturnValue(true);

      await app.initialize();

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should throw error when configuration validation fails', async () => {
      const validationError = new Error('CUIT is required');
      ConfigValidator.validateStartupOrThrow.mockImplementation(() => {
        throw validationError;
      });

      await expect(app.initialize()).rejects.toThrow('CUIT is required');

      expect(console.error).toHaveBeenCalledWith('❌ Configuration validation failed:');
      expect(console.error).toHaveBeenCalledWith('CUIT is required');
      expect(mockAfipService.initialize).not.toHaveBeenCalled();
    });

    it('should handle AfipService initialization failure', async () => {
      mockAfipService.initialize.mockRejectedValue(new Error('AFIP connection failed'));

      await expect(app.initialize()).rejects.toThrow('AFIP connection failed');
    });
  });

  describe('testBinanceConnection', () => {
    it('should call testBinanceConnection command', async () => {
      testBinanceConnection.mockResolvedValue();

      await app.testBinanceConnection();

      expect(testBinanceConnection).toHaveBeenCalledWith(
        mockBinanceService,
        app.config
      );
    });

    it('should handle connection test errors', async () => {
      testBinanceConnection.mockRejectedValue(new Error('Connection failed'));

      await expect(app.testBinanceConnection()).rejects.toThrow('Connection failed');
    });
  });

  describe('fetchBinanceOrders', () => {
    it('should fetch orders with default parameters', async () => {
      fetchBinanceOrders.mockResolvedValue({
        success: true,
        ordersCount: 10,
        newOrdersCount: 3
      });

      const result = await app.fetchBinanceOrders();

      expect(fetchBinanceOrders).toHaveBeenCalledWith(
        mockBinanceService,
        7,
        'SELL',
        false,
        app.config,
        mockAfipService
      );
      expect(result.success).toBe(true);
    });

    it('should fetch orders with custom parameters', async () => {
      fetchBinanceOrders.mockResolvedValue({
        success: true,
        ordersCount: 15,
        newOrdersCount: 5
      });

      const result = await app.fetchBinanceOrders(30, 'BUY', true);

      expect(fetchBinanceOrders).toHaveBeenCalledWith(
        mockBinanceService,
        30,
        'BUY',
        true,
        app.config,
        mockAfipService
      );
      expect(result.newOrdersCount).toBe(5);
    });

    it('should return result from fetchBinanceOrders', async () => {
      const mockResult = {
        success: true,
        ordersCount: 20,
        newOrdersCount: 10
      };
      fetchBinanceOrders.mockResolvedValue(mockResult);

      const result = await app.fetchBinanceOrders(7, 'SELL', false);

      expect(result).toEqual(mockResult);
    });

    it('should handle fetch errors', async () => {
      fetchBinanceOrders.mockRejectedValue(new Error('API error'));

      await expect(app.fetchBinanceOrders()).rejects.toThrow('API error');
    });
  });

  describe('fetchBinanceMonth', () => {
    it('should fetch current month orders', async () => {
      fetchBinanceMonth.mockResolvedValue();

      await app.fetchBinanceMonth('SELL');

      expect(fetchBinanceMonth).toHaveBeenCalledWith(
        'SELL',
        expect.any(Function)
      );
    });

    it('should pass bound processOrders function to fetchBinanceMonth', async () => {
      let capturedProcessOrders;
      fetchBinanceMonth.mockImplementation((tradeType, processOrders) => {
        capturedProcessOrders = processOrders;
        return Promise.resolve();
      });

      await app.fetchBinanceMonth('BUY');

      // Verify processOrders was called as bound function
      expect(typeof capturedProcessOrders).toBe('function');

      // Call the captured function and verify it works
      await capturedProcessOrders();

      expect(DirectInvoiceService).toHaveBeenCalledWith(
        app.config,
        mockAfipService
      );
      expect(mockDirectInvoiceService.initialize).toHaveBeenCalled();
      expect(mockDirectInvoiceService.processUnprocessedOrders).toHaveBeenCalled();
      expect(mockDirectInvoiceService.close).toHaveBeenCalled();
    });

    it('should handle fetch month errors', async () => {
      fetchBinanceMonth.mockRejectedValue(new Error('Month fetch failed'));

      await expect(app.fetchBinanceMonth('SELL')).rejects.toThrow('Month fetch failed');
    });
  });

  describe('processOrders', () => {
    it('should process unprocessed orders using DirectInvoiceService', async () => {
      const result = await app.processOrders();

      expect(DirectInvoiceService).toHaveBeenCalledWith(
        app.config,
        mockAfipService
      );
      expect(mockDirectInvoiceService.initialize).toHaveBeenCalled();
      expect(mockDirectInvoiceService.processUnprocessedOrders).toHaveBeenCalled();
      expect(mockDirectInvoiceService.close).toHaveBeenCalled();
      expect(result).toEqual({
        processed: 5,
        successful: 4,
        failed: 1
      });
    });

    it('should return processing result', async () => {
      mockDirectInvoiceService.processUnprocessedOrders.mockResolvedValue({
        processed: 10,
        successful: 8,
        failed: 2
      });

      const result = await app.processOrders();

      expect(result.processed).toBe(10);
      expect(result.successful).toBe(8);
      expect(result.failed).toBe(2);
    });

    it('should throw error when processUnprocessedOrders fails', async () => {
      mockDirectInvoiceService.processUnprocessedOrders.mockRejectedValue(
        new Error('Processing failed')
      );

      await expect(app.processOrders()).rejects.toThrow('Processing failed');

      // Note: close() is not called on error in current implementation
      expect(mockDirectInvoiceService.close).not.toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockDirectInvoiceService.initialize.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(app.processOrders()).rejects.toThrow('Database connection failed');
    });
  });

  describe('showCurrentMonthReport', () => {
    it('should call showCurrentMonthReport command', async () => {
      showCurrentMonthReport.mockResolvedValue();

      await app.showCurrentMonthReport();

      expect(showCurrentMonthReport).toHaveBeenCalled();
    });

    it('should handle report generation errors', async () => {
      showCurrentMonthReport.mockRejectedValue(new Error('Report generation failed'));

      await expect(app.showCurrentMonthReport()).rejects.toThrow('Report generation failed');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow: initialize -> fetch -> process -> report', async () => {
      fetchBinanceOrders.mockResolvedValue({
        success: true,
        ordersCount: 5,
        newOrdersCount: 5
      });
      showCurrentMonthReport.mockResolvedValue();

      await app.initialize();
      const fetchResult = await app.fetchBinanceOrders(7, 'SELL', false);
      const processResult = await app.processOrders();
      await app.showCurrentMonthReport();

      expect(mockAfipService.initialize).toHaveBeenCalled();
      expect(fetchBinanceOrders).toHaveBeenCalled();
      expect(mockDirectInvoiceService.processUnprocessedOrders).toHaveBeenCalled();
      expect(showCurrentMonthReport).toHaveBeenCalled();

      expect(fetchResult.success).toBe(true);
      expect(processResult.processed).toBe(5);
    });

    it('should handle auto-process workflow: fetch with autoProcess=true', async () => {
      fetchBinanceOrders.mockResolvedValue({
        success: true,
        ordersCount: 10,
        newOrdersCount: 8
      });

      await app.initialize();
      await app.fetchBinanceOrders(7, 'SELL', true);

      // Auto-process is handled inside fetchBinanceOrders
      expect(fetchBinanceOrders).toHaveBeenCalledWith(
        mockBinanceService,
        7,
        'SELL',
        true,
        app.config,
        mockAfipService
      );
    });

    it('should handle errors gracefully in workflow', async () => {
      await app.initialize();

      fetchBinanceOrders.mockRejectedValue(new Error('Network error'));

      await expect(app.fetchBinanceOrders()).rejects.toThrow('Network error');

      // Should still be able to process orders independently
      const result = await app.processOrders();
      expect(result).toBeDefined();
    });
  });

  describe('configuration handling', () => {
    it('should use production environment configuration', () => {
      expect(app.config.environment).toBe('production');
    });

    it('should handle missing optional configuration', () => {
      config.binance = {
        apiKey: '',
        secretKey: ''
      };

      const appWithoutBinance = new AfipInvoiceApp();

      expect(appWithoutBinance.config.binanceApiKey).toBe('');
      expect(appWithoutBinance.config.binanceSecretKey).toBe('');
    });
  });
});
