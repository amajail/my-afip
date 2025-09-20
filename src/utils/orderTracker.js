const fs = require('fs');
const path = require('path');

class OrderTracker {
  constructor() {
    this.trackingFile = path.join(__dirname, '..', '..', 'data', 'processed-orders.json');
    this.processedOrders = this.loadProcessedOrders();
  }

  loadProcessedOrders() {
    try {
      if (fs.existsSync(this.trackingFile)) {
        const data = fs.readFileSync(this.trackingFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('Warning: Could not load processed orders file:', error.message);
    }

    return {
      orders: {},
      lastUpdated: new Date().toISOString()
    };
  }

  saveProcessedOrders() {
    try {
      const dir = path.dirname(this.trackingFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.processedOrders.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.trackingFile, JSON.stringify(this.processedOrders, null, 2));
    } catch (error) {
      console.error('Error saving processed orders:', error.message);
    }
  }

  isOrderProcessed(orderNumber) {
    return !!this.processedOrders.orders[orderNumber];
  }

  markOrderAsProcessed(orderNumber, invoiceResult) {
    this.processedOrders.orders[orderNumber] = {
      processedAt: new Date().toISOString(),
      success: invoiceResult.success,
      cae: invoiceResult.cae || null,
      voucherNumber: invoiceResult.voucherNumber || null,
      error: invoiceResult.error || null
    };
  }

  getProcessedOrdersCount() {
    return Object.keys(this.processedOrders.orders).length;
  }

  getProcessedOrderInfo(orderNumber) {
    return this.processedOrders.orders[orderNumber] || null;
  }

  filterNewOrders(orders) {
    const newOrders = [];
    const duplicates = [];

    orders.forEach(order => {
      if (this.isOrderProcessed(order.orderNumber)) {
        const existingInfo = this.getProcessedOrderInfo(order.orderNumber);
        duplicates.push({
          orderNumber: order.orderNumber,
          totalPrice: order.totalPrice,
          processedAt: existingInfo.processedAt,
          success: existingInfo.success,
          cae: existingInfo.cae
        });
      } else {
        newOrders.push(order);
      }
    });

    return { newOrders, duplicates };
  }

  saveResults(results) {
    results.forEach(result => {
      if (result.invoice && result.invoice.orderNumber) {
        this.markOrderAsProcessed(result.invoice.orderNumber, result);
      }
    });

    this.saveProcessedOrders();
  }
}

module.exports = OrderTracker;