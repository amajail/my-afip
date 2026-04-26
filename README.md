# AFIP Electronic Invoicing for Cryptocurrency Trading

A Node.js application for processing cryptocurrency P2P trading orders into AFIP-compliant electronic invoices for Argentine monotributistas.

## Features

- **Binance API Integration**: Fetch P2P trading orders directly from Binance
- **Automatic Invoice Creation**: Converts trading orders to AFIP Type C invoices
- **Azure Table Storage**: Cloud database shared between local runs and GitHub Actions
- **Dashboard**: Astro static site (GitHub Pages) showing monthly order and invoice stats
- **Historical Reprocessing**: `process-month` command creates invoices for old orders with today's date
- **Duplicate Prevention**: Order numbers are unique; already-processed orders are skipped
- **Weekly Automation**: GitHub Actions workflow runs every Monday at 9am UTC
- **AFIP WSFEv1 Compliance**: Full electronic invoicing via the open-source facturajs SDK

## Quick Start

### Prerequisites

- Node.js 18+
- AFIP CUIT (tax ID)
- AFIP digital certificate and private key
- Binance API key and secret
- Azure Storage account (for database)

### Installation

```bash
git clone <repository-url>
cd my-afip
npm install
```

### Configuration

Create a `.env` file:

```bash
# AFIP
AFIP_CUIT=20283536638
AFIP_CERT_PATH=./certificates/cert.crt
AFIP_KEY_PATH=./certificates/private.key
AFIP_ENVIRONMENT=production          # 'production' or 'homologacion'
AFIP_PTOVTA=3                        # Point of sale number

# Binance
BINANCE_API_KEY=your_binance_api_key
BINANCE_SECRET_KEY=your_binance_secret_key

# Azure
AZURE_STORAGE_CONNECTION_STRING=your_azure_storage_connection_string

# Optional
LOG_LEVEL=info
```

## Usage

### CLI Commands

Invoked via `node src/index.js <command>` or `npm run <script>`:

| Command | npm script | Description |
|---|---|---|
| `binance-fetch [days] [type]` | `npm run binance:fetch` | Fetch orders from Binance into Azure Storage |
| `binance-auto` | `npm run binance:auto` | Fetch last 7 days + process pending to AFIP |
| `process` | `npm run process:auto` | Process all pending orders to AFIP invoices |
| `process <order-number>` | — | Process a specific order by number |
| `process-month <year> <month>` | `npm run process:month` | Create invoices for all pending orders in a given month |
| `report` | `npm run report` | Show current-month invoice report |
| `report-stats` | — | Show order statistics summary |
| `mark-manual <order> <cae> [voucher]` | — | Mark an order as manually processed |
| `help` | — | Show available commands |

### Typical Workflows

```bash
# Fetch today's orders then immediately create AFIP invoices
npm run binance:auto

# Fetch only (no AFIP submission) — useful before checking
npm run binance:fetch

# Create invoices for all January 2026 pending orders
npm run process:month -- 2026 1

# View this month's invoice report
npm run report
```

### Two-Part Automation

Binance P2P API blocks requests from cloud providers (Azure, AWS) — an Argentine IP is required. For this reason, the workflow is split:

1. **Local step** — run `npm run binance:fetch` to pull orders from Binance and save them to Azure Table Storage.
2. **Automated step** — GitHub Actions reads from Azure Table Storage every Monday and creates AFIP invoices.

### Historical / Backfill Processing

AFIP normally requires invoices to be created within 10 days of the order date. The `process-month` command bypasses this internal check and uses **today's date** as the invoice date (AFIP requires the invoice date to be ≥ the last issued invoice date, so using today is always safe).

```bash
node src/index.js process-month 2026 1   # backfill January 2026
node src/index.js process-month 2026 2   # backfill February 2026
```

### Dashboard

An Astro-based dashboard is hosted on GitHub Pages at `https://<org>.github.io/my-afip/`. It reads from the Azure Function API.

- Navigate between months with the prev/next arrows
- When a month has pending (uninvoiced) SELL orders, a **"Create N pending invoices"** button appears
- Clicking the button calls `POST /api/process-month` and reloads the data when done

To run the dashboard locally:

```bash
cd dashboard
cp .env.example .env       # set PUBLIC_API_URL to your local function URL
npm install
npm run dev                # opens http://localhost:4321
```

### Azure Functions (API)

The backend runs as Azure Functions v4 (Node.js):

| Endpoint | Method | Description |
|---|---|---|
| `GET /api/orders?month=YYYY-MM` | GET | Returns orders and stats for a month |
| `POST /api/process-month` | POST | Creates invoices for pending orders in `{ year, month }` |

To run locally:

```bash
# copy and fill in local.settings.json (gitignored)
cp local.settings.json.example local.settings.json
func start
```

Required settings in `local.settings.json`: `AZURE_STORAGE_CONNECTION_STRING`, `AFIP_CUIT`, `AFIP_CERT_PATH`, `AFIP_KEY_PATH`, `AFIP_ENVIRONMENT`, `AFIP_PTOVTA`, `BINANCE_API_KEY`, `BINANCE_SECRET_KEY`, `CORS_ORIGINS`.

## Configuration Reference

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `AFIP_CUIT` | Yes | AFIP tax ID (11 digits, no hyphens) |
| `AFIP_CERT_PATH` | Yes | Path to AFIP certificate (.crt) |
| `AFIP_KEY_PATH` | Yes | Path to AFIP private key |
| `AFIP_ENVIRONMENT` | Yes | `production` or `homologacion` |
| `AFIP_PTOVTA` | Yes | Point of sale number |
| `AZURE_STORAGE_CONNECTION_STRING` | Yes | Azure Storage connection string (database) |
| `BINANCE_API_KEY` | Yes | Binance API key |
| `BINANCE_SECRET_KEY` | Yes | Binance secret key |
| `CORS_ORIGINS` | Functions only | Allowed origin for CORS (e.g. `https://you.github.io`) |
| `LOG_LEVEL` | No | Winston log level (default: `info`) |

For Azure Functions deployment, certificates are passed as base64-encoded env vars instead of file paths:

| Variable | Description |
|---|---|
| `AFIP_CERT_B64` | Base64-encoded AFIP certificate |
| `AFIP_KEY_B64` | Base64-encoded AFIP private key |

### Binance API Setup

> **Geographic restriction:** Binance P2P API blocks requests from cloud providers (Azure, AWS, etc.). The `binance-fetch` step must run from an Argentine IP address.

1. Go to Binance → Account → API Management
2. Create a key with **Read** permission only
3. Restrict to your IP address
4. Add keys to `.env`

## Project Structure

```
my-afip/
├── src/
│   ├── index.js                      # CLI entry point
│   ├── domain/                       # Business logic (DDD)
│   │   ├── entities/                 # Order, Invoice, InvoiceResult
│   │   ├── value-objects/            # Money, CUIT, CAE, OrderNumber
│   │   ├── services/                 # OrderProcessor, InvoiceCalculator, InvoiceDateValidator
│   │   └── events/                   # InvoiceCreated, OrderProcessed
│   ├── application/
│   │   ├── use-cases/                # FetchBinanceOrders, CreateInvoice, ProcessUnprocessedOrders,
│   │   │                             # ProcessMonthOrders, GenerateMonthlyReport
│   │   ├── interfaces/               # IOrderRepository, IAfipGateway, IBinanceGateway
│   │   └── di/                       # Dependency injection container
│   ├── infrastructure/
│   │   ├── repositories/             # SQLiteOrderRepository (wraps AzureTableDatabase)
│   │   └── gateways/                 # AfipGatewayAdapter, BinanceGatewayAdapter
│   ├── functions/                    # Azure Functions HTTP triggers
│   │   ├── orders.js                 # GET /api/orders
│   │   └── processMonth.js           # POST /api/process-month
│   ├── database/
│   │   └── AzureTableDatabase.js     # Azure Table Storage wrapper
│   ├── cli/
│   │   ├── commands/                 # BinanceCommand, ProcessCommand, ReportCommand
│   │   └── formatters/               # ConsoleFormatter, TableFormatter, ReportFormatter
│   └── shared/
│       ├── config/                   # Environment-aware configuration
│       ├── errors/                   # AppError hierarchy
│       ├── logging/                  # Logger abstraction
│       └── validation/               # CUIT, amount, date validators
├── dashboard/                        # Astro static site (GitHub Pages)
│   ├── src/pages/index.astro         # Main dashboard page
│   ├── .env.example                  # PUBLIC_API_URL template
│   └── astro.config.mjs
├── tests/
│   ├── unit/                         # Unit tests
│   └── integration/                  # Integration tests
├── .github/workflows/
│   ├── pr-checks.yml                 # CI on PR / push to main
│   ├── weekly-invoicing.yml          # Monday 9am UTC: process pending orders
│   └── deploy-azure-function.yml     # Deploy functions on push to main
├── certificates/                     # AFIP certificates (gitignored)
├── local.settings.json               # Azure Functions local config (gitignored)
└── package.json
```

## Database

All data is stored in **Azure Table Storage** (`myafipdb` account), shared between local runs and GitHub Actions.

**orders** table:
- `order_number` (partition key) — Binance order ID
- `amount`, `price`, `total_price` — amounts in USDT and ARS
- `trade_type` — SELL or BUY
- `order_date`, `create_time` — timestamps
- `processed_at`, `success`, `cae`, `voucher_number`, `error_message` — AFIP result

No local database file is needed; the Azure connection string is the only requirement.

## AFIP Integration

Uses the open-source **facturajs** SDK for WSFEv1 integration.

### Invoice Type

- **Type C (CbteTipo: 11)** — for monotributistas, no VAT breakdown
- **Concept 2** (services) — requires service from/to dates matching the order date
- Currency: Argentine pesos (PES)

### 10-Day Rule

AFIP requires invoices to be created within 10 days of the order date. This is enforced by `InvoiceDateValidator`. The `process-month` command and `CreateInvoice` use case accept a `skipAgeCheck` flag to bypass this internal check when backfilling historical orders.

### Certificate Requirements

1. Valid AFIP digital certificate registered to your CUIT
2. Certificate associated with the `wsfe` service in the AFIP portal
3. Point of sale configured for electronic billing

## Automated Weekly Run

A GitHub Actions workflow (`weekly-invoicing.yml`) runs every Monday at 9am UTC:

1. Reads unprocessed SELL orders from Azure Table Storage
2. Decodes AFIP certificates from GitHub secrets (`AFIP_CERT_B64`, `AFIP_KEY_B64`)
3. Creates AFIP invoices for each pending order
4. Results are written back to Azure Table Storage

Required GitHub secrets: `AFIP_CUIT`, `AFIP_CERT_B64`, `AFIP_KEY_B64`, `AFIP_ENVIRONMENT`, `AFIP_PTOVTA`, `BINANCE_API_KEY`, `BINANCE_SECRET_KEY`, `AZURE_STORAGE_CONNECTION_STRING`.

## Testing

```bash
npm test                    # All tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:coverage       # Coverage report (57% threshold)
```

Coverage threshold: **57%** across branches, functions, lines, and statements.

## Troubleshooting

**AFIP 401 errors**
- Verify the certificate is associated with the `wsfe` service in the AFIP portal
- Allow 24–48 hours after certificate creation for service propagation
- Confirm the CUIT in your config matches the certificate

**AFIP "voucher number out of sequence" errors**
- Another invoice was created in AFIP outside this app (e.g. manually via portal)
- Use `mark-manual <order> <cae> [voucher]` to sync the database, then retry

**Binance API errors**
- Run `node src/index.js binance-test` to verify connectivity
- Ensure the API key has Read permission
- Binance P2P supports max 30 days per request and 6 months of history
- Requests from cloud providers are blocked — run `binance-fetch` locally

**Azure Storage errors**
- Verify `AZURE_STORAGE_CONNECTION_STRING` is set
- Tables (`orders`, `invoices`) are created automatically on first run

**Pending orders not retried after a failed run**
- A `success=false` result means the order was attempted but AFIP rejected it
- Check the `error_message` in the database or the logs for the rejection reason
- Re-run `process` or `process-month` — failed orders are eligible for retry

## Security

- Never commit `.env`, `local.settings.json`, certificates, or database files (all gitignored)
- AFIP private key and certificate stored in `./certificates/` (gitignored)
- In CI/CD, certificates are base64-encoded and stored as GitHub secrets

## License

ISC
