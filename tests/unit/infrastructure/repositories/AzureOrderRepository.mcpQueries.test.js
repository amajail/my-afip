/**
 * Tests for the MCP-facing query methods added to AzureOrderRepository:
 * findSuccessfullyInvoiced() and findNewestOrderDate().
 * The database is fully mocked — tests never reach real storage.
 */

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
  processed_at: '2026-04-27T10:00:00Z',
  processing_method: 'automatic',
  success: 1,
  cae: '75123456789012',
  voucher_number: 40,
  invoice_date: '2026-04-27',
  error_message: null,
};

function makeRepo(dbOverrides) {
  const mockDb = {
    initialize: jest.fn().mockResolvedValue(),
    ...dbOverrides,
  };
  const repo = new AzureOrderRepository();
  repo.initialized = true;
  repo.db = mockDb;
  return { repo, mockDb };
}

describe('AzureOrderRepository.findSuccessfullyInvoiced()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps successfully processed rows to Order entities', async () => {
    const { repo } = makeRepo({
      getSuccessfullyProcessedOrders: jest.fn().mockResolvedValue([validRow]),
    });
    const orders = await repo.findSuccessfullyInvoiced();
    expect(orders).toHaveLength(1);
    expect(orders[0].orderNumber.value).toBe(validRow.order_number);
    expect(orders[0].isSuccessful()).toBe(true);
    expect(orders[0].cae.value).toBe(validRow.cae);
    expect(orders[0].invoiceDate).toBe(validRow.invoice_date);
  });

  it('skips rows that fail entity validation and warns', async () => {
    const invalidRow = { ...validRow, order_number: '99999999999999999999', price: 0 };
    const { repo } = makeRepo({
      getSuccessfullyProcessedOrders: jest.fn().mockResolvedValue([validRow, invalidRow]),
    });
    const orders = await repo.findSuccessfullyInvoiced();
    expect(orders).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Skipping invalid order row during deserialization',
      expect.objectContaining({
        orderNumber: invalidRow.order_number,
        event: 'order_deserialization_failed',
      })
    );
  });

  it('propagates database errors', async () => {
    const { repo } = makeRepo({
      getSuccessfullyProcessedOrders: jest.fn().mockRejectedValue(new Error('Azure down')),
    });
    await expect(repo.findSuccessfullyInvoiced()).rejects.toThrow('Azure down');
  });
});

describe('AzureOrderRepository.findNewestOrderDate()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the max order_date across the whole table', async () => {
    const { repo } = makeRepo({
      getAllOrders: jest.fn().mockResolvedValue([
        { ...validRow, order_date: '2026-04-26' },
        { ...validRow, order_date: '2026-07-27' },
        { ...validRow, order_date: '2025-12-31' },
      ]),
    });
    await expect(repo.findNewestOrderDate()).resolves.toBe('2026-07-27');
  });

  it('ignores rows without an order_date', async () => {
    const { repo } = makeRepo({
      getAllOrders: jest.fn().mockResolvedValue([
        { ...validRow, order_date: '' },
        { ...validRow, order_date: '2026-05-01' },
      ]),
    });
    await expect(repo.findNewestOrderDate()).resolves.toBe('2026-05-01');
  });

  it('returns null for an empty table', async () => {
    const { repo } = makeRepo({ getAllOrders: jest.fn().mockResolvedValue([]) });
    await expect(repo.findNewestOrderDate()).resolves.toBeNull();
  });
});
