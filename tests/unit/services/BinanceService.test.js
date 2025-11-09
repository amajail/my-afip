const BinanceService = require('../../../src/services/BinanceService');
const nock = require('nock');

// Mock validators
jest.mock('../../../src/utils/validators', () => ({
  ConfigValidator: {
    validateBinanceConfig: jest.fn(() => ({ valid: true, errors: [] }))
  },
  DateValidator: {
    validateOrThrow: jest.fn(),
    validate: jest.fn(() => ({ valid: true, errors: [] }))
  }
}));

const { ConfigValidator, DateValidator } = require('../../../src/utils/validators');

describe('BinanceService', () => {
  let service;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    ConfigValidator.validateBinanceConfig.mockReturnValue({ valid: true, errors: [] });
    DateValidator.validateOrThrow.mockImplementation(() => {});
    DateValidator.validate.mockReturnValue({ valid: true, errors: [] });

    // Clean up any existing nock interceptors
    nock.cleanAll();

    service = new BinanceService({
      apiKey: 'test_api_key',
      secretKey: 'test_secret_key'
    });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('initialization', () => {
    it('should initialize with API credentials', () => {
      expect(service.apiKey).toBe('test_api_key');
      expect(service.secretKey).toBe('test_secret_key');
      expect(service.baseURL).toBe('https://api.binance.com');
      expect(service.initialized).toBe(false);
    });

    it('should initialize successfully with valid config', () => {
      service.initialize();
      expect(service.initialized).toBe(true);
      expect(ConfigValidator.validateBinanceConfig).toHaveBeenCalledWith({
        apiKey: 'test_api_key',
        secretKey: 'test_secret_key'
      });
    });

    it('should throw error with invalid config', () => {
      ConfigValidator.validateBinanceConfig.mockReturnValue({
        valid: false,
        errors: ['apiKey is required'],
        missingKeys: ['apiKey']
      });

      expect(() => {
        service.initialize();
      }).toThrow('apiKey is required');
    });
  });

  describe('signature creation', () => {
    it('should create valid HMAC SHA256 signature', () => {
      const queryString = 'symbol=BTCUSDT&timestamp=1234567890';
      const signature = service.createSignature(queryString);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(64); // SHA256 hex = 64 chars
    });

    it('should create consistent signatures for same input', () => {
      const queryString = 'symbol=BTCUSDT&timestamp=1234567890';
      const sig1 = service.createSignature(queryString);
      const sig2 = service.createSignature(queryString);

      expect(sig1).toBe(sig2);
    });

    it('should create different signatures for different inputs', () => {
      const sig1 = service.createSignature('symbol=BTCUSDT');
      const sig2 = service.createSignature('symbol=ETHUSDT');

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('query string building', () => {
    it('should build query string from parameters', () => {
      const params = { symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT' };
      const queryString = service.buildQueryString(params);

      expect(queryString).toContain('symbol=BTCUSDT');
      expect(queryString).toContain('side=BUY');
      expect(queryString).toContain('type=LIMIT');
    });

    it('should URL encode parameter values', () => {
      const params = { message: 'hello world' };
      const queryString = service.buildQueryString(params);

      expect(queryString).toBe('message=hello%20world');
    });

    it('should handle empty parameters', () => {
      const queryString = service.buildQueryString({});
      expect(queryString).toBe('');
    });
  });

  describe('testConnection', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should successfully test API connection', async () => {
      nock('https://api.binance.com')
        .get('/sapi/v1/account/status')
        .query(true)
        .reply(200, { data: 'Normal' });

      const result = await service.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Connected to Binance API successfully');
    });

    it('should handle authentication errors', async () => {
      nock('https://api.binance.com')
        .get('/sapi/v1/account/status')
        .query(true)
        .reply(401, {
          code: -2014,
          msg: 'API-key format invalid.'
        });

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('API-key format invalid');
    });

    it('should handle network errors', async () => {
      nock('https://api.binance.com')
        .get('/sapi/v1/account/status')
        .query(true)
        .replyWithError('Network timeout');

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle rate limit errors', async () => {
      nock('https://api.binance.com')
        .get('/sapi/v1/account/status')
        .query(true)
        .reply(429, {
          code: -1003,
          msg: 'Too much request weight used'
        });

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('rate limit');
    });
  });

  describe('getRecentP2POrders', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should fetch recent P2P orders successfully', async () => {
      const mockOrders = [
        {
          orderNumber: '12345678901234567890',
          tradeType: 'SELL',
          asset: 'USDT',
          fiat: 'ARS',
          amount: '100.00',
          totalPrice: '120000.00',
          createTime: Date.now()
        }
      ];

      nock('https://api.binance.com')
        .get('/sapi/v1/c2c/orderMatch/listUserOrderHistory')
        .query(true)
        .reply(200, {
          code: '000000',
          data: mockOrders,
          success: true
        });

      const result = await service.getRecentP2POrders('SELL', 7);

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].orderNumber).toBe('12345678901234567890');
    });

    it('should handle empty results', async () => {
      nock('https://api.binance.com')
        .get('/sapi/v1/c2c/orderMatch/listUserOrderHistory')
        .query(true)
        .reply(200, {
          code: '000000',
          data: [],
          success: true
        });

      const result = await service.getRecentP2POrders('SELL', 7);

      expect(result.data).toHaveLength(0);
    });

    it('should throw on API errors', async () => {
      nock('https://api.binance.com')
        .get('/sapi/v1/c2c/orderMatch/listUserOrderHistory')
        .query(true)
        .reply(400, {
          code: '-1000',
          msg: 'Invalid parameters'
        });

      await expect(service.getRecentP2POrders('SELL', 7)).rejects.toThrow();
    });

    it('should use correct default parameters', async () => {
      let capturedQuery;

      nock('https://api.binance.com')
        .get('/sapi/v1/c2c/orderMatch/listUserOrderHistory')
        .query((query) => {
          capturedQuery = query;
          return true;
        })
        .reply(200, { code: '000000', data: [], success: true });

      await service.getRecentP2POrders();

      expect(capturedQuery).toHaveProperty('tradeType');
      expect(capturedQuery).toHaveProperty('timestamp');
      expect(capturedQuery).toHaveProperty('signature');
    });
  });

  describe('getP2POrdersByDateRange', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should fetch orders for specific date range', async () => {
      const startDate = '2025-09-01';
      const endDate = '2025-09-10';

      nock('https://api.binance.com')
        .get('/sapi/v1/c2c/orderMatch/listUserOrderHistory')
        .query(true)
        .reply(200, {
          code: '000000',
          data: [{ orderNumber: '123' }],
          success: true
        });

      const result = await service.getP2POrdersByDateRange(startDate, endDate, 'SELL');

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(DateValidator.validateOrThrow).toHaveBeenCalledTimes(2);
    });

    it('should validate date format', async () => {
      DateValidator.validateOrThrow.mockImplementation((date) => {
        if (date === 'invalid-date') {
          throw new Error('Invalid date format');
        }
      });

      await expect(
        service.getP2POrdersByDateRange('invalid-date', '2025-09-10', 'SELL')
      ).rejects.toThrow('Invalid date format');
    });

    it('should validate date range order', async () => {
      await expect(
        service.getP2POrdersByDateRange('2025-09-10', '2025-09-01', 'SELL')
      ).rejects.toThrow('startDate cannot be after endDate');
    });

    it('should reject date ranges exceeding 30 days', async () => {
      const startDate = '2025-01-01';
      const endDate = '2025-03-01'; // More than 30 days

      await expect(
        service.getP2POrdersByDateRange(startDate, endDate, 'SELL')
      ).rejects.toThrow('Date range cannot exceed 30 days');
    });
  });

  describe('getCurrentMonthP2POrders', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should fetch current month orders', async () => {
      nock('https://api.binance.com')
        .get('/sapi/v1/c2c/orderMatch/listUserOrderHistory')
        .query(true)
        .reply(200, {
          code: '000000',
          data: [{ orderNumber: '456' }],
          success: true
        });

      const result = await service.getCurrentMonthP2POrders('SELL');

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
    });

    it('should use correct date range for current month', async () => {
      let capturedQuery;

      nock('https://api.binance.com')
        .get('/sapi/v1/c2c/orderMatch/listUserOrderHistory')
        .query((query) => {
          capturedQuery = query;
          return true;
        })
        .reply(200, { code: '000000', data: [], success: true });

      await service.getCurrentMonthP2POrders('SELL');

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Verify timestamp is around the start of the month
      const startTime = parseInt(capturedQuery.startTimestamp);
      expect(startTime).toBeGreaterThanOrEqual(startOfMonth.getTime() - 1000);
    });
  });

  describe('convertP2POrderToInternalFormat', () => {
    it('should convert Binance order to internal format', () => {
      const binanceOrder = {
        orderNumber: '12345678901234567890',
        tradeType: 'SELL',
        asset: 'USDT',
        fiat: 'ARS',
        amount: '100.50',
        totalPrice: '120600.00',
        createTime: 1695648000000,
        buyerNickname: 'buyer_test',
        sellerNickname: 'seller_test',
        orderStatus: 'COMPLETED'
      };

      const result = service.convertP2POrderToInternalFormat(binanceOrder);

      expect(result.orderNumber).toBe('12345678901234567890');
      expect(result.tradeType).toBe('SELL');
      expect(result.asset).toBe('USDT');
      expect(result.fiat).toBe('ARS');
      expect(result.amount).toBe('100.50');
      expect(result.totalPrice).toBe('120600.00');
      expect(parseFloat(result.price)).toBeCloseTo(1200, 0);
      expect(result.origin).toBe('BINANCE_API');
    });

    it('should calculate price correctly', () => {
      const binanceOrder = {
        orderNumber: '123',
        tradeType: 'SELL',
        asset: 'USDT',
        fiat: 'ARS',
        amount: '50',
        totalPrice: '60000'
      };

      const result = service.convertP2POrderToInternalFormat(binanceOrder);

      expect(parseFloat(result.price)).toBe(1200.00);
    });

    it('should handle missing optional fields', () => {
      const binanceOrder = {
        orderNumber: '789',
        tradeType: 'BUY',
        asset: 'USDT',
        fiat: 'ARS',
        amount: '100',
        totalPrice: '120000'
      };

      const result = service.convertP2POrderToInternalFormat(binanceOrder);

      expect(result.advNo).toBe('789'); // Falls back to orderNumber
      expect(result.fiatSymbol).toBe('$'); // Default value
      expect(result.payMethods).toEqual([]); // Default empty array
    });
  });

  describe('makeAuthenticatedRequest', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should throw error if not initialized', async () => {
      const uninitializedService = new BinanceService({
        apiKey: 'test_api_key',
        secretKey: 'test_secret_key'
      });

      await expect(
        uninitializedService.makeAuthenticatedRequest('/test')
      ).rejects.toThrow('Binance service not initialized');
    });

    it('should add timestamp to parameters', async () => {
      let capturedQuery;

      nock('https://api.binance.com')
        .get('/test')
        .query((query) => {
          capturedQuery = query;
          return true;
        })
        .reply(200, { success: true });

      await service.makeAuthenticatedRequest('/test', { symbol: 'BTCUSDT' });

      expect(capturedQuery).toHaveProperty('timestamp');
      expect(capturedQuery).toHaveProperty('signature');
      expect(capturedQuery.symbol).toBe('BTCUSDT');
    });

    it('should include API key in headers', async () => {
      let capturedHeaders;

      nock('https://api.binance.com')
        .get('/test')
        .query(true)
        .reply(function() {
          capturedHeaders = this.req.headers;
          return [200, { success: true }];
        });

      await service.makeAuthenticatedRequest('/test');

      expect(capturedHeaders['x-mbx-apikey']).toBe('test_api_key');
    });

    it('should handle connection timeouts', async () => {
      nock('https://api.binance.com')
        .get('/test')
        .query(true)
        .delay(15000) // Longer than 10s timeout
        .reply(200, {});

      await expect(
        service.makeAuthenticatedRequest('/test')
      ).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should handle rate limit errors with retry-after', async () => {
      nock('https://api.binance.com')
        .get('/test')
        .query(true)
        .reply(429, { msg: 'Rate limit exceeded' }, { 'retry-after': '120' });

      await expect(
        service.makeAuthenticatedRequest('/test')
      ).rejects.toThrow('rate limit');
    });

    it('should handle authentication failures', async () => {
      nock('https://api.binance.com')
        .get('/test')
        .query(true)
        .reply(401, { msg: 'Invalid API key' });

      await expect(
        service.makeAuthenticatedRequest('/test')
      ).rejects.toThrow('authentication failed');
    });

    it('should handle general API errors', async () => {
      nock('https://api.binance.com')
        .get('/test')
        .query(true)
        .reply(500, { msg: 'Internal server error' });

      await expect(
        service.makeAuthenticatedRequest('/test')
      ).rejects.toThrow('Internal server error');
    });

    it('should handle network errors', async () => {
      nock('https://api.binance.com')
        .get('/test')
        .query(true)
        .replyWithError('Connection refused');

      await expect(
        service.makeAuthenticatedRequest('/test')
      ).rejects.toThrow();
    });
  });
});
