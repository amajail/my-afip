const DatabaseOrderTracker = require('../utils/DatabaseOrderTracker');
const AfipService = require('./AfipService');
const Invoice = require('../models/Invoice');
const logger = require('../utils/logger');
const { ErrorHandler } = require('../utils/errors');

class DirectInvoiceService {
  constructor(config, afipService = null) {
    this.config = config;
    this.dbTracker = new DatabaseOrderTracker();
    // Reuse existing afipService if provided, otherwise create new one
    this.afipService = afipService || new AfipService(config);
  }

  async initialize() {
    await this.dbTracker.initialize();
    // Only initialize if we created a new afipService
    if (!this.afipService.initialized) {
      await this.afipService.initialize();
    }
    logger.info('Direct Invoice Service initialized', {
      event: 'direct_invoice_service_initialized'
    });
  }

  async processUnprocessedOrders() {
    logger.debug('Loading unprocessed orders from database', {
      event: 'unprocessed_orders_load_start'
    });

    // Get orders that haven't been processed yet
    const unprocessedOrders = await this.dbTracker.getUnprocessedOrders();

    if (unprocessedOrders.length === 0) {
      logger.info('No unprocessed orders found', {
        event: 'no_unprocessed_orders'
      });
      return { processed: 0, successful: 0, failed: 0 };
    }

    logger.info('Found unprocessed orders', {
      count: unprocessedOrders.length,
      event: 'unprocessed_orders_found'
    });

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
      const invoice = invoices[i];

      try {
        // Update database with result, including the invoice date (CbteFch)
        await this.dbTracker.db.markOrderProcessed(
          order.order_number,
          result,
          'automatic',
          invoice.docDate  // This is the CbteFch date calculated for AFIP
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
        logger.error('Error updating database for order', {
          orderNumber: order.order_number,
          error: error.message,
          event: 'order_update_failed'
        });
        failed++;
        finalResults.push({
          orderNumber: order.order_number,
          success: false,
          error: error.message
        });
      }
    }

    logger.info('Processing summary', {
      totalProcessed: successful + failed,
      successful,
      failed,
      event: 'processing_complete'
    });

    return {
      processed: successful + failed,
      successful,
      failed,
      results: finalResults
    };
  }

  convertOrderToInvoice(order) {
    // Calculate the appropriate invoice date based on AFIP rules
    const invoiceDate = this.calculateInvoiceDate(order.create_time);

    // Convert database order to Invoice model format
    return new Invoice({
      docType: 11, // Type C for monotributistas
      docNumber: '', // Will be auto-assigned by AFIP
      docDate: invoiceDate,
      concept: 2, // Services (allows wider date range than Products)
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

  calculateInvoiceDate(binanceTimestamp) {
    // Convert Binance timestamp to Date object
    const binanceDate = new Date(parseInt(binanceTimestamp));
    const today = new Date();

    // Calculate 10 days ago from today (AFIP regulation limit for Services concept)
    const tenDaysAgo = new Date(today);
    tenDaysAgo.setDate(today.getDate() - 10);

    // AFIP Invoice Date Rules for Services (Concept 2):
    // - Use actual Binance order date if within last 10 days
    // - Use exactly 10 days ago if Binance order is older (to stay within AFIP date range)
    if (binanceDate >= tenDaysAgo) {
      return binanceDate.toISOString().split('T')[0];
    }

    return tenDaysAgo.toISOString().split('T')[0];
  }

  async close() {
    await this.dbTracker.close();
  }
}

module.exports = DirectInvoiceService;