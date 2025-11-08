const DatabaseOrderTracker = require('../utils/DatabaseOrderTracker');
const logger = require('../utils/logger');

async function showCurrentMonthReport() {
  logger.info('Current Month Orders Report');
  logger.info('='.repeat(50));
  const dbTracker = new DatabaseOrderTracker();
  try {
    await dbTracker.initialize();
    const stats = await dbTracker.getCurrentMonthStats();
    const orders = await dbTracker.getCurrentMonthOrders();
    logger.info('Summary Statistics', {
      period: `${stats.earliest_date || 'N/A'} to ${stats.latest_date || 'N/A'}`,
      totalOrders: stats.total_orders || 0,
      successfulInvoices: stats.successful_orders || 0,
      failedAttempts: stats.failed_orders || 0,
      pendingProcessing: stats.pending_orders || 0,
      totalAmount: stats.total_amount || 0,
      invoicedAmount: stats.invoiced_amount || 0,
      event: 'monthly_report_stats'
    });

    // Get processing method breakdown
    const manualCount = orders.filter(o => o.processing_method === 'manual' && o.status === 'Success').length;
    const autoCount = orders.filter(o => o.processing_method === 'automatic' && o.status === 'Success').length;

    if (manualCount > 0 || autoCount > 0) {
      logger.info('Processing method breakdown', {
        manualProcessing: manualCount,
        automaticProcessing: autoCount,
        event: 'report_processing_methods'
      });
    }
    if (orders.length === 0) {
      logger.info('No orders found for current month', {
        event: 'report_no_orders'
      });
      return;
    }
    logger.info(`Detailed Orders (${orders.length} orders)`);
    logger.info('-'.repeat(175));
    logger.info('Order Date | Invoice Date | Order Number                      | Amount    | Status    | Method    | CAE/Error');
    logger.info('-'.repeat(175));
    orders.forEach(order => {
      const orderDate = order.order_date;
      // Use actual invoice_date from database (CbteFch)
      const invoiceDate = order.invoice_date || '-'.padEnd(10);
      const orderNum = order.order_number.padEnd(30);
      const amount = `$${order.total_price.toLocaleString()}`.padEnd(9);

      // Better status display with emojis
      let statusDisplay = '';
      let methodDisplay = '';
      let result = '';

      if (order.status === 'Success') {
        statusDisplay = '✅ Success'.padEnd(9);
        methodDisplay = order.processing_method === 'manual' ? '🤲 Manual' : '🤖 Auto';
        methodDisplay = methodDisplay.padEnd(9);
        result = `CAE: ${order.cae || 'N/A'}`;
        if (order.processing_method === 'manual') {
          result += ' (Manual)';
        }
      } else if (order.status === 'Failed') {
        statusDisplay = '❌ Failed'.padEnd(9);
        methodDisplay = order.processing_method === 'manual' ? '🤲 Manual' : '🤖 Auto';
        methodDisplay = methodDisplay.padEnd(9);
        result = `${(order.error_message || 'Processing failed').substring(0, 50)}`;
      } else {
        statusDisplay = '⏳ Pending'.padEnd(9);
        methodDisplay = '-'.padEnd(9);
        result = 'Awaiting processing';
      }

      logger.info(`${orderDate} | ${invoiceDate} | ${orderNum} | ${amount} | ${statusDisplay} | ${methodDisplay} | ${result}`);
    });
    logger.info('-'.repeat(175));
    const totalAttempted = (stats.successful_orders || 0) + (stats.failed_orders || 0);
    const successRate = totalAttempted > 0
      ? ((stats.successful_orders / totalAttempted) * 100).toFixed(1)
      : '0';
    const invoiceRate = stats.total_orders > 0
      ? ((stats.successful_orders / stats.total_orders) * 100).toFixed(1)
      : '0';

    logger.info('Invoice Success Rate', {
      successRate: `${successRate}%`,
      successful: stats.successful_orders || 0,
      total: totalAttempted,
      event: 'report_success_rate'
    });
    logger.info('Overall Completion', {
      completionRate: `${invoiceRate}%`,
      invoiced: stats.successful_orders || 0,
      totalOrders: stats.total_orders || 0,
      event: 'report_completion'
    });
    if (stats.pending_orders > 0) {
      logger.info('Next Actions', {
        pendingOrders: stats.pending_orders,
        suggestions: [
          `Run "npm run orders" to process ${stats.pending_orders} pending orders`,
          'Or run "npm run binance:auto" to fetch new orders and process all'
        ],
        event: 'report_next_actions'
      });
    }
  } catch (error) {
    logger.error('Error generating current month report', {
      error: error.message,
      event: 'report_generation_failed'
    });
  } finally {
    await dbTracker.close();
  }
}

module.exports = { showCurrentMonthReport };
