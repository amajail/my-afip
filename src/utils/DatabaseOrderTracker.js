const Database = require('../database/Database');
const logger = require('./logger');

class DatabaseOrderTracker {
  constructor() {
    this.db = new Database();
    this.initialized = false;
  }

  async initialize() {
    if (!this.initialized) {
      await this.db.initialize();
      this.initialized = true;
    }
  }

  async insertOrders(orders) {
    await this.initialize();

    const insertedCount = await Promise.all(
      orders.map(async (order) => {
        try {
          await this.db.insertOrder(order);
          return 1;
        } catch (error) {
          logger.warn('Could not insert order', {
            orderNumber: order.orderNumber,
            error: error.message,
            event: 'order_insert_failed'
          });
          return 0;
        }
      })
    );

    return insertedCount.reduce((sum, count) => sum + count, 0);
  }

  async filterNewOrders(orders) {
    await this.initialize();

    // First, insert/update all orders in database
    await this.insertOrders(orders);

    // Get successfully processed orders only (not failed ones)
    const processedOrders = await this.db.getSuccessfullyProcessedOrders();
    const processedOrderNumbers = new Set(processedOrders.map(o => o.order_number));

    // Filter orders
    const newOrders = orders.filter(order => !processedOrderNumbers.has(order.orderNumber));
    const duplicates = orders.filter(order => processedOrderNumbers.has(order.orderNumber))
      .map(order => {
        const processed = processedOrders.find(p => p.order_number === order.orderNumber);
        return {
          orderNumber: order.orderNumber,
          totalPrice: order.totalPrice,
          processedAt: processed.processed_at,
          processingMethod: processed.processing_method,
          success: !!processed.success,
          cae: processed.cae
        };
      });

    return { newOrders, duplicates };
  }

  async saveResults(results, orderNumbers) {
    await this.initialize();

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const orderNumber = orderNumbers[i];

      if (orderNumber) {
        try {
          await this.db.markOrderProcessed(orderNumber, result, 'automatic');
        } catch (error) {
          logger.error('Error saving result for order', {
            orderNumber,
            error: error.message,
            event: 'save_result_failed'
          });
        }
      }
    }
  }

  async markManualInvoice(orderNumber, cae, voucherNumber, notes = null) {
    await this.initialize();

    try {
      const changes = await this.db.markOrderManual(orderNumber, cae, voucherNumber, notes);
      if (changes > 0) {
        logger.info('Order marked as manually processed', {
          orderNumber,
          cae,
          voucherNumber,
          event: 'manual_invoice_marked'
        });
        return true;
      } else {
        logger.warn('Order not found in database', {
          orderNumber,
          event: 'manual_invoice_order_not_found'
        });
        return false;
      }
    } catch (error) {
      logger.error('Error marking manual invoice for order', {
        orderNumber,
        error: error.message,
        event: 'manual_invoice_mark_failed'
      });
      return false;
    }
  }

  async getStats() {
    await this.initialize();
    return await this.db.getOrderStats();
  }

  async getProcessedOrders() {
    await this.initialize();
    return await this.db.getProcessedOrders();
  }

  async getUnprocessedOrders() {
    await this.initialize();
    return await this.db.getUnprocessedOrders();
  }

  async getOrdersByStatus(success = null) {
    await this.initialize();
    return await this.db.getOrdersByStatus(success);
  }

  async getCurrentMonthOrders() {
    await this.initialize();
    return await this.db.getCurrentMonthOrders();
  }

  async getCurrentMonthStats() {
    await this.initialize();
    return await this.db.getCurrentMonthStats();
  }

  async close() {
    if (this.db) {
      await this.db.close();
    }
  }
}

module.exports = DatabaseOrderTracker;