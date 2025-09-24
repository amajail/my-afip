const DatabaseOrderTracker = require('../utils/DatabaseOrderTracker');
const AfipService = require('./AfipService');
const Invoice = require('../models/Invoice');

class DirectInvoiceService {
  constructor(config) {
    this.config = config;
    this.dbTracker = new DatabaseOrderTracker();
    this.afipService = new AfipService(config);
  }

  async initialize() {
    await this.dbTracker.initialize();
    this.afipService.initialize();
    console.log('🔗 Direct Invoice Service initialized (Database → AFIP)');
  }

  async processUnprocessedOrders() {
    console.log('🔍 Loading unprocessed orders from database...');

    // Get orders that haven't been processed yet
    const unprocessedOrders = await this.dbTracker.getUnprocessedOrders();

    if (unprocessedOrders.length === 0) {
      console.log('✅ No unprocessed orders found');
      return { processed: 0, successful: 0, failed: 0 };
    }

    console.log(`📋 Found ${unprocessedOrders.length} unprocessed orders`);

    // Convert all orders to invoices first
    const invoices = unprocessedOrders.map(order => {
      const invoice = this.convertOrderToInvoice(order);
      invoice.orderNumber = order.order_number; // Add reference for later tracking
      return invoice;
    });

    // Process all invoices in sequence with proper voucher numbering
    const results = await this.afipService.createMultipleInvoices(invoices);

    let successful = 0;
    let failed = 0;
    const finalResults = [];

    // Update database with results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const order = unprocessedOrders[i];

      try {
        // Update database with result
        await this.dbTracker.db.markOrderProcessed(
          order.order_number,
          result,
          'automatic'
        );

        if (result.success) {
          successful++;
        } else {
          failed++;
        }

        finalResults.push({
          orderNumber: order.order_number,
          success: result.success,
          cae: result.cae,
          error: result.error
        });

      } catch (error) {
        console.error(`❌ Error updating database for order ${order.order_number}:`, error.message);
        failed++;
        finalResults.push({
          orderNumber: order.order_number,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`\n📊 Processing Summary:`);
    console.log(`  - Total processed: ${successful + failed}`);
    console.log(`  - Successful: ${successful}`);
    console.log(`  - Failed: ${failed}`);

    return {
      processed: successful + failed,
      successful,
      failed,
      results: finalResults
    };
  }

  convertOrderToInvoice(order) {
    // Convert database order to Invoice model format
    return new Invoice({
      docType: 11, // Type C for monotributistas
      docNumber: '', // Will be auto-assigned by AFIP
      docDate: new Date().toISOString().split('T')[0], // Use current date instead of old order date
      concept: 1, // Products (cryptocurrency trading commissions)
      currency: 'PES',
      exchange: 1,
      netAmount: Math.round(parseFloat(order.total_price)),
      totalAmount: Math.round(parseFloat(order.total_price)),
      vatAmount: 0,
      taxes: [],
      associatedDocs: [],
      orderNumber: order.order_number
    });
  }

  async close() {
    await this.dbTracker.close();
  }
}

module.exports = DirectInvoiceService;