const AfipInvoiceApp = require('./AfipInvoiceApp');

async function main() {
  const app = new AfipInvoiceApp();

  try {
    await app.initialize();
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case 'binance-auto': {
        const autoDays = parseInt(args[1]) || 7;
        const autoTradeType = args[2] || 'SELL';
        console.log('🤖 Automatic mode: Fetch from Binance + Process to AFIP');
        await app.fetchBinanceOrders(autoDays, autoTradeType, true);
        break;
      }
      case 'report':
        await app.showCurrentMonthReport();
        break;
      default:
        console.log('Available commands:');
        console.log('');
        console.log('  binance-auto [days] [type]  - Fetch Binance orders and auto-process to AFIP');
        console.log('                                Default: 7 days, SELL type');
        console.log('');
        console.log('  report                      - Show current month report');
        console.log('');
        console.log('Examples:');
        console.log('  npm run binance:auto              - Fetch last 7 days of SELL orders + process');
        console.log('  node src/index.js binance-auto 30 - Fetch last 30 days + process');
        console.log('  npm run report                    - Show month report');
        break;
    }
  } catch (error) {
    console.error('💥 Application error:', error.message);
    process.exit(1);
  }
}

main();
