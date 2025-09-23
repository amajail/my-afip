const BinanceOrderFetcher = require('../../scripts/fetchBinanceOrders');

async function testBinanceConnection(binanceService, config) {
  if (!config.binanceApiKey || !config.binanceSecretKey) {
    console.log('❌ Binance API credentials not configured');
    console.log('Please set BINANCE_API_KEY and BINANCE_SECRET_KEY in your .env file');
    return;
  }
  try {
    binanceService.initialize();
    const result = await binanceService.testConnection();
    if (result.success) {
      console.log('✅ Binance API connection successful');
      console.log('🔑 API Key configured correctly');
    } else {
      console.log('❌ Binance API connection failed');
      console.log(`Error: ${result.error}`);
    }
  } catch (error) {
    console.log('❌ Binance API test failed');
    console.log(`Error: ${error.message}`);
  }
}

async function fetchBinanceOrders(binanceService, days = 7, tradeType = 'SELL', autoProcess = false) {
  console.log('📡 Fetching orders from Binance API...');
  const fetcher = new BinanceOrderFetcher();
  try {
    await fetcher.initialize();

    // Use database-first approach
    const result = await fetcher.fetchToDatabase({ days, tradeType });

    if (result.success) {
      console.log(`✅ Successfully fetched ${result.ordersCount} orders`);
      console.log(`💾 New orders stored: ${result.newOrdersCount}`);

      if (autoProcess && result.newOrdersCount > 0) {
        console.log('\n🔄 Auto-processing new orders to AFIP invoices...');
        const { processOrders } = require('./orders');
        const processResult = await processOrders({}, null); // Will use database-first processing
        console.log('📊 Processing summary:');
        console.log(`  - Orders processed: ${processResult?.processed || 0}`);
        console.log(`  - Successful: ${processResult?.successful || 0}`);
        console.log(`  - Failed: ${processResult?.failed || 0}`);
      }
    } else {
      console.log(`❌ Failed to fetch orders: ${result.error}`);
    }
    return result;
  } catch (error) {
    console.log(`❌ Binance fetch error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function fetchBinanceMonth(tradeType, processOrders) {
  console.log('📅 Fetching current month orders from Binance...');
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

        console.log(`✅ Fetched ${orders.length} orders for current month`);
        console.log(`💾 New orders stored: ${insertedCount}`);

        if (insertedCount > 0) {
          console.log('🔄 Processing new orders to invoices...');
          await processOrders();
        }
      } finally {
        await dbTracker.close();
      }
    } else {
      console.log('ℹ️  No orders found for current month');
    }
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
  }
}

module.exports = { testBinanceConnection, fetchBinanceOrders, fetchBinanceMonth };
