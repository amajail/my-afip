/**
 * The Functions worker loads `src/functions/index.js` with only the env vars
 * the deployed app actually sets — and that does NOT include AFIP_CERT_PATH
 * (certs arrive as AFIP_CERT_B64 and are reconstructed per request). A
 * config-hungry require at module scope fails the entry-point load and
 * de-indexes every function, /api/* included; that outage shipped once with
 * the MCP module. This test loads the REAL entry point (no container mock,
 * real @azure/functions in its out-of-host test mode) under a bare env and
 * pins it to load clean.
 */

describe('functions entry point', () => {
  const savedEnv = process.env;

  afterEach(() => {
    process.env = savedEnv;
  });

  it('loads with no AFIP_* configuration set', () => {
    process.env = { PATH: savedEnv.PATH, NODE_ENV: 'test' };
    jest.resetModules();
    expect(() => require('../../../src/functions/index.js')).not.toThrow();
  });

  it('MCP call path constructs under the deployed env (storage yes, certs no)', () => {
    // The deployed Function App sets AZURE_STORAGE_CONNECTION_STRING but no
    // AFIP_CERT_PATH — the read tools must be able to build their
    // repository/use-case there. Loading index.js survived once while the
    // tools themselves still threw config errors at call time (utils/logger
    // and the container's gateway imports dragged shared/config in); this
    // pins the whole read path, not just the entry point.
    process.env = {
      PATH: savedEnv.PATH,
      NODE_ENV: 'test',
      AZURE_STORAGE_CONNECTION_STRING: 'UseDevelopmentStorage=true',
    };
    jest.resetModules();
    const container = require('../../../src/application/di/container');
    expect(container.getOrderRepository()).toBeTruthy();
    expect(container.getGenerateMonthlyReportUseCase()).toBeTruthy();
  });
});
