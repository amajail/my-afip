const DirectInvoiceService = require('../services/DirectInvoiceService');
const DatabaseOrderTracker = require('../utils/DatabaseOrderTracker');
const OrderTracker = require('../utils/orderTracker');
const CSVParser = require('../utils/csvParser');
const { processOrderFiles } = require('../../scripts/convertOrders');
const fs = require('fs');

async function processOrders(config, afipService) {
  console.log('🚀 Processing orders to AFIP invoices (Database-first)...');
  try {
    const directService = new DirectInvoiceService(config);
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

async function processOrdersLegacy(afipService) {
  console.log('🔄 Converting cryptocurrency orders to invoices (Legacy File-based)...');
  const ordersDir = './orders';
  if (!fs.existsSync(ordersDir)) {
    throw new Error('Orders folder not found. Please create ./orders folder and add JSON order files.');
  }
  const orderFiles = fs.readdirSync(ordersDir).filter(file => file.endsWith('.json'));
  if (orderFiles.length === 0) {
    throw new Error('No JSON order files found in ./orders folder.');
  }
  console.log(`📦 Found ${orderFiles.length} order file(s)`);
  const conversionResult = await processOrderFiles();
  if (!conversionResult || conversionResult.newOrders.length === 0) {
    console.log('✅ No new orders to process');
    return;
  }
  const csvFile = './data/orders-invoices.csv';
  if (fs.existsSync(csvFile)) {
    console.log('\n🚀 Processing converted invoices...');
    const parseResult = await CSVParser.parseInvoices(csvFile);
    if (parseResult.invoices.length > 0) {
      console.log('\n💼 Creating invoices in AFIP...');
      const results = await afipService.createMultipleInvoices(parseResult.invoices);
      const dbTracker = new DatabaseOrderTracker();
      try {
        const orderNumbers = conversionResult.newOrders.map(order => order.orderNumber);
        await dbTracker.saveResults(results, orderNumbers);
        const fileTracker = new OrderTracker();
        results.forEach((result, index) => {
          if (orderNumbers[index]) {
            result.invoice = {
              ...result.invoice,
              orderNumber: orderNumbers[index]
            };
          }
        });
        fileTracker.saveResults(results);
        // Save results and print summary using AfipInvoiceApp helpers if needed
        if (typeof afipService.saveResults === 'function') {
          await afipService.saveResults(results);
        }
        if (typeof afipService.printSummary === 'function') {
          afipService.printSummary(results);
        }
      } finally {
        await dbTracker.close();
      }
    }
  } else {
    throw new Error('Failed to generate orders CSV file');
  }
}

module.exports = { processOrders, processOrdersLegacy };
