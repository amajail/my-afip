/**
 * Custom Error Classes for AFIP Invoice Application
 *
 * Provides structured error handling with context, error codes, and recovery hints.
 * All errors include:
 * - Descriptive message
 * - Error code for programmatic handling
 * - Context data for debugging
 * - Recovery hints where applicable
 */

/**
 * Base application error class
 * All custom errors extend from this
 */
class ApplicationError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON format for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage() {
    return this.message;
  }
}

/**
 * AFIP Service Errors
 */
class AfipError extends ApplicationError {
  constructor(message, code = 'AFIP_ERROR', context = {}) {
    super(message, code, context);
  }
}

class AfipAuthenticationError extends AfipError {
  constructor(message, context = {}) {
    super(message, 'AFIP_AUTH_ERROR', context);
  }

  getUserMessage() {
    return 'AFIP authentication failed. Please check your certificate and key files.';
  }
}

class AfipInvoiceRejectedError extends AfipError {
  constructor(message, afipResponse, context = {}) {
    super(message, 'AFIP_INVOICE_REJECTED', { ...context, afipResponse });
    this.afipResponse = afipResponse;
  }

  getUserMessage() {
    return `AFIP rejected the invoice: ${this.message}`;
  }
}

class AfipConnectionError extends AfipError {
  constructor(message, context = {}) {
    super(message, 'AFIP_CONNECTION_ERROR', context);
    this.retryable = true;
  }

  getUserMessage() {
    return 'Unable to connect to AFIP servers. Please check your internet connection and try again.';
  }
}

class AfipValidationError extends AfipError {
  constructor(message, validationErrors, context = {}) {
    super(message, 'AFIP_VALIDATION_ERROR', { ...context, validationErrors });
    this.validationErrors = validationErrors;
  }

  getUserMessage() {
    return `Invoice validation failed: ${this.message}`;
  }
}

/**
 * Binance Service Errors
 */
class BinanceError extends ApplicationError {
  constructor(message, code = 'BINANCE_ERROR', context = {}) {
    super(message, code, context);
  }
}

class BinanceAuthenticationError extends BinanceError {
  constructor(message, context = {}) {
    super(message, 'BINANCE_AUTH_ERROR', context);
  }

  getUserMessage() {
    return 'Binance API authentication failed. Please check your API key and secret.';
  }
}

class BinanceConnectionError extends BinanceError {
  constructor(message, context = {}) {
    super(message, 'BINANCE_CONNECTION_ERROR', context);
    this.retryable = true;
  }

  getUserMessage() {
    return 'Unable to connect to Binance API. Please check your internet connection and try again.';
  }
}

class BinanceRateLimitError extends BinanceError {
  constructor(message, retryAfter, context = {}) {
    super(message, 'BINANCE_RATE_LIMIT', { ...context, retryAfter });
    this.retryAfter = retryAfter;
    this.retryable = true;
  }

  getUserMessage() {
    return `Binance API rate limit exceeded. Please wait ${this.retryAfter || 60} seconds and try again.`;
  }
}

/**
 * Database Errors
 */
class DatabaseError extends ApplicationError {
  constructor(message, code = 'DATABASE_ERROR', context = {}) {
    super(message, code, context);
  }
}

class DatabaseConnectionError extends DatabaseError {
  constructor(message, context = {}) {
    super(message, 'DATABASE_CONNECTION_ERROR', context);
  }

  getUserMessage() {
    return 'Database connection failed. Please check database configuration.';
  }
}

class DatabaseConstraintError extends DatabaseError {
  constructor(message, constraint, context = {}) {
    super(message, 'DATABASE_CONSTRAINT_ERROR', { ...context, constraint });
    this.constraint = constraint;
  }

  getUserMessage() {
    return `Database constraint violation: ${this.message}`;
  }
}

class DatabaseQueryError extends DatabaseError {
  constructor(message, query, context = {}) {
    super(message, 'DATABASE_QUERY_ERROR', { ...context, query });
  }

  getUserMessage() {
    return 'Database query failed. Please contact support if this persists.';
  }
}

/**
 * Validation Errors
 */
class ValidationError extends ApplicationError {
  constructor(message, field, value, context = {}) {
    super(message, 'VALIDATION_ERROR', { ...context, field, value });
    this.field = field;
    this.value = value;
  }

  getUserMessage() {
    return `Validation failed for ${this.field}: ${this.message}`;
  }
}

class InvalidCUITError extends ValidationError {
  constructor(cuit, context = {}) {
    super(`Invalid CUIT format: ${cuit}`, 'cuit', cuit, context);
  }

  getUserMessage() {
    return `Invalid CUIT format. CUIT must be 11 digits.`;
  }
}

class InvalidAmountError extends ValidationError {
  constructor(amount, reason, context = {}) {
    super(`Invalid amount: ${amount} - ${reason}`, 'amount', amount, context);
  }

  getUserMessage() {
    return `Invalid amount: ${this.message}`;
  }
}

class InvalidDateError extends ValidationError {
  constructor(date, reason, context = {}) {
    super(`Invalid date: ${date} - ${reason}`, 'date', date, context);
  }

  getUserMessage() {
    return `Invalid date: ${this.message}`;
  }
}

/**
 * Configuration Errors
 */
class ConfigurationError extends ApplicationError {
  constructor(message, missingKeys = [], context = {}) {
    super(message, 'CONFIGURATION_ERROR', { ...context, missingKeys });
    this.missingKeys = missingKeys;
  }

  getUserMessage() {
    if (this.missingKeys.length > 0) {
      return `Configuration error: Missing required environment variables: ${this.missingKeys.join(', ')}`;
    }
    return `Configuration error: ${this.message}`;
  }
}

/**
 * File System Errors
 */
class FileSystemError extends ApplicationError {
  constructor(message, filePath, operation, context = {}) {
    super(message, 'FILESYSTEM_ERROR', { ...context, filePath, operation });
    this.filePath = filePath;
    this.operation = operation;
  }

  getUserMessage() {
    return `File ${this.operation} failed for ${this.filePath}: ${this.message}`;
  }
}

/**
 * Error Handler Utility
 */
class ErrorHandler {
  /**
   * Determine if error is retryable
   */
  static isRetryable(error) {
    return error.retryable === true ||
           error instanceof AfipConnectionError ||
           error instanceof BinanceConnectionError ||
           error instanceof BinanceRateLimitError;
  }

  /**
   * Get retry delay in milliseconds
   */
  static getRetryDelay(error, attempt = 1) {
    if (error instanceof BinanceRateLimitError && error.retryAfter) {
      return error.retryAfter * 1000;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    return Math.min(1000 * Math.pow(2, attempt - 1), 30000);
  }

  /**
   * Wrap native errors in application errors
   */
  static wrap(error, context = {}) {
    // Already an application error
    if (error instanceof ApplicationError) {
      return error;
    }

    // SQLite/Database errors
    if (error.message?.includes('SQLITE') || error.code === 'SQLITE_CONSTRAINT') {
      return new DatabaseConstraintError(error.message, error.code, context);
    }

    // Network errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return new AfipConnectionError(error.message, { originalError: error.code, ...context });
    }

    // File system errors
    if (error.code === 'ENOENT' || error.code === 'EACCES') {
      return new FileSystemError(
        error.message,
        error.path,
        error.code === 'ENOENT' ? 'read' : 'access',
        context
      );
    }

    // Generic application error for unknown errors
    return new ApplicationError(error.message, 'UNKNOWN_ERROR', {
      originalError: error.name,
      originalCode: error.code,
      ...context
    });
  }

  /**
   * Format error for logging
   */
  static formatForLogging(error) {
    if (error instanceof ApplicationError) {
      return {
        name: error.name,
        code: error.code,
        message: error.message,
        context: error.context,
        timestamp: error.timestamp,
        stack: error.stack
      };
    }

    return {
      name: error.name || 'Error',
      message: error.message,
      code: error.code,
      stack: error.stack
    };
  }
}

module.exports = {
  // Base
  ApplicationError,

  // AFIP Errors
  AfipError,
  AfipAuthenticationError,
  AfipInvoiceRejectedError,
  AfipConnectionError,
  AfipValidationError,

  // Binance Errors
  BinanceError,
  BinanceAuthenticationError,
  BinanceConnectionError,
  BinanceRateLimitError,

  // Database Errors
  DatabaseError,
  DatabaseConnectionError,
  DatabaseConstraintError,
  DatabaseQueryError,

  // Validation Errors
  ValidationError,
  InvalidCUITError,
  InvalidAmountError,
  InvalidDateError,

  // Other Errors
  ConfigurationError,
  FileSystemError,

  // Utilities
  ErrorHandler
};
