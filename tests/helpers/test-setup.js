// Global test setup and configuration
require('dotenv').config({ path: '.env.test' });

// Suppress console output during tests unless debugging
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  };
}

// Mock environment variables for testing
process.env.AFIP_CUIT = process.env.AFIP_CUIT || 'your_cuit_here';
process.env.AFIP_ENVIRONMENT = process.env.AFIP_ENVIRONMENT || 'testing';
process.env.AFIP_CERT_PATH = process.env.AFIP_CERT_PATH || './certificates/cert.crt';
process.env.AFIP_KEY_PATH = process.env.AFIP_KEY_PATH || './certificates/private.key';
process.env.AFIP_PTOVTA = process.env.AFIP_PTOVTA || '3'; // Keep default for tests

// Global test timeout
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});