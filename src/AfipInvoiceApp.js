const fs = require('fs');
const path = require('path');
const config = require('./config');
const AfipService = require('./services/AfipService');
const BinanceService = require('./services/BinanceService');
const { ConfigValidator } = require('./utils/validators');

class AfipInvoiceApp {
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

    // Validate all configuration at startup
    console.log('🔍 Validating configuration...');
    try {
      ConfigValidator.validateStartupOrThrow(config);
      console.log('✅ Configuration validated successfully');
    } catch (error) {
      console.error('❌ Configuration validation failed:');
      console.error(error.message);
      throw error;
    }

    await this.afipService.initialize();
    if (!fs.existsSync(path.dirname(this.config.outputPath))) {
      fs.mkdirSync(path.dirname(this.config.outputPath), { recursive: true });
    }
    console.log('✅ Application initialized successfully');
  }
}

module.exports = AfipInvoiceApp;
