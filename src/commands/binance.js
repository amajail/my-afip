const BinanceOrderFetcher = require('../../scripts/fetchBinanceOrders');
const logger = require('../utils/logger');

async function testBinanceConnection(binanceService, config) {
  if (!config.binanceApiKey || !config.binanceSecretKey) {
    logger.warn('Binance API credentials not configured. Please set BINANCE_API_KEY and BINANCE_SECRET_KEY in your .env file', {
      event: 'binance_credentials_missing'
    });
    return;
  }
  try {
    binanceService.initialize();
    const result = await binanceService.testConnection();
    if (result.success) {
      logger.info('Binance API connection successful - API Key configured correctly', {
        event: 'binance_connection_test_success'
      });
    } else {
      logger.error('Binance API connection failed', {
        error: result.error,
        event: 'binance_connection_test_failed'
      });
    }
  } catch (error) {
    logger.error('Binance API test failed', {
      error: error.message,
      event: 'binance_test_exception'
    });
  }
}

async function fetchBinanceOrders(binanceService, days = 7, tradeType = 'SELL', autoProcess = false, config = null, afipService = null) {
  logger.info('Fetching orders from Binance API', {
    days,
    tradeType,
    autoProcess,
    event: 'binance_fetch_start'
  });
  const fetcher = new BinanceOrderFetcher();
  try {
    await fetcher.initialize();

    // Use database-first approach
    const result = await fetcher.fetchToDatabase({ days, tradeType });

    if (result.success) {
      logger.info('Successfully fetched Binance orders', {
        ordersCount: result.ordersCount,
        newOrdersCount: result.newOrdersCount,
        event: 'binance_fetch_success'
      });

      if (autoProcess && result.newOrdersCount > 0) {
        logger.info('Auto-processing new orders to AFIP invoices', {
          newOrdersCount: result.newOrdersCount,
          event: 'auto_process_start'
        });
        const { processOrders } = require('./orders');
        const processResult = await processOrders(config || {}, afipService); // Pass config and afipService
        logger.info('Processing summary', {
          processed: processResult?.processed || 0,
          successful: processResult?.successful || 0,
          failed: processResult?.failed || 0,
          event: 'auto_process_complete'
        });
      }
    } else {
      logger.error('Failed to fetch orders', {
        error: result.error,
        event: 'binance_fetch_failed'
      });
    }
    return result;
  } catch (error) {
    logger.error('Binance fetch error', {
      error: error.message,
      event: 'binance_fetch_exception'
    });
    return { success: false, error: error.message };
  }
}

async function fetchBinanceMonth(tradeType, processOrders) {
  logger.info('Fetching current month orders from Binance', {
    tradeType,
    event: 'binance_month_fetch_start'
  });
  const fetcher = new BinanceOrderFetcher();
  try {
    await fetcher.initialize();

    // Use database-first approach for current month
    const response = await fetcher.binanceService.getCurrentMonthP2POrders(tradeType);

    if (response.data && response.data.length > 0) {
      const orders = response.data.map(order =>
        fetcher.binanceService.convertP2POrderToInternalFormat(order)
      );

      // Store directly to database
      const DatabaseOrderTracker = require('../utils/DatabaseOrderTracker');
      const dbTracker = new DatabaseOrderTracker();
      try {
        await dbTracker.initialize();
        const insertedCount = await dbTracker.insertOrders(orders);

        logger.info('Fetched current month orders', {
          totalOrders: orders.length,
          newOrdersStored: insertedCount,
          event: 'binance_month_fetch_success'
        });

        if (insertedCount > 0) {
          logger.info('Processing new orders to invoices', {
            count: insertedCount,
            event: 'month_orders_process_start'
          });
          await processOrders();
        }
      } finally {
        await dbTracker.close();
      }
    } else {
      logger.info('No orders found for current month', {
        event: 'binance_month_no_orders'
      });
    }
  } catch (error) {
    logger.error('Failed to fetch current month orders', {
      error: error.message,
      event: 'binance_month_fetch_failed'
    });
  }
}

module.exports = { testBinanceConnection, fetchBinanceOrders, fetchBinanceMonth };
