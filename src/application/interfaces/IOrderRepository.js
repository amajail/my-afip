/**
 * IOrderRepository Interface
 *
 * Repository interface for Order persistence following Repository pattern.
 * Defines the contract for Order data access operations.
 * Infrastructure layer will implement this interface.
 */

/**
 * Order Repository Interface
 * @interface
 */
class IOrderRepository {
  /**
   * Save a new order
   * @param {Order} order - Order to save
   * @returns {Promise<Order>} Saved order
   * @abstract
   */
  async save(order) {
    throw new Error('Method not implemented: save');
  }

  /**
   * Find order by order number
   * @param {OrderNumber|string} orderNumber - Order number to find
   * @returns {Promise<Order|null>} Found order or null
   * @abstract
   */
  async findByOrderNumber(orderNumber) {
    throw new Error('Method not implemented: findByOrderNumber');
  }

  /**
   * Find all unprocessed orders
   * @returns {Promise<Order[]>} Unprocessed orders
   * @abstract
   */
  async findUnprocessed() {
    throw new Error('Method not implemented: findUnprocessed');
  }

  /**
   * Find orders by date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Order[]>} Orders in date range
   * @abstract
   */
  async findByDateRange(startDate, endDate) {
    throw new Error('Method not implemented: findByDateRange');
  }

  /**
   * Find orders by trade type
   * @param {string} tradeType - 'BUY' or 'SELL'
   * @returns {Promise<Order[]>} Orders of specified type
   * @abstract
   */
  async findByTradeType(tradeType) {
    throw new Error('Method not implemented: findByTradeType');
  }

  /**
   * Update existing order
   * @param {Order} order - Order to update
   * @returns {Promise<Order>} Updated order
   * @abstract
   */
  async update(order) {
    throw new Error('Method not implemented: update');
  }

  /**
   * Delete order
   * @param {OrderNumber|string} orderNumber - Order number to delete
   * @returns {Promise<boolean>} Whether deletion was successful
   * @abstract
   */
  async delete(orderNumber) {
    throw new Error('Method not implemented: delete');
  }

  /**
   * Get total count of orders
   * @returns {Promise<number>} Total order count
   * @abstract
   */
  async count() {
    throw new Error('Method not implemented: count');
  }

  /**
   * Save multiple orders
   * @param {Order[]} orders - Orders to save
   * @returns {Promise<Order[]>} Saved orders
   * @abstract
   */
  async saveMany(orders) {
    throw new Error('Method not implemented: saveMany');
  }
}

module.exports = IOrderRepository;
