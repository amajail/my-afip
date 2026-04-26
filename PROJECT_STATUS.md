# Project Status

**Last updated:** April 2026

## Current State

The system is production-operational. Weekly automation runs every Monday via GitHub Actions, fetching Binance P2P SELL orders and creating AFIP Type C invoices automatically.

## Architecture Completion

| Phase | Description | Status |
|---|---|---|
| 1 | Foundation: shared config, errors, logging, validation | Complete |
| 2 | Domain layer: entities, value objects, domain services | Complete |
| 3 | Infrastructure: SQLite repositories, gateway adapters | Complete |
| 4 | Application layer: use cases, DI container | Complete |
| 5 | API layer: Azure Functions HTTP triggers | Planned |
| 6 | CLI layer: commands, formatters, router | Complete |
| 7 | Integration and deployment | CI/CD done; Azure Functions pending |

## What Works

- **Weekly automation**: GitHub Actions runs `binance-auto` every Monday 9am UTC
- **Binance integration**: Fetches last 7 days of SELL orders via P2P API
- **AFIP invoice creation**: Type C invoices via WSFEv1 (facturajs SDK)
- **Duplicate prevention**: SQLite UNIQUE constraint on `order_number`
- **Retry logic**: Failed orders are retried automatically on next run
- **Monthly reporting**: `npm run report` shows current-month order and invoice status
- **CI/CD**: PRs trigger test suite on Node 18.x and 20.x with coverage enforcement

## Known Limitations

- **API layer not implemented**: `src/api/` directories exist but are empty. Azure Functions HTTP triggers are planned (Phase 5) but the CLI is the only interface.
- **Legacy layer coexists**: `src/services/` (AfipService, BinanceService) is still used by the gateways. A full replacement is deferred to Phase 5.
- **Test coverage at threshold**: Currently at 57% minimum. Increasing coverage is in the roadmap.

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js 18+ (CommonJS) |
| AFIP SDK | facturajs ^0.3.2 |
| Database | SQLite (sqlite3 ^5.1.7) |
| HTTP client | axios ^1.12.2 |
| Logging | winston ^3.18.3 |
| Testing | Jest ^30.1.3 |
| CI/CD | GitHub Actions |
| DB hosting | Azure Blob Storage (weekly workflow) |

## Configuration

Required environment variables:

```bash
AFIP_CUIT=                    # 11-digit CUIT, no hyphens
AFIP_CERT_PATH=               # Path to .crt file
AFIP_KEY_PATH=                # Path to private key
AFIP_ENVIRONMENT=production   # or 'homologacion'
AFIP_PTOVTA=2                 # Point of sale number
BINANCE_API_KEY=
BINANCE_SECRET_KEY=
```

See [README](README.md#configuration-reference) for full reference.
