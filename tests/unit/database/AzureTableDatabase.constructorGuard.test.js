jest.mock('@azure/data-tables', () => ({
  TableClient: {
    fromConnectionString: jest.fn().mockReturnValue({}),
  },
}));

const AzureTableDatabase = require('../../../src/database/AzureTableDatabase');

describe('AzureTableDatabase constructor test-environment guard', () => {
  const originalConn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.AZURE_STORAGE_CONNECTION_STRING = originalConn;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('throws when AZURE_STORAGE_CONNECTION_STRING is missing', () => {
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    expect(() => new AzureTableDatabase()).toThrow('AZURE_STORAGE_CONNECTION_STRING is required');
  });

  it('refuses a real Azure account while NODE_ENV=test', () => {
    process.env.NODE_ENV = 'test';
    process.env.AZURE_STORAGE_CONNECTION_STRING =
      'DefaultEndpointsProtocol=https;AccountName=myafipdb;AccountKey=secret;EndpointSuffix=core.windows.net';
    expect(() => new AzureTableDatabase()).toThrow(/Refusing to connect to non-emulator/);
  });

  it('allows the Azurite emulator (UseDevelopmentStorage=true) while NODE_ENV=test', () => {
    process.env.NODE_ENV = 'test';
    process.env.AZURE_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true';
    expect(() => new AzureTableDatabase()).not.toThrow();
  });

  it('allows a devstoreaccount1 emulator connection string while NODE_ENV=test', () => {
    process.env.NODE_ENV = 'test';
    process.env.AZURE_STORAGE_CONNECTION_STRING =
      'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=key;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;';
    expect(() => new AzureTableDatabase()).not.toThrow();
  });

  it('allows a real Azure account when not running under test', () => {
    process.env.NODE_ENV = 'production';
    process.env.AZURE_STORAGE_CONNECTION_STRING =
      'DefaultEndpointsProtocol=https;AccountName=myafipdb;AccountKey=secret;EndpointSuffix=core.windows.net';
    expect(() => new AzureTableDatabase()).not.toThrow();
  });
});
