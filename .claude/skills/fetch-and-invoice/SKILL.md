---
name: "fetch-and-invoice"
description: "Check pending-order status, backfill missing Binance P2P orders for a past month, and invoice them to AFIP — the proven decision tree for 'fetch and invoice July', avoiding the exploration this skill was built to shortcut. Never auto-invoices without explicit confirmation in-conversation."
metadata:
  author: "my-afip"
user-invocable: true
disable-model-invocation: false
---

# fetch-and-invoice

Encodes the decision tree a prior session derived the hard way for "fetch
Binance orders and invoice them for month X": `binance:fetch` can only
express "last N days from now," never a fixed past window; `report status`
used to silently lie about pending orders; and invoicing is irreversible.
Follow these steps in order. **This workflow ends in a step that files real
AFIP invoices under the owner's real CUIT — never run past Step 4 without
fresh, explicit, in-conversation confirmation.**

## Step 1 — Check pending status first (don't assume data is missing)

Two checks, in this order:

1. **Authoritative check** — query the repository directly for the exact
   target range. Use plain `'YYYY-MM-DD'` strings, not `Date` objects —
   `AzureTableDatabase.getOrdersByDateRange` compares `orderDate` as a plain
   string, so a `Date` object silently breaks the comparison.
   ```bash
   node -e "
   const container = require('./src/application/di/container');
   (async () => {
     await container.initialize();
     const repo = container.getOrderRepository();
     const orders = await repo.findByDateRange('2026-07-01', '2026-09-01');
     const pending = orders.filter(o => o.isSellTrade() && !o.isProcessed());
     console.log('total:', orders.length, 'pending:', pending.length);
     pending.forEach(o => console.log(o.orderNumber.value, o.orderDate, o.totalAmount.format()));
     await container.cleanup();
   })();
   "
   ```
2. **Convenience check** — `node src/index.js report status pending` (now
   fixed and trustworthy, see Step 6). Do **not** use `report-stats` for a
   past month — it's scoped to the current calendar month only and will
   wrongly look empty.

Decision point: pending orders already exist for the range → skip to
**Step 3**. The range returns **zero orders total** (not just zero pending)
→ go to **Step 2**.

## Step 2 — If orders are genuinely missing: fetch (LOCAL ONLY)

Per CLAUDE.md rule 2: Binance P2P blocks cloud-provider IPs and needs an
Argentine-residential IP. If the current session might not be running on the
owner's machine, say so and don't attempt the fetch blindly.

**A fetch from the wrong IP doesn't error — it returns empty.** An empty
result here does not prove "no data for this window"; it may just prove
"wrong machine." Confirm the environment before concluding there's nothing
to fetch.

- **Recent / rolling window** (the normal weekly path) — unchanged:
  ```bash
  npm run binance:fetch -- 7 SELL
  ```
- **Fixed past window (backfill)** — `binance:fetch`/`binance:auto` can't
  target this; `getRecentP2POrders` always anchors its window to "now."
  1. **Dry-run first, zero DB risk**: confirms Binance actually has data
     before anything touches the database.
     ```bash
     node scripts/fetchBinanceOrders.js range 2026-07-01 2026-08-01 SELL
     ```
     This writes a local gitignored JSON file under `orders/` only.
  2. **Only if a real DB write is actually needed**: the wired, DB-writing
     path is `container.getFetchBinanceOrdersUseCase()` →
     `BinanceGatewayAdapter` → `AzureOrderRepository.saveMany()`, but it only
     calls `getRecentP2POrders` today. `BinanceService.getP2POrdersByDateRange`
     already exists and is the right primitive for a fixed window, but it's
     unwired. Wiring `{startDate, endDate}` through `BinanceGatewayAdapter`
     and `FetchBinanceOrders` is a **code change that needs explicit owner
     sign-off** — propose it, don't silently do it. (A prior session
     prototyped and reverted exactly this once the dry-run showed the data
     already existed — always dry-run first, it's usually enough.)
  3. **Chunk any range into ≤30 days**, overlapping at the boundaries.
     Binance's real API caps at ~30 days server-side; `getP2POrdersByDateRange`
     enforces it client-side and throws, `getRecentP2POrders` doesn't and
     just silently returns nothing instead. Downstream dedup is by
     `orderNumber`, so overlap is free. Worked example for a July–August
     backfill: `2026-07-01→2026-07-26`, `2026-07-24→2026-08-18`,
     `2026-08-16→2026-09-02`.
  4. **ART timezone note**: a bare `'YYYY-MM-DD'` parses as UTC midnight,
     several hours off true ART midnight (UTC-3). Don't use an exact
     calendar-day boundary as a range edge — pad it and let the
     overlap/dedup above absorb the slack.

## Step 3 — Decide the invoicing path (decision only — no execution yet)

- Orders within AFIP's 10-day window (CLAUDE.md rule 3) →
  `npm run process:auto` — dates invoices with the order's real date.
- Orders older than 10 days (the usual backfill case) →
  `npm run process:month -- 2026 7` — uses `skipAgeCheck` and **always dates
  the invoice with today**, never the order's original date. This path
  exists specifically for backfilling; never use it to "fix" or backdate an
  invoice.

## Step 4 — STOP: explicit confirmation required before running Step 3

Before running `process:auto` or `process:month` — and before `binance:auto`,
which fetches **and** invoices in one pass despite the name — state plainly
to the owner: the target month/range, the exact number of orders about to be
invoiced, and the total amount. Then wait for an explicit go-ahead **in this
conversation**. A confirmation from an earlier session, or earlier in this
session about a different month or range, does not carry over — ask again
for this specific run.

These commands file real electronic invoices with AFIP under the owner's
real CUIT and cannot be undone once AFIP issues a CAE. Nothing about this
step is skippable because the backfill "looks routine" — routineness is
exactly the failure mode this gate exists to block.

- **No confirmation needed**: `report`, `report status <x>`, `report-stats`,
  `binance-test`, `binance:fetch`, `scripts/fetchBinanceOrders.js range`
  (dry-run), the Step 1 repo-query one-liner.
- **Confirmation required, every time, this conversation**: `binance:auto`,
  `process:auto`, `process:month`, any direct `process <order-number>`.

## Step 5 — `mark-manual` escape hatch

If AFIP responds with `10016` ("no se corresponde con el proximo a
autorizar"), it already issued that voucher — don't retry invoicing, record
it instead:
```bash
node src/index.js mark-manual <order-number> <cae> [voucher-number]
```

## Step 6 — Known gotchas (don't rediscover these)

- **History, already fixed**: `report status pending|success|failed` used
  to always return empty — a string (`'Pending'`/etc.) was being compared
  against a boolean parameter, and pending orders were structurally
  unreachable regardless. Fixed this session; now trustworthy.
  `report-stats` was never buggy but is current-month-only — still don't use
  it for a past month.
- **Two persistence paths, same table**: `container.getFetchBinanceOrdersUseCase()`
  (used above) and the legacy `DatabaseOrderTracker`/
  `AzureTableDatabase.insertOrder()` path (used by report commands and the
  old standalone script) both land in the same `orders` Azure Table
  (partitionKey `orders`) — no schema drift risk, don't treat them as
  separate stores.
- **Days-anchored-to-now** is why Step 2's backfill branch exists at all —
  `binance:fetch`/`binance:auto` can only express "last N days from now,"
  never a fixed past window.
- **ART boundary** — see Step 2.4.
- **Silent empty-fetch on the wrong IP** — see Step 2's bolded warning.

## Irreversibility reminder

Nothing past Step 3 runs without fresh, in-conversation, specific
confirmation. This workflow files real tax documents under the owner's real
CUIT — there is no undo.
