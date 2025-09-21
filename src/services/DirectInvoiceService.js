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

    let successful = 0;
    let failed = 0;
    const results = [];

    for (const order of unprocessedOrders) {
      try {
        console.log(`🔄 Processing order ${order.order_number} ($${order.total_price})...`);

        // Convert database order to Invoice format
        const invoice = this.convertOrderToInvoice(order);

        // Submit to AFIP
        const result = await this.afipService.createInvoice(invoice);

        // Update database with result
        await this.dbTracker.db.markOrderProcessed(
          order.order_number,
          result,
          'automatic'
        );

        if (result.success) {
          console.log(`✅ Order ${order.order_number}: CAE ${result.cae}`);
          successful++;
        } else {
          console.log(`❌ Order ${order.order_number}: ${result.error}`);
          failed++;
        }

        results.push({
          orderNumber: order.order_number,
          success: result.success,
          cae: result.cae,
          error: result.error
        });

      } catch (error) {
        console.error(`❌ Error processing order ${order.order_number}:`, error.message);

        await this.dbTracker.db.markOrderProcessed(
          order.order_number,
          { success: false, error: error.message },
          'automatic'
        );

        failed++;
        results.push({
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
      results
    };
  }

  convertOrderToInvoice(order) {
    // Convert database order to Invoice model format
    return new Invoice({
      docType: 11, // Type C for monotributistas
      docNumber: '', // Will be auto-assigned by AFIP
      docDate: order.order_date,
      concept: 2, // Services
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