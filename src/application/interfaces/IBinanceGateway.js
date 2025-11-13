/**
 * IBinanceGateway Interface
 *
 * Gateway interface for Binance operations following Gateway pattern.
 * Defines the contract for Binance external service communication.
 * Infrastructure layer will implement this interface.
 */

/**
 * Binance Gateway Interface
 * @interface
 */
class IBinanceGateway {
  /**
   * Fetch orders from Binance
   * @param {Object} options - Fetch options
   * @param {number} [options.days=7] - Number of days to look back
   * @param {string} [options.tradeType='SELL'] - Trade type filter
   * @returns {Promise<Order[]>} Fetched orders
   * @abstract
   */
  async fetchOrders(options) {
    throw new Error('Method not implemented: fetchOrders');
  }

  /**
   * Get order by order number
   * @param {string} orderNumber - Order number to fetch
   * @returns {Promise<Order|null>} Order or null
   * @abstract
   */
  async getOrder(orderNumber) {
    throw new Error('Method not implemented: getOrder');
  }

  /**
   * Test Binance connection
   * @returns {Promise<boolean>} Whether connection is successful
   * @abstract
   */
  async testConnection() {
    throw new Error('Method not implemented: testConnection');
  }

  /**
   * Get account status
   * @returns {Promise<Object>} Account status information
   * @abstract
   */
  async getAccountStatus() {
    throw new Error('Method not implemented: getAccountStatus');
  }
}

module.exports = IBinanceGateway;
