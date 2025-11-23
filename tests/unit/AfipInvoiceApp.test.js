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
jest.mock('../../src/shared/validation/validators');
jest.mock('fs');

const AfipInvoiceApp = require('../../src/AfipInvoiceApp');
const config = require('../../src/config');
const AfipService = require('../../src/services/AfipService');
const BinanceService = require('../../src/services/BinanceService');
const { ConfigValidator } = require('../../src/shared/validation/validators');
const fs = require('fs');

describe('AfipInvoiceApp', () => {
  let app;
  let mockAfipService;
  let mockBinanceService;

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
});
