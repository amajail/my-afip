/**
 * Centralized Configuration Module
 *
 * This module loads and validates all environment variables in one place.
 * All other modules should import configuration from here instead of
 * directly accessing process.env.
 *
 * Benefits:
 * - Single source of truth for configuration
 * - Easier to mock for testing
 * - Type coercion and validation in one place
 * - Clear documentation of all required environment variables
 */

require('dotenv').config();

/**
 * Parse integer from environment variable with fallback
 */
function getInt(key, defaultValue) {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get required environment variable or throw error
 */
function getRequired(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Get optional environment variable with fallback
 */
function get(key, defaultValue = '') {
  return process.env[key] || defaultValue;
}

// Export configuration object
module.exports = {
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
  },

  // Helper method to check if running in production
  isProduction() {
    return this.afip.environment === 'production';
  },

  // Helper method to check if running in test mode
  isTest() {
    return process.env.NODE_ENV === 'test';
  }
};
