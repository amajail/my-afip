/**
 * LoggerFactory Tests
 *
 * Tests for the LoggerFactory that creates appropriate logger instances
 */

// Mock dependencies before requiring the factory
jest.mock('../../../../src/shared/logging/loggers/ConsoleLogger');
jest.mock('../../../../src/shared/logging/loggers/ApplicationInsightsLogger');
jest.mock('../../../../src/shared/config/environment');

const LoggerFactory = require('../../../../src/shared/logging/LoggerFactory');
const ConsoleLogger = require('../../../../src/shared/logging/loggers/ConsoleLogger');
const ApplicationInsightsLogger = require('../../../../src/shared/logging/loggers/ApplicationInsightsLogger');
const environment = require('../../../../src/shared/config/environment');

describe('LoggerFactory', () => {
  let originalEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.APPINSIGHTS_INSTRUMENTATIONKEY;
    delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

    // Setup default mocks
    ConsoleLogger.mockImplementation((config) => ({
      type: 'console',
      config
    }));

    ApplicationInsightsLogger.mockImplementation((config) => ({
      type: 'appinsights',
      config
    }));
  });

  describe('createLogger', () => {
    describe('with explicit type', () => {
      it('should create ConsoleLogger when type is "console"', () => {
        const logger = LoggerFactory.createLogger({ type: 'console' });

        expect(ConsoleLogger).toHaveBeenCalled();
        expect(logger.type).toBe('console');
      });

      it('should create ApplicationInsightsLogger when type is "appinsights"', () => {
        process.env.APPINSIGHTS_INSTRUMENTATIONKEY = 'test-key';

        const logger = LoggerFactory.createLogger({ type: 'appinsights' });

        expect(ApplicationInsightsLogger).toHaveBeenCalled();
        expect(logger.type).toBe('appinsights');
      });

      it('should pass level to ConsoleLogger', () => {
        LoggerFactory.createLogger({ type: 'console', level: 'debug' });

        expect(ConsoleLogger).toHaveBeenCalledWith(
          expect.objectContaining({ level: 'debug' })
        );
      });

      it('should pass custom config to logger', () => {
        LoggerFactory.createLogger({
          type: 'console',
          config: { colorize: false }
        });

        expect(ConsoleLogger).toHaveBeenCalledWith(
          expect.objectContaining({ colorize: false })
        );
      });
    });

    describe('with automatic type detection', () => {
      it('should create ApplicationInsightsLogger for Azure Functions', () => {
        environment.isAzureFunctions.mockReturnValue(true);
        process.env.APPINSIGHTS_INSTRUMENTATIONKEY = 'test-key';

        const logger = LoggerFactory.createLogger();

        expect(ApplicationInsightsLogger).toHaveBeenCalled();
      });

      it('should create ConsoleLogger for CLI environment', () => {
        environment.isAzureFunctions.mockReturnValue(false);

        const logger = LoggerFactory.createLogger();

        expect(ConsoleLogger).toHaveBeenCalled();
      });
    });

    describe('default configuration', () => {
      it('should create silent logger in test environment', () => {
        environment.isTest.mockReturnValue(true);
        environment.isDevelopment.mockReturnValue(false);

        LoggerFactory.createLogger();

        expect(ConsoleLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            level: 'error',
            silent: true,
            colorize: false,
            includeTimestamp: false,
            writeToFile: false
          })
        );
      });

      it('should create debug logger in development environment', () => {
        environment.isTest.mockReturnValue(false);
        environment.isDevelopment.mockReturnValue(true);

        LoggerFactory.createLogger();

        expect(ConsoleLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            level: 'debug',
            colorize: true,
            includeTimestamp: true,
            writeToFile: true
          })
        );
      });

      it('should create info logger in production environment', () => {
        environment.isTest.mockReturnValue(false);
        environment.isDevelopment.mockReturnValue(false);

        LoggerFactory.createLogger();

        expect(ConsoleLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            level: 'info',
            colorize: true,
            includeTimestamp: true,
            writeToFile: true
          })
        );
      });
    });
  });

  describe('_createApplicationInsightsLogger', () => {
    it('should create logger with instrumentation key from APPINSIGHTS_INSTRUMENTATIONKEY', () => {
      process.env.APPINSIGHTS_INSTRUMENTATIONKEY = 'key-from-env';
      environment.getNodeEnv.mockReturnValue('production');
      environment.getRuntimeContext.mockReturnValue('api');

      LoggerFactory.createLogger({ type: 'appinsights' });

      expect(ApplicationInsightsLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          instrumentationKey: 'key-from-env'
        })
      );
    });

    it('should create logger with instrumentation key from APPLICATIONINSIGHTS_CONNECTION_STRING', () => {
      process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = 'key-from-connection-string';
      environment.getNodeEnv.mockReturnValue('production');
      environment.getRuntimeContext.mockReturnValue('api');

      LoggerFactory.createLogger({ type: 'appinsights' });

      expect(ApplicationInsightsLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          instrumentationKey: 'key-from-connection-string'
        })
      );
    });

    it('should fall back to ConsoleLogger when instrumentation key is missing', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      LoggerFactory.createLogger({ type: 'appinsights' });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Application Insights instrumentation key not found')
      );
      expect(ConsoleLogger).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should include default properties', () => {
      process.env.APPINSIGHTS_INSTRUMENTATIONKEY = 'test-key';
      environment.getNodeEnv.mockReturnValue('production');
      environment.getRuntimeContext.mockReturnValue('api');

      LoggerFactory.createLogger({ type: 'appinsights' });

      expect(ApplicationInsightsLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultProperties: {
            environment: 'production',
            runtimeContext: 'api'
          }
        })
      );
    });

    it('should enable console output in development', () => {
      process.env.APPINSIGHTS_INSTRUMENTATIONKEY = 'test-key';
      environment.isDevelopment.mockReturnValue(true);
      environment.getNodeEnv.mockReturnValue('development');
      environment.getRuntimeContext.mockReturnValue('api');

      LoggerFactory.createLogger({ type: 'appinsights' });

      expect(ApplicationInsightsLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          enableConsole: true
        })
      );
    });

    it('should disable console output in production', () => {
      process.env.APPINSIGHTS_INSTRUMENTATIONKEY = 'test-key';
      environment.isDevelopment.mockReturnValue(false);
      environment.getNodeEnv.mockReturnValue('production');
      environment.getRuntimeContext.mockReturnValue('api');

      LoggerFactory.createLogger({ type: 'appinsights' });

      expect(ApplicationInsightsLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          enableConsole: false
        })
      );
    });
  });

  describe('fromConfig', () => {
    it('should create logger from config object', () => {
      const config = {
        logging: {
          logLevel: 'debug'
        }
      };

      LoggerFactory.fromConfig(config);

      expect(ConsoleLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug'
        })
      );
    });

    it('should create logger with instrumentation key for API runtime', () => {
      process.env.APPINSIGHTS_INSTRUMENTATIONKEY = 'fallback-key';
      environment.isAzureFunctions.mockReturnValue(true);
      environment.getNodeEnv.mockReturnValue('production');
      environment.getRuntimeContext.mockReturnValue('api');

      const config = {
        logging: {
          logLevel: 'info'
        },
        environment: {
          runtime: 'api',
          applicationInsightsKey: 'config-key'
        }
      };

      LoggerFactory.fromConfig(config);

      expect(ApplicationInsightsLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          instrumentationKey: 'config-key'
        })
      );
    });

    it('should handle empty config object', () => {
      LoggerFactory.fromConfig({});

      expect(ConsoleLogger).toHaveBeenCalled();
    });
  });

  describe('createTestLogger', () => {
    it('should create silent ConsoleLogger for testing', () => {
      const logger = LoggerFactory.createTestLogger();

      expect(ConsoleLogger).toHaveBeenCalledWith({
        level: 'debug',
        colorize: false,
        includeTimestamp: false,
        writeToFile: false,
        silent: true
      });
    });
  });
});
