const AzureOrderRepository = require('../../../../src/infrastructure/repositories/AzureOrderRepository');

jest.mock('../../../../src/database/AzureTableDatabase');
jest.mock('../../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const logger = require('../../../../src/utils/logger');

const validRow = {
  order_number: '12345678901234567890',
  amount: 100,
  price: 1200,
  total_price: 120000,
  asset: 'USDT',
  fiat: 'ARS',
  trade_type: 'SELL',
  create_time: 1745697600000,
  order_date: '2026-04-26',
  buyer_nickname: null,
  seller_nickname: null,
  processed_at: null,
  processing_method: null,
  success: null,
  cae: null,
  voucher_number: null,
  invoice_date: null,
  error_message: null,
};

const invalidRow = {
  ...validRow,
  order_number: '99999999999999999999',
  price: 0, // fails Order._validate(): Price must be positive
};

function makeRepo(rows) {
  const mockDb = {
    initialize: jest.fn().mockResolvedValue(),
    getUnprocessedOrders: jest.fn().mockResolvedValue(rows),
  };

  const Database = require('../../../../src/database/AzureTableDatabase');
  Database.mockImplementation(() => mockDb);

  const repo = new AzureOrderRepository();
  repo.initialized = true;
  repo.db = mockDb;
  return repo;
}

describe('AzureOrderRepository.findUnprocessed()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns all orders when all rows are valid', async () => {
    const repo = makeRepo([validRow]);
    const orders = await repo.findUnprocessed();
    expect(orders).toHaveLength(1);
    expect(orders[0].orderNumber.value).toBe(validRow.order_number);
  });

  it('skips an invalid row and returns the valid ones', async () => {
    const repo = makeRepo([validRow, invalidRow]);
    const orders = await repo.findUnprocessed();
    expect(orders).toHaveLength(1);
    expect(orders[0].orderNumber.value).toBe(validRow.order_number);
  });

  it('logs a warning for each skipped row', async () => {
    const repo = makeRepo([validRow, invalidRow]);
    await repo.findUnprocessed();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Skipping invalid order row during deserialization',
      expect.objectContaining({
        orderNumber: invalidRow.order_number,
        event: 'order_deserialization_failed',
      })
    );
  });

  it('returns empty array when all rows are invalid', async () => {
    const repo = makeRepo([invalidRow]);
    const orders = await repo.findUnprocessed();
    expect(orders).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('propagates errors thrown by getUnprocessedOrders', async () => {
    const mockDb = {
      initialize: jest.fn().mockResolvedValue(),
      getUnprocessedOrders: jest.fn().mockRejectedValue(new Error('Azure connection failed')),
    };
    const repo = new AzureOrderRepository();
    repo.initialized = true;
    repo.db = mockDb;

    await expect(repo.findUnprocessed()).rejects.toThrow('Azure connection failed');
  });
});
