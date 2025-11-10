# AFIP Invoice Application - Layered Architecture

## Overview

This document describes the layered architecture for the AFIP Invoice Application, designed to support both Azure Functions API and CLI usage with shared business logic.

## Architecture Principles

1. **Clean Architecture** - Dependencies point inward toward the domain
2. **Dependency Inversion** - High-level modules don't depend on low-level modules
3. **Single Responsibility** - Each layer has a specific purpose
4. **Testability** - Each layer can be tested independently
5. **Reusability** - Business logic is shared between API and CLI

## Layer Structure

```
┌─────────────────────────────────────────────────────────┐
│         Presentation Layer (API + CLI)                  │
│  ┌──────────────┐              ┌──────────────┐        │
│  │   Azure      │              │     CLI      │        │
│  │  Functions   │              │   Commands   │        │
│  └──────────────┘              └──────────────┘        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│           Application Layer (Use Cases)                  │
│  • FetchBinanceOrders    • CreateInvoice                │
│  • ProcessOrders         • GenerateReport               │
│  • SyncBinanceOrders     • QueryInvoice                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│             Domain Layer (Business Logic)                │
│  • Order Entity          • Invoice Entity               │
│  • Money Value Object    • CUIT Value Object            │
│  • InvoiceCalculator     • OrderProcessor               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│       Infrastructure Layer (External Systems)            │
│  • OrderRepository       • AfipGateway                  │
│  • InvoiceRepository     • BinanceGateway               │
│  • Database              • FileStorage                   │
└─────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── api/                          # Azure Functions API (Presentation)
│   ├── functions/
│   │   ├── binance.function.js   # POST/GET /api/binance/orders
│   │   ├── invoices.function.js  # POST/GET /api/invoices
│   │   ├── reports.function.js   # GET /api/reports/month
│   │   └── health.function.js    # GET /api/health
│   ├── middleware/
│   │   ├── auth.middleware.js    # Authentication
│   │   ├── validation.middleware.js
│   │   └── error.middleware.js
│   ├── dto/
│   │   ├── binance.dto.js
│   │   └── invoice.dto.js
│   └── host.json                 # Azure Functions config
│
├── cli/                          # CLI Interface (Presentation)
│   ├── commands/
│   │   ├── binance.command.js    # CLI: binance commands
│   │   ├── invoices.command.js   # CLI: invoice commands
│   │   ├── reports.command.js    # CLI: report commands
│   │   └── index.js
│   ├── formatters/
│   │   ├── table.formatter.js
│   │   └── json.formatter.js
│   └── index.js                  # CLI entry point
│
├── application/                  # Use Cases (Application Layer)
│   ├── use-cases/
│   │   ├── binance/
│   │   │   ├── FetchBinanceOrders.js
│   │   │   ├── SyncBinanceOrders.js
│   │   │   └── ProcessBinanceOrders.js
│   │   ├── invoices/
│   │   │   ├── CreateInvoice.js
│   │   │   ├── ProcessUnprocessedOrders.js
│   │   │   └── QueryInvoice.js
│   │   └── reports/
│   │       ├── GenerateMonthlyReport.js
│   │       └── GetInvoiceStats.js
│   └── interfaces/               # Ports (dependency inversion)
│       ├── IOrderRepository.js
│       ├── IAfipGateway.js
│       └── IBinanceGateway.js
│
├── domain/                       # Business Logic (Domain Layer)
│   ├── entities/
│   │   ├── Order.js              # Order aggregate root
│   │   ├── Invoice.js            # Invoice aggregate root
│   │   └── InvoiceResult.js      # Result of invoice creation
│   ├── value-objects/
│   │   ├── Money.js              # Money with currency
│   │   ├── CUIT.js               # Argentine tax ID
│   │   └── CAE.js                # AFIP authorization code
│   ├── services/                 # Domain services
│   │   ├── InvoiceCalculator.js  # Calculate invoice amounts
│   │   ├── InvoiceDateValidator.js # Validate invoice dates
│   │   └── OrderProcessor.js     # Process orders to invoices
│   └── events/
│       ├── InvoiceCreated.js
│       └── OrderProcessed.js
│
├── infrastructure/               # External Systems (Infrastructure)
│   ├── database/
│   │   ├── repositories/
│   │   │   ├── OrderRepository.js    # Implements IOrderRepository
│   │   │   └── InvoiceRepository.js
│   │   ├── Database.js
│   │   └── migrations/
│   ├── external-apis/
│   │   ├── afip/
│   │   │   ├── AfipClient.js
│   │   │   └── AfipGateway.js       # Implements IAfipGateway
│   │   └── binance/
│   │       ├── BinanceClient.js
│   │       └── BinanceGateway.js    # Implements IBinanceGateway
│   ├── file-system/
│   │   └── FileStorage.js
│   └── cache/
│       └── TokenCache.js
│
└── shared/                       # Cross-cutting Concerns
    ├── config/
    │   ├── index.js
    │   ├── api.config.js
    │   └── cli.config.js
    ├── errors/
    │   ├── AppError.js
    │   ├── DomainError.js
    │   └── InfrastructureError.js
    ├── logging/
    │   ├── Logger.js
    │   └── loggers/
    │       ├── ConsoleLogger.js
    │       └── ApplicationInsightsLogger.js
    ├── validation/
    │   └── validators.js
    └── utils/
        ├── date.utils.js
        └── format.utils.js
```

## Layer Responsibilities

### 1. Presentation Layer (API + CLI)

**Purpose**: Handle user input/output

**API (Azure Functions)**:
- HTTP request/response handling
- Request validation and DTO mapping
- Authentication and authorization
- Error formatting for HTTP responses

**CLI**:
- Command parsing
- User interaction
- Output formatting (tables, JSON)
- Error formatting for console

**Dependencies**: Application Layer (Use Cases)

### 2. Application Layer (Use Cases)

**Purpose**: Orchestrate business workflows

**Responsibilities**:
- Coordinate between domain and infrastructure
- Transaction management
- Use case implementation
- Application-level validation

**Example Use Cases**:
```javascript
// FetchBinanceOrders.js
class FetchBinanceOrders {
  constructor(binanceGateway, orderRepository) {
    this.binanceGateway = binanceGateway;
    this.orderRepository = orderRepository;
  }

  async execute({ days, tradeType }) {
    // 1. Fetch from Binance
    const orders = await this.binanceGateway.getOrders(days, tradeType);

    // 2. Save to database
    await this.orderRepository.saveMany(orders);

    // 3. Return result
    return { ordersCount: orders.length };
  }
}
```

**Dependencies**: Domain Layer, Infrastructure Interfaces

### 3. Domain Layer (Business Logic)

**Purpose**: Core business rules and entities

**Entities**: Encapsulate business data and behavior
```javascript
// Order.js
class Order {
  constructor(orderNumber, amount, price, tradeType, createTime) {
    this.orderNumber = orderNumber;
    this.amount = amount;
    this.price = price;
    this.tradeType = tradeType;
    this.createTime = createTime;
  }

  toInvoice() {
    // Business logic to convert order to invoice
  }

  isProcessable() {
    // Business rules for processing
  }
}
```

**Value Objects**: Immutable values with validation
```javascript
// Money.js
class Money {
  constructor(amount, currency) {
    if (amount < 0) throw new Error('Amount cannot be negative');
    this.amount = amount;
    this.currency = currency;
  }

  add(other) {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add money in different currencies');
    }
    return new Money(this.amount + other.amount, this.currency);
  }
}
```

**Domain Services**: Business logic that doesn't belong to an entity
```javascript
// InvoiceCalculator.js
class InvoiceCalculator {
  calculateVAT(netAmount, vatRate) {
    return netAmount * vatRate;
  }

  calculateTotal(netAmount, vatAmount) {
    return netAmount + vatAmount;
  }
}
```

**Dependencies**: None (pure business logic)

### 4. Infrastructure Layer (External Systems)

**Purpose**: Implement technical details

**Repositories**: Data persistence
```javascript
// OrderRepository.js
class OrderRepository {
  async save(order) {
    // SQLite implementation
  }

  async findByOrderNumber(orderNumber) {
    // Query database
  }
}
```

**Gateways**: External API communication
```javascript
// AfipGateway.js
class AfipGateway {
  async createInvoice(invoice) {
    // AFIP API call
  }

  async queryInvoice(cae) {
    // AFIP API call
  }
}
```

**Dependencies**: Domain Interfaces (implements them)

### 5. Shared Layer (Cross-cutting)

**Purpose**: Common utilities and configuration

**Config**: Centralized configuration
**Logging**: Logging abstraction
**Errors**: Custom error types
**Validation**: Common validators
**Utils**: Helper functions

## API Endpoints (Azure Functions)

### Binance Operations
```
POST   /api/binance/fetch          # Fetch orders from Binance
POST   /api/binance/sync           # Sync and process orders
GET    /api/binance/orders         # Get stored orders
```

### Invoice Operations
```
POST   /api/invoices/create        # Create single invoice
POST   /api/invoices/process-all   # Process unprocessed orders
GET    /api/invoices/:cae          # Query invoice by CAE
GET    /api/invoices               # List invoices
```

### Reports
```
GET    /api/reports/month          # Monthly report
GET    /api/reports/stats          # Statistics
```

### Health
```
GET    /api/health                 # Health check
GET    /api/health/afip            # AFIP connection status
GET    /api/health/binance         # Binance connection status
```

## CLI Commands

```bash
# Binance commands
afip-cli binance fetch --days 7 --type SELL
afip-cli binance sync --days 30 --auto-process
afip-cli binance test-connection

# Invoice commands
afip-cli invoice create --order ORDER_NUMBER
afip-cli invoice process-all
afip-cli invoice query --cae CAE_NUMBER
afip-cli invoice list --month 2025-01

# Report commands
afip-cli report month
afip-cli report stats
```

## Migration Plan

### Phase 1: Foundation (Week 1)
1. ✅ Create directory structure
2. Create shared layer (config, errors, logging)
3. Create domain value objects (Money, CUIT, CAE)
4. Create domain entities (Order, Invoice)

### Phase 2: Domain Layer (Week 1-2)
1. Extract business logic from services to domain services
2. Create domain events
3. Write domain layer tests

### Phase 3: Infrastructure Layer (Week 2)
1. Create repository interfaces
2. Move database code to repositories
3. Create gateway interfaces
4. Move AFIP/Binance code to gateways
5. Write infrastructure tests

### Phase 4: Application Layer (Week 2-3)
1. Create use cases from existing services
2. Implement dependency injection
3. Write use case tests

### Phase 5: API Layer (Week 3)
1. Create Azure Functions handlers
2. Create DTOs and validation
3. Add authentication middleware
4. Write API tests

### Phase 6: CLI Layer (Week 3-4)
1. Refactor existing CLI to use use cases
2. Improve output formatting
3. Add interactive prompts
4. Write CLI tests

### Phase 7: Integration & Deployment (Week 4)
1. End-to-end testing
2. Performance testing
3. Azure Functions deployment
4. Documentation updates

## Benefits

1. **Testability**: Each layer can be unit tested independently
2. **Maintainability**: Clear separation of concerns
3. **Flexibility**: Easy to add new presentation layers (web UI, mobile app)
4. **Reusability**: Business logic shared between API and CLI
5. **Scalability**: Azure Functions scales automatically
6. **Type Safety**: Clear interfaces and contracts
7. **Domain Focus**: Business logic is isolated and protected

## Technology Stack

- **Runtime**: Node.js
- **API**: Azure Functions (HTTP triggers)
- **Database**: SQLite
- **External APIs**: AFIP (facturajs), Binance
- **Testing**: Jest
- **Logging**: Custom logger + Application Insights (Azure)
- **CLI**: Commander.js
- **Validation**: Custom validators

## Next Steps

1. Review and approve architecture
2. Begin Phase 1 implementation
3. Set up CI/CD for Azure Functions
4. Create API documentation (OpenAPI/Swagger)
5. Create CLI documentation
