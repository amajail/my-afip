/**
 * SQLiteOrderRepository
 *
 * SQLite implementation of IOrderRepository interface
 * Part of Infrastructure Layer
 */

const IOrderRepository = require('../../application/interfaces/IOrderRepository');
const Order = require('../../domain/entities/Order');
const OrderNumber = require('../../domain/value-objects/OrderNumber');
const Money = require('../../domain/value-objects/Money');
const CAE = require('../../domain/value-objects/CAE');
const Database = require('../../database/Database');
const logger = require('../../utils/logger');

class SQLiteOrderRepository extends IOrderRepository {
  constructor(database = null) {
    super();
    this.db = database || new Database();
    this.initialized = false;
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    if (!this.initialized) {
      await this.db.initialize();
      this.initialized = true;
    }
  }

  /**
   * Save a new order
   * @param {Order} order - Order to save
   * @returns {Promise<Order>} Saved order
   */
  async save(order) {
    await this.initialize();

    const orderData = this._toDatabase(order);

    try {
      await this.db.insertOrder(orderData);
      logger.info('Order saved', {
        orderNumber: order.orderNumber.value,
        event: 'order_saved'
      });
      return order;
    } catch (error) {
      logger.error('Failed to save order', {
        orderNumber: order.orderNumber.value,
        error: error.message,
        event: 'order_save_failed'
      });
      throw error;
    }
  }

  /**
   * Find order by order number
   * @param {OrderNumber|string} orderNumber - Order number to find
   * @returns {Promise<Order|null>} Found order or null
   */
  async findByOrderNumber(orderNumber) {
    await this.initialize();

    const orderNumberStr = orderNumber instanceof OrderNumber
      ? orderNumber.value
      : orderNumber;

    try {
      const row = await this.db.getOrderByNumber(orderNumberStr);
      return row ? this._fromDatabase(row) : null;
    } catch (error) {
      logger.error('Failed to find order', {
        orderNumber: orderNumberStr,
        error: error.message,
        event: 'order_find_failed'
      });
      return null;
    }
  }

  /**
   * Find all unprocessed orders
   * @returns {Promise<Order[]>} Unprocessed orders
   */
  async findUnprocessed() {
    await this.initialize();

    try {
      const rows = await this.db.getUnprocessedOrders();
      return rows.map(row => this._fromDatabase(row));
    } catch (error) {
      logger.error('Failed to find unprocessed orders', {
        error: error.message,
        event: 'unprocessed_orders_find_failed'
      });
      return [];
    }
  }

  /**
   * Find orders by date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Order[]>} Orders in date range
   */
  async findByDateRange(startDate, endDate) {
    await this.initialize();

    try {
      const rows = await this.db.getOrdersByDateRange(startDate, endDate);
      return rows.map(row => this._fromDatabase(row));
    } catch (error) {
      logger.error('Failed to find orders by date range', {
        startDate,
        endDate,
        error: error.message,
        event: 'orders_date_range_find_failed'
      });
      return [];
    }
  }

  /**
   * Find orders by trade type
   * @param {string} tradeType - 'BUY' or 'SELL'
   * @returns {Promise<Order[]>} Orders of specified type
   */
  async findByTradeType(tradeType) {
    await this.initialize();

    try {
      const rows = await this.db.getOrdersByTradeType(tradeType);
      return rows.map(row => this._fromDatabase(row));
    } catch (error) {
      logger.error('Failed to find orders by trade type', {
        tradeType,
        error: error.message,
        event: 'orders_trade_type_find_failed'
      });
      return [];
    }
  }

  /**
   * Update existing order
   * @param {Order} order - Order to update
   * @returns {Promise<Order>} Updated order
   */
  async update(order) {
    await this.initialize();

    const orderData = this._toDatabase(order);

    try {
      await this.db.updateOrder(order.orderNumber.value, orderData);
      logger.info('Order updated', {
        orderNumber: order.orderNumber.value,
        event: 'order_updated'
      });
      return order;
    } catch (error) {
      logger.error('Failed to update order', {
        orderNumber: order.orderNumber.value,
        error: error.message,
        event: 'order_update_failed'
      });
      throw error;
    }
  }

  /**
   * Delete order
   * @param {OrderNumber|string} orderNumber - Order number to delete
   * @returns {Promise<boolean>} Whether deletion was successful
   */
  async delete(orderNumber) {
    await this.initialize();

    const orderNumberStr = orderNumber instanceof OrderNumber
      ? orderNumber.value
      : orderNumber;

    try {
      await this.db.deleteOrder(orderNumberStr);
      logger.info('Order deleted', {
        orderNumber: orderNumberStr,
        event: 'order_deleted'
      });
      return true;
    } catch (error) {
      logger.error('Failed to delete order', {
        orderNumber: orderNumberStr,
        error: error.message,
        event: 'order_delete_failed'
      });
      return false;
    }
  }

  /**
   * Get total count of orders
   * @returns {Promise<number>} Total order count
   */
  async count() {
    await this.initialize();

    try {
      const stats = await this.db.getStats();
      return stats.total_orders || 0;
    } catch (error) {
      logger.error('Failed to count orders', {
        error: error.message,
        event: 'order_count_failed'
      });
      return 0;
    }
  }

  /**
   * Save multiple orders
   * @param {Order[]} orders - Orders to save
   * @returns {Promise<Order[]>} Saved orders
   */
  async saveMany(orders) {
    await this.initialize();

    const savedOrders = [];

    for (const order of orders) {
      try {
        const saved = await this.save(order);
        savedOrders.push(saved);
      } catch (error) {
        logger.warn('Failed to save order in batch', {
          orderNumber: order.orderNumber.value,
          error: error.message,
          event: 'batch_order_save_failed'
        });
      }
    }

    return savedOrders;
  }

  /**
   * Convert Order entity to database format
   * @private
   */
  _toDatabase(order) {
    return {
      orderNumber: order.orderNumber.value,
      amount: order.amount,
      price: order.price,
      totalPrice: order.totalAmount.amount,
      asset: order.asset,
      fiat: order.fiat,
      orderDate: order.orderDate,
      buyerNickname: order.buyerNickname,
      sellerNickname: order.sellerNickname,
      tradeType: order.tradeType,
      createTime: order.createTime,
      processingStatus: order.processingStatus,
      processingMethod: order.processingMethod,
      cae: order.cae ? order.cae.value : null,
      errorMessage: order.errorMessage
    };
  }

  /**
   * Convert database row to Order entity
   * @private
   */
  _fromDatabase(row) {
    return new Order({
      orderNumber: row.order_number,
      amount: row.amount,
      price: row.price,
      totalPrice: row.total_price,
      asset: row.asset,
      fiat: row.fiat,
      orderDate: row.order_date,
      buyerNickname: row.buyer_nickname,
      sellerNickname: row.seller_nickname,
      tradeType: row.trade_type,
      createTime: row.create_time,
      processingStatus: row.processing_status,
      processingMethod: row.processing_method,
      cae: row.cae,
      errorMessage: row.error_message
    });
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.initialized) {
      await this.db.close();
      this.initialized = false;
    }
  }
}

module.exports = SQLiteOrderRepository;
