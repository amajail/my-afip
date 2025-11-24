/**
 * ApplicationInsightsLogger Tests
 *
 * Tests for the Application Insights logger implementation
 */

const ApplicationInsightsLogger = require('../../../../../src/shared/logging/loggers/ApplicationInsightsLogger');

describe('ApplicationInsightsLogger', () => {
  let mockClient;
  let mockAppInsights;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Application Insights client
    mockClient = {
      trackTrace: jest.fn(),
      trackException: jest.fn(),
      trackEvent: jest.fn(),
      trackMetric: jest.fn(),
      trackDependency: jest.fn(),
      flush: jest.fn(),
      commonProperties: {}
    };

    mockAppInsights = {
      setup: jest.fn().mockReturnThis(),
      setAutoDependencyCorrelation: jest.fn().mockReturnThis(),
      setAutoCollectRequests: jest.fn().mockReturnThis(),
      setAutoCollectPerformance: jest.fn().mockReturnThis(),
      setAutoCollectExceptions: jest.fn().mockReturnThis(),
      setAutoCollectDependencies: jest.fn().mockReturnThis(),
      setAutoCollectConsole: jest.fn().mockReturnThis(),
      setUseDiskRetryCaching: jest.fn().mockReturnThis(),
      start: jest.fn().mockReturnThis(),
      defaultClient: mockClient
    };

    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create logger with provided appInsights instance', () => {
      const logger = new ApplicationInsightsLogger({
        appInsights: mockAppInsights
      });

      expect(logger.appInsights).toBe(mockAppInsights);
      expect(logger.client).toBe(mockClient);
    });

    it('should initialize with default options', () => {
      const logger = new ApplicationInsightsLogger({
        appInsights: mockAppInsights
      });

      expect(logger.level).toBe('info');
      expect(logger.enableConsole).toBe(true);
      expect(logger.defaultProperties).toEqual({});
    });

    it('should initialize with custom options', () => {
      const logger = new ApplicationInsightsLogger({
        appInsights: mockAppInsights,
        level: 'debug',
        enableConsole: false,
        defaultProperties: { app: 'test' }
      });

      expect(logger.level).toBe('debug');
      expect(logger.enableConsole).toBe(false);
      expect(logger.defaultProperties).toEqual({ app: 'test' });
    });

    it('should handle missing instrumentation key', () => {
      const logger = new ApplicationInsightsLogger({});

      expect(logger.appInsights).toBeNull();
      expect(logger.client).toBeNull();
    });
  });

  describe('_shouldLog', () => {
    it('should log error when level is info', () => {
      const logger = new ApplicationInsightsLogger({
        appInsights: mockAppInsights,
        level: 'info'
      });

      expect(logger._shouldLog('error')).toBe(true);
    });

    it('should not log debug when level is info', () => {
      const logger = new ApplicationInsightsLogger({
        appInsights: mockAppInsights,
        level: 'info'
      });

      expect(logger._shouldLog('debug')).toBe(false);
    });

    it('should log all levels when level is debug', () => {
      const logger = new ApplicationInsightsLogger({
        appInsights: mockAppInsights,
        level: 'debug'
      });

      expect(logger._shouldLog('error')).toBe(true);
      expect(logger._shouldLog('warn')).toBe(true);
      expect(logger._shouldLog('info')).toBe(true);
      expect(logger._shouldLog('http')).toBe(true);
      expect(logger._shouldLog('debug')).toBe(true);
    });
  });

  describe('logging methods', () => {
    let logger;

    beforeEach(() => {
      logger = new ApplicationInsightsLogger({
        appInsights: mockAppInsights,
        level: 'debug'
      });
    });

    describe('error', () => {
      it('should track error as trace', () => {
        logger.error('Test error', { code: 500 });

        expect(mockClient.trackTrace).toHaveBeenCalledWith({
          message: 'Test error',
          severity: 3,
          properties: {
            code: 500,
            level: 'error'
          }
        });
      });

      it('should track Error object as exception', () => {
        const error = new Error('Something went wrong');
        logger.error('Test error', { error });

        expect(mockClient.trackException).toHaveBeenCalledWith({
          exception: error,
          properties: {
            message: 'Test error',
            error
          }
        });
      });

      it('should log to console when enabled (via _trackTrace)', () => {
        logger.error('Test error', { code: 500 });

        // When no Error object in metadata, error() calls _trackTrace which uses console.log
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[ERROR] Test error',
          expect.any(Object)
        );
      });

      it('should log to console.error when Error object provided', () => {
        const error = new Error('Something went wrong');
        logger.error('Test error', { error });

        // When Error object in metadata, error() calls _trackException which uses console.error
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[ERROR]',
          expect.any(Object),
          expect.any(Object)
        );
      });
    });

    describe('warn', () => {
      it('should track warning', () => {
        logger.warn('Test warning', { deprecated: true });

        expect(mockClient.trackTrace).toHaveBeenCalledWith({
          message: 'Test warning',
          severity: 2,
          properties: {
            deprecated: true,
            level: 'warn'
          }
        });
      });
    });

    describe('info', () => {
      it('should track info message', () => {
        logger.info('Test info', { event: 'startup' });

        expect(mockClient.trackTrace).toHaveBeenCalledWith({
          message: 'Test info',
          severity: 1,
          properties: {
            event: 'startup',
            level: 'info'
          }
        });
      });
    });

    describe('debug', () => {
      it('should track debug message', () => {
        logger.debug('Test debug', { var: 'value' });

        expect(mockClient.trackTrace).toHaveBeenCalledWith({
          message: 'Test debug',
          severity: 0,
          properties: {
            var: 'value',
            level: 'debug'
          }
        });
      });

      it('should not track when level is info', () => {
        const logger = new ApplicationInsightsLogger({
          appInsights: mockAppInsights,
          level: 'info'
        });

        logger.debug('Test debug');

        expect(mockClient.trackTrace).not.toHaveBeenCalled();
      });
    });

    describe('http', () => {
      it('should track HTTP message', () => {
        logger.http('HTTP request', {
          method: 'GET',
          url: '/api/test'
        });

        expect(mockClient.trackTrace).toHaveBeenCalledWith({
          message: 'HTTP request',
          severity: 1,
          properties: {
            method: 'GET',
            url: '/api/test',
            level: 'http'
          }
        });
      });

      it('should track HTTP dependency when url and duration provided', () => {
        logger.http('HTTP request', {
          method: 'GET',
          url: 'https://api.example.com/data',
          duration: 250,
          statusCode: 200,
          success: true
        });

        expect(mockClient.trackDependency).toHaveBeenCalledWith({
          target: 'https://api.example.com/data',
          name: 'GET',
          data: 'https://api.example.com/data',
          duration: 250,
          resultCode: 200,
          success: true,
          dependencyTypeName: 'HTTP'
        });
      });

      it('should not track dependency without url and duration', () => {
        logger.http('HTTP request', { method: 'GET' });

        expect(mockClient.trackDependency).not.toHaveBeenCalled();
      });
    });

    describe('log', () => {
      it('should delegate to error() for error level', () => {
        const error = new Error('Test');
        logger.log('error', 'Test message', { error });

        expect(mockClient.trackException).toHaveBeenCalled();
      });

      it('should track trace for other levels', () => {
        logger.log('info', 'Test message');

        expect(mockClient.trackTrace).toHaveBeenCalledWith({
          message: 'Test message',
          severity: 1,
          properties: {
            level: 'info'
          }
        });
      });
    });
  });

  describe('console logging', () => {
    it('should log to console when enabled', () => {
      const logger = new ApplicationInsightsLogger({
        appInsights: mockAppInsights,
        enableConsole: true
      });

      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[INFO] Test message',
        expect.any(Object)
      );
    });

    it('should not log to console when disabled', () => {
      const logger = new ApplicationInsightsLogger({
        appInsights: mockAppInsights,
        enableConsole: false
      });

      logger.info('Test message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('additional methods', () => {
    let logger;

    beforeEach(() => {
      logger = new ApplicationInsightsLogger({
        appInsights: mockAppInsights,
        defaultProperties: { app: 'test' }
      });
    });

    describe('trackEvent', () => {
      it('should track custom event', () => {
        logger.trackEvent('UserAction', { action: 'click' }, { count: 1 });

        expect(mockClient.trackEvent).toHaveBeenCalledWith({
          name: 'UserAction',
          properties: {
            app: 'test',
            action: 'click'
          },
          measurements: { count: 1 }
        });
      });

      it('should not track when client is null', () => {
        const logger = new ApplicationInsightsLogger({});
        logger.trackEvent('Test');

        expect(mockClient.trackEvent).not.toHaveBeenCalled();
      });
    });

    describe('trackMetric', () => {
      it('should track metric', () => {
        logger.trackMetric('ResponseTime', 150, { endpoint: '/api/test' });

        expect(mockClient.trackMetric).toHaveBeenCalledWith({
          name: 'ResponseTime',
          value: 150,
          properties: {
            app: 'test',
            endpoint: '/api/test'
          }
        });
      });
    });

    describe('flush', () => {
      it('should flush telemetry buffer', () => {
        logger.flush();

        expect(mockClient.flush).toHaveBeenCalled();
      });

      it('should not throw when client is null', () => {
        const logger = new ApplicationInsightsLogger({});
        expect(() => logger.flush()).not.toThrow();
      });
    });

    describe('setDefaultProperties', () => {
      it('should update default properties', () => {
        logger.setDefaultProperties({ version: '1.0.0' });

        expect(logger.defaultProperties).toEqual({
          app: 'test',
          version: '1.0.0'
        });
        expect(mockClient.commonProperties).toEqual({
          version: '1.0.0'
        });
      });

      it('should not throw when client is null', () => {
        const logger = new ApplicationInsightsLogger({});
        expect(() => logger.setDefaultProperties({ test: 'value' })).not.toThrow();
      });
    });
  });

  describe('without Application Insights client', () => {
    let logger;

    beforeEach(() => {
      logger = new ApplicationInsightsLogger({
        enableConsole: true
      });
    });

    it('should still log to console', () => {
      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[INFO] Test message',
        expect.any(Object)
      );
    });

    it('should not crash when logging without client', () => {
      expect(() => {
        logger.error('Test');
        logger.warn('Test');
        logger.info('Test');
        logger.debug('Test');
        logger.http('Test');
      }).not.toThrow();
    });
  });
});
