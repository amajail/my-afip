/**
 * MCP (Model Context Protocol) server tools.
 *
 * Exposes the orders/invoices tables as READ-ONLY MCP tools so remote clients
 * (e.g. Claude custom connectors) can answer "income this month?" without the
 * CLI. There are deliberately NO write tools: invoicing stays CLI/cron only
 * (dev-kit family roadmap, Slice B). Hosted in-process by the Azure Functions
 * MCP extension on the separate `/runtime/webhooks/mcp` endpoint (Streamable
 * HTTP, behind the platform system key) — the existing `authLevel: 'function'`
 * HTTP API under `/api/*` is untouched.
 *
 * Tool surface is frozen by dev-kit `docs/mcp-contracts.md` (S0):
 * - single required `month` arg (`YYYY-MM`) on every tool;
 * - errors as `{ error, code?, details? }` (code = error class name);
 * - amounts as plain ARS numbers, never formatted strings;
 * - every response carries `tableFreshness` — the age of the newest order in
 *   the WHOLE table — because the Binance fetch only runs on the owner's
 *   machine (repo rule 2): a stale table silently under-reports income, and
 *   this field is what lets a client flag that instead of trusting the number.
 *
 * Each tool is thin: read args from `context.triggerMetadata.mcptoolargs`,
 * delegate to the DI container's use-cases/repositories, and return a JSON
 * string (MCP tool results are strings, not the `{ status, jsonBody }` HTTP
 * shape).
 */

const { app } = require('@azure/functions');
const { ValidationError } = require('../shared/errors');

// The container and utils/logger both walk to shared/config, which throws on
// missing AFIP_* env vars — and the deployed Function App does not set
// AFIP_CERT_PATH (certs arrive as AFIP_CERT_B64, reconstructed per request).
// Requiring either at module scope fails the worker's entry-point load and
// de-indexes EVERY function, /api/* included. So: container resolved per call,
// and logging via the invocation context, like the sibling HTTP handlers.
let _container;
function container() {
  _container = _container || require('../application/di/container');
  return _container;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Wrap a tool handler so args are normalized and errors become a JSON
 * `{ error, code, details }` string instead of throwing (a thrown error
 * surfaces to the client as an opaque failure; a structured payload is legible
 * to the model, per the S0 contract error shape).
 * @param {string} toolName
 * @param {(args: Object) => Promise<any>} fn - receives the parsed tool args
 */
function tool(toolName, fn) {
  return async (_toolArgs, context) => {
    const args = (context && context.triggerMetadata && context.triggerMetadata.mcptoolargs) || {};
    try {
      const result = await fn(args);
      return JSON.stringify(result);
    } catch (err) {
      if (context && typeof context.error === 'function') {
        context.error(`MCP tool ${toolName} failed:`, err && err.message);
      }
      return JSON.stringify({
        error: (err && err.message) || 'unknown error',
        code: (err && err.name) || undefined,
        details: (err && err.validationErrors) || undefined,
      });
    }
  };
}

/**
 * Validate and split a `YYYY-MM` month key.
 * @param {*} month - raw tool arg
 * @returns {{month: string, year: number, monthNumber: number}}
 * @throws {ValidationError} when the arg is missing or malformed
 */
function parseMonth(month) {
  if (typeof month !== 'string' || !MONTH_RE.test(month)) {
    throw ValidationError.forField('month', 'month is required in YYYY-MM format (e.g. "2026-07")');
  }
  const [year, monthNumber] = month.split('-').map(Number);
  return { month, year, monthNumber };
}

/**
 * First and last day (YYYY-MM-DD) of a month, for date-range repository queries.
 * @param {number} year
 * @param {number} monthNumber - 1-12
 * @returns {{startDate: string, endDate: string}}
 */
function monthRange(year, monthNumber) {
  const prefix = `${year}-${String(monthNumber).padStart(2, '0')}`;
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { startDate: `${prefix}-01`, endDate: `${prefix}-${String(lastDay).padStart(2, '0')}` };
}

/**
 * The date a successful order's invoice is considered issued. `invoiceDate`
 * when recorded; manual invoices (`mark-manual`) don't store one, so fall back
 * to the order date rather than dropping them from every month.
 * @param {import('../domain/entities/Order')} order
 * @returns {string} YYYY-MM-DD
 */
function invoiceDateOf(order) {
  return order.invoiceDate || order.orderDate;
}

/**
 * Freshness of the orders table as a whole (any month): the newest fetched
 * order and its age in whole days. `{ null, null }` when the table is empty.
 * This is the staleness signal for the local-only Binance fetch.
 * @returns {Promise<{newestOrderDate: string|null, ageDays: number|null}>}
 */
async function tableFreshness() {
  const newestOrderDate = await container().getOrderRepository().findNewestOrderDate();
  if (!newestOrderDate) {
    return { newestOrderDate: null, ageDays: null };
  }
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const newestUtc = Date.parse(`${newestOrderDate}T00:00:00Z`);
  return { newestOrderDate, ageDays: Math.floor((todayUtc - newestUtc) / MS_PER_DAY) };
}

// ---------------------------------------------------------------------------
// list_orders
// ---------------------------------------------------------------------------
app.mcpTool('mcpListOrders', {
  toolName: 'list_orders',
  description:
    'List Binance P2P orders for one month (by order date), with per-order invoice processing status. ' +
    'Amounts are plain ARS numbers. Check tableFreshness.ageDays: the Binance fetch only runs on the ' +
    'owner\'s machine, so a high age means the table is stale and recent orders are missing.',
  toolProperties: [
    {
      propertyName: 'month',
      propertyType: 'string',
      description: 'Month in YYYY-MM format (e.g. "2026-07").',
      isRequired: true,
    },
  ],
  handler: tool('list_orders', async (args) => {
    const { month, year, monthNumber } = parseMonth(args.month);
    const [report, freshness] = await Promise.all([
      container().getGenerateMonthlyReportUseCase().execute({ year, month: monthNumber }),
      tableFreshness(),
    ]);
    const orders = report.orders.map((o) => ({
      orderNumber: o.orderNumber,
      orderDate: o.orderDate,
      tradeType: o.tradeType,
      asset: o.asset,
      fiat: o.fiat,
      totalPrice: o.totalPrice,
      processingStatus: o.processing_status,
      cae: o.cae ? o.cae.value : null,
      voucherNumber: o.voucherNumber != null ? o.voucherNumber : null,
      errorMessage: o.error_message || null,
    }));
    return { month, count: orders.length, tableFreshness: freshness, orders };
  }),
});

// ---------------------------------------------------------------------------
// list_invoices
// ---------------------------------------------------------------------------
app.mcpTool('mcpListInvoices', {
  toolName: 'list_invoices',
  description:
    'List AFIP invoices issued in one month (by invoice date — a back-filled invoice can belong to a ' +
    'later month than its order). Amounts are plain ARS numbers.',
  toolProperties: [
    {
      propertyName: 'month',
      propertyType: 'string',
      description: 'Month in YYYY-MM format (e.g. "2026-07").',
      isRequired: true,
    },
  ],
  handler: tool('list_invoices', async (args) => {
    const { month } = parseMonth(args.month);
    const [invoicedOrders, freshness] = await Promise.all([
      container().getOrderRepository().findSuccessfullyInvoiced(),
      tableFreshness(),
    ]);
    const invoices = invoicedOrders
      .filter((o) => invoiceDateOf(o).startsWith(month))
      .sort((a, b) => (a.voucherNumber || 0) - (b.voucherNumber || 0))
      .map((o) => ({
        voucherNumber: o.voucherNumber != null ? o.voucherNumber : null,
        cae: o.cae ? o.cae.value : null,
        invoiceDate: invoiceDateOf(o),
        orderNumber: o.orderNumber.value,
        totalAmount: o.totalAmount.amount,
        currency: o.totalAmount.currency,
      }));
    return { month, count: invoices.length, tableFreshness: freshness, invoices };
  }),
});

// ---------------------------------------------------------------------------
// monthly_income
// ---------------------------------------------------------------------------
app.mcpTool('mcpMonthlyIncome', {
  toolName: 'monthly_income',
  description:
    'Monthly income summary: ARS invoiced via AFIP (by invoice date), total SELL order volume (by ' +
    'order date), and how many SELL orders still lack a successful invoice. Before trusting the ' +
    'numbers, check tableFreshness.ageDays — a stale orders table under-reports income.',
  toolProperties: [
    {
      propertyName: 'month',
      propertyType: 'string',
      description: 'Month in YYYY-MM format (e.g. "2026-07").',
      isRequired: true,
    },
  ],
  handler: tool('monthly_income', async (args) => {
    const { month, year, monthNumber } = parseMonth(args.month);
    const { startDate, endDate } = monthRange(year, monthNumber);
    const orderRepository = container().getOrderRepository();
    const [monthOrders, invoicedOrders, freshness] = await Promise.all([
      orderRepository.findByDateRange(startDate, endDate),
      orderRepository.findSuccessfullyInvoiced(),
      tableFreshness(),
    ]);

    const invoicesInMonth = invoicedOrders.filter((o) => invoiceDateOf(o).startsWith(month));
    const sellOrders = monthOrders.filter((o) => o.isSellTrade());
    const uninvoiced = sellOrders.filter((o) => !o.isSuccessful());

    return {
      month,
      invoicedArs: invoicesInMonth.reduce((sum, o) => sum + o.totalAmount.amount, 0),
      invoiceCount: invoicesInMonth.length,
      sellOrdersArs: sellOrders.reduce((sum, o) => sum + o.totalAmount.amount, 0),
      sellOrderCount: sellOrders.length,
      uninvoicedCount: uninvoiced.length,
      tableFreshness: freshness,
    };
  }),
});
