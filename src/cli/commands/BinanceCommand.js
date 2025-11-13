/**
 * BinanceCommand
 *
 * CLI command handler for Binance operations
 * Part of Presentation Layer (CLI)
 */

const BinanceOrderFetcher = require('../../../scripts/fetchBinanceOrders');
const ConsoleFormatter = require('../formatters/ConsoleFormatter');
const ReportFormatter = require('../formatters/ReportFormatter');
const logger = require('../../utils/logger');

class BinanceCommand {
  /**
   * Test Binance API connection
   * @param {Object} binanceService - Binance service instance
   * @param {Object} config - Configuration
   */
  static async testConnection(binanceService, config) {
    ConsoleFormatter.progress('Testing Binance API connection');

    if (!config.binanceApiKey || !config.binanceSecretKey) {
      ConsoleFormatter.warning('Binance API credentials not configured');
      ConsoleFormatter.info('Please set BINANCE_API_KEY and BINANCE_SECRET_KEY in your .env file');
      logger.warn('Binance API credentials missing', { event: 'binance_credentials_missing' });
      return;
    }

    try {
      binanceService.initialize();
      const result = await binanceService.testConnection();

      if (result.success) {
        ConsoleFormatter.success('Binance API connection successful');
        ConsoleFormatter.info('API Key configured correctly');
        logger.info('Binance connection test success', { event: 'binance_connection_test_success' });
      } else {
        ConsoleFormatter.error('Binance API connection failed', result.error);
        logger.error('Binance connection test failed', {
          error: result.error,
          event: 'binance_connection_test_failed'
        });
      }
    } catch (error) {
      ConsoleFormatter.error('Binance API test failed', error);
      logger.error('Binance test exception', {
        error: error.message,
        event: 'binance_test_exception'
      });
    }
  }

  /**
   * Fetch orders from Binance
   * @param {Object} binanceService - Binance service instance
   * @param {Object} options - Fetch options
   * @param {number} [options.days=7] - Number of days to fetch
   * @param {string} [options.tradeType='SELL'] - Trade type filter
   * @param {boolean} [options.autoProcess=false] - Auto-process orders
   * @param {Object} [options.config] - Configuration
   * @param {Object} [options.afipService] - AFIP service instance
   */
  static async fetchOrders(binanceService, options = {}) {
    const {
      days = 7,
      tradeType = 'SELL',
      autoProcess = false,
      config = null,
      afipService = null
    } = options;

    ConsoleFormatter.header('Fetching Binance Orders');
    ConsoleFormatter.keyValue('Days', days);
    ConsoleFormatter.keyValue('Trade Type', tradeType);
    ConsoleFormatter.keyValue('Auto Process', autoProcess ? 'Yes' : 'No');
    ConsoleFormatter.newLine();

    logger.info('Binance fetch start', { days, tradeType, autoProcess, event: 'binance_fetch_start' });

    const fetcher = new BinanceOrderFetcher();

    try {
      ConsoleFormatter.progress('Initializing Binance fetcher');
      await fetcher.initialize();

      ConsoleFormatter.progress('Fetching orders from Binance API');
      const result = await fetcher.fetchToDatabase({ days, tradeType });

      if (result.success) {
        ReportFormatter.formatBinanceFetchSummary({
          total: result.ordersCount,
          newOrders: result.newOrdersCount,
          existingOrders: result.ordersCount - result.newOrdersCount
        });

        logger.info('Binance fetch success', {
          ordersCount: result.ordersCount,
          newOrdersCount: result.newOrdersCount,
          event: 'binance_fetch_success'
        });

        if (autoProcess && result.newOrdersCount > 0) {
          ConsoleFormatter.progress('Auto-processing new orders to AFIP invoices');
          logger.info('Auto-process start', {
            newOrdersCount: result.newOrdersCount,
            event: 'auto_process_start'
          });

          const processResult = await this._processOrders(config, afipService);

          ReportFormatter.formatProcessingSummary(processResult);
          logger.info('Auto-process complete', {
            processed: processResult?.processed || 0,
            successful: processResult?.successful || 0,
            failed: processResult?.failed || 0,
            event: 'auto_process_complete'
          });
        }

        return result;
      } else {
        ConsoleFormatter.error('Failed to fetch orders', result.error);
        logger.error('Binance fetch failed', { error: result.error, event: 'binance_fetch_failed' });
        return result;
      }
    } catch (error) {
      ConsoleFormatter.error('Binance fetch error', error);
      logger.error('Binance fetch exception', {
        error: error.message,
        event: 'binance_fetch_exception'
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch current month orders from Binance
   * @param {string} tradeType - Trade type filter
   * @param {Function} processOrders - Order processing function
   */
  static async fetchMonth(tradeType, processOrders) {
    ConsoleFormatter.header('Fetching Current Month Orders');
    ConsoleFormatter.keyValue('Trade Type', tradeType);
    ConsoleFormatter.newLine();

    logger.info('Binance month fetch start', { tradeType, event: 'binance_month_fetch_start' });

    const fetcher = new BinanceOrderFetcher();

    try {
      await fetcher.initialize();

      ConsoleFormatter.progress('Fetching current month P2P orders');
      const response = await fetcher.binanceService.getCurrentMonthP2POrders(tradeType);

      if (response.data && response.data.length > 0) {
        const orders = response.data.map(order =>
          fetcher.binanceService.convertP2POrderToInternalFormat(order)
        );

        const DatabaseOrderTracker = require('../../utils/DatabaseOrderTracker');
        const dbTracker = new DatabaseOrderTracker();

        try {
          await dbTracker.initialize();
          const insertedCount = await dbTracker.insertOrders(orders);

          ConsoleFormatter.success(`Fetched ${orders.length} orders from Binance`);
          ConsoleFormatter.keyValue('New orders stored', insertedCount, 1);
          ConsoleFormatter.newLine();

          logger.info('Binance month fetch success', {
            totalOrders: orders.length,
            newOrdersStored: insertedCount,
            event: 'binance_month_fetch_success'
          });

          if (insertedCount > 0) {
            ConsoleFormatter.progress('Processing new orders to invoices');
            logger.info('Month orders process start', {
              count: insertedCount,
              event: 'month_orders_process_start'
            });
            await processOrders();
          }
        } finally {
          await dbTracker.close();
        }
      } else {
        ConsoleFormatter.info('No orders found for current month');
        logger.info('Binance month no orders', { event: 'binance_month_no_orders' });
      }
    } catch (error) {
      ConsoleFormatter.error('Failed to fetch current month orders', error);
      logger.error('Binance month fetch failed', {
        error: error.message,
        event: 'binance_month_fetch_failed'
      });
    }
  }

  /**
   * Process orders to AFIP invoices (internal helper)
   * @private
   */
  static async _processOrders(config, afipService) {
    const DirectInvoiceService = require('../../services/DirectInvoiceService');
    const directInvoiceService = new DirectInvoiceService(config || {}, afipService);

    try {
      await directInvoiceService.initialize();
      const processResult = await directInvoiceService.processUnprocessedOrders();
      return processResult;
    } finally {
      await directInvoiceService.close();
    }
  }
}

module.exports = BinanceCommand;
