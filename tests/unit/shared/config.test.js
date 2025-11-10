describe('Shared Config Layer', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear module cache to get fresh config
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('helpers', () => {
    let helpers;

    beforeEach(() => {
      helpers = require('../../../src/shared/config/helpers');
    });

    describe('get', () => {
      it('should return environment variable value', () => {
        process.env.TEST_VAR = 'test_value';
        expect(helpers.get('TEST_VAR')).toBe('test_value');
      });

      it('should return default value when not set', () => {
        expect(helpers.get('MISSING_VAR', 'default')).toBe('default');
      });

      it('should return empty string as default', () => {
        expect(helpers.get('MISSING_VAR')).toBe('');
      });
    });

    describe('getRequired', () => {
      it('should return environment variable value', () => {
        process.env.REQUIRED_VAR = 'required_value';
        expect(helpers.getRequired('REQUIRED_VAR')).toBe('required_value');
      });

      it('should throw error when variable is not set', () => {
        expect(() => helpers.getRequired('MISSING_VAR')).toThrow(
          'Required environment variable MISSING_VAR is not set'
        );
      });
    });

    describe('getInt', () => {
      it('should parse integer value', () => {
        process.env.INT_VAR = '42';
        expect(helpers.getInt('INT_VAR', 0)).toBe(42);
      });

      it('should return default for invalid integer', () => {
        process.env.INT_VAR = 'not_a_number';
        expect(helpers.getInt('INT_VAR', 10)).toBe(10);
      });

      it('should return default when not set', () => {
        expect(helpers.getInt('MISSING_INT', 100)).toBe(100);
      });

      it('should parse negative integers', () => {
        process.env.NEG_INT = '-42';
        expect(helpers.getInt('NEG_INT', 0)).toBe(-42);
      });
    });

    describe('getFloat', () => {
      it('should parse float value', () => {
        process.env.FLOAT_VAR = '3.14';
        expect(helpers.getFloat('FLOAT_VAR', 0)).toBe(3.14);
      });

      it('should return default for invalid float', () => {
        process.env.FLOAT_VAR = 'not_a_number';
        expect(helpers.getFloat('FLOAT_VAR', 1.5)).toBe(1.5);
      });

      it('should return default when not set', () => {
        expect(helpers.getFloat('MISSING_FLOAT', 2.71)).toBe(2.71);
      });
    });

    describe('getBoolean', () => {
      it('should parse "true" as true', () => {
        process.env.BOOL_VAR = 'true';
        expect(helpers.getBoolean('BOOL_VAR', false)).toBe(true);
      });

      it('should parse "1" as true', () => {
        process.env.BOOL_VAR = '1';
        expect(helpers.getBoolean('BOOL_VAR', false)).toBe(true);
      });

      it('should parse "yes" as true', () => {
        process.env.BOOL_VAR = 'yes';
        expect(helpers.getBoolean('BOOL_VAR', false)).toBe(true);
      });

      it('should parse "on" as true', () => {
        process.env.BOOL_VAR = 'on';
        expect(helpers.getBoolean('BOOL_VAR', false)).toBe(true);
      });

      it('should parse "false" as false', () => {
        process.env.BOOL_VAR = 'false';
        expect(helpers.getBoolean('BOOL_VAR', true)).toBe(false);
      });

      it('should parse "0" as false', () => {
        process.env.BOOL_VAR = '0';
        expect(helpers.getBoolean('BOOL_VAR', true)).toBe(false);
      });

      it('should be case insensitive', () => {
        process.env.BOOL_VAR = 'TRUE';
        expect(helpers.getBoolean('BOOL_VAR', false)).toBe(true);
      });

      it('should return default for invalid value', () => {
        process.env.BOOL_VAR = 'maybe';
        expect(helpers.getBoolean('BOOL_VAR', true)).toBe(true);
      });

      it('should return default when not set', () => {
        expect(helpers.getBoolean('MISSING_BOOL', false)).toBe(false);
      });
    });

    describe('getJSON', () => {
      it('should parse valid JSON', () => {
        process.env.JSON_VAR = '{"key": "value"}';
        expect(helpers.getJSON('JSON_VAR')).toEqual({ key: 'value' });
      });

      it('should return default for invalid JSON', () => {
        process.env.JSON_VAR = 'not json';
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        expect(helpers.getJSON('JSON_VAR', { default: true })).toEqual({ default: true });
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('should return null default when not set', () => {
        expect(helpers.getJSON('MISSING_JSON')).toBeNull();
      });
    });

    describe('getArray', () => {
      it('should parse comma-separated values', () => {
        process.env.ARRAY_VAR = 'one,two,three';
        expect(helpers.getArray('ARRAY_VAR')).toEqual(['one', 'two', 'three']);
      });

      it('should trim whitespace', () => {
        process.env.ARRAY_VAR = ' one , two , three ';
        expect(helpers.getArray('ARRAY_VAR')).toEqual(['one', 'two', 'three']);
      });

      it('should filter empty values', () => {
        process.env.ARRAY_VAR = 'one,,two,,,three';
        expect(helpers.getArray('ARRAY_VAR')).toEqual(['one', 'two', 'three']);
      });

      it('should return default when not set', () => {
        expect(helpers.getArray('MISSING_ARRAY', ['default'])).toEqual(['default']);
      });

      it('should return empty array as default', () => {
        expect(helpers.getArray('MISSING_ARRAY')).toEqual([]);
      });
    });

    describe('validateRequired', () => {
      it('should not throw when all required variables are set', () => {
        process.env.VAR1 = 'value1';
        process.env.VAR2 = 'value2';

        expect(() => {
          helpers.validateRequired(['VAR1', 'VAR2']);
        }).not.toThrow();
      });

      it('should throw when any required variable is missing', () => {
        process.env.VAR1 = 'value1';

        expect(() => {
          helpers.validateRequired(['VAR1', 'VAR2', 'VAR3']);
        }).toThrow('Missing required environment variables: VAR2, VAR3');
      });
    });
  });

  describe('environment', () => {
    let environment;

    beforeEach(() => {
      environment = require('../../../src/shared/config/environment');
    });

    describe('getNodeEnv', () => {
      it('should return NODE_ENV value', () => {
        process.env.NODE_ENV = 'production';
        jest.resetModules();
        environment = require('../../../src/shared/config/environment');
        expect(environment.getNodeEnv()).toBe('production');
      });

      it('should return "development" when not set', () => {
        delete process.env.NODE_ENV;
        jest.resetModules();
        environment = require('../../../src/shared/config/environment');
        expect(environment.getNodeEnv()).toBe('development');
      });
    });

    describe('isProduction', () => {
      it('should return true in production', () => {
        process.env.NODE_ENV = 'production';
        jest.resetModules();
        environment = require('../../../src/shared/config/environment');
        expect(environment.isProduction()).toBe(true);
      });

      it('should return false in development', () => {
        process.env.NODE_ENV = 'development';
        jest.resetModules();
        environment = require('../../../src/shared/config/environment');
        expect(environment.isProduction()).toBe(false);
      });
    });

    describe('isTest', () => {
      it('should return true in test mode', () => {
        expect(environment.isTest()).toBe(true); // We're running tests
      });
    });

    describe('isAzureFunctions', () => {
      it('should return true when WEBSITE_INSTANCE_ID is set', () => {
        process.env.WEBSITE_INSTANCE_ID = 'test-instance';
        jest.resetModules();
        environment = require('../../../src/shared/config/environment');
        expect(environment.isAzureFunctions()).toBe(true);
      });

      it('should return true when AZURE_FUNCTIONS_ENVIRONMENT is set', () => {
        process.env.AZURE_FUNCTIONS_ENVIRONMENT = 'test';
        jest.resetModules();
        environment = require('../../../src/shared/config/environment');
        expect(environment.isAzureFunctions()).toBe(true);
      });

      it('should return false when neither is set', () => {
        delete process.env.WEBSITE_INSTANCE_ID;
        delete process.env.AZURE_FUNCTIONS_ENVIRONMENT;
        jest.resetModules();
        environment = require('../../../src/shared/config/environment');
        expect(environment.isAzureFunctions()).toBe(false);
      });
    });

    describe('getRuntimeContext', () => {
      it('should return "test" in test mode', () => {
        expect(environment.getRuntimeContext()).toBe('test');
      });

      it('should return "api" in Azure Functions', () => {
        process.env.WEBSITE_INSTANCE_ID = 'test';
        process.env.NODE_ENV = 'production';
        jest.resetModules();
        environment = require('../../../src/shared/config/environment');
        expect(environment.getRuntimeContext()).toBe('api');
      });
    });

    describe('getAfipEnvironment', () => {
      it('should return AFIP_ENVIRONMENT value', () => {
        process.env.AFIP_ENVIRONMENT = 'homologacion';
        jest.resetModules();
        environment = require('../../../src/shared/config/environment');
        expect(environment.getAfipEnvironment()).toBe('homologacion');
      });

      it('should return "production" as default', () => {
        delete process.env.AFIP_ENVIRONMENT;
        jest.resetModules();
        environment = require('../../../src/shared/config/environment');
        expect(environment.getAfipEnvironment()).toBe('production');
      });
    });

    describe('isAfipProduction', () => {
      it('should return true for production environment', () => {
        process.env.AFIP_ENVIRONMENT = 'production';
        jest.resetModules();
        environment = require('../../../src/shared/config/environment');
        expect(environment.isAfipProduction()).toBe(true);
      });

      it('should return false for homologacion', () => {
        process.env.AFIP_ENVIRONMENT = 'homologacion';
        jest.resetModules();
        environment = require('../../../src/shared/config/environment');
        expect(environment.isAfipProduction()).toBe(false);
      });
    });
  });
});
