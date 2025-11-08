const DirectInvoiceService = require('../services/DirectInvoiceService');

async function processOrders(config, afipService) {
  console.log('🚀 Processing orders to AFIP invoices...');
  try {
    const directService = new DirectInvoiceService(config, afipService);
    await directService.initialize();
    const result = await directService.processUnprocessedOrders();

    if (result.processed === 0) {
      console.log('✅ No unprocessed orders found in database');
      console.log('💡 Use "npm run binance:fetch" to fetch new orders from Binance');
    }

    await directService.close();
    return result;
  } catch (error) {
    console.error('❌ Error in database order processing:', error.message);
    throw error;
  }
}

module.exports = { processOrders };
