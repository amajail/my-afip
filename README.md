# AFIP Electronic Invoicing for Cryptocurrency Trading

A Node.js application for processing cryptocurrency P2P trading orders into AFIP-compliant electronic invoices for Argentine monotributistas.

## Features

- **Binance API Integration**: Automatically fetch P2P trading orders from Binance
- **Automatic Order Processing**: Converts cryptocurrency trading data to AFIP Type C invoices
- **Duplicate Prevention**: SQLite database prevents duplicate invoice creation
- **Comprehensive Reporting**: Database-powered monthly reports and statistics
- **Secure Configuration**: Environment-based configuration with sensitive data protection
- **AFIP WSFEv1 Compliance**: Full electronic invoicing via open-source facturajs SDK
- **Weekly Automation**: GitHub Actions workflow runs every Monday at 9am UTC

## Quick Start

### Prerequisites

- Node.js 18+
- AFIP CUIT (tax ID)
- AFIP digital certificate and private key (for production)
- Binance API key and secret

### Installation

```bash
git clone <repository-url>
cd my-afip
npm install
```

### Configuration

Create a `.env` file:

```bash
# Required
AFIP_CUIT=20283536638
AFIP_CERT_PATH=./certificates/cert.crt
AFIP_KEY_PATH=./certificates/private.key
AFIP_ENVIRONMENT=production          # 'production' or 'homologacion'
AFIP_PTOVTA=2                        # Point of sale number (default: 2)
BINANCE_API_KEY=your_binance_api_key
BINANCE_SECRET_KEY=your_binance_secret_key

# Optional
LOG_LEVEL=info
DB_PATH=./data/afip-orders.db
INVOICE_INPUT_PATH=./data/invoices.csv
INVOICE_OUTPUT_PATH=./data/processed
```

## Usage

### CLI Commands

The application is invoked via `node src/index.js <command>`:

| Command | npm script | Description |
|---|---|---|
| `binance-auto` | `npm run binance:auto` | Fetch last 7 days of SELL orders and process to AFIP |
| `report` | `npm run report` | Show current-month invoice report |
| `binance-fetch` | — | Fetch orders only (no processing) |
| `binance-test` | — | Test Binance API connection |
| `process` | — | Process all pending orders |
| `process <order>` | — | Process a specific order by number |
| `mark-manual` | — | Mark an order as manually processed |
| `report-stats` | — | Show order statistics |
| `help` | — | Show available commands |

### Typical workflow

```bash
# Full automation: fetch from Binance + create AFIP invoices
npm run binance:auto

# View this month's invoice report
npm run report
```

### Automated weekly run

A GitHub Actions workflow (`weekly-invoicing.yml`) runs `binance-auto` every Monday at 9am UTC. It:

1. Downloads the SQLite database from Azure Blob Storage
2. Decodes AFIP certificates from GitHub secrets
3. Runs `npm run binance:auto`
4. Uploads the updated database back to Azure Blob Storage

Required GitHub secrets: `AFIP_CUIT`, `AFIP_CERT_B64`, `AFIP_KEY_B64`, `AFIP_ENVIRONMENT`, `AFIP_PTOVTA`, `BINANCE_API_KEY`, `BINANCE_SECRET_KEY`, `AZURE_STORAGE_CONNECTION_STRING`.

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AFIP_CUIT` | Yes | — | AFIP tax ID (11 digits, no hyphens) |
| `AFIP_CERT_PATH` | Yes | — | Path to AFIP certificate (.crt) |
| `AFIP_KEY_PATH` | Yes | — | Path to AFIP private key |
| `AFIP_ENVIRONMENT` | No | `production` | `production` or `homologacion` |
| `AFIP_PTOVTA` | No | `2` | Point of sale number |
| `BINANCE_API_KEY` | Yes | — | Binance API key |
| `BINANCE_SECRET_KEY` | Yes | — | Binance secret key |
| `DB_PATH` | No | `./data/afip-orders.db` | SQLite database path |
| `LOG_LEVEL` | No | `info` | Winston log level |
| `INVOICE_OUTPUT_PATH` | No | `./data/processed` | Output directory |

### Binance API Setup

1. Go to Binance → Account → API Management
2. Create a key with **Read** permission only
3. Restrict to your IP address
4. Add keys to `.env`

## Project Structure

```
my-afip/
├── src/
│   ├── index.js                      # Entry point (loads dotenv, starts CLI)
│   ├── cli.js                        # CLI router
│   ├── AfipInvoiceApp.js             # Application facade
│   ├── domain/                       # Business logic (DDD)
│   │   ├── entities/                 # Order, Invoice, InvoiceResult
│   │   ├── value-objects/            # Money, CUIT, CAE, OrderNumber
│   │   ├── services/                 # OrderProcessor, InvoiceCalculator, InvoiceDateValidator
│   │   └── events/                   # InvoiceCreated, OrderProcessed
│   ├── application/
│   │   ├── use-cases/                # FetchBinanceOrders, CreateInvoice, ProcessUnprocessedOrders, GenerateMonthlyReport
│   │   ├── interfaces/               # IOrderRepository, IInvoiceRepository, IAfipGateway, IBinanceGateway
│   │   └── di/                       # Dependency injection container
│   ├── infrastructure/
│   │   ├── repositories/             # SQLiteOrderRepository, SQLiteInvoiceRepository
│   │   └── gateways/                 # AfipGatewayAdapter, BinanceGatewayAdapter
│   ├── cli/
│   │   ├── commands/                 # BinanceCommand, ProcessCommand, ReportCommand
│   │   └── formatters/               # ConsoleFormatter, TableFormatter, ReportFormatter
│   ├── shared/
│   │   ├── config/                   # Environment-aware configuration
│   │   ├── constants/                # AFIP constants
│   │   ├── errors/                   # AppError hierarchy
│   │   ├── logging/                  # Logger abstraction (Console + App Insights)
│   │   ├── utils/                    # Date, currency, format helpers
│   │   └── validation/               # CUIT, amount, date validators
│   ├── database/
│   │   └── Database.js               # SQLite wrapper
│   └── services/                     # Legacy AFIP and Binance service wrappers
├── tests/
│   ├── unit/                         # Unit tests
│   └── integration/                  # Integration tests (SQLite)
├── .github/workflows/
│   ├── pr-checks.yml                 # CI on PR and push to main/develop
│   └── weekly-invoicing.yml          # Monday 9am UTC automation
├── data/                             # SQLite database (gitignored)
├── certificates/                     # AFIP certificates (gitignored)
├── package.json
└── .env                              # Environment config (gitignored)
```

## Database Schema

SQLite at `./data/afip-orders.db`:

**orders** — Binance P2P orders with processing status
- `order_number` (UNIQUE) — Binance order ID
- `amount`, `price`, `total_price` — amounts in USDT and ARS
- `trade_type` — SELL or BUY
- `create_time` — original transaction timestamp
- `processed_at`, `success`, `cae`, `voucher_number`, `error_message` — AFIP result

**invoices** — AFIP invoice records linked to orders

## AFIP Integration

Uses the open-source **facturajs** SDK for direct WSFEv1 integration.

### Invoice Type

- **Type C (CbteTipo: 11)** — for monotributistas, no VAT
- **Concept 2** (services) — requires service from/to dates
- Currency: Argentine pesos (PES)

### AFIP 10-Day Rule

Invoices must be created within 10 days of the order date. This is enforced by `InvoiceDateValidator` and will throw a `DomainError` if violated.

### Certificate Requirements

1. Valid AFIP digital certificate registered to your CUIT
2. Certificate associated with the `wsfe` service in the AFIP portal
3. Point of sale configured for electronic billing

See [Certificate Management](docs/core/certificates.md) for setup instructions.

## Testing

```bash
npm test                # All tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests only
npm run test:coverage   # Coverage report (57% threshold)
```

Coverage threshold: **57%** across branches, functions, lines, and statements.

## Troubleshooting

**AFIP 401 errors**
- Verify certificate is associated with the `wsfe` service in the AFIP portal
- Allow 24-48 hours after certificate creation for service propagation
- Confirm CUIT in `.env` matches the certificate

**Binance API errors**
- Run `node src/index.js binance-test` to verify connectivity
- Ensure API key has Read permission
- Binance P2P API supports max 30 days per request, 6 months historical

**Duplicate orders**
- Orders are deduplicated by `order_number` at database level
- A failed attempt does not prevent retry on next run

## Security

- Never commit `.env`, certificates, or database files (all gitignored)
- AFIP private key and certificate stored in `./certificates/` (gitignored)
- In CI/CD, certificates are base64-encoded and stored as GitHub secrets

## License

ISC
