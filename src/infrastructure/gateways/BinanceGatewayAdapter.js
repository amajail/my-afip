/**
 * BinanceGatewayAdapter
 *
 * Adapter implementing IBinanceGateway interface
 * Wraps BinanceService to provide clean gateway interface
 * Part of Infrastructure Layer
 */

const IBinanceGateway = require('../../application/interfaces/IBinanceGateway');
const BinanceService = require('../../services/BinanceService');
const Order = require('../../domain/entities/Order');
const logger = require('../../utils/logger');
const config = require('../../config');

class BinanceGatewayAdapter extends IBinanceGateway {
  /**
   * @param {BinanceService} [binanceService=null] - Optional BinanceService instance (for testing)
   */
  constructor(binanceService = null) {
    super();

    // Use provided service or create new one with config
    this.binanceService = binanceService || new BinanceService({
      apiKey: config.binance.apiKey,
      secretKey: config.binance.secretKey
    });

    this.initialized = false;
  }

  /**
   * Initialize Binance connection
   */
  async initialize() {
    if (!this.initialized) {
      this.binanceService.initialize();
      this.initialized = true;
    }
  }

  /**
   * Fetch orders from Binance
   * @param {Object} options - Fetch options
   * @param {number} [options.days=7] - Number of days to look back
   * @param {string} [options.tradeType='SELL'] - Trade type filter
   * @returns {Promise<Order[]>} Array of Order domain entities
   */
  async fetchOrders(options = {}) {
    await this.initialize();

    const {
      days = 7,
      tradeType = 'SELL'
    } = options;

    try {
      logger.debug('Fetching orders from Binance', {
        days,
        tradeType,
        event: 'binance_gateway_fetch_start'
      });

      // Fetch from Binance API
      const response = await this.binanceService.getRecentP2POrders(tradeType, days);

      // Convert API response to domain entities
      const orders = this._convertResponseToOrders(response);

      logger.info('Fetched orders from Binance', {
        count: orders.length,
        days,
        tradeType,
        event: 'binance_gateway_fetch_success'
      });

      return orders;
    } catch (error) {
      logger.error('Binance gateway error fetching orders', {
        days,
        tradeType,
        error: error.message,
        event: 'binance_gateway_fetch_error'
      });

      throw error;
    }
  }

  /**
   * Get order by order number
   * @param {string} orderNumber - Order number to fetch
   * @returns {Promise<Order|null>} Order domain entity or null
   */
  async getOrder(orderNumber) {
    await this.initialize();

    try {
      logger.debug('Fetching order from Binance', {
        orderNumber,
        event: 'binance_gateway_get_order_start'
      });

      // Note: Binance P2P API doesn't have a direct "get by order number" endpoint
      // We need to fetch recent orders and filter
      // This is a limitation of the current API

      // Fetch last 30 days to have a good chance of finding the order
      const response = await this.binanceService.getRecentP2POrders('SELL', 30);

      // Find the specific order
      const binanceOrder = response.data?.find(
        o => o.orderNumber === orderNumber
      );

      if (!binanceOrder) {
        logger.warn('Order not found in Binance', {
          orderNumber,
          event: 'binance_order_not_found'
        });
        return null;
      }

      // Convert to domain entity
      const internalFormat = this.binanceService.convertP2POrderToInternalFormat(binanceOrder);
      const order = this._convertToOrderEntity(internalFormat);

      logger.info('Retrieved order from Binance', {
        orderNumber,
        event: 'binance_gateway_get_order_success'
      });

      return order;
    } catch (error) {
      logger.error('Binance gateway error getting order', {
        orderNumber,
        error: error.message,
        event: 'binance_gateway_get_order_error'
      });

      return null;
    }
  }

  /**
   * Test Binance connection
   * @returns {Promise<boolean>} Whether connection is successful
   */
  async testConnection() {
    try {
      await this.initialize();

      const result = await this.binanceService.testConnection();

      logger.info('Binance connection test result', {
        success: result.success,
        event: 'binance_connection_test'
      });

      return result.success;
    } catch (error) {
      logger.error('Binance connection test failed', {
        error: error.message,
        event: 'binance_connection_test_failed'
      });

      return false;
    }
  }

  /**
   * Get account status
   * @returns {Promise<Object>} Account status information
   */
  async getAccountStatus() {
    await this.initialize();

    try {
      const result = await this.binanceService.testConnection();

      return {
        connected: result.success,
        accountStatus: result.accountStatus || null,
        message: result.message,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Binance gateway error getting account status', {
        error: error.message,
        event: 'binance_gateway_status_error'
      });

      return {
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Convert Binance API response to Order entities
   * @private
   * @param {Object} response - Binance API response
   * @returns {Order[]} Array of Order entities
   */
  _convertResponseToOrders(response) {
    if (!response.data || !Array.isArray(response.data)) {
      logger.warn('Invalid Binance response format', {
        event: 'binance_invalid_response'
      });
      return [];
    }

    return response.data.map(binanceOrder => {
      try {
        // Convert to internal format first
        const internalFormat = this.binanceService.convertP2POrderToInternalFormat(binanceOrder);

        // Convert to domain entity
        return this._convertToOrderEntity(internalFormat);
      } catch (error) {
        logger.error('Error converting Binance order to domain entity', {
          orderNumber: binanceOrder.orderNumber,
          error: error.message,
          event: 'binance_conversion_error'
        });
        return null;
      }
    }).filter(order => order !== null);
  }

  /**
   * Convert internal format to Order domain entity
   * @private
   * @param {Object} internalFormat - Internal order format
   * @returns {Order} Order domain entity
   */
  _convertToOrderEntity(internalFormat) {
    // Convert timestamp to date string
    const orderDate = new Date(parseInt(internalFormat.createTime)).toISOString().split('T')[0];

    return new Order({
      orderNumber: internalFormat.orderNumber,
      amount: parseFloat(internalFormat.amount),
      price: parseFloat(internalFormat.price),
      totalPrice: parseFloat(internalFormat.totalPrice),
      asset: internalFormat.asset,
      fiat: internalFormat.fiat,
      orderDate: orderDate,
      buyerNickname: internalFormat.buyerNickname,
      sellerNickname: internalFormat.sellerNickname,
      tradeType: internalFormat.tradeType,
      createTime: internalFormat.createTime,
      processedAt: null, // New orders haven't been processed yet
      processingMethod: null,
      success: null,
      cae: null,
      voucherNumber: null,
      invoiceDate: null,
      errorMessage: null
    });
  }
}

module.exports = BinanceGatewayAdapter;
