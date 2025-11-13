/**
 * CLI Router
 *
 * Routes CLI commands to appropriate handlers
 * Part of Presentation Layer (CLI)
 */

const BinanceCommand = require('./commands/BinanceCommand');
const ReportCommand = require('./commands/ReportCommand');
const ProcessCommand = require('./commands/ProcessCommand');
const ConsoleFormatter = require('./formatters/ConsoleFormatter');

class CLI {
  constructor(app) {
    this.app = app;
  }

  /**
   * Route command to appropriate handler
   * @param {string} command - Command name
   * @param {Array} args - Command arguments
   */
  async route(command, args = []) {
    try {
      switch (command) {
        case 'binance-auto':
          return await this._handleBinanceAuto(args);

        case 'binance-fetch':
          return await this._handleBinanceFetch(args);

        case 'binance-test':
          return await this._handleBinanceTest();

        case 'report':
          return await this._handleReport(args);

        case 'report-stats':
          return await this._handleReportStats();

        case 'process':
          return await this._handleProcess(args);

        case 'mark-manual':
          return await this._handleMarkManual(args);

        case 'help':
        default:
          this._showHelp();
          break;
      }
    } catch (error) {
      ConsoleFormatter.error('Command execution failed', error);
      process.exit(1);
    }
  }

  /**
   * Handle binance-auto command
   * @private
   */
  async _handleBinanceAuto(args) {
    const days = parseInt(args[0]) || 7;
    const tradeType = args[1] || 'SELL';

    await this.app.initialize();

    return await BinanceCommand.fetchOrders(this.app.binanceService, {
      days,
      tradeType,
      autoProcess: true,
      config: this.app.config,
      afipService: this.app.afipService
    });
  }

  /**
   * Handle binance-fetch command
   * @private
   */
  async _handleBinanceFetch(args) {
    const days = parseInt(args[0]) || 7;
    const tradeType = args[1] || 'SELL';

    await this.app.initialize();

    return await BinanceCommand.fetchOrders(this.app.binanceService, {
      days,
      tradeType,
      autoProcess: false
    });
  }

  /**
   * Handle binance-test command
   * @private
   */
  async _handleBinanceTest() {
    await this.app.initialize();
    return await BinanceCommand.testConnection(
      this.app.binanceService,
      this.app.config
    );
  }

  /**
   * Handle report command
   * @private
   */
  async _handleReport(args) {
    const subcommand = args[0];

    if (subcommand === 'status' && args[1]) {
      return await ReportCommand.showOrdersByStatus(args[1]);
    }

    return await ReportCommand.showMonthlyReport();
  }

  /**
   * Handle report-stats command
   * @private
   */
  async _handleReportStats() {
    return await ReportCommand.showStatistics();
  }

  /**
   * Handle process command
   * @private
   */
  async _handleProcess(args) {
    await this.app.initialize();

    const orderNumber = args[0];

    if (orderNumber) {
      return await ProcessCommand.processOrderByNumber(
        orderNumber,
        this.app.config,
        this.app.afipService
      );
    }

    return await ProcessCommand.processUnprocessedOrders(
      this.app.config,
      this.app.afipService
    );
  }

  /**
   * Handle mark-manual command
   * @private
   */
  async _handleMarkManual(args) {
    const orderNumber = args[0];
    const cae = args[1];

    if (!orderNumber || !cae) {
      ConsoleFormatter.error('Usage: mark-manual <order-number> <cae>');
      process.exit(1);
    }

    return await ProcessCommand.markOrderAsManual(orderNumber, cae);
  }

  /**
   * Show help message
   * @private
   */
  _showHelp() {
    ConsoleFormatter.header('AFIP Invoice Application - CLI Commands');

    ConsoleFormatter.subheader('Binance Commands');
    ConsoleFormatter.listItem('binance-auto [days] [type]    Fetch orders and auto-process (default: 7 days, SELL)');
    ConsoleFormatter.listItem('binance-fetch [days] [type]   Fetch orders without processing');
    ConsoleFormatter.listItem('binance-test                  Test Binance API connection');
    ConsoleFormatter.newLine();

    ConsoleFormatter.subheader('Report Commands');
    ConsoleFormatter.listItem('report                        Show current month invoice report');
    ConsoleFormatter.listItem('report status <status>        Show orders by status (success|failed|pending)');
    ConsoleFormatter.listItem('report-stats                  Show statistics summary');
    ConsoleFormatter.newLine();

    ConsoleFormatter.subheader('Processing Commands');
    ConsoleFormatter.listItem('process                       Process all unprocessed orders');
    ConsoleFormatter.listItem('process <order-number>        Process specific order (not yet implemented)');
    ConsoleFormatter.listItem('mark-manual <order> <cae>     Mark order as manually processed');
    ConsoleFormatter.newLine();

    ConsoleFormatter.subheader('Examples');
    ConsoleFormatter.listItem('npm start binance-auto              # Fetch last 7 days + process', 1);
    ConsoleFormatter.listItem('npm start binance-auto 30 BUY       # Fetch last 30 days BUY orders', 1);
    ConsoleFormatter.listItem('npm start report                    # Show monthly report', 1);
    ConsoleFormatter.listItem('npm start report status failed      # Show failed orders', 1);
    ConsoleFormatter.listItem('npm start process                   # Process pending orders', 1);
    ConsoleFormatter.newLine();

    ConsoleFormatter.subheader('NPM Scripts');
    ConsoleFormatter.listItem('npm run binance:auto          # Same as: npm start binance-auto', 1);
    ConsoleFormatter.listItem('npm run report                # Same as: npm start report', 1);
    ConsoleFormatter.newLine();
  }
}

module.exports = CLI;
