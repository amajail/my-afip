const Database = require('../database/Database');

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
          console.warn(`Warning: Could not insert order ${order.orderNumber}:`, error.message);
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

    // Get processed orders
    const processedOrders = await this.db.getProcessedOrders();
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
          console.error(`Error saving result for order ${orderNumber}:`, error.message);
        }
      }
    }
  }

  async markManualInvoice(orderNumber, cae, voucherNumber, notes = null) {
    await this.initialize();

    try {
      const changes = await this.db.markOrderManual(orderNumber, cae, voucherNumber, notes);
      if (changes > 0) {
        console.log(`✅ Order ${orderNumber} marked as manually processed (CAE: ${cae})`);
        return true;
      } else {
        console.warn(`⚠️  Order ${orderNumber} not found in database`);
        return false;
      }
    } catch (error) {
      console.error(`Error marking manual invoice for order ${orderNumber}:`, error.message);
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