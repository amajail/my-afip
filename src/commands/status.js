const DatabaseOrderTracker = require('../utils/DatabaseOrderTracker');
const logger = require('../utils/logger');

async function checkOrderStatus() {
  const dbTracker = new DatabaseOrderTracker();
  try {
    const stats = await dbTracker.getStats();
    logger.info('Order Processing Status (Database)', {
      totalOrders: stats.total_orders,
      processed: stats.processed_orders,
      unprocessed: stats.total_orders - stats.processed_orders,
      successful: stats.successful_orders,
      failed: stats.failed_orders,
      manual: stats.manual_orders,
      automatic: stats.automatic_orders,
      totalInvoicedAmount: stats.total_invoiced_amount,
      event: 'status_check'
    });
    if (stats.processed_orders > 0) {
      logger.info('Recent processed orders');
      const recentOrders = await dbTracker.getProcessedOrders();
      recentOrders.slice(0, 5).forEach(order => {
        const method = order.processing_method === 'manual' ? 'Manual' : 'Auto';
        const status = order.success ? 'Success' : 'Failed';
        logger.info(`${method} ${status} ${order.order_number}`, {
          orderNumber: order.order_number,
          method: order.processing_method,
          success: order.success,
          cae: order.cae,
          event: 'status_recent_order'
        });
      });
      if (recentOrders.length > 5) {
        logger.info(`... and ${recentOrders.length - 5} more processed orders`, {
          additionalOrders: recentOrders.length - 5,
          event: 'status_more_orders'
        });
      }
    }
  } finally {
    await dbTracker.close();
  }
}

module.exports = { checkOrderStatus };
