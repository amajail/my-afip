/**
 * Errors Tests
 *
 * Comprehensive tests for custom error classes and ErrorHandler utility
 */

const {
  ApplicationError,
  AfipError,
  AfipAuthenticationError,
  AfipInvoiceRejectedError,
  AfipConnectionError,
  AfipValidationError,
  BinanceError,
  BinanceAuthenticationError,
  BinanceConnectionError,
  BinanceRateLimitError,
  DatabaseError,
  DatabaseConnectionError,
  DatabaseConstraintError,
  DatabaseQueryError,
  ValidationError,
  InvalidCUITError,
  InvalidAmountError,
  InvalidDateError,
  ConfigurationError,
  FileSystemError,
  ErrorHandler
} = require('../../../src/utils/errors');

describe('Error Classes', () => {
  describe('ApplicationError', () => {
    it('should create error with message, code, and context', () => {
      const error = new ApplicationError('Test error', 'TEST_CODE', { foo: 'bar' });

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.context).toEqual({ foo: 'bar' });
      expect(error.name).toBe('ApplicationError');
      expect(error.timestamp).toBeDefined();
      expect(error.stack).toBeDefined();
    });

    it('should have default empty context', () => {
      const error = new ApplicationError('Test error', 'TEST_CODE');
      expect(error.context).toEqual({});
    });

    it('should convert to JSON', () => {
      const error = new ApplicationError('Test error', 'TEST_CODE', { foo: 'bar' });
      const json = error.toJSON();

      expect(json).toHaveProperty('name', 'ApplicationError');
      expect(json).toHaveProperty('message', 'Test error');
      expect(json).toHaveProperty('code', 'TEST_CODE');
      expect(json).toHaveProperty('context', { foo: 'bar' });
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('stack');
    });

    it('should get user message', () => {
      const error = new ApplicationError('Technical error message', 'TEST_CODE');
      expect(error.getUserMessage()).toBe('Technical error message');
    });
  });

  describe('AFIP Errors', () => {
    describe('AfipError', () => {
      it('should create AFIP error', () => {
        const error = new AfipError('AFIP service error');

        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.message).toBe('AFIP service error');
        expect(error.code).toBe('AFIP_ERROR');
      });

      it('should allow custom code', () => {
        const error = new AfipError('Custom AFIP error', 'CUSTOM_CODE');
        expect(error.code).toBe('CUSTOM_CODE');
      });
    });

    describe('AfipAuthenticationError', () => {
      it('should create authentication error', () => {
        const error = new AfipAuthenticationError('Invalid certificate');

        expect(error).toBeInstanceOf(AfipError);
        expect(error.code).toBe('AFIP_AUTH_ERROR');
        expect(error.message).toBe('Invalid certificate');
      });

      it('should provide user-friendly message', () => {
        const error = new AfipAuthenticationError('Certificate expired');
        expect(error.getUserMessage()).toBe(
          'AFIP authentication failed. Please check your certificate and key files.'
        );
      });
    });

    describe('AfipInvoiceRejectedError', () => {
      it('should create invoice rejected error with AFIP response', () => {
        const afipResponse = { Errors: ['Invalid amount'], Result: 'R' };
        const error = new AfipInvoiceRejectedError(
          'Invoice rejected',
          afipResponse,
          { orderNumber: '123' }
        );

        expect(error).toBeInstanceOf(AfipError);
        expect(error.code).toBe('AFIP_INVOICE_REJECTED');
        expect(error.afipResponse).toEqual(afipResponse);
        expect(error.context.afipResponse).toEqual(afipResponse);
        expect(error.context.orderNumber).toBe('123');
      });

      it('should provide user-friendly message', () => {
        const error = new AfipInvoiceRejectedError('Amount exceeds limit', {});
        expect(error.getUserMessage()).toBe('AFIP rejected the invoice: Amount exceeds limit');
      });
    });

    describe('AfipConnectionError', () => {
      it('should create connection error', () => {
        const error = new AfipConnectionError('Network timeout');

        expect(error).toBeInstanceOf(AfipError);
        expect(error.code).toBe('AFIP_CONNECTION_ERROR');
        expect(error.retryable).toBe(true);
      });

      it('should provide user-friendly message', () => {
        const error = new AfipConnectionError('Connection failed');
        expect(error.getUserMessage()).toBe(
          'Unable to connect to AFIP servers. Please check your internet connection and try again.'
        );
      });
    });

    describe('AfipValidationError', () => {
      it('should create validation error with validation details', () => {
        const validationErrors = ['Invalid CUIT', 'Invalid amount'];
        const error = new AfipValidationError('Validation failed', validationErrors);

        expect(error).toBeInstanceOf(AfipError);
        expect(error.code).toBe('AFIP_VALIDATION_ERROR');
        expect(error.validationErrors).toEqual(validationErrors);
        expect(error.context.validationErrors).toEqual(validationErrors);
      });

      it('should provide user-friendly message', () => {
        const error = new AfipValidationError('CUIT format invalid', []);
        expect(error.getUserMessage()).toBe('Invoice validation failed: CUIT format invalid');
      });
    });
  });

  describe('Binance Errors', () => {
    describe('BinanceError', () => {
      it('should create Binance error', () => {
        const error = new BinanceError('API error');

        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe('BINANCE_ERROR');
      });
    });

    describe('BinanceAuthenticationError', () => {
      it('should create authentication error', () => {
        const error = new BinanceAuthenticationError('Invalid API key');

        expect(error).toBeInstanceOf(BinanceError);
        expect(error.code).toBe('BINANCE_AUTH_ERROR');
      });

      it('should provide user-friendly message', () => {
        const error = new BinanceAuthenticationError('Auth failed');
        expect(error.getUserMessage()).toBe(
          'Binance API authentication failed. Please check your API key and secret.'
        );
      });
    });

    describe('BinanceConnectionError', () => {
      it('should create connection error', () => {
        const error = new BinanceConnectionError('Network error');

        expect(error).toBeInstanceOf(BinanceError);
        expect(error.code).toBe('BINANCE_CONNECTION_ERROR');
        expect(error.retryable).toBe(true);
      });

      it('should provide user-friendly message', () => {
        const error = new BinanceConnectionError('Connection timeout');
        expect(error.getUserMessage()).toBe(
          'Unable to connect to Binance API. Please check your internet connection and try again.'
        );
      });
    });

    describe('BinanceRateLimitError', () => {
      it('should create rate limit error', () => {
        const error = new BinanceRateLimitError('Rate limit exceeded', 120);

        expect(error).toBeInstanceOf(BinanceError);
        expect(error.code).toBe('BINANCE_RATE_LIMIT');
        expect(error.retryAfter).toBe(120);
        expect(error.context.retryAfter).toBe(120);
        expect(error.retryable).toBe(true);
      });

      it('should provide user-friendly message with retry time', () => {
        const error = new BinanceRateLimitError('Too many requests', 90);
        expect(error.getUserMessage()).toBe(
          'Binance API rate limit exceeded. Please wait 90 seconds and try again.'
        );
      });

      it('should provide default retry time if not specified', () => {
        const error = new BinanceRateLimitError('Too many requests', null);
        expect(error.getUserMessage()).toBe(
          'Binance API rate limit exceeded. Please wait 60 seconds and try again.'
        );
      });
    });
  });

  describe('Database Errors', () => {
    describe('DatabaseError', () => {
      it('should create database error', () => {
        const error = new DatabaseError('Query failed');

        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe('DATABASE_ERROR');
      });
    });

    describe('DatabaseConnectionError', () => {
      it('should create connection error', () => {
        const error = new DatabaseConnectionError('Connection refused');

        expect(error).toBeInstanceOf(DatabaseError);
        expect(error.code).toBe('DATABASE_CONNECTION_ERROR');
      });

      it('should provide user-friendly message', () => {
        const error = new DatabaseConnectionError('DB offline');
        expect(error.getUserMessage()).toBe(
          'Database connection failed. Please check database configuration.'
        );
      });
    });

    describe('DatabaseConstraintError', () => {
      it('should create constraint error', () => {
        const error = new DatabaseConstraintError('Unique constraint', 'UNIQUE_ORDER_NUMBER');

        expect(error).toBeInstanceOf(DatabaseError);
        expect(error.code).toBe('DATABASE_CONSTRAINT_ERROR');
        expect(error.constraint).toBe('UNIQUE_ORDER_NUMBER');
        expect(error.context.constraint).toBe('UNIQUE_ORDER_NUMBER');
      });

      it('should provide user-friendly message', () => {
        const error = new DatabaseConstraintError('Duplicate key', 'PRIMARY_KEY');
        expect(error.getUserMessage()).toBe('Database constraint violation: Duplicate key');
      });
    });

    describe('DatabaseQueryError', () => {
      it('should create query error', () => {
        const query = 'SELECT * FROM invalid_table';
        const error = new DatabaseQueryError('Table not found', query);

        expect(error).toBeInstanceOf(DatabaseError);
        expect(error.code).toBe('DATABASE_QUERY_ERROR');
        expect(error.context.query).toBe(query);
      });

      it('should provide user-friendly message', () => {
        const error = new DatabaseQueryError('Syntax error', 'SELECT *');
        expect(error.getUserMessage()).toBe(
          'Database query failed. Please contact support if this persists.'
        );
      });
    });
  });

  describe('Validation Errors', () => {
    describe('ValidationError', () => {
      it('should create validation error', () => {
        const error = new ValidationError('Invalid value', 'email', 'not-an-email');

        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.field).toBe('email');
        expect(error.value).toBe('not-an-email');
        expect(error.context.field).toBe('email');
        expect(error.context.value).toBe('not-an-email');
      });

      it('should provide user-friendly message', () => {
        const error = new ValidationError('Must be a number', 'amount', 'abc');
        expect(error.getUserMessage()).toBe('Validation failed for amount: Must be a number');
      });
    });

    describe('InvalidCUITError', () => {
      it('should create invalid CUIT error', () => {
        const error = new InvalidCUITError('12345');

        expect(error).toBeInstanceOf(ValidationError);
        expect(error.field).toBe('cuit');
        expect(error.value).toBe('12345');
        expect(error.message).toBe('Invalid CUIT format: 12345');
      });

      it('should provide user-friendly message', () => {
        const error = new InvalidCUITError('12345');
        expect(error.getUserMessage()).toBe('Invalid CUIT format. CUIT must be 11 digits.');
      });
    });

    describe('InvalidAmountError', () => {
      it('should create invalid amount error', () => {
        const error = new InvalidAmountError(-100, 'Amount must be positive');

        expect(error).toBeInstanceOf(ValidationError);
        expect(error.field).toBe('amount');
        expect(error.value).toBe(-100);
        expect(error.message).toBe('Invalid amount: -100 - Amount must be positive');
      });

      it('should provide user-friendly message', () => {
        const error = new InvalidAmountError(0, 'Must be greater than zero');
        expect(error.getUserMessage()).toContain('Invalid amount:');
      });
    });

    describe('InvalidDateError', () => {
      it('should create invalid date error', () => {
        const error = new InvalidDateError('2025-13-01', 'Month out of range');

        expect(error).toBeInstanceOf(ValidationError);
        expect(error.field).toBe('date');
        expect(error.value).toBe('2025-13-01');
        expect(error.message).toBe('Invalid date: 2025-13-01 - Month out of range');
      });

      it('should provide user-friendly message', () => {
        const error = new InvalidDateError('invalid', 'Not a date');
        expect(error.getUserMessage()).toContain('Invalid date:');
      });
    });
  });

  describe('Other Errors', () => {
    describe('ConfigurationError', () => {
      it('should create configuration error', () => {
        const error = new ConfigurationError('Missing config', ['API_KEY', 'SECRET']);

        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe('CONFIGURATION_ERROR');
        expect(error.missingKeys).toEqual(['API_KEY', 'SECRET']);
        expect(error.context.missingKeys).toEqual(['API_KEY', 'SECRET']);
      });

      it('should provide user-friendly message with missing keys', () => {
        const error = new ConfigurationError('Config error', ['DB_HOST', 'DB_PORT']);
        expect(error.getUserMessage()).toBe(
          'Configuration error: Missing required environment variables: DB_HOST, DB_PORT'
        );
      });

      it('should provide generic message without missing keys', () => {
        const error = new ConfigurationError('Invalid format', []);
        expect(error.getUserMessage()).toBe('Configuration error: Invalid format');
      });
    });

    describe('FileSystemError', () => {
      it('should create file system error', () => {
        const error = new FileSystemError('File not found', '/path/to/file.txt', 'read');

        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe('FILESYSTEM_ERROR');
        expect(error.filePath).toBe('/path/to/file.txt');
        expect(error.operation).toBe('read');
        expect(error.context.filePath).toBe('/path/to/file.txt');
        expect(error.context.operation).toBe('read');
      });

      it('should provide user-friendly message', () => {
        const error = new FileSystemError('Permission denied', '/tmp/file', 'write');
        expect(error.getUserMessage()).toBe(
          'File write failed for /tmp/file: Permission denied'
        );
      });
    });
  });

  describe('ErrorHandler', () => {
    describe('isRetryable', () => {
      it('should identify retryable errors by flag', () => {
        const error = new ApplicationError('Test', 'TEST');
        error.retryable = true;

        expect(ErrorHandler.isRetryable(error)).toBe(true);
      });

      it('should identify AfipConnectionError as retryable', () => {
        const error = new AfipConnectionError('Timeout');
        expect(ErrorHandler.isRetryable(error)).toBe(true);
      });

      it('should identify BinanceConnectionError as retryable', () => {
        const error = new BinanceConnectionError('Network error');
        expect(ErrorHandler.isRetryable(error)).toBe(true);
      });

      it('should identify BinanceRateLimitError as retryable', () => {
        const error = new BinanceRateLimitError('Rate limit', 60);
        expect(ErrorHandler.isRetryable(error)).toBe(true);
      });

      it('should identify non-retryable errors', () => {
        const error = new InvalidCUITError('12345');
        expect(ErrorHandler.isRetryable(error)).toBe(false);
      });
    });

    describe('getRetryDelay', () => {
      it('should return retry delay from BinanceRateLimitError', () => {
        const error = new BinanceRateLimitError('Rate limit', 120);
        expect(ErrorHandler.getRetryDelay(error, 1)).toBe(120000); // 120 seconds in ms
      });

      it('should use exponential backoff for attempt 1', () => {
        const error = new AfipConnectionError('Timeout');
        expect(ErrorHandler.getRetryDelay(error, 1)).toBe(1000); // 1s
      });

      it('should use exponential backoff for attempt 2', () => {
        const error = new AfipConnectionError('Timeout');
        expect(ErrorHandler.getRetryDelay(error, 2)).toBe(2000); // 2s
      });

      it('should use exponential backoff for attempt 3', () => {
        const error = new AfipConnectionError('Timeout');
        expect(ErrorHandler.getRetryDelay(error, 3)).toBe(4000); // 4s
      });

      it('should cap exponential backoff at 30 seconds', () => {
        const error = new AfipConnectionError('Timeout');
        expect(ErrorHandler.getRetryDelay(error, 10)).toBe(30000); // max 30s
      });
    });

    describe('wrap', () => {
      it('should return ApplicationError as-is', () => {
        const error = new AfipError('Test error');
        const wrapped = ErrorHandler.wrap(error);

        expect(wrapped).toBe(error);
      });

      it('should wrap SQLite constraint errors', () => {
        const nativeError = new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed');
        nativeError.code = 'SQLITE_CONSTRAINT';

        const wrapped = ErrorHandler.wrap(nativeError, { table: 'orders' });

        expect(wrapped).toBeInstanceOf(DatabaseConstraintError);
        expect(wrapped.code).toBe('DATABASE_CONSTRAINT_ERROR');
        expect(wrapped.context.table).toBe('orders');
      });

      it('should wrap ENOTFOUND errors as connection errors', () => {
        const nativeError = new Error('getaddrinfo ENOTFOUND api.afip.gov.ar');
        nativeError.code = 'ENOTFOUND';

        const wrapped = ErrorHandler.wrap(nativeError);

        expect(wrapped).toBeInstanceOf(AfipConnectionError);
        expect(wrapped.code).toBe('AFIP_CONNECTION_ERROR');
        expect(wrapped.context.originalError).toBe('ENOTFOUND');
      });

      it('should wrap ECONNREFUSED errors as connection errors', () => {
        const nativeError = new Error('connect ECONNREFUSED 127.0.0.1:3000');
        nativeError.code = 'ECONNREFUSED';

        const wrapped = ErrorHandler.wrap(nativeError);

        expect(wrapped).toBeInstanceOf(AfipConnectionError);
        expect(wrapped.code).toBe('AFIP_CONNECTION_ERROR');
      });

      it('should wrap ENOENT errors as file system errors', () => {
        const nativeError = new Error('ENOENT: no such file or directory');
        nativeError.code = 'ENOENT';
        nativeError.path = '/path/to/file.txt';

        const wrapped = ErrorHandler.wrap(nativeError);

        expect(wrapped).toBeInstanceOf(FileSystemError);
        expect(wrapped.code).toBe('FILESYSTEM_ERROR');
        expect(wrapped.filePath).toBe('/path/to/file.txt');
        expect(wrapped.operation).toBe('read');
      });

      it('should wrap EACCES errors as file system errors', () => {
        const nativeError = new Error('EACCES: permission denied');
        nativeError.code = 'EACCES';
        nativeError.path = '/root/file.txt';

        const wrapped = ErrorHandler.wrap(nativeError);

        expect(wrapped).toBeInstanceOf(FileSystemError);
        expect(wrapped.operation).toBe('access');
      });

      it('should wrap unknown errors as generic ApplicationError', () => {
        const nativeError = new Error('Unknown error');
        nativeError.code = 'UNKNOWN';

        const wrapped = ErrorHandler.wrap(nativeError, { source: 'test' });

        expect(wrapped).toBeInstanceOf(ApplicationError);
        expect(wrapped.code).toBe('UNKNOWN_ERROR');
        expect(wrapped.context.originalError).toBe('Error');
        expect(wrapped.context.originalCode).toBe('UNKNOWN');
        expect(wrapped.context.source).toBe('test');
      });
    });

    describe('formatForLogging', () => {
      it('should format ApplicationError for logging', () => {
        const error = new AfipError('Test error', 'TEST_CODE', { foo: 'bar' });
        const formatted = ErrorHandler.formatForLogging(error);

        expect(formatted).toHaveProperty('name', 'AfipError');
        expect(formatted).toHaveProperty('code', 'TEST_CODE');
        expect(formatted).toHaveProperty('message', 'Test error');
        expect(formatted).toHaveProperty('context', { foo: 'bar' });
        expect(formatted).toHaveProperty('timestamp');
        expect(formatted).toHaveProperty('stack');
      });

      it('should format native Error for logging', () => {
        const error = new Error('Native error');
        error.code = 'NATIVE_CODE';

        const formatted = ErrorHandler.formatForLogging(error);

        expect(formatted).toHaveProperty('name', 'Error');
        expect(formatted).toHaveProperty('message', 'Native error');
        expect(formatted).toHaveProperty('code', 'NATIVE_CODE');
        expect(formatted).toHaveProperty('stack');
      });

      it('should handle errors without code', () => {
        const error = new Error('Simple error');
        const formatted = ErrorHandler.formatForLogging(error);

        expect(formatted.name).toBe('Error');
        expect(formatted.code).toBeUndefined();
      });
    });
  });
});
