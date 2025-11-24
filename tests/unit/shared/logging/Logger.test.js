/**
 * Logger Tests
 *
 * Tests for the abstract Logger base class
 */

const Logger = require('../../../../src/shared/logging/Logger');

describe('Logger', () => {
  describe('LEVELS constant', () => {
    it('should define all log levels', () => {
      expect(Logger.LEVELS).toEqual({
        ERROR: 'error',
        WARN: 'warn',
        INFO: 'info',
        HTTP: 'http',
        DEBUG: 'debug'
      });
    });
  });

  describe('abstract methods', () => {
    let logger;

    beforeEach(() => {
      logger = new Logger();
    });

    it('should throw error when error() is called without implementation', () => {
      expect(() => logger.error('test message')).toThrow('error() must be implemented by subclass');
    });

    it('should throw error when warn() is called without implementation', () => {
      expect(() => logger.warn('test message')).toThrow('warn() must be implemented by subclass');
    });

    it('should throw error when info() is called without implementation', () => {
      expect(() => logger.info('test message')).toThrow('info() must be implemented by subclass');
    });

    it('should throw error when http() is called without implementation', () => {
      expect(() => logger.http('test message')).toThrow('http() must be implemented by subclass');
    });

    it('should throw error when debug() is called without implementation', () => {
      expect(() => logger.debug('test message')).toThrow('debug() must be implemented by subclass');
    });

    it('should throw error when log() is called without implementation', () => {
      expect(() => logger.log('info', 'test message')).toThrow('log() must be implemented by subclass');
    });
  });

  describe('domain-specific helper methods', () => {
    let logger;
    let mockInfo;
    let mockError;
    let mockDebug;

    beforeEach(() => {
      logger = new Logger();
      mockInfo = jest.fn();
      mockError = jest.fn();
      mockDebug = jest.fn();

      // Override abstract methods with mocks
      logger.info = mockInfo;
      logger.error = mockError;
      logger.debug = mockDebug;
    });

    describe('logInvoiceCreation', () => {
      it('should log invoice creation with correct metadata', () => {
        logger.logInvoiceCreation('12345', 'CAE123', 100);

        expect(mockInfo).toHaveBeenCalledWith('Invoice created successfully', {
          orderNumber: '12345',
          cae: 'CAE123',
          voucherNumber: 100,
          event: 'invoice_created'
        });
      });
    });

    describe('logInvoiceFailure', () => {
      it('should log invoice failure with Error object', () => {
        const error = new Error('AFIP rejected invoice');
        logger.logInvoiceFailure('12345', error);

        expect(mockError).toHaveBeenCalledWith('Invoice creation failed', {
          orderNumber: '12345',
          error: 'AFIP rejected invoice',
          event: 'invoice_failed'
        });
      });

      it('should log invoice failure with string error', () => {
        logger.logInvoiceFailure('12345', 'Network timeout');

        expect(mockError).toHaveBeenCalledWith('Invoice creation failed', {
          orderNumber: '12345',
          error: 'Network timeout',
          event: 'invoice_failed'
        });
      });
    });

    describe('logBinanceOrder', () => {
      it('should log Binance order with default action', () => {
        logger.logBinanceOrder('ORDER123', 1000.50);

        expect(mockInfo).toHaveBeenCalledWith('Binance order fetched', {
          orderNumber: 'ORDER123',
          amount: 1000.50,
          event: 'binance_order_fetched'
        });
      });

      it('should log Binance order with custom action', () => {
        logger.logBinanceOrder('ORDER123', 1000.50, 'processed');

        expect(mockInfo).toHaveBeenCalledWith('Binance order processed', {
          orderNumber: 'ORDER123',
          amount: 1000.50,
          event: 'binance_order_processed'
        });
      });
    });

    describe('logDatabaseOperation', () => {
      it('should log database operation with details', () => {
        logger.logDatabaseOperation('INSERT', {
          table: 'orders',
          rows: 5
        });

        expect(mockDebug).toHaveBeenCalledWith('Database operation: INSERT', {
          operation: 'INSERT',
          table: 'orders',
          rows: 5,
          event: 'database_operation'
        });
      });

      it('should log database operation without details', () => {
        logger.logDatabaseOperation('SELECT');

        expect(mockDebug).toHaveBeenCalledWith('Database operation: SELECT', {
          operation: 'SELECT',
          event: 'database_operation'
        });
      });
    });

    describe('logAfipApiCall', () => {
      it('should log AFIP API call with details', () => {
        logger.logAfipApiCall('createInvoice', {
          voucherNumber: 123,
          amount: 5000
        });

        expect(mockInfo).toHaveBeenCalledWith('AFIP API call: createInvoice', {
          method: 'createInvoice',
          voucherNumber: 123,
          amount: 5000,
          event: 'afip_api_call'
        });
      });

      it('should log AFIP API call without details', () => {
        logger.logAfipApiCall('getLastVoucherNumber');

        expect(mockInfo).toHaveBeenCalledWith('AFIP API call: getLastVoucherNumber', {
          method: 'getLastVoucherNumber',
          event: 'afip_api_call'
        });
      });
    });

    describe('logStartup', () => {
      it('should log application startup with config', () => {
        logger.logStartup({
          environment: 'production',
          version: '1.0.0'
        });

        expect(mockInfo).toHaveBeenCalledWith('Application started', {
          environment: 'production',
          version: '1.0.0',
          event: 'app_startup'
        });
      });

      it('should log application startup without config', () => {
        logger.logStartup();

        expect(mockInfo).toHaveBeenCalledWith('Application started', {
          event: 'app_startup'
        });
      });
    });

    describe('logShutdown', () => {
      it('should log application shutdown with stats', () => {
        logger.logShutdown({
          uptime: 3600,
          processedOrders: 150
        });

        expect(mockInfo).toHaveBeenCalledWith('Application shutting down', {
          uptime: 3600,
          processedOrders: 150,
          event: 'app_shutdown'
        });
      });

      it('should log application shutdown without stats', () => {
        logger.logShutdown();

        expect(mockInfo).toHaveBeenCalledWith('Application shutting down', {
          event: 'app_shutdown'
        });
      });
    });
  });

  describe('concrete implementation', () => {
    it('should allow creating concrete logger subclass', () => {
      class ConcreteLogger extends Logger {
        constructor() {
          super();
          this.logs = [];
        }

        error(message, metadata = {}) {
          this.logs.push({ level: 'error', message, metadata });
        }

        warn(message, metadata = {}) {
          this.logs.push({ level: 'warn', message, metadata });
        }

        info(message, metadata = {}) {
          this.logs.push({ level: 'info', message, metadata });
        }

        http(message, metadata = {}) {
          this.logs.push({ level: 'http', message, metadata });
        }

        debug(message, metadata = {}) {
          this.logs.push({ level: 'debug', message, metadata });
        }

        log(level, message, metadata = {}) {
          this.logs.push({ level, message, metadata });
        }
      }

      const logger = new ConcreteLogger();
      logger.error('test error', { code: 500 });
      logger.logInvoiceCreation('123', 'CAE', 1);

      expect(logger.logs).toHaveLength(2);
      expect(logger.logs[0]).toEqual({
        level: 'error',
        message: 'test error',
        metadata: { code: 500 }
      });
      expect(logger.logs[1]).toEqual({
        level: 'info',
        message: 'Invoice created successfully',
        metadata: {
          orderNumber: '123',
          cae: 'CAE',
          voucherNumber: 1,
          event: 'invoice_created'
        }
      });
    });
  });
});
