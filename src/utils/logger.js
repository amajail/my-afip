/**
 * Centralized Logging Utility
 *
 * Uses Winston for structured logging with configurable levels and formats.
 * Replaces console.log/error/warn throughout the application.
 *
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info('Application started');
 *   logger.error('Error occurred', { error: err.message, stack: err.stack });
 *   logger.debug('Debug info', { data: someData });
 */

const winston = require('winston');
const path = require('path');
const config = require('../config');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for console output
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

winston.addColors(colors);

// Custom format for console (development) - human-readable
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;

    let msg = `${timestamp} [${level}]: ${message}`;

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      // Filter out winston internals
      const cleanMeta = { ...meta };
      delete cleanMeta[Symbol.for('level')];
      delete cleanMeta[Symbol.for('message')];
      delete cleanMeta[Symbol.for('splat')];

      if (Object.keys(cleanMeta).length > 0) {
        msg += ` ${JSON.stringify(cleanMeta, null, 2)}`;
      }
    }

    return msg;
  })
);

// JSON format for production - machine-readable
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Determine format based on environment
const logFormat = config.app.environment === 'production' ? jsonFormat : consoleFormat;

// Create logger instance
const logger = winston.createLogger({
  level: config.app.logLevel || 'info',
  levels,
  format: logFormat,
  transports: [
    // Console output (always enabled)
    new winston.transports.Console({
      format: logFormat
    }),

    // Error log file
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),

    // Combined log file (all levels)
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      format: jsonFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  // Handle uncaught exceptions and unhandled rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join('logs', 'exceptions.log'),
      format: jsonFormat
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join('logs', 'rejections.log'),
      format: jsonFormat
    })
  ]
});

// Add helper methods for common logging patterns
logger.logInvoiceCreation = (orderNumber, cae, voucherNumber) => {
  logger.info('Invoice created successfully', {
    orderNumber,
    cae,
    voucherNumber,
    event: 'invoice_created'
  });
};

logger.logInvoiceFailure = (orderNumber, error) => {
  logger.error('Invoice creation failed', {
    orderNumber,
    error: error.message || error,
    event: 'invoice_failed'
  });
};

logger.logBinanceOrder = (orderNumber, amount, action = 'fetched') => {
  logger.info(`Binance order ${action}`, {
    orderNumber,
    amount,
    event: `binance_order_${action}`
  });
};

logger.logDatabaseOperation = (operation, details = {}) => {
  logger.debug(`Database operation: ${operation}`, {
    operation,
    ...details,
    event: 'database_operation'
  });
};

// In test environment, reduce logging noise
if (process.env.NODE_ENV === 'test') {
  logger.transports.forEach(transport => {
    transport.silent = true;
  });
}

module.exports = logger;
