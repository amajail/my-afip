const AfipInvoiceApp = require('./AfipInvoiceApp');

async function main() {
  const app = new AfipInvoiceApp();
  // Removed unused BinanceOrderFetcher import after refactor
  try {
    await app.initialize();
    const args = process.argv.slice(2);
    const command = args[0];
    switch (command) {
      case 'process': {
        const inputFile = args[1] || app.config.inputPath;
        await app.processInvoices(inputFile);
        break;
      }
      case 'orders':
        await app.processOrders();
        break;
      case 'status':
        await app.checkOrderStatus();
        break;
      case 'report':
      case 'month-report':
        await app.showCurrentMonthReport();
        break;
      case 'manual': {
        const orderNumber = args[1];
        const cae = args[2];
        const voucherNumber = args[3];
        const notes = args[4] || null;
        if (!orderNumber || !cae || !voucherNumber) {
          console.log('Usage: node src/index.js manual <orderNumber> <CAE> <voucherNumber> [notes]');
          console.log('Example: node src/index.js manual 22798407061264470016 12345678901234 123 "Manual invoice via AFIP portal"');
          process.exit(1);
        }
        await app.markManualInvoice(orderNumber, cae, parseInt(voucherNumber), notes);
        break;
      }
      case 'binance-test':
        await app.testBinanceConnection();
        break;
      case 'binance-fetch': {
        const fetchDays = parseInt(args[1]) || 7;
        const fetchTradeType = args[2] || 'SELL';
        const autoProcess = args[3] === 'true' || args[3] === 'auto';
        await app.fetchBinanceOrders(fetchDays, fetchTradeType, autoProcess);
        break;
      }
      case 'binance-auto': {
        const autoDays = parseInt(args[1]) || 7;
        const autoTradeType = args[2] || 'SELL';
        console.log('🤖 Automatic mode: Fetch from Binance + Process to AFIP');
        await app.fetchBinanceOrders(autoDays, autoTradeType, true);
        break;
      }
      case 'binance-month': {
        const monthTradeType = args[1] || 'SELL';
        await app.fetchBinanceMonth(monthTradeType);
        break;
      }
      case 'sample':
        await app.generateSampleData();
        break;
      default:
        console.log('Usage:');
        console.log('  node src/index.js process [input-file]           - Process invoices from CSV');
        console.log('  node src/index.js orders                         - Convert orders JSON to invoices and process');
        console.log('  node src/index.js status                         - Check processed orders status');
        console.log('  node src/index.js manual <order> <cae> <voucher> - Mark order as manually processed');
        console.log('  node src/index.js binance-test                   - Test Binance API connection');
        console.log('  node src/index.js binance-fetch [days] [type]    - Fetch orders from Binance API');
        console.log('  node src/index.js binance-month [type]           - Fetch current month orders');
        console.log('  node src/index.js binance-auto [days] [type]     - Fetch from Binance + auto-process');
        console.log('  node src/index.js sample                         - Generate sample CSV');
        console.log('');
        console.log('Binance Examples:');
        console.log('  node src/index.js binance-fetch 7 SELL          - Fetch last 7 days of SELL orders');
        console.log('  node src/index.js binance-month SELL            - Current month SELL orders + process');
        console.log('  node src/index.js binance-auto 30 SELL          - Fetch last 30 days + auto-process');
        break;
    }
  } catch (error) {
    console.error('💥 Application error:', error.message);
    process.exit(1);
  }
}

main();
