# Architecture

## Overview

The application follows **Clean Architecture**. Dependencies point inward — Domain has no external dependencies, and each outer layer only depends on the one immediately inside it.

```
┌─────────────────────────────────────┐
│  Presentation (CLI, Functions, SWA) │  ← User Interface
├─────────────────────────────────────┤
│    Application (Use Cases)          │  ← Orchestration
├─────────────────────────────────────┤
│    Domain (Business Logic)          │  ← Core — no external dependencies
├─────────────────────────────────────┤
│    Infrastructure (External)        │  ← Technical Details
└─────────────────────────────────────┘
         Shared (cross-cutting)
```

## Layer Responsibilities

### Domain (`src/domain/`)

Pure business logic. No framework dependencies, no I/O.

**Entities** — aggregate roots with identity and lifecycle:
- `Order.js` — Binance P2P order. Tracks processing state. Key methods: `canBeProcessed()`, `isReadyForInvoicing()` (10-day rule), `markAsProcessed(result)`, `isSellTrade()`.
- `Invoice.js` — AFIP electronic invoice. Knows its type (C vs B), concept (services), VAT rate. Key methods: `toAFIPFormat(pointOfSale)`, `fromOrder(order, options)`.
- `InvoiceResult.js` — AFIP response encapsulation. Static factories: `success(data)`, `failure(error)`, `fromAFIPResponse(response)`.

**Value Objects** — immutable, validated on construction:
- `Money.js` — amount + currency (ARS/USD/EUR). Full arithmetic: `add`, `subtract`, `multiply`, `percentage`, `convertTo`.
- `CUIT.js` — Argentine tax ID with checksum validation. Formatted as `XX-XXXXXXXX-X`.
- `CAE.js` — AFIP authorization code (14 digits). Has `isExpired()`, `daysUntilExpiration()`.
- `OrderNumber.js` — Binance order identifier with validation.

**Domain Services** — stateless business logic:
- `InvoiceCalculator.js` — VAT rates (`STANDARD: 0.21`, `REDUCED: 0.105`, `ZERO: 0`).
- `InvoiceDateValidator.js` — enforces the AFIP 10-day rule (`MAX_DAYS_AFTER_TRANSACTION = 10`).
- `OrderProcessor.js` — eligibility check: `canProcess(order)` → `{canProcess, reasons[]}`.

**Domain Events** — immutable event records:
- `InvoiceCreated.js` — orderNumber, cae, voucherNumber, invoiceDate, totalAmount.
- `OrderProcessed.js` — orderNumber, success, cae, voucherNumber, errorMessage.

### Application (`src/application/`)

Orchestrates domain and infrastructure. Defines ports (interfaces) that infrastructure must implement.

**Interfaces** (dependency inversion contracts):
- `IOrderRepository` — `save`, `findByOrderNumber`
- `IInvoiceRepository` — `save`, `findByCae`
- `IAfipGateway` — `createInvoice`, `queryInvoice`
- `IBinanceGateway` — `fetchOrders`, `getOrderByNumber`

**Use Cases** (all extend `UseCase` base):
- `FetchBinanceOrders` — fetches SELL orders for N days, stores new ones, skips duplicates
- `CreateInvoice` — creates a single AFIP invoice for an order number. Splits failures into
  *permanent* (AFIP rejection, `DomainError`, `ValidationError`, duplicate voucher) which are
  recorded as failed, and *transient* (TLS/DH, network, AFIP unreachable) which are re-thrown so
  the order stays unprocessed and is retried next run.
- `ProcessUnprocessedOrders` — batch-runs `CreateInvoice` for all pending orders
- `ProcessMonthOrders` — back-fills one `YYYY-MM`: resets that month's failed orders via
  `resetForRetry()`, then re-invoices them with `skipAgeCheck` and **today's** invoice date
- `GenerateMonthlyReport` — aggregates orders and invoices for a given month

**DI Container** (`di/container.js`) — singleton factory that wires all infrastructure implementations to use-case constructors.

### Infrastructure (`src/infrastructure/`)

External system adapters. Implements the application interfaces.

**Repositories** (Azure Table Storage):
- `AzureOrderRepository` — implements `IOrderRepository`. Hydrates `Order` domain objects from entities.
- `AzureInvoiceRepository` — implements `IInvoiceRepository`.

**Gateways**:
- `AfipGatewayAdapter` — implements `IAfipGateway`. Wraps the legacy `AfipService`.
- `BinanceGatewayAdapter` — implements `IBinanceGateway`. Wraps the legacy `BinanceService`.

**Database** (`src/database/AzureTableDatabase.js`) — `@azure/data-tables` wrapper used by both
repositories. Two tables, `orders` and `invoices`, from `AZURE_STORAGE_CONNECTION_STRING`. Orders are
keyed `partitionKey = 'orders'`, `rowKey = orderNumber`, so `createEntity` + a swallowed 409 is the
dedupe. The constructor refuses a non-Azurite connection string when `NODE_ENV=test`.

### CLI (`src/cli/`)

Presentation layer. Routes `process.argv` to use cases and formats output.

**Router** (`cli/index.js`) — maps command strings to command handlers:

| Command | Handler |
|---|---|
| `binance-auto` | `BinanceCommand.fetchOrders()` |
| `binance-fetch` | `BinanceCommand.fetchOrders()` |
| `binance-test` | `BinanceCommand.testConnection()` |
| `report` | `ReportCommand.showMonthlyReport()` |
| `report-stats` | `ReportCommand.showStatistics()` |
| `process` | `ProcessCommand.processUnprocessedOrders()` |
| `process <order>` | `ProcessCommand.processOrderByNumber(n)` |
| `process-month <y> <m>` | `ProcessCommand.processOrdersByMonth(y, m)` |
| `mark-manual <order> <cae> [voucher]` | `ProcessCommand.markOrderAsManual()` |

**Formatters**:
- `ConsoleFormatter` — styled console output (success/error/warning/info/progress/header).
- `TableFormatter` — ASCII table renderer.
- `ReportFormatter` — monthly report and processing summary layouts.

### HTTP (`src/functions/`)

Azure Functions v4 programming model; `functions/index.js` just requires each handler module. Thin,
like the CLI: parse → use case → JSON.

| Route | Method | Handler |
|---|---|---|
| `/api/orders?month=YYYY-MM` | GET | reads `orders` + stats for the month (defaults to current) |
| `/api/process-month` | POST | `{year, month}` → `ProcessMonthOrders` |

Both are `authLevel: 'function'`, so the dashboard needs a function key. `processMonth` reconstructs
the AFIP certificate and key from the `AFIP_CERT_B64`/`AFIP_KEY_B64` app settings into `os.tmpdir()`
per request, sets `AFIP_CERT_PATH`/`AFIP_KEY_PATH`, and unlinks them in a `finally`. The DI container
is required *inside* the handler, not at module load, so those paths exist before it wires up.

### Dashboard (`dashboard/`)

Astro static site on Azure Static Web Apps, styled with Tailwind v4 + `@amajail/ui` (pinned to a tag,
never a branch). Built with `PUBLIC_API_URL` and `PUBLIC_FUNCTION_KEY` at deploy time.

### Shared (`src/shared/`)

Cross-cutting concerns used by all layers.

**Config** — environment-aware unified config. Entry point: `src/shared/config/index.js`. See [Configuration Reference](README.md#configuration-reference) for all env vars.

**Errors** — custom hierarchy:
```
AppError (base, adds statusCode + metadata)
├── DomainError     — HTTP 422, business rule violations
├── ValidationError — HTTP 400, input validation failures
├── InfrastructureError — HTTP 500, wraps originalError
└── NotFoundError   — HTTP 404, resourceType + identifier
```

**Logging** — `LoggerFactory` selects `ConsoleLogger` (CLI/dev/test) or `ApplicationInsightsLogger` (Azure) based on environment detection.

**Constants** — `afip.constants.js` contains `AFIP_DOC_TYPE`, `AFIP_CONCEPT`, `AFIP_VOUCHER_TYPE`, `CURRENCY_CODE`, `INVOICE_DATE_RULES`.

**Utils** — `date.utils.js`, `currency.utils.js`, `format.utils.js`.

**Validation** — `CUITValidator` (with checksum), `AmountValidator`, `DateValidator`, `ConfigValidator`, `InvoiceValidator`.

## Directory Structure

```
src/
├── index.js                          # Entry point
├── cli.js                            # CLI bootstrap
├── AfipInvoiceApp.js                 # Application facade (config init)
├── domain/
│   ├── entities/                     # Order.js, Invoice.js, InvoiceResult.js
│   ├── value-objects/                # Money.js, CUIT.js, CAE.js, OrderNumber.js
│   ├── services/                     # InvoiceCalculator, InvoiceDateValidator, OrderProcessor
│   └── events/                       # InvoiceCreated.js, OrderProcessed.js
├── application/
│   ├── interfaces/                   # IOrderRepository, IInvoiceRepository, IAfipGateway, IBinanceGateway
│   ├── use-cases/
│   │   ├── binance/                  # FetchBinanceOrders
│   │   ├── invoices/                 # CreateInvoice, ProcessUnprocessedOrders, ProcessMonthOrders
│   │   └── reports/                  # GenerateMonthlyReport
│   └── di/                           # Container (dependency injection)
├── infrastructure/
│   ├── repositories/                 # AzureOrderRepository, AzureInvoiceRepository
│   └── gateways/                     # AfipGatewayAdapter, BinanceGatewayAdapter
├── functions/                        # Azure Functions HTTP triggers (orders, processMonth)
├── cli/
│   ├── commands/                     # BinanceCommand, ProcessCommand, ReportCommand
│   ├── formatters/                   # ConsoleFormatter, TableFormatter, ReportFormatter
│   └── index.js                      # CLI router
├── shared/
│   ├── config/                       # Unified config (index, environment, helpers, api.config, cli.config)
│   ├── constants/                    # afip.constants.js
│   ├── errors/                       # AppError, DomainError, ValidationError, InfrastructureError, NotFoundError
│   ├── logging/                      # Logger, LoggerFactory, ConsoleLogger, ApplicationInsightsLogger
│   ├── utils/                        # currency.utils, date.utils, format.utils
│   └── validation/                   # validators.js
├── database/
│   └── AzureTableDatabase.js         # Azure Table Storage wrapper
└── services/                         # Legacy: AfipService, BinanceService
```

## Legacy Layer

`src/services/`, `src/models/`, and `src/utils/` contain the pre-refactoring implementation that is still in use. The gateways wrap these services rather than replacing them directly:

- `AfipGatewayAdapter` → wraps `AfipService`
- `BinanceGatewayAdapter` → wraps `BinanceService`
- `src/config/index.js`, `src/utils/logger.js`, `src/utils/validators.js` are backward-compatibility shims re-exporting from `src/shared/`

## Business Rules

The AFIP rules and constants that must not be got wrong live in **`CLAUDE.md`** ("Read this first"
and "Invoice constants"), so there is one copy. The structural half is here: `InvoiceDateValidator`
enforces the 10-day rule, `OrderProcessor.canProcess()` gates eligibility, and duplicate prevention
is the `rowKey = orderNumber` collision described under Infrastructure.

## Implementation Status

| Phase | Description | Status |
|---|---|---|
| 1 | Foundation: shared layer, domain value objects | Complete |
| 2 | Domain layer: entities, services, events | Complete |
| 3 | Infrastructure: repositories and gateway adapters | Complete |
| 4 | Application layer: use cases, DI container | Complete |
| 5 | HTTP layer: Azure Functions triggers (`src/functions/`) | Complete |
| 6 | CLI layer: refactored commands and formatters | Complete |
| 7 | Integration and deployment | Complete — Function App, Static Web App and CI/CD all deploy from `main` |

## Testing

```
tests/
├── helpers/              # test-setup.js
└── unit/
    ├── domain/           # entities, value objects, services
    ├── application/      # use case tests
    ├── infrastructure/   # repository tests
    ├── database/         # AzureTableDatabase (incl. the NODE_ENV=test storage guard)
    ├── cli/              # formatter tests
    ├── shared/           # config, utils, errors, logging
    └── services/         # legacy service tests
```

Everything is unit-level and mocked; there is no `tests/integration/` directory, so the
`test:integration` script currently matches nothing. Coverage threshold: **57%** across branches,
functions, lines and statements (enforced by Jest, `src/functions/**` excluded from collection).
