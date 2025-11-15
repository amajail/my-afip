/**
 * ProcessCommand
 *
 * CLI command handler for order processing operations
 * Part of Presentation Layer (CLI)
 *
 * Updated to use Application Layer use cases following Clean Architecture
 */

const container = require('../../application/di/container');
const ConsoleFormatter = require('../formatters/ConsoleFormatter');
const ReportFormatter = require('../formatters/ReportFormatter');
const logger = require('../../utils/logger');

class ProcessCommand {
  /**
   * Process unprocessed orders to AFIP invoices
   * @param {Object} config - Configuration (legacy, not used)
   * @param {Object} afipService - AFIP service instance (legacy, not used)
   */
  static async processUnprocessedOrders(config, afipService) {
    ConsoleFormatter.header('Processing Unprocessed Orders');
    ConsoleFormatter.progress('Initializing order processing');

    try {
      // Initialize container
      await container.initialize();

      // Get use case from DI container
      const processUnprocessedOrdersUseCase = container.getProcessUnprocessedOrdersUseCase();

      ConsoleFormatter.progress('Processing orders to AFIP');
      logger.info('Order processing start', { event: 'order_processing_start' });

      // Execute use case
      const result = await processUnprocessedOrdersUseCase.execute();

      // Format and display results
      ReportFormatter.formatProcessingSummary({
        processed: result.totalOrders,
        successful: result.processedOrders,
        failed: result.failedOrders
      });

      logger.info('Order processing complete', {
        processed: result.totalOrders,
        successful: result.processedOrders,
        failed: result.failedOrders,
        event: 'order_processing_complete'
      });

      return {
        processed: result.totalOrders,
        successful: result.processedOrders,
        failed: result.failedOrders
      };
    } catch (error) {
      ConsoleFormatter.error('Order processing failed', error);
      logger.error('Order processing exception', {
        error: error.message,
        event: 'order_processing_exception'
      });
      throw error;
    } finally {
      await container.cleanup();
    }
  }

  /**
   * Process specific order by order number
   * @param {string} orderNumber - Order number to process
   * @param {Object} config - Configuration (legacy, not used)
   * @param {Object} afipService - AFIP service instance (legacy, not used)
   */
  static async processOrderByNumber(orderNumber, config, afipService) {
    ConsoleFormatter.header('Processing Specific Order');
    ConsoleFormatter.keyValue('Order Number', orderNumber);
    ConsoleFormatter.newLine();

    try {
      // Initialize container
      await container.initialize();

      // Get use case from DI container
      const createInvoiceUseCase = container.getCreateInvoiceUseCase();

      ConsoleFormatter.progress('Processing order to AFIP');
      logger.info('Single order processing start', {
        orderNumber,
        event: 'single_order_processing_start'
      });

      // Execute use case
      const result = await createInvoiceUseCase.execute({ orderNumber });

      // Display result
      if (result.success) {
        ConsoleFormatter.success(`Invoice created successfully for order ${orderNumber}`);
        ConsoleFormatter.keyValue('CAE', result.cae, 1);
        ConsoleFormatter.keyValue('CAE Expiration', result.caeExpiration, 1);
        ConsoleFormatter.keyValue('Voucher Number', result.voucherNumber, 1);
        logger.info('Single order processing success', {
          orderNumber,
          cae: result.cae,
          event: 'single_order_processing_success'
        });
      } else {
        ConsoleFormatter.error(`Failed to create invoice for order ${orderNumber}`, result.error);
        logger.error('Single order processing failed', {
          orderNumber,
          error: result.error,
          event: 'single_order_processing_failed'
        });
      }

      return result;
    } catch (error) {
      ConsoleFormatter.error('Order processing failed', error);
      logger.error('Single order processing exception', {
        error: error.message,
        orderNumber,
        event: 'single_order_processing_exception'
      });
      throw error;
    } finally {
      await container.cleanup();
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
