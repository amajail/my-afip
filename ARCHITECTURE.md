# Architecture

## Overview

The application follows **Clean Architecture** with four implemented layers and a planned API layer. Dependencies point inward — Domain has no external dependencies, and each outer layer only depends on the one immediately inside it.

```
┌─────────────────────────────────────┐
│    Presentation (CLI)               │  ← User Interface
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
- `CreateInvoice` — creates a single AFIP invoice for an order number
- `ProcessUnprocessedOrders` — batch-runs `CreateInvoice` for all pending orders
- `GenerateMonthlyReport` — aggregates orders and invoices for a given month

**DI Container** (`di/container.js`) — singleton factory that wires all infrastructure implementations to use-case constructors.

### Infrastructure (`src/infrastructure/`)

External system adapters. Implements the application interfaces.

**Repositories** (SQLite):
- `SQLiteOrderRepository` — implements `IOrderRepository`. Hydrates `Order` domain objects from rows.
- `SQLiteInvoiceRepository` — implements `IInvoiceRepository`.

**Gateways**:
- `AfipGatewayAdapter` — implements `IAfipGateway`. Wraps the legacy `AfipService`.
- `BinanceGatewayAdapter` — implements `IBinanceGateway`. Wraps the legacy `BinanceService`.

**Database** (`src/database/Database.js`) — SQLite wrapper used by both repositories. Default path: `./data/afip-orders.db`.

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
| `mark-manual` | `ProcessCommand.markOrderAsManual()` |

**Formatters**:
- `ConsoleFormatter` — styled console output (success/error/warning/info/progress/header).
- `TableFormatter` — ASCII table renderer.
- `ReportFormatter` — monthly report and processing summary layouts.

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
│   │   ├── invoices/                 # CreateInvoice, ProcessUnprocessedOrders
│   │   └── reports/                  # GenerateMonthlyReport
│   └── di/                           # Container (dependency injection)
├── infrastructure/
│   ├── repositories/                 # SQLiteOrderRepository, SQLiteInvoiceRepository
│   └── gateways/                     # AfipGatewayAdapter, BinanceGatewayAdapter
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
│   └── Database.js                   # SQLite wrapper
└── services/                         # Legacy: AfipService, BinanceService, DirectInvoiceService
```

## Legacy Layer

`src/services/`, `src/models/`, and `src/utils/` contain the pre-refactoring implementation that is still in use. The gateways wrap these services rather than replacing them directly:

- `AfipGatewayAdapter` → wraps `AfipService`
- `BinanceGatewayAdapter` → wraps `BinanceService`
- `src/config/index.js`, `src/utils/logger.js`, `src/utils/validators.js` are backward-compatibility shims re-exporting from `src/shared/`

## Business Rules

**AFIP 10-Day Rule** — invoices must be created within 10 calendar days of the order date. Enforced by `InvoiceDateValidator`. Violations throw `DomainError`.

**Type C Invoices** — `CbteTipo: 11`, no VAT, for monotributistas in simplified tax regime.

**Service Invoicing** — `Concepto: 2` (services, not goods). Requires `FchServDesde` and `FchServHasta` dates.

**Duplicate Prevention** — `order_number` has a UNIQUE constraint in the database. A failed attempt does not count as processed — failed orders are automatically retried on the next run.

## Implementation Status

| Phase | Description | Status |
|---|---|---|
| 1 | Foundation: shared layer, domain value objects | Complete |
| 2 | Domain layer: entities, services, events | Complete |
| 3 | Infrastructure: repositories and gateway adapters | Complete |
| 4 | Application layer: use cases, DI container | Complete |
| 5 | API layer: Azure Functions HTTP triggers | Planned — `src/api/` directories exist but are empty |
| 6 | CLI layer: refactored commands and formatters | Complete |
| 7 | Integration and deployment | Partially complete (CI/CD done, Azure deployment pending) |

## Testing

```
tests/
├── unit/
│   ├── domain/           # 241+ tests — entities, value objects, services
│   ├── application/      # Use case tests
│   ├── cli/              # Formatter tests
│   ├── shared/           # Config, utils, errors, logging
│   └── services/         # Legacy service tests
└── integration/
    └── database/         # SQLite integration tests (in-memory DB)
```

Coverage threshold: **57%** across branches, functions, lines, and statements (enforced by Jest).
