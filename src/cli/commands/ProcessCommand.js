/**
 * ProcessCommand
 *
 * CLI command handler for order processing operations
 * Part of Presentation Layer (CLI)
 */

const ConsoleFormatter = require('../formatters/ConsoleFormatter');
const ReportFormatter = require('../formatters/ReportFormatter');
const logger = require('../../utils/logger');

class ProcessCommand {
  /**
   * Process unprocessed orders to AFIP invoices
   * @param {Object} config - Configuration
   * @param {Object} afipService - AFIP service instance
   */
  static async processUnprocessedOrders(config, afipService) {
    ConsoleFormatter.header('Processing Unprocessed Orders');
    ConsoleFormatter.progress('Initializing invoice service');

    const DirectInvoiceService = require('../../services/DirectInvoiceService');
    const directInvoiceService = new DirectInvoiceService(config, afipService);

    try {
      await directInvoiceService.initialize();

      ConsoleFormatter.progress('Processing orders to AFIP');
      logger.info('Order processing start', { event: 'order_processing_start' });

      const result = await directInvoiceService.processUnprocessedOrders();

      // Format and display results
      ReportFormatter.formatProcessingSummary(result);

      logger.info('Order processing complete', {
        processed: result?.processed || 0,
        successful: result?.successful || 0,
        failed: result?.failed || 0,
        event: 'order_processing_complete'
      });

      return result;
    } catch (error) {
      ConsoleFormatter.error('Order processing failed', error);
      logger.error('Order processing exception', {
        error: error.message,
        event: 'order_processing_exception'
      });
      throw error;
    } finally {
      await directInvoiceService.close();
    }
  }

  /**
   * Process specific order by order number
   * @param {string} orderNumber - Order number to process
   * @param {Object} config - Configuration
   * @param {Object} afipService - AFIP service instance
   */
  static async processOrderByNumber(orderNumber, config, afipService) {
    ConsoleFormatter.header('Processing Specific Order');
    ConsoleFormatter.keyValue('Order Number', orderNumber);
    ConsoleFormatter.newLine();

    const DirectInvoiceService = require('../../services/DirectInvoiceService');
    const directInvoiceService = new DirectInvoiceService(config, afipService);

    try {
      await directInvoiceService.initialize();

      ConsoleFormatter.progress('Processing order to AFIP');
      logger.info('Single order processing start', {
        orderNumber,
        event: 'single_order_processing_start'
      });

      // Note: Would need to add method to DirectInvoiceService to process single order
      ConsoleFormatter.warning('Single order processing not yet implemented');
      ConsoleFormatter.info('Use processUnprocessedOrders to process all pending orders');

      logger.warn('Single order processing not implemented', {
        orderNumber,
        event: 'single_order_processing_not_implemented'
      });
    } catch (error) {
      ConsoleFormatter.error('Order processing failed', error);
      logger.error('Single order processing exception', {
        error: error.message,
        orderNumber,
        event: 'single_order_processing_exception'
      });
      throw error;
    } finally {
      await directInvoiceService.close();
    }
  }

  /**
   * Mark order as manually processed
   * @param {string} orderNumber - Order number
   * @param {string} cae - CAE number
   */
  static async markOrderAsManual(orderNumber, cae) {
    ConsoleFormatter.header('Mark Order as Manually Processed');
    ConsoleFormatter.keyValue('Order Number', orderNumber);
    ConsoleFormatter.keyValue('CAE', cae);
    ConsoleFormatter.newLine();

    const DatabaseOrderTracker = require('../../utils/DatabaseOrderTracker');
    const dbTracker = new DatabaseOrderTracker();

    try {
      await dbTracker.initialize();

      ConsoleFormatter.progress('Marking order as manual');
      const result = await dbTracker.markManualInvoice(orderNumber, cae);

      if (result) {
        ConsoleFormatter.success(`Order ${orderNumber} marked as manually processed`);
        logger.info('Order marked as manual', {
          orderNumber,
          cae,
          event: 'order_marked_manual'
        });
      } else {
        ConsoleFormatter.error('Failed to mark order as manual');
        ConsoleFormatter.warning('Order may not exist in database');
        logger.error('Failed to mark order as manual', {
          orderNumber,
          event: 'mark_manual_failed'
        });
      }
    } catch (error) {
      ConsoleFormatter.error('Error marking order as manual', error);
      logger.error('Mark manual exception', {
        error: error.message,
        orderNumber,
        event: 'mark_manual_exception'
      });
      throw error;
    } finally {
      await dbTracker.close();
    }
  }
}

module.exports = ProcessCommand;
