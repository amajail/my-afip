const fs = require('fs');
const path = require('path');
const config = require('./config');
const AfipService = require('./services/AfipService');
const BinanceService = require('./services/BinanceService');
// Removed unused imports after refactor
const { showCurrentMonthReport } = require('./commands/report');
const { processOrdersDatabase } = require('./commands/orders-db');
const { checkOrderStatus } = require('./commands/status');
const { processInvoices } = require('./commands/process');
const { markManualInvoice } = require('./commands/manual');
const { generateSampleData } = require('./commands/sample');
const { testBinanceConnection, fetchBinanceOrders, fetchBinanceMonth } = require('./commands/binance');

class AfipInvoiceApp {
  async markManualInvoice(orderNumber, cae, voucherNumber, notes) {
    await markManualInvoice(orderNumber, cae, voucherNumber, notes);
  }
  async checkOrderStatus() {
    await checkOrderStatus();
  }

  async generateSampleData() {
    await generateSampleData();
  }
  constructor() {
    // Use centralized configuration
    this.config = {
      cuit: config.afip.cuit,
      certPath: config.afip.certPath,
      keyPath: config.afip.keyPath,
      environment: config.afip.environment,
      inputPath: config.app.invoiceInputPath,
      outputPath: config.app.invoiceOutputPath,
      binanceApiKey: config.binance.apiKey,
      binanceSecretKey: config.binance.secretKey
    };

    this.afipService = new AfipService(this.config);
    this.binanceService = new BinanceService({
      apiKey: this.config.binanceApiKey,
      secretKey: this.config.binanceSecretKey
    });
  }

  async initialize() {
    console.log('🚀 Starting AFIP Invoice Application...');
    if (!this.config.cuit) {
      throw new Error('AFIP_CUIT environment variable is required');
    }
    await this.afipService.initialize();
    if (!fs.existsSync(path.dirname(this.config.outputPath))) {
      fs.mkdirSync(path.dirname(this.config.outputPath), { recursive: true });
    }
    console.log('✅ Application initialized successfully');
  }

  async processInvoices(inputFile) {
    await processInvoices(this, inputFile);
  }

  async testBinanceConnection() {
    await testBinanceConnection(this.binanceService, this.config);
  }

  async fetchBinanceOrders(days = 7, tradeType = 'SELL', autoProcess = false) {
    return await fetchBinanceOrders(this.binanceService, days, tradeType, autoProcess, this.config, this.afipService);
  }

  async fetchBinanceMonth(tradeType) {
    await fetchBinanceMonth(tradeType, this.processOrders.bind(this));
  }

  async processOrders() {
    return await processOrdersDatabase(this.config, this.afipService);
  }

  async showCurrentMonthReport() {
    await showCurrentMonthReport();
  }
}

module.exports = AfipInvoiceApp;
