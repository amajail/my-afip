const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const {
  BinanceError,
  BinanceAuthenticationError,
  BinanceConnectionError,
  BinanceRateLimitError,
  ConfigurationError,
  ErrorHandler
} = require('../utils/errors');
const { ConfigValidator, DateValidator } = require('../utils/validators');

class BinanceService {
  constructor(config) {
    this.config = config;
    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
    this.baseURL = 'https://api.binance.com';
    this.initialized = false;
  }

  initialize() {
    // Validate Binance configuration
    const validation = ConfigValidator.validateBinanceConfig(this.config);
    if (!validation.valid) {
      throw new ConfigurationError(
        validation.errors.join('; '),
        validation.missingKeys
      );
    }

    this.initialized = true;
    logger.info('Binance API service initialized', {
      event: 'binance_initialized'
    });
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
      throw new BinanceError('Binance service not initialized', 'BINANCE_NOT_INITIALIZED');
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
      // Handle different types of errors
      if (error.response) {
        const status = error.response.status;
        const errorMsg = error.response.data?.msg || error.response.statusText;

        // Rate limit error (HTTP 429)
        if (status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 60;
          throw new BinanceRateLimitError(
            `Binance API rate limit exceeded: ${errorMsg}`,
            parseInt(retryAfter),
            { endpoint, status }
          );
        }

        // Authentication error (HTTP 401)
        if (status === 401) {
          throw new BinanceAuthenticationError(
            `Binance API authentication failed: ${errorMsg}`,
            { endpoint, status }
          );
        }

        // Other API errors
        throw new BinanceError(
          `Binance API Error (${status}): ${errorMsg}`,
          'BINANCE_API_ERROR',
          { endpoint, status, response: error.response.data }
        );
      } else if (error.request) {
        // Network error - no response received
        throw new BinanceConnectionError(
          'No response received from Binance API',
          { endpoint, error: error.code }
        );
      } else {
        // Other errors (setup, etc.)
        throw new BinanceError(
          `Binance API request failed: ${error.message}`,
          'BINANCE_REQUEST_ERROR',
          { endpoint }
        );
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

    logger.debug('Fetching P2P order history', {
      tradeType,
      page,
      rows,
      event: 'binance_p2p_fetch_start'
    });

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

      logger.info('Retrieved P2P orders', {
        count: response.data?.length || 0,
        tradeType,
        event: 'binance_p2p_fetch_success'
      });
      return response;

    } catch (error) {
      // Wrap error if needed and add context
      const wrappedError = ErrorHandler.wrap(error, {
        service: 'BinanceService',
        method: 'getP2POrderHistory',
        tradeType,
        page,
        rows
      });

      logger.error('Error fetching P2P order history', ErrorHandler.formatForLogging(wrappedError));
      throw wrappedError;
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
    // Validate start date
    DateValidator.validateOrThrow(startDate, {
      allowPast: true,
      allowFuture: true,
      fieldName: 'startDate'
    });

    // Validate end date
    DateValidator.validateOrThrow(endDate, {
      allowPast: true,
      allowFuture: true,
      fieldName: 'endDate'
    });

    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();

    // Validate date range order
    if (startTime > endTime) {
      throw new Error('startDate cannot be after endDate');
    }

    // Validate date range span (max 30 days)
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

    logger.debug('Fetching current month P2P orders', {
      tradeType,
      startDate: startOfMonth.toLocaleDateString(),
      endDate: endOfMonth.toLocaleDateString(),
      event: 'binance_current_month_fetch'
    });

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
      logger.debug('Testing Binance API connection', {
        event: 'binance_connection_test_start'
      });

      // Test with a simple request to get account info (requires less permissions)
      const response = await this.makeAuthenticatedRequest('/sapi/v1/account/status');

      logger.info('Binance API connection successful', {
        event: 'binance_connection_test_success'
      });
      return {
        success: true,
        message: 'Connected to Binance API successfully',
        accountStatus: response
      };
    } catch (error) {
      const wrappedError = ErrorHandler.wrap(error, {
        service: 'BinanceService',
        method: 'testConnection'
      });

      logger.error('Binance API connection failed', ErrorHandler.formatForLogging(wrappedError));

      return {
        success: false,
        error: wrappedError.message,
        errorCode: wrappedError.code,
        message: wrappedError.getUserMessage(),
        retryable: ErrorHandler.isRetryable(wrappedError)
      };
    }
  }
}

module.exports = BinanceService;