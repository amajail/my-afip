/**
 * Centralized Configuration Module (Refactored)
 *
 * This module provides a unified configuration interface for both
 * Azure Functions API and CLI usage. It loads environment-specific
 * configuration and provides a single source of truth.
 *
 * Architecture:
 * - Shared configuration (AFIP, Binance, Database, App settings)
 * - API-specific configuration (Azure Functions, authentication)
 * - CLI-specific configuration (display, commands)
 * - Environment detection utilities
 */

require('dotenv').config();

const { get, getRequired, getInt } = require('./helpers');
const environment = require('./environment');
const apiConfig = require('./api.config');
const cliConfig = require('./cli.config');

// ===== Core Shared Configuration =====
// Configuration used by both API and CLI

const shared = {
  // AFIP Configuration
  afip: {
    cuit: getRequired('AFIP_CUIT'),
    certPath: getRequired('AFIP_CERT_PATH'),
    keyPath: getRequired('AFIP_KEY_PATH'),
    environment: get('AFIP_ENVIRONMENT', 'production'),
    ptoVta: getInt('AFIP_PTOVTA', 2),
    cacheTokensPath: get('AFIP_CACHE_TOKENS_PATH', './.afip-tokens')
  },

  // Binance API Configuration
  binance: {
    apiKey: getRequired('BINANCE_API_KEY'),
    secretKey: getRequired('BINANCE_SECRET_KEY'),
    apiUrl: get('BINANCE_API_URL', 'https://api.binance.com')
  },

  // Database Configuration
  database: {
    path: get('DB_PATH', './data/afip-orders.db')
  },

  // Application Settings
  app: {
    logLevel: get('LOG_LEVEL', 'info'),
    invoiceInputPath: get('INVOICE_INPUT_PATH', './data/invoices.csv'),
    invoiceOutputPath: get('INVOICE_OUTPUT_PATH', './data/processed')
  }
};

// ===== Unified Configuration Export =====

const config = {
  // Spread shared configuration
  ...shared,

  // Environment utilities
  environment,

  // API-specific configuration (only loaded when in API context)
  api: environment.isAzureFunctions() ? apiConfig : null,

  // CLI-specific configuration (only loaded when in CLI context)
  cli: environment.isCLI() ? cliConfig : null,

  // Helper methods for backward compatibility
  isProduction() {
    return environment.isAfipProduction();
  },

  isTest() {
    return environment.isTest();
  },

  // Get runtime context
  getRuntimeContext() {
    return environment.getRuntimeContext();
  }
};

module.exports = config;
