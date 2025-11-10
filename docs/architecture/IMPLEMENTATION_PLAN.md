# Layered Architecture Implementation Plan

> **Status**: 🚧 In Progress
> **Start Date**: 2025-11-10
> **Target Completion**: 2025-12-08 (4 weeks)

## Overview

This document tracks the implementation of the layered architecture for supporting both Azure Functions API and CLI with shared business logic.

## Progress Overview

- [ ] Phase 1: Foundation (Week 1)
- [ ] Phase 2: Domain Layer (Week 1-2)
- [ ] Phase 3: Infrastructure Layer (Week 2)
- [ ] Phase 4: Application Layer (Week 2-3)
- [ ] Phase 5: API Layer (Week 3)
- [ ] Phase 6: CLI Layer (Week 3-4)
- [ ] Phase 7: Integration & Deployment (Week 4)

---

## Phase 1: Foundation (Week 1)

### 1.1 Shared Layer - Configuration
- [x] Move existing config to `src/shared/config/index.js`
- [x] Create `src/shared/config/api.config.js` (Azure Functions settings)
- [x] Create `src/shared/config/cli.config.js` (CLI-specific settings)
- [x] Create `src/shared/config/environment.js` (environment detection)
- [x] Write tests for configuration

### 1.2 Shared Layer - Errors
- [x] Create `src/shared/errors/AppError.js` (base error class)
- [x] Create `src/shared/errors/DomainError.js` (business rule violations)
- [x] Create `src/shared/errors/ValidationError.js` (validation failures)
- [x] Create `src/shared/errors/InfrastructureError.js` (external system errors)
- [x] Create `src/shared/errors/NotFoundError.js` (resource not found)
- [x] Create `src/shared/errors/index.js` (exports all errors)
- [x] Write tests for error classes

### 1.3 Shared Layer - Logging
- [ ] Create `src/shared/logging/Logger.js` (abstract logger interface)
- [ ] Create `src/shared/logging/loggers/ConsoleLogger.js`
- [ ] Create `src/shared/logging/loggers/ApplicationInsightsLogger.js`
- [ ] Create `src/shared/logging/LoggerFactory.js` (logger creation)
- [ ] Move existing logger to shared layer
- [ ] Write tests for logging

### 1.4 Shared Layer - Validation & Utils
- [ ] Move validators to `src/shared/validation/validators.js`
- [ ] Create `src/shared/utils/date.utils.js`
- [ ] Create `src/shared/utils/format.utils.js`
- [ ] Create `src/shared/utils/currency.utils.js`
- [ ] Write tests for utilities

### 1.5 Domain Layer - Value Objects
- [ ] Create `src/domain/value-objects/Money.js`
  - [ ] Implement constructor with validation
  - [ ] Implement arithmetic operations (add, subtract)
  - [ ] Implement comparison methods
  - [ ] Implement currency conversion
  - [ ] Write comprehensive tests
- [ ] Create `src/domain/value-objects/CUIT.js`
  - [ ] Implement CUIT validation
  - [ ] Implement formatting methods
  - [ ] Write tests
- [ ] Create `src/domain/value-objects/CAE.js`
  - [ ] Implement CAE validation
  - [ ] Implement formatting methods
  - [ ] Write tests
- [ ] Create `src/domain/value-objects/OrderNumber.js`
- [ ] Create `src/domain/value-objects/index.js` (exports)

---

## Phase 2: Domain Layer (Week 1-2)

### 2.1 Domain Entities
- [ ] Create `src/domain/entities/Order.js`
  - [ ] Define Order properties
  - [ ] Implement business rules (isProcessable, canBeInvoiced)
  - [ ] Implement toInvoice() conversion
  - [ ] Implement validation
  - [ ] Write comprehensive tests
- [ ] Create `src/domain/entities/Invoice.js`
  - [ ] Move from models to domain
  - [ ] Refactor to use Money value object
  - [ ] Refactor to use CUIT value object
  - [ ] Remove infrastructure dependencies
  - [ ] Write comprehensive tests
- [ ] Create `src/domain/entities/InvoiceResult.js`
  - [ ] Define result properties (success, cae, voucherNumber, error)
  - [ ] Implement factory methods (success, failure)
  - [ ] Write tests

### 2.2 Domain Services
- [ ] Create `src/domain/services/InvoiceCalculator.js`
  - [ ] Extract VAT calculation logic
  - [ ] Extract total calculation logic
  - [ ] Extract exchange rate logic
  - [ ] Write tests
- [ ] Create `src/domain/services/InvoiceDateValidator.js`
  - [ ] Extract AFIP 10-day rule logic
  - [ ] Extract service date validation
  - [ ] Write tests
- [ ] Create `src/domain/services/OrderProcessor.js`
  - [ ] Extract order to invoice conversion logic
  - [ ] Implement batch processing rules
  - [ ] Write tests

### 2.3 Domain Events
- [ ] Create `src/domain/events/DomainEvent.js` (base class)
- [ ] Create `src/domain/events/InvoiceCreated.js`
- [ ] Create `src/domain/events/OrderProcessed.js`
- [ ] Create `src/domain/events/InvoiceFailed.js`
- [ ] Create event handler infrastructure

---

## Phase 3: Infrastructure Layer (Week 2)

### 3.1 Database - Repositories
- [ ] Create `src/application/interfaces/IOrderRepository.js` (interface)
- [ ] Create `src/infrastructure/database/repositories/OrderRepository.js`
  - [ ] Implement save(order)
  - [ ] Implement saveMany(orders)
  - [ ] Implement findByOrderNumber(orderNumber)
  - [ ] Implement findUnprocessed()
  - [ ] Implement findByDateRange(start, end)
  - [ ] Write tests
- [ ] Create `src/application/interfaces/IInvoiceRepository.js`
- [ ] Create `src/infrastructure/database/repositories/InvoiceRepository.js`
  - [ ] Implement save(invoice)
  - [ ] Implement findByCAE(cae)
  - [ ] Implement findByMonth(year, month)
  - [ ] Write tests
- [ ] Move `src/database/Database.js` to `src/infrastructure/database/Database.js`
- [ ] Update DatabaseOrderTracker to use repositories

### 3.2 External APIs - AFIP
- [ ] Create `src/application/interfaces/IAfipGateway.js`
- [ ] Create `src/infrastructure/external-apis/afip/AfipClient.js`
  - [ ] Move AfipService logic here
  - [ ] Clean up facturajs integration
- [ ] Create `src/infrastructure/external-apis/afip/AfipGateway.js`
  - [ ] Implement IAfipGateway interface
  - [ ] Implement createInvoice(invoice)
  - [ ] Implement queryInvoice(cae)
  - [ ] Implement testConnection()
  - [ ] Write tests with mocked AFIP responses

### 3.3 External APIs - Binance
- [ ] Create `src/application/interfaces/IBinanceGateway.js`
- [ ] Create `src/infrastructure/external-apis/binance/BinanceClient.js`
  - [ ] Move BinanceService logic here
- [ ] Create `src/infrastructure/external-apis/binance/BinanceGateway.js`
  - [ ] Implement IBinanceGateway interface
  - [ ] Implement getOrders(days, tradeType)
  - [ ] Implement getCurrentMonthOrders(tradeType)
  - [ ] Implement testConnection()
  - [ ] Write tests with mocked Binance responses

### 3.4 File System & Cache
- [ ] Create `src/infrastructure/file-system/FileStorage.js`
  - [ ] Implement saveInvoice(invoice, filepath)
  - [ ] Implement readInvoice(filepath)
- [ ] Create `src/infrastructure/cache/TokenCache.js`
  - [ ] Move AFIP token caching logic here
  - [ ] Implement get/set/clear methods

---

## Phase 4: Application Layer (Week 2-3)

### 4.1 Binance Use Cases
- [ ] Create `src/application/use-cases/binance/FetchBinanceOrders.js`
  - [ ] Implement execute({ days, tradeType })
  - [ ] Use IBinanceGateway and IOrderRepository
  - [ ] Return { ordersCount, newOrdersCount }
  - [ ] Write tests
- [ ] Create `src/application/use-cases/binance/SyncBinanceOrders.js`
  - [ ] Fetch + save + return stats
  - [ ] Write tests
- [ ] Create `src/application/use-cases/binance/ProcessBinanceOrders.js`
  - [ ] Fetch + process + create invoices
  - [ ] Write tests

### 4.2 Invoice Use Cases
- [ ] Create `src/application/use-cases/invoices/CreateInvoice.js`
  - [ ] Implement execute({ orderNumber })
  - [ ] Use IOrderRepository, IAfipGateway, IInvoiceRepository
  - [ ] Return InvoiceResult
  - [ ] Write tests
- [ ] Create `src/application/use-cases/invoices/ProcessUnprocessedOrders.js`
  - [ ] Get unprocessed orders
  - [ ] Convert to invoices
  - [ ] Submit to AFIP
  - [ ] Save results
  - [ ] Return stats
  - [ ] Write tests
- [ ] Create `src/application/use-cases/invoices/QueryInvoice.js`
  - [ ] Query by CAE
  - [ ] Return invoice data
  - [ ] Write tests

### 4.3 Report Use Cases
- [ ] Create `src/application/use-cases/reports/GenerateMonthlyReport.js`
  - [ ] Get orders for month
  - [ ] Calculate statistics
  - [ ] Return formatted report
  - [ ] Write tests
- [ ] Create `src/application/use-cases/reports/GetInvoiceStats.js`
  - [ ] Calculate overall stats
  - [ ] Write tests

### 4.4 Dependency Injection
- [ ] Create `src/application/di/container.js`
  - [ ] Register repositories
  - [ ] Register gateways
  - [ ] Register use cases
  - [ ] Create factory methods

---

## Phase 5: API Layer (Week 3)

### 5.1 Azure Functions Setup
- [ ] Create `src/api/host.json` (Azure Functions configuration)
- [ ] Create `src/api/local.settings.json.example`
- [ ] Add Azure Functions core tools to package.json
- [ ] Configure function runtime settings

### 5.2 API Middleware
- [ ] Create `src/api/middleware/auth.middleware.js`
  - [ ] API key authentication
  - [ ] JWT validation (optional)
- [ ] Create `src/api/middleware/validation.middleware.js`
  - [ ] Request body validation
- [ ] Create `src/api/middleware/error.middleware.js`
  - [ ] Error formatting for HTTP responses
  - [ ] Status code mapping

### 5.3 DTOs (Data Transfer Objects)
- [ ] Create `src/api/dto/binance.dto.js`
  - [ ] FetchOrdersRequest
  - [ ] SyncOrdersRequest
  - [ ] OrdersResponse
- [ ] Create `src/api/dto/invoice.dto.js`
  - [ ] CreateInvoiceRequest
  - [ ] InvoiceResponse
  - [ ] ProcessResultResponse

### 5.4 API Functions - Binance
- [ ] Create `src/api/functions/binance.function.js`
  - [ ] POST /api/binance/fetch - Fetch orders
  - [ ] POST /api/binance/sync - Sync and process
  - [ ] GET /api/binance/orders - List orders
  - [ ] Write integration tests

### 5.5 API Functions - Invoices
- [ ] Create `src/api/functions/invoices.function.js`
  - [ ] POST /api/invoices/create - Create single invoice
  - [ ] POST /api/invoices/process-all - Process all pending
  - [ ] GET /api/invoices/:cae - Query by CAE
  - [ ] GET /api/invoices - List invoices
  - [ ] Write integration tests

### 5.6 API Functions - Reports & Health
- [ ] Create `src/api/functions/reports.function.js`
  - [ ] GET /api/reports/month - Monthly report
  - [ ] GET /api/reports/stats - Statistics
  - [ ] Write tests
- [ ] Create `src/api/functions/health.function.js`
  - [ ] GET /api/health - Overall health
  - [ ] GET /api/health/afip - AFIP status
  - [ ] GET /api/health/binance - Binance status
  - [ ] Write tests

---

## Phase 6: CLI Layer (Week 3-4)

### 6.1 CLI Infrastructure
- [ ] Create `src/cli/index.js` (CLI entry point)
- [ ] Install commander.js for CLI parsing
- [ ] Install chalk for colored output
- [ ] Install ora for spinners
- [ ] Create CLI configuration

### 6.2 CLI Formatters
- [ ] Create `src/cli/formatters/table.formatter.js`
  - [ ] Format data as ASCII tables
- [ ] Create `src/cli/formatters/json.formatter.js`
  - [ ] Format as JSON output
- [ ] Create `src/cli/formatters/color.formatter.js`
  - [ ] Status colors (success, error, warning)

### 6.3 CLI Commands - Binance
- [ ] Create `src/cli/commands/binance.command.js`
  - [ ] `binance fetch --days <n> --type <SELL|BUY>`
  - [ ] `binance sync --days <n> --auto-process`
  - [ ] `binance test-connection`
  - [ ] Use FetchBinanceOrders use case
  - [ ] Format output with table formatter

### 6.4 CLI Commands - Invoices
- [ ] Create `src/cli/commands/invoices.command.js`
  - [ ] `invoice create --order <order-number>`
  - [ ] `invoice process-all`
  - [ ] `invoice query --cae <cae>`
  - [ ] `invoice list --month <YYYY-MM>`
  - [ ] Use invoice use cases
  - [ ] Format output

### 6.5 CLI Commands - Reports
- [ ] Create `src/cli/commands/reports.command.js`
  - [ ] `report month`
  - [ ] `report stats`
  - [ ] Use report use cases
  - [ ] Format output with tables

### 6.6 CLI Polish
- [ ] Add interactive prompts for missing parameters
- [ ] Add progress spinners for long operations
- [ ] Add colored output for status
- [ ] Add --help documentation
- [ ] Create CLI user guide

---

## Phase 7: Integration & Deployment (Week 4)

### 7.1 Testing
- [ ] Write end-to-end API tests
- [ ] Write end-to-end CLI tests
- [ ] Test API + CLI using same use cases
- [ ] Load testing for API endpoints
- [ ] Test error scenarios

### 7.2 Migration
- [ ] Create migration script for existing code
- [ ] Update all imports/references
- [ ] Deprecate old structure
- [ ] Run full test suite
- [ ] Fix any breaking changes

### 7.3 Azure Functions Deployment
- [ ] Create Azure Function App
- [ ] Configure Application Insights
- [ ] Set up environment variables
- [ ] Deploy API functions
- [ ] Test deployed endpoints
- [ ] Set up CI/CD pipeline

### 7.4 Documentation
- [ ] Update README with new architecture
- [ ] Create API documentation (OpenAPI/Swagger)
- [ ] Create CLI documentation
- [ ] Document deployment process
- [ ] Create architecture diagrams
- [ ] Update contributing guidelines

### 7.5 Performance & Monitoring
- [ ] Set up Application Insights dashboards
- [ ] Configure alerts for errors
- [ ] Monitor API response times
- [ ] Optimize slow endpoints
- [ ] Set up logging aggregation

---

## Rollback Plan

If issues arise during migration:

1. **Phase 1-2**: Keep existing code, new code is additive
2. **Phase 3-4**: Feature flag to switch between old/new implementations
3. **Phase 5-6**: Deploy API and CLI as separate apps initially
4. **Phase 7**: Blue-green deployment for Azure Functions

---

## Success Criteria

- [ ] All existing functionality works
- [ ] All tests pass (unit + integration + e2e)
- [ ] API endpoints functional and documented
- [ ] CLI commands work as before
- [ ] Azure Functions deployed successfully
- [ ] Performance is equal or better
- [ ] Code coverage maintained or improved
- [ ] Documentation complete

---

## Notes & Decisions

### 2025-11-10
- ✅ Created directory structure
- ✅ Documented architecture in ARCHITECTURE.md
- ✅ Created implementation plan with checklist
- 🚧 Starting Phase 1: Foundation

---

## Next Actions

1. Implement shared layer (config, errors, logging)
2. Create domain value objects
3. Begin domain entity refactoring
