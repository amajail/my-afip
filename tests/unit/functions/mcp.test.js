/**
 * Handler-level tests for the MCP tools (src/functions/mcp.js).
 *
 * The Azure Functions runtime is mocked: registrations are captured from
 * app.mcpTool and handlers invoked directly with a fake context carrying
 * triggerMetadata.mcptoolargs. The DI container is mocked so no repository
 * ever touches storage (repo rule: tests never reach real storage).
 *
 * Contract under test: dev-kit docs/mcp-contracts.md (S0) — month arg,
 * error shape, plain ARS numbers, tableFreshness on every response.
 */

jest.mock('@azure/functions', () => ({
  app: { mcpTool: jest.fn() },
}));
jest.mock('../../../src/application/di/container', () => ({
  getOrderRepository: jest.fn(),
  getGenerateMonthlyReportUseCase: jest.fn(),
}));
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { app } = require('@azure/functions');
const container = require('../../../src/application/di/container');
const Order = require('../../../src/domain/entities/Order');
const CAE = require('../../../src/domain/value-objects/CAE');

require('../../../src/functions/mcp');

// Capture tool registrations at load time (before per-test mock resets).
const tools = {};
for (const call of app.mcpTool.mock.calls) {
  const definition = call[1];
  tools[definition.toolName] = definition;
}

async function invoke(toolName, args) {
  const raw = await tools[toolName].handler(undefined, {
    triggerMetadata: { mcptoolargs: args },
  });
  expect(typeof raw).toBe('string'); // MCP tool results are JSON strings
  return JSON.parse(raw);
}

function makeOrder(overrides = {}) {
  return new Order({
    orderNumber: overrides.orderNumber || '11111111111111111111',
    amount: 100,
    price: 1200,
    totalPrice: overrides.totalPrice != null ? overrides.totalPrice : 120000,
    asset: 'USDT',
    fiat: 'ARS',
    tradeType: overrides.tradeType || 'SELL',
    createTime: 1745697600000,
    orderDate: overrides.orderDate || '2026-07-10',
    processedAt: overrides.processedAt !== undefined ? overrides.processedAt : null,
    success: overrides.success !== undefined ? overrides.success : null,
    processingMethod: overrides.processingMethod,
    cae: overrides.cae || null,
    voucherNumber: overrides.voucherNumber || null,
    invoiceDate: overrides.invoiceDate !== undefined ? overrides.invoiceDate : null,
  });
}

function mockOrderRepository(overrides = {}) {
  const repo = {
    findNewestOrderDate: jest.fn().mockResolvedValue('2026-07-27'),
    findSuccessfullyInvoiced: jest.fn().mockResolvedValue([]),
    findByDateRange: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
  container.getOrderRepository.mockReturnValue(repo);
  return repo;
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  jest.setSystemTime(new Date('2026-07-30T12:00:00Z'));
  mockOrderRepository();
  container.getGenerateMonthlyReportUseCase.mockReturnValue({
    execute: jest.fn().mockResolvedValue({ orders: [] }),
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('MCP tool registration', () => {
  it('registers exactly the three read tools — no write tools', () => {
    expect(Object.keys(tools).sort()).toEqual(['list_invoices', 'list_orders', 'monthly_income']);
  });

  it.each(['list_orders', 'list_invoices', 'monthly_income'])(
    '%s takes a single required month string arg',
    (toolName) => {
      expect(tools[toolName].toolProperties).toEqual([
        expect.objectContaining({
          propertyName: 'month',
          propertyType: 'string',
          isRequired: true,
        }),
      ]);
    }
  );
});

describe('month validation (S0 error shape)', () => {
  it.each([
    ['missing', undefined],
    ['malformed', 'July 2026'],
    ['month 13', '2026-13'],
    ['month 00', '2026-00'],
    ['full date', '2026-07-01'],
  ])('rejects %s month with {error, code, details}', async (_label, month) => {
    const body = await invoke('monthly_income', month === undefined ? {} : { month });
    expect(body.code).toBe('ValidationError');
    expect(body.error).toMatch(/month/i);
    expect(body.details).toEqual([{ field: 'month', message: expect.any(String) }]);
  });
});

describe('tableFreshness', () => {
  it('reports the newest order date of the whole table and its age in whole days', async () => {
    mockOrderRepository({ findNewestOrderDate: jest.fn().mockResolvedValue('2026-07-27') });
    const body = await invoke('monthly_income', { month: '2026-07' });
    expect(body.tableFreshness).toEqual({ newestOrderDate: '2026-07-27', ageDays: 3 });
  });

  it('is null/null when the orders table is empty', async () => {
    mockOrderRepository({ findNewestOrderDate: jest.fn().mockResolvedValue(null) });
    const body = await invoke('monthly_income', { month: '2026-07' });
    expect(body.tableFreshness).toEqual({ newestOrderDate: null, ageDays: null });
  });
});

describe('list_orders', () => {
  it('delegates the month to GenerateMonthlyReport and maps orders to the contract shape', async () => {
    const execute = jest.fn().mockResolvedValue({
      orders: [
        {
          orderNumber: '11111111111111111111',
          orderDate: '2026-07-10',
          tradeType: 'SELL',
          totalPrice: 120000,
          fiat: 'ARS',
          asset: 'USDT',
          processing_status: 'success',
          cae: CAE.of('75123456789012'),
          voucherNumber: 42,
          error_message: null,
          processing_method: 'automatic',
        },
        {
          orderNumber: '22222222222222222222',
          orderDate: '2026-07-11',
          tradeType: 'BUY',
          totalPrice: 50000,
          fiat: 'ARS',
          asset: 'USDT',
          processing_status: 'pending',
          cae: null,
          voucherNumber: null,
          error_message: null,
          processing_method: null,
        },
      ],
    });
    container.getGenerateMonthlyReportUseCase.mockReturnValue({ execute });

    const body = await invoke('list_orders', { month: '2026-07' });

    expect(execute).toHaveBeenCalledWith({ year: 2026, month: 7 });
    expect(body.month).toBe('2026-07');
    expect(body.count).toBe(2);
    expect(body.tableFreshness).toEqual({ newestOrderDate: '2026-07-27', ageDays: 3 });
    expect(body.orders[0]).toEqual({
      orderNumber: '11111111111111111111',
      orderDate: '2026-07-10',
      tradeType: 'SELL',
      asset: 'USDT',
      fiat: 'ARS',
      totalPrice: 120000,
      processingStatus: 'success',
      cae: '75123456789012', // CAE value object flattened to its string value
      voucherNumber: 42,
      errorMessage: null,
    });
    expect(body.orders[1]).toEqual(
      expect.objectContaining({ processingStatus: 'pending', cae: null, voucherNumber: null })
    );
  });

  it('maps a use-case failure to {error, code}', async () => {
    container.getGenerateMonthlyReportUseCase.mockReturnValue({
      execute: jest.fn().mockRejectedValue(new Error('storage unavailable')),
    });
    const body = await invoke('list_orders', { month: '2026-07' });
    expect(body).toEqual({ error: 'storage unavailable', code: 'Error' });
  });
});

describe('list_invoices', () => {
  it('filters by invoice date (not order date) and maps to the contract shape', async () => {
    const invoicedInJulyForJuneOrder = makeOrder({
      orderNumber: '11111111111111111111',
      orderDate: '2026-06-28',
      processedAt: '2026-07-05T10:00:00Z',
      success: true,
      cae: '75123456789012',
      voucherNumber: 40,
      invoiceDate: '2026-07-05',
      totalPrice: 200000,
    });
    const invoicedInJune = makeOrder({
      orderNumber: '22222222222222222222',
      orderDate: '2026-06-10',
      processedAt: '2026-06-10T10:00:00Z',
      success: true,
      cae: '75123456789013',
      voucherNumber: 39,
      invoiceDate: '2026-06-10',
      totalPrice: 999999,
    });
    // Manual invoice: mark-manual records no invoiceDate — falls back to order date.
    const manualJuly = makeOrder({
      orderNumber: '33333333333333333333',
      orderDate: '2026-07-15',
      processedAt: '2026-07-16T10:00:00Z',
      processingMethod: 'manual',
      success: true,
      cae: '75123456789014',
      voucherNumber: 41,
      invoiceDate: null,
      totalPrice: 100000,
    });
    mockOrderRepository({
      findSuccessfullyInvoiced: jest
        .fn()
        .mockResolvedValue([manualJuly, invoicedInJune, invoicedInJulyForJuneOrder]),
    });

    const body = await invoke('list_invoices', { month: '2026-07' });

    expect(body.month).toBe('2026-07');
    expect(body.count).toBe(2);
    expect(body.invoices).toEqual([
      {
        voucherNumber: 40,
        cae: '75123456789012',
        invoiceDate: '2026-07-05',
        orderNumber: '11111111111111111111',
        totalAmount: 200000,
        currency: 'ARS',
      },
      {
        voucherNumber: 41,
        cae: '75123456789014',
        invoiceDate: '2026-07-15',
        orderNumber: '33333333333333333333',
        totalAmount: 100000,
        currency: 'ARS',
      },
    ]);
    expect(body.tableFreshness).toEqual({ newestOrderDate: '2026-07-27', ageDays: 3 });
  });

  it('returns an empty list for a month with no invoices', async () => {
    const body = await invoke('list_invoices', { month: '2025-01' });
    expect(body).toEqual({
      month: '2025-01',
      count: 0,
      tableFreshness: { newestOrderDate: '2026-07-27', ageDays: 3 },
      invoices: [],
    });
  });
});

describe('monthly_income', () => {
  it('sums invoiced ARS by invoice month and SELL orders by order month', async () => {
    const sellInvoiced = makeOrder({
      orderNumber: '11111111111111111111',
      orderDate: '2026-07-10',
      processedAt: '2026-07-10T10:00:00Z',
      success: true,
      cae: '75123456789012',
      voucherNumber: 40,
      invoiceDate: '2026-07-10',
      totalPrice: 100000,
    });
    const sellPending = makeOrder({
      orderNumber: '22222222222222222222',
      orderDate: '2026-07-12',
      totalPrice: 50000,
    });
    const buyOrder = makeOrder({
      orderNumber: '33333333333333333333',
      orderDate: '2026-07-13',
      tradeType: 'BUY',
      totalPrice: 70000,
    });
    // June order back-filled with a July invoice: counts for July income.
    const juneOrderJulyInvoice = makeOrder({
      orderNumber: '44444444444444444444',
      orderDate: '2026-06-28',
      processedAt: '2026-07-20T10:00:00Z',
      success: true,
      cae: '75123456789013',
      voucherNumber: 41,
      invoiceDate: '2026-07-20',
      totalPrice: 200000,
    });
    // Invoiced in August: not July income.
    const augustInvoice = makeOrder({
      orderNumber: '55555555555555555555',
      orderDate: '2026-07-31',
      processedAt: '2026-08-01T10:00:00Z',
      success: true,
      cae: '75123456789014',
      voucherNumber: 42,
      invoiceDate: '2026-08-01',
      totalPrice: 300000,
    });

    const repo = mockOrderRepository({
      findByDateRange: jest.fn().mockResolvedValue([sellInvoiced, sellPending, buyOrder]),
      findSuccessfullyInvoiced: jest
        .fn()
        .mockResolvedValue([sellInvoiced, juneOrderJulyInvoice, augustInvoice]),
    });

    const body = await invoke('monthly_income', { month: '2026-07' });

    expect(repo.findByDateRange).toHaveBeenCalledWith('2026-07-01', '2026-07-31');
    expect(body).toEqual({
      month: '2026-07',
      invoicedArs: 300000, // 100000 + 200000 (August-dated invoice excluded)
      invoiceCount: 2,
      sellOrdersArs: 150000, // SELL orders only; the BUY is excluded
      sellOrderCount: 2,
      uninvoicedCount: 1, // the pending SELL
      tableFreshness: { newestOrderDate: '2026-07-27', ageDays: 3 },
    });
  });

  it('computes the correct last day for date-range queries (leap February)', async () => {
    const repo = mockOrderRepository();
    await invoke('monthly_income', { month: '2028-02' });
    expect(repo.findByDateRange).toHaveBeenCalledWith('2028-02-01', '2028-02-29');
  });

  it('maps a repository failure to {error, code}', async () => {
    mockOrderRepository({
      findByDateRange: jest.fn().mockRejectedValue(new TypeError('boom')),
    });
    const body = await invoke('monthly_income', { month: '2026-07' });
    expect(body).toEqual({ error: 'boom', code: 'TypeError' });
  });
});
