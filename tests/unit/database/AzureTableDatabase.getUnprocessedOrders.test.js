const { TableClient } = require('@azure/data-tables');

jest.mock('@azure/data-tables', () => ({
  TableClient: {
    fromConnectionString: jest.fn().mockReturnValue({ listEntities: jest.fn() }),
  },
}));

process.env.AZURE_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true';

const AzureTableDatabase = require('../../../src/database/AzureTableDatabase');

const baseEntity = {
  rowKey: '12345678901234567890',
  partitionKey: 'orders',
  amount: 100,
  price: 1200,
  totalPrice: 120000,
  asset: 'USDT',
  fiat: 'ARS',
  tradeType: 'SELL',
  createTime: 1745697600000,
  orderDate: '2026-04-26',
};

function makeDb(entities) {
  const db = new AzureTableDatabase();
  db.ordersClient = {
    listEntities: jest.fn().mockReturnValue(
      (async function* () { for (const e of entities) yield e; })()
    ),
  };
  return db;
}

describe('AzureTableDatabase.getUnprocessedOrders()', () => {
  it('includes entities with no processedAt', async () => {
    const db = makeDb([{ ...baseEntity }]);
    const rows = await db.getUnprocessedOrders();
    expect(rows).toHaveLength(1);
  });

  it('excludes successfully processed orders', async () => {
    const db = makeDb([{ ...baseEntity, processedAt: new Date().toISOString(), success: true }]);
    const rows = await db.getUnprocessedOrders();
    expect(rows).toHaveLength(0);
  });

  it('excludes failed orders (no longer retried automatically)', async () => {
    const db = makeDb([{ ...baseEntity, processedAt: new Date().toISOString(), success: false }]);
    const rows = await db.getUnprocessedOrders();
    expect(rows).toHaveLength(0);
  });

  it('excludes old processed orders that have no success field stored', async () => {
    const db = makeDb([{ ...baseEntity, processedAt: new Date().toISOString() }]);
    const rows = await db.getUnprocessedOrders();
    expect(rows).toHaveLength(0);
  });

  it('returns only pending orders from a mixed set', async () => {
    const pending = { ...baseEntity, rowKey: 'pending-1' };
    const processed = { ...baseEntity, rowKey: 'processed-1', processedAt: new Date().toISOString(), success: true };
    const failed = { ...baseEntity, rowKey: 'failed-1', processedAt: new Date().toISOString(), success: false };

    const db = makeDb([pending, processed, failed]);
    const rows = await db.getUnprocessedOrders();
    expect(rows).toHaveLength(1);
    expect(rows[0].order_number).toBe('pending-1');
  });

  it('sorts results by create_time ascending', async () => {
    const older = { ...baseEntity, rowKey: 'older', createTime: 1000 };
    const newer = { ...baseEntity, rowKey: 'newer', createTime: 2000 };

    const db = makeDb([newer, older]);
    const rows = await db.getUnprocessedOrders();
    expect(rows[0].order_number).toBe('older');
    expect(rows[1].order_number).toBe('newer');
  });
});
