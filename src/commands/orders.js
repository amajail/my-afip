const DirectInvoiceService = require('../services/DirectInvoiceService');
const logger = require('../utils/logger');

async function processOrders(config, afipService) {
  logger.info('Processing orders to AFIP invoices', {
    event: 'process_orders_start'
  });
  try {
    const directService = new DirectInvoiceService(config, afipService);
    await directService.initialize();
    const result = await directService.processUnprocessedOrders();

    if (result.processed === 0) {
      logger.info('No unprocessed orders found in database. Use "npm run binance:fetch" to fetch new orders from Binance', {
        event: 'process_orders_no_orders'
      });
    }

    await directService.close();
    return result;
  } catch (error) {
    logger.error('Error in database order processing', {
      error: error.message,
      event: 'process_orders_failed'
    });
    throw error;
  }
}

module.exports = { processOrders };
