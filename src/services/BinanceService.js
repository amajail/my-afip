const axios = require('axios');
const crypto = require('crypto');

class BinanceService {
  constructor(config) {
    this.config = config;
    this.baseURL = 'https://api.binance.com';
    this.initialized = false;
  }

  initialize() {
    if (!this.config.apiKey || !this.config.secretKey) {
      throw new Error('Binance API key and secret are required');
    }
    this.initialized = true;
    console.log('📡 Binance API service initialized');
  }

  // Create HMAC SHA256 signature for authenticated requests
  createSignature(queryString) {
    return crypto
      .createHmac('sha256', this.config.secretKey)
      .update(queryString)
      .digest('hex');
  }

  // Build query string from parameters
  buildQueryString(params) {
    return Object.keys(params)
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');
  }

  // Make authenticated API request
  async makeAuthenticatedRequest(endpoint, params = {}) {
    if (!this.initialized) {
      throw new Error('Binance service not initialized');
    }

    // Add timestamp for signature
    params.timestamp = Date.now();

    const queryString = this.buildQueryString(params);
    const signature = this.createSignature(queryString);

    const url = `${this.baseURL}${endpoint}?${queryString}&signature=${signature}`;

    try {
      const response = await axios.get(url, {
        headers: {
          'X-MBX-APIKEY': this.config.apiKey
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Binance API Error: ${error.response.status} - ${error.response.data.msg || error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Binance API Error: No response received');
      } else {
        throw new Error(`Binance API Error: ${error.message}`);
      }
    }
  }

  // Get P2P trading order history
  async getP2POrderHistory(options = {}) {
    const {
      tradeType = 'SELL', // 'BUY' or 'SELL'
      startTime = null,
      endTime = null,
      page = 1,
      rows = 100
    } = options;

    console.log(`📊 Fetching P2P order history (${tradeType})...`);

    const params = {
      tradeType,
      page,
      rows
    };

    // Add time filters if provided
    if (startTime) {
      params.startTimestamp = startTime;
    }
    if (endTime) {
      params.endTimestamp = endTime;
    }

    try {
      const response = await this.makeAuthenticatedRequest('/sapi/v1/c2c/orderMatch/listUserOrderHistory', params);

      console.log(`✓ Retrieved ${response.data?.length || 0} P2P orders`);
      return response;

    } catch (error) {
      console.error('Error fetching P2P order history:', error.message);
      throw error;
    }
  }

  // Get recent P2P orders (last 7 days by default)
  async getRecentP2POrders(tradeType = 'SELL', days = 7) {
    const endTime = Date.now();
    const startTime = endTime - (days * 24 * 60 * 60 * 1000); // days ago

    return await this.getP2POrderHistory({
      tradeType,
      startTime,
      endTime,
      rows: 100
    });
  }

  // Get P2P orders for a specific date range
  async getP2POrdersByDateRange(startDate, endDate, tradeType = 'SELL') {
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();

    if (endTime - startTime > 30 * 24 * 60 * 60 * 1000) {
      throw new Error('Date range cannot exceed 30 days');
    }

    return await this.getP2POrderHistory({
      tradeType,
      startTime,
      endTime,
      rows: 100
    });
  }

  // Get current month P2P orders
  async getCurrentMonthP2POrders(tradeType = 'SELL') {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    console.log(`📅 Fetching ${tradeType} orders for ${startOfMonth.toLocaleDateString()} to ${endOfMonth.toLocaleDateString()}`);

    const startTime = startOfMonth.getTime();
    const endTime = endOfMonth.getTime();

    return await this.getP2POrderHistory({
      tradeType,
      startTime,
      endTime,
      rows: 100
    });
  }

  // Convert Binance P2P order format to our internal format
  convertP2POrderToInternalFormat(binanceOrder) {
    // Calculate price per unit from totalPrice / amount
    const price = binanceOrder.totalPrice && binanceOrder.amount
      ? (parseFloat(binanceOrder.totalPrice) / parseFloat(binanceOrder.amount)).toFixed(2)
      : null;

    return {
      orderNumber: binanceOrder.orderNumber,
      advNo: binanceOrder.advNo || binanceOrder.orderNumber,
      tradeType: binanceOrder.tradeType,
      asset: binanceOrder.asset,
      fiat: binanceOrder.fiat,
      fiatSymbol: binanceOrder.fiatSymbol || '$',
      amount: binanceOrder.amount,
      price: price,
      totalPrice: binanceOrder.totalPrice,
      orderStatus: binanceOrder.orderStatus,
      createTime: binanceOrder.createTime,
      buyerNickname: binanceOrder.buyerNickname,
      sellerNickname: binanceOrder.sellerNickname,
      // Map other fields as needed
      currencyTicketSize: "0.01",
      assetTicketSize: "0.01",
      priceTicketSize: "0.01",
      payMethods: binanceOrder.payMethods || [],
      classify: "profession",
      origin: "BINANCE_API"
    };
  }

  // Test API connection
  async testConnection() {
    try {
      console.log('🔍 Testing Binance API connection...');

      // Test with a simple request to get account info (requires less permissions)
      const response = await this.makeAuthenticatedRequest('/sapi/v1/account/status');

      console.log('✅ Binance API connection successful');
      return {
        success: true,
        message: 'Connected to Binance API successfully',
        accountStatus: response
      };
    } catch (error) {
      console.error('❌ Binance API connection failed:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Failed to connect to Binance API'
      };
    }
  }
}

module.exports = BinanceService;