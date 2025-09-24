const BinanceService = require('../../../src/services/BinanceService');
const MockFactory = require('../../helpers/mock-factory');
const nock = require('nock');

describe('BinanceService', () => {
  let service;

  beforeEach(() => {
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
    });

    it('should throw error without API credentials', () => {
      expect(() => {
        new BinanceService({});
      }).toThrow();
    });
  });

  describe('testConnection', () => {
    it('should successfully test API connection', async () => {
      // Mock Binance API response for account status
      nock('https://api.binance.com')
        .get('/api/v3/account')
        .query(true) // Accept any query parameters
        .reply(200, {
          accountType: 'SPOT',
          balances: []
        });

      const result = await service.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Connection successful');
    });

    it('should handle invalid API credentials', async () => {
      nock('https://api.binance.com')
        .get('/api/v3/account')
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
        .get('/api/v3/account')
        .query(true)
        .replyWithError('Network timeout');

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });
  });

  describe('fetchOrders', () => {
    it('should fetch P2P orders successfully', async () => {
      const mockOrders = [
        {
          orderNumber: '12345678901234567890',
          advNo: 'adv123',
          tradeType: 'SELL',
          asset: 'USDT',
          fiat: 'ARS',
          fiatSymbol: '$',
          amount: '100.00',
          totalPrice: '120000.00',
          unitPrice: '1200.00',
          createTime: Date.now(),
          buyerNickname: 'buyer123',
          sellerNickname: 'seller456'
        }
      ];

      nock('https://p2p.binance.com')
        .post('/bapi/c2c/v2/friendly/c2c/portal/wallet/search')
        .reply(200, {
          code: '000000',
          data: mockOrders,
          success: true
        });

      const result = await service.fetchOrders('SELL', 7);

      expect(result.success).toBe(true);
      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].orderNumber).toBe('12345678901234567890');
    });

    it('should handle empty results', async () => {
      nock('https://p2p.binance.com')
        .post('/bapi/c2c/v2/friendly/c2c/portal/wallet/search')
        .reply(200, {
          code: '000000',
          data: [],
          success: true
        });

      const result = await service.fetchOrders('SELL', 7);

      expect(result.success).toBe(true);
      expect(result.orders).toHaveLength(0);
    });

    it('should validate trade type parameter', async () => {
      await expect(service.fetchOrders('INVALID', 7)).rejects.toThrow('Invalid trade type');
    });

    it('should validate days parameter', async () => {
      await expect(service.fetchOrders('SELL', 0)).rejects.toThrow('Days must be positive');
      await expect(service.fetchOrders('SELL', 100)).rejects.toThrow('Days cannot exceed 30');
    });

    it('should handle API rate limits', async () => {
      nock('https://p2p.binance.com')
        .post('/bapi/c2c/v2/friendly/c2c/portal/wallet/search')
        .reply(429, {
          code: '-1003',
          msg: 'Too much request weight used'
        });

      const result = await service.fetchOrders('SELL', 7);

      expect(result.success).toBe(false);
      expect(result.error).toContain('rate limit');
    });

    it('should handle Binance API errors', async () => {
      nock('https://p2p.binance.com')
        .post('/bapi/c2c/v2/friendly/c2c/portal/wallet/search')
        .reply(400, {
          code: '-1000',
          msg: 'Invalid parameters'
        });

      const result = await service.fetchOrders('SELL', 7);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid parameters');
    });
  });

  describe('fetchOrdersForPeriod', () => {
    it('should fetch orders for specific date range', async () => {
      const startDate = '2025-09-01';
      const endDate = '2025-09-10';

      nock('https://p2p.binance.com')
        .post('/bapi/c2c/v2/friendly/c2c/portal/wallet/search')
        .reply(200, {
          code: '000000',
          data: [MockFactory.createBinanceOrder()],
          success: true
        });

      const result = await service.fetchOrdersForPeriod(startDate, endDate, 'SELL');

      expect(result.success).toBe(true);
      expect(result.orders).toHaveLength(1);
    });

    it('should validate date format', async () => {
      await expect(
        service.fetchOrdersForPeriod('invalid-date', '2025-09-10', 'SELL')
      ).rejects.toThrow('Invalid date format');
    });

    it('should validate date range logic', async () => {
      await expect(
        service.fetchOrdersForPeriod('2025-09-10', '2025-09-01', 'SELL')
      ).rejects.toThrow('Start date must be before end date');
    });
  });

  describe('request signing', () => {
    it('should generate proper API signature', () => {
      const params = { symbol: 'BTCUSDT', timestamp: 1234567890 };
      const signature = service.generateSignature(params);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should include timestamp in requests', () => {
      const params = service.addTimestamp({ symbol: 'BTCUSDT' });

      expect(params.timestamp).toBeDefined();
      expect(params.timestamp).toBeCloseTo(Date.now(), -1000); // Within 1 second
    });
  });

  describe('error handling', () => {
    it('should handle connection timeouts', async () => {
      nock('https://p2p.binance.com')
        .post('/bapi/c2c/v2/friendly/c2c/portal/wallet/search')
        .delay(35000) // Longer than timeout
        .reply(200, {});

      const result = await service.fetchOrders('SELL', 7);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should handle malformed JSON responses', async () => {
      nock('https://p2p.binance.com')
        .post('/bapi/c2c/v2/friendly/c2c/portal/wallet/search')
        .reply(200, 'invalid json response');

      const result = await service.fetchOrders('SELL', 7);

      expect(result.success).toBe(false);
      expect(result.error).toContain('parsing');
    });
  });

  describe('data transformation', () => {
    it('should normalize order data structure', async () => {
      const binanceOrder = {
        orderNumber: '12345678901234567890',
        tradeType: 'SELL',
        asset: 'USDT',
        fiat: 'ARS',
        amount: '100.50',
        totalPrice: '120675.25',
        unitPrice: '1200.75',
        createTime: 1695648000000, // Unix timestamp
        buyerNickname: 'buyer_test',
        sellerNickname: 'seller_test'
      };

      nock('https://p2p.binance.com')
        .post('/bapi/c2c/v2/friendly/c2c/portal/wallet/search')
        .reply(200, {
          code: '000000',
          data: [binanceOrder],
          success: true
        });

      const result = await service.fetchOrders('SELL', 7);

      const order = result.orders[0];
      expect(order.order_number).toBe('12345678901234567890');
      expect(order.trade_type).toBe('SELL');
      expect(order.asset).toBe('USDT');
      expect(order.fiat).toBe('ARS');
      expect(parseFloat(order.amount)).toBe(100.50);
      expect(parseFloat(order.total_price)).toBe(120675.25);
      expect(parseFloat(order.price)).toBe(1200.75);
    });
  });
});