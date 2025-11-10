/**
 * Abstract Logger Base Class
 *
 * Defines the interface that all logger implementations must follow.
 * Provides standard log levels and helper methods for common logging patterns.
 */

class Logger {
  /**
   * Log levels in order of severity
   */
  static LEVELS = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    HTTP: 'http',
    DEBUG: 'debug'
  };

  /**
   * Log an error message
   * @param {string} message - Error message
   * @param {Object} metadata - Additional context
   */
  error(message, metadata = {}) {
    throw new Error('error() must be implemented by subclass');
  }

  /**
   * Log a warning message
   * @param {string} message - Warning message
   * @param {Object} metadata - Additional context
   */
  warn(message, metadata = {}) {
    throw new Error('warn() must be implemented by subclass');
  }

  /**
   * Log an informational message
   * @param {string} message - Info message
   * @param {Object} metadata - Additional context
   */
  info(message, metadata = {}) {
    throw new Error('info() must be implemented by subclass');
  }

  /**
   * Log an HTTP request/response
   * @param {string} message - HTTP message
   * @param {Object} metadata - Additional context
   */
  http(message, metadata = {}) {
    throw new Error('http() must be implemented by subclass');
  }

  /**
   * Log a debug message
   * @param {string} message - Debug message
   * @param {Object} metadata - Additional context
   */
  debug(message, metadata = {}) {
    throw new Error('debug() must be implemented by subclass');
  }

  /**
   * Log a message at the specified level
   * @param {string} level - Log level (error, warn, info, http, debug)
   * @param {string} message - Log message
   * @param {Object} metadata - Additional context
   */
  log(level, message, metadata = {}) {
    throw new Error('log() must be implemented by subclass');
  }

  // ===== Domain-Specific Helper Methods =====
  // These provide consistent logging for common application events

  /**
   * Log successful invoice creation
   * @param {string} orderNumber - Order number
   * @param {string} cae - AFIP authorization code
   * @param {number} voucherNumber - Invoice voucher number
   */
  logInvoiceCreation(orderNumber, cae, voucherNumber) {
    this.info('Invoice created successfully', {
      orderNumber,
      cae,
      voucherNumber,
      event: 'invoice_created'
    });
  }

  /**
   * Log invoice creation failure
   * @param {string} orderNumber - Order number
   * @param {Error|string} error - Error that occurred
   */
  logInvoiceFailure(orderNumber, error) {
    this.error('Invoice creation failed', {
      orderNumber,
      error: error.message || error,
      event: 'invoice_failed'
    });
  }

  /**
   * Log Binance order event
   * @param {string} orderNumber - Order number
   * @param {number} amount - Order amount
   * @param {string} action - Action performed (fetched, processed, etc.)
   */
  logBinanceOrder(orderNumber, amount, action = 'fetched') {
    this.info(`Binance order ${action}`, {
      orderNumber,
      amount,
      event: `binance_order_${action}`
    });
  }

  /**
   * Log database operation
   * @param {string} operation - Operation name
   * @param {Object} details - Operation details
   */
  logDatabaseOperation(operation, details = {}) {
    this.debug(`Database operation: ${operation}`, {
      operation,
      ...details,
      event: 'database_operation'
    });
  }

  /**
   * Log AFIP API call
   * @param {string} method - API method called
   * @param {Object} details - Call details
   */
  logAfipApiCall(method, details = {}) {
    this.info(`AFIP API call: ${method}`, {
      method,
      ...details,
      event: 'afip_api_call'
    });
  }

  /**
   * Log application startup
   * @param {Object} config - Application configuration summary
   */
  logStartup(config = {}) {
    this.info('Application started', {
      ...config,
      event: 'app_startup'
    });
  }

  /**
   * Log application shutdown
   * @param {Object} stats - Shutdown statistics
   */
  logShutdown(stats = {}) {
    this.info('Application shutting down', {
      ...stats,
      event: 'app_shutdown'
    });
  }
}

module.exports = Logger;
