const BinanceService = require('../src/services/BinanceService');
const DatabaseOrderTracker = require('../src/utils/DatabaseOrderTracker');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class BinanceOrderFetcher {
  constructor() {
    this.binanceService = new BinanceService({
      apiKey: process.env.BINANCE_API_KEY,
      secretKey: process.env.BINANCE_SECRET_KEY
    });

    this.ordersDir = path.join(__dirname, '..', 'orders');

    // Ensure orders directory exists
    if (!fs.existsSync(this.ordersDir)) {
      fs.mkdirSync(this.ordersDir, { recursive: true });
    }
  }

  async initialize() {
    try {
      this.binanceService.initialize();

      // Test connection
      const testResult = await this.binanceService.testConnection();
      if (!testResult.success) {
        throw new Error(`Binance API connection failed: ${testResult.error}`);
      }

      console.log('✅ Binance service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Binance service:', error.message);
      throw error;
    }
  }

  async fetchRecentOrders(days = 7, tradeType = 'SELL') {
    console.log(`📥 Fetching recent ${tradeType} orders from last ${days} days...`);

    try {
      const response = await this.binanceService.getRecentP2POrders(tradeType, days);

      if (response.data && response.data.length > 0) {
        // Convert to our expected format
        const orders = response.data.map(order =>
          this.binanceService.convertP2POrderToInternalFormat(order)
        );

        // Save to JSON file with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `binance-orders-${tradeType.toLowerCase()}-${timestamp}.json`;
        const filepath = path.join(this.ordersDir, filename);

        const orderData = {
          code: "000000",
          message: null,
          messageDetail: null,
          data: orders,
          total: orders.length,
          success: true,
          fetchedAt: new Date().toISOString(),
          source: 'BINANCE_API',
          tradeType: tradeType,
          dateRange: {
            days: days,
            startTime: Date.now() - (days * 24 * 60 * 60 * 1000),
            endTime: Date.now()
          }
        };

        fs.writeFileSync(filepath, JSON.stringify(orderData, null, 2));

        console.log(`✅ Fetched ${orders.length} orders`);
        console.log(`💾 Saved to: ${filename}`);

        return {
          success: true,
          ordersCount: orders.length,
          filename: filename,
          filepath: filepath,
          orders: orders
        };
      } else {
        console.log('ℹ️  No orders found for the specified period');
        return {
          success: true,
          ordersCount: 0,
          orders: []
        };
      }
    } catch (error) {
      console.error('❌ Error fetching orders:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async fetchOrdersByDateRange(startDate, endDate, tradeType = 'SELL') {
    console.log(`📥 Fetching ${tradeType} orders from ${startDate} to ${endDate}...`);

    try {
      const response = await this.binanceService.getP2POrdersByDateRange(startDate, endDate, tradeType);

      if (response.data && response.data.length > 0) {
        const orders = response.data.map(order =>
          this.binanceService.convertP2POrderToInternalFormat(order)
        );

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `binance-orders-${tradeType.toLowerCase()}-${startDate}_to_${endDate}-${timestamp}.json`;
        const filepath = path.join(this.ordersDir, filename);

        const orderData = {
          code: "000000",
          message: null,
          messageDetail: null,
          data: orders,
          total: orders.length,
          success: true,
          fetchedAt: new Date().toISOString(),
          source: 'BINANCE_API',
          tradeType: tradeType,
          dateRange: {
            startDate: startDate,
            endDate: endDate,
            startTime: new Date(startDate).getTime(),
            endTime: new Date(endDate).getTime()
          }
        };

        fs.writeFileSync(filepath, JSON.stringify(orderData, null, 2));

        console.log(`✅ Fetched ${orders.length} orders`);
        console.log(`💾 Saved to: ${filename}`);

        return {
          success: true,
          ordersCount: orders.length,
          filename: filename,
          filepath: filepath,
          orders: orders
        };
      } else {
        console.log('ℹ️  No orders found for the specified date range');
        return {
          success: true,
          ordersCount: 0,
          orders: []
        };
      }
    } catch (error) {
      console.error('❌ Error fetching orders:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async fetchCurrentMonthOrders(tradeType = 'SELL') {
    const now = new Date();
    const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    console.log(`📅 Fetching current month (${monthName}) ${tradeType} orders...`);

    try {
      const response = await this.binanceService.getCurrentMonthP2POrders(tradeType);

      if (response.data && response.data.length > 0) {
        const orders = response.data.map(order =>
          this.binanceService.convertP2POrderToInternalFormat(order)
        );

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `binance-orders-${tradeType.toLowerCase()}-current-month-${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${timestamp}.json`;
        const filepath = path.join(this.ordersDir, filename);

        const orderData = {
          code: "000000",
          message: null,
          messageDetail: null,
          data: orders,
          total: orders.length,
          success: true,
          fetchedAt: new Date().toISOString(),
          source: 'BINANCE_API',
          tradeType: tradeType,
          period: 'CURRENT_MONTH',
          month: {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            monthName: monthName
          }
        };

        fs.writeFileSync(filepath, JSON.stringify(orderData, null, 2));

        console.log(`✅ Fetched ${orders.length} orders for ${monthName}`);
        console.log(`💾 Saved to: ${filename}`);

        return {
          success: true,
          ordersCount: orders.length,
          filename: filename,
          filepath: filepath,
          orders: orders,
          month: monthName
        };
      } else {
        console.log(`ℹ️  No orders found for current month (${monthName})`);
        return {
          success: true,
          ordersCount: 0,
          orders: [],
          month: monthName
        };
      }
    } catch (error) {
      console.error('❌ Error fetching current month orders:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async fetchAndProcess(options = {}) {
    const {
      days = 7,
      tradeType = 'SELL',
      autoProcess = false
    } = options;

    console.log('🚀 Starting Binance order fetch and process...');

    try {
      // Fetch orders
      const fetchResult = await this.fetchRecentOrders(days, tradeType);

      if (!fetchResult.success) {
        throw new Error(fetchResult.error);
      }

      if (fetchResult.ordersCount === 0) {
        console.log('✅ No new orders to process');
        return fetchResult;
      }

      // Optionally auto-process to invoices
      if (autoProcess) {
        console.log('\n🔄 Auto-processing orders to invoices...');

        // Import the order processing function
        const { processOrderFiles } = require('./convertOrders');
        const conversionResult = await processOrderFiles();

        fetchResult.processed = conversionResult;
      }

      return fetchResult;
    } catch (error) {
      console.error('❌ Fetch and process failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Database-first approach: Fetch and store directly to database
  async fetchToDatabase(options = {}) {
    const {
      days = 7,
      tradeType = 'SELL'
    } = options;

    console.log(`📥 Fetching ${tradeType} orders from last ${days} days directly to database...`);

    try {
      const response = await this.binanceService.getRecentP2POrders(tradeType, days);

      if (response.data && response.data.length > 0) {
        // Convert to our expected format
        const orders = response.data.map(order =>
          this.binanceService.convertP2POrderToInternalFormat(order)
        );

        // Store directly to database
        const dbTracker = new DatabaseOrderTracker();
        try {
          await dbTracker.initialize();
          const insertedCount = await dbTracker.insertOrders(orders);

          console.log(`✅ Fetched ${orders.length} orders`);
          console.log(`💾 Stored ${insertedCount} new orders to database`);

          return {
            success: true,
            ordersCount: orders.length,
            newOrdersCount: insertedCount,
            orders: orders
          };
        } finally {
          await dbTracker.close();
        }
      } else {
        console.log('ℹ️  No orders found for the specified period');
        return {
          success: true,
          ordersCount: 0,
          newOrdersCount: 0,
          orders: []
        };
      }
    } catch (error) {
      console.error('❌ Error fetching orders to database:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const fetcher = new BinanceOrderFetcher();

  try {
    await fetcher.initialize();

    switch (command) {
      case 'recent':
        const days = parseInt(args[1]) || 7;
        const tradeType = args[2] || 'SELL';
        await fetcher.fetchRecentOrders(days, tradeType);
        break;

      case 'month':
      case 'current-month':
        const monthTradeType = args[1] || 'SELL';
        await fetcher.fetchCurrentMonthOrders(monthTradeType);
        break;

      case 'range':
        const startDate = args[1];
        const endDate = args[2];
        const rangeTradeType = args[3] || 'SELL';

        if (!startDate || !endDate) {
          console.log('Usage: node fetchBinanceOrders.js range YYYY-MM-DD YYYY-MM-DD [SELL|BUY]');
          process.exit(1);
        }

        await fetcher.fetchOrdersByDateRange(startDate, endDate, rangeTradeType);
        break;

      case 'auto':
        const autoDays = parseInt(args[1]) || 7;
        const autoTradeType = args[2] || 'SELL';
        await fetcher.fetchAndProcess({
          days: autoDays,
          tradeType: autoTradeType,
          autoProcess: true
        });
        break;

      case 'test':
        console.log('✅ Binance API connection test completed successfully');
        break;

      default:
        console.log('Usage:');
        console.log('  node fetchBinanceOrders.js recent [days] [SELL|BUY]     - Fetch recent orders');
        console.log('  node fetchBinanceOrders.js month [SELL|BUY]             - Fetch current month orders');
        console.log('  node fetchBinanceOrders.js range start end [SELL|BUY]   - Fetch orders by date range');
        console.log('  node fetchBinanceOrders.js auto [days] [SELL|BUY]       - Fetch and auto-process');
        console.log('  node fetchBinanceOrders.js test                          - Test API connection');
        console.log('');
        console.log('Examples:');
        console.log('  node fetchBinanceOrders.js recent 7 SELL');
        console.log('  node fetchBinanceOrders.js month SELL                   - Current month SELL orders');
        console.log('  node fetchBinanceOrders.js range 2025-09-15 2025-09-20 SELL');
        console.log('  node fetchBinanceOrders.js auto 7 SELL');
        break;
    }
  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = BinanceOrderFetcher;