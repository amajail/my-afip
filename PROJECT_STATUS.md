# Project Status

**Last updated:** April 2026

## Current State

The system is production-operational. Weekly automation runs every Monday via GitHub Actions, fetching Binance P2P SELL orders and creating AFIP Type C invoices automatically.

## Architecture Completion

| Phase | Description | Status |
|---|---|---|
| 1 | Foundation: shared config, errors, logging, validation | Complete |
| 2 | Domain layer: entities, value objects, domain services | Complete |
| 3 | Infrastructure: Azure Table repositories, gateway adapters | Complete |
| 4 | Application layer: use cases, DI container | Complete |
| 5 | HTTP layer: Azure Functions triggers (`src/functions/`) | Complete |
| 6 | CLI layer: commands, formatters, router | Complete |
| 7 | Integration and deployment | Complete — Function App, Static Web App and CI/CD deploy from `main` |

## What Works

- **Weekly automation**: GitHub Actions runs `binance-auto` every Monday 9am UTC
- **Binance integration**: Fetches last 7 days of SELL orders via P2P API
- **AFIP invoice creation**: Type C invoices via WSFEv1 (facturajs SDK)
- **Duplicate prevention**: `rowKey = orderNumber` in the `orders` table — a re-insert 409s and is ignored
- **Retry logic**: Transient failures leave the order unprocessed and are retried automatically on the next run
- **Monthly reporting**: `npm run report` shows current-month order and invoice status
- **HTTP API + dashboard**: `GET /api/orders`, `POST /api/process-month` on `my-afip-func`, with an Astro dashboard on Static Web Apps
- **CI/CD**: PRs trigger test suite on Node 22.x and 24.x with coverage enforcement, plus a privacy scan

## Known Limitations

- **Binance fetch is not automatable**: Binance P2P blocks cloud-provider IPs, so the fetch half must be run from a machine with an Argentine IP. Only the processing half is on a schedule.
- **Legacy layer coexists**: `src/services/` (AfipService, BinanceService) is still used by the gateways.
- **Test coverage at threshold**: Currently at 57% minimum. Increasing coverage is in the roadmap.
- **No integration tests**: `tests/integration/` no longer exists, so `npm run test:integration` matches nothing.

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js 18+ (CommonJS); CI on 22.x and 24.x |
| AFIP SDK | facturajs ^0.3.2 |
| Datastore | Azure Table Storage (`@azure/data-tables` ^13.3.2) |
| HTTP | Azure Functions v4 (`@azure/functions` ^4.5.0) |
| Dashboard | Astro 5 + Tailwind v4 + `@amajail/ui`, on Azure Static Web Apps |
| HTTP client | axios ^1.12.2 |
| Logging | winston ^3.18.3 |
| Testing | Jest ^30.1.3 |
| CI/CD | GitHub Actions |

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
