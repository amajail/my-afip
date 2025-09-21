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
    const result = await fetcher.fetchAndProcess({ days, tradeType, autoProcess });
    if (result.success) {
      console.log(`✅ Successfully fetched ${result.ordersCount} orders`);
      if (autoProcess && result.processed) {
        console.log('📊 Processing summary:');
        console.log(`  - New orders: ${result.processed.newOrders?.length || 0}`);
        console.log(`  - Duplicates: ${result.processed.duplicates?.length || 0}`);
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
  await fetcher.initialize();
  const result = await fetcher.fetchCurrentMonthOrders(tradeType);
  if (result.success && result.ordersCount > 0) {
    console.log(`✅ Fetched ${result.ordersCount} orders for ${result.month}`);
    console.log('🔄 Processing to invoices...');
    await processOrders();
  } else if (result.success) {
    console.log(`ℹ️  No orders found for ${result.month}`);
  } else {
    console.log(`❌ Failed: ${result.error}`);
  }
}

module.exports = { testBinanceConnection, fetchBinanceOrders, fetchBinanceMonth };
