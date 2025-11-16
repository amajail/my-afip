# CLAUDE.md - AI Assistant Development Guide

This document provides comprehensive guidance for AI assistants working with the **my-afip** codebase. It covers architecture, conventions, workflows, and best practices to ensure effective collaboration.

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Directory Structure](#directory-structure)
- [Development Workflows](#development-workflows)
- [Code Conventions](#code-conventions)
- [Testing Guidelines](#testing-guidelines)
- [Git Workflow](#git-workflow)
- [Common Tasks](#common-tasks)
- [Important Constraints](#important-constraints)

---

## Project Overview

### What is my-afip?

A production-ready Node.js application for processing cryptocurrency P2P trading orders into AFIP-compliant electronic invoices for Argentine monotributistas.

**Key Technologies:**
- **Runtime:** Node.js 18+ (CommonJS modules)
- **Database:** SQLite (file-based, ACID-compliant)
- **External APIs:** AFIP WSFEv1 (facturajs SDK), Binance P2P API
- **Testing:** Jest with 57% coverage threshold
- **CI/CD:** GitHub Actions (Node 18.x, 20.x)

### Business Domain

- **AFIP:** Argentina's Federal Tax Authority electronic invoicing system
- **Binance P2P:** Peer-to-peer cryptocurrency trading platform
- **Monotributistas:** Argentine simplified tax regime (no VAT)
- **Type C Invoices:** Consumer invoices without VAT breakdown
- **CAE:** Electronic Authorization Code from AFIP
- **WSFEv1:** AFIP's Web Services for Electronic Invoicing

---

## Architecture

### Clean Architecture Principles

The codebase follows **Clean Architecture** with strict layered dependencies:

```
┌─────────────────────────────────────┐
│    Presentation (CLI + API)         │  ← User Interface
├─────────────────────────────────────┤
│    Application (Use Cases)          │  ← Orchestration
├─────────────────────────────────────┤
│    Domain (Business Logic)          │  ← Core (Framework-independent)
├─────────────────────────────────────┤
│    Infrastructure (External)        │  ← Technical Details
└─────────────────────────────────────┘
```

**Dependency Rule:** Dependencies point INWARD only. Domain layer has ZERO external dependencies.

### Layer Responsibilities

#### 1. Domain Layer (`src/domain/`)
**Purpose:** Pure business logic, framework-independent

- **Entities:** Aggregate roots with identity and lifecycle
  - `Order.js` - Binance P2P order (308 LOC)
  - `Invoice.js` - AFIP electronic invoice (366 LOC)
  - `InvoiceResult.js` - AFIP response encapsulation (239 LOC)

- **Value Objects:** Immutable domain concepts (use `Object.freeze()`)
  - `Money.js` - Monetary amounts with currency
  - `CUIT.js` - Argentine tax ID with checksum validation
  - `CAE.js` - AFIP authorization code
  - `OrderNumber.js` - Order identifier

- **Domain Services:** Stateless business logic
  - `OrderProcessor.js` - Order eligibility and processing
  - `InvoiceCalculator.js` - VAT and amount calculations
  - `InvoiceDateValidator.js` - AFIP 10-day rule enforcement

- **Domain Events:** Immutable event records
  - `InvoiceCreated.js`, `OrderProcessed.js`

**Key Patterns:**
- Factory methods: `Money.of(100, 'ARS')`, `CUIT.of('20123456789')`
- Immutability: All domain objects use `Object.freeze()`
- Rich behavior: Business logic in entities, not anemic data models
- Validation: Constructor-level validation with custom errors

#### 2. Application Layer (`src/application/`)
**Purpose:** Use cases and interface definitions (Ports)

- **Interfaces:** Dependency inversion contracts
  - `IOrderRepository.js` - Order persistence port
  - `IInvoiceRepository.js` - Invoice persistence port
  - `IAfipGateway.js` - AFIP service port
  - `IBinanceGateway.js` - Binance service port

**Pattern:** Use cases orchestrate domain and infrastructure layers

#### 3. Infrastructure Layer (`src/infrastructure/`)
**Purpose:** External system integration

- **Repositories:** Data persistence implementations
  - `SQLiteOrderRepository.js` - Implements `IOrderRepository`
  - `SQLiteInvoiceRepository.js` - Implements `IInvoiceRepository`

- **Gateways:** External API adapters
  - `AfipGatewayAdapter.js` - Implements `IAfipGateway`
  - `BinanceGatewayAdapter.js` - Implements `IBinanceGateway`

#### 4. Presentation Layer (CLI + API)
**CLI (`src/cli/`):**
- Command handlers: `BinanceCommand.js`, `ReportCommand.js`, `ProcessCommand.js`
- Formatters: `ConsoleFormatter.js`, `TableFormatter.js`, `ReportFormatter.js`
- Router: `src/cli/index.js`

**API (Future):** Azure Functions HTTP triggers

#### 5. Shared Layer (`src/shared/`)
**Purpose:** Cross-cutting concerns used by all layers

- **Config:** Environment-aware configuration management
- **Errors:** Custom error hierarchy (`AppError` → `DomainError`, `ValidationError`, `InfrastructureError`)
- **Logging:** Abstract logger with Console and Application Insights implementations
- **Validation:** Common validators (CUIT, amount, date)
- **Utils:** Date, currency, format helpers

---

## Directory Structure

```
my-afip/
├── src/                              # Source code (2,671 LOC)
│   ├── domain/                       # Business logic (DDD)
│   │   ├── entities/                 # Aggregate roots
│   │   ├── value-objects/            # Immutable values
│   │   ├── services/                 # Domain services
│   │   └── events/                   # Domain events
│   ├── infrastructure/               # External systems
│   │   ├── repositories/             # Data persistence
│   │   └── gateways/                 # API adapters
│   ├── application/                  # Use cases & ports
│   │   └── interfaces/               # Dependency inversion
│   ├── cli/                          # CLI presentation
│   │   ├── commands/                 # Command handlers
│   │   └── formatters/               # Output formatting
│   ├── shared/                       # Cross-cutting concerns
│   │   ├── config/                   # Configuration
│   │   ├── errors/                   # Error hierarchy
│   │   ├── logging/                  # Logging abstraction
│   │   ├── validation/               # Validators
│   │   └── utils/                    # Utilities
│   ├── database/                     # Database abstraction
│   ├── services/                     # Legacy services
│   ├── models/                       # Legacy models
│   ├── commands/                     # Legacy commands
│   ├── config/                       # Config entry point
│   ├── AfipInvoiceApp.js            # Main application class
│   ├── cli.js                        # CLI router
│   └── index.js                      # Entry point
├── tests/                            # Test suite (Jest)
│   ├── unit/                         # Unit tests
│   │   ├── domain/                   # Domain layer tests
│   │   ├── shared/                   # Shared layer tests
│   │   ├── services/                 # Service tests
│   │   └── commands/                 # Command tests
│   ├── integration/                  # Integration tests
│   └── helpers/                      # Test utilities
├── docs/                             # Documentation
│   ├── architecture/                 # Architecture docs
│   ├── development/                  # Development guides
│   └── migrations/                   # Migration guides
├── .github/workflows/                # CI/CD
│   └── pr-checks.yml                # Automated checks
├── data/                             # SQLite database
├── certificates/                     # AFIP certificates (gitignored)
├── package.json                      # Dependencies
├── jest.config.js                    # Test configuration
└── .env                              # Environment (gitignored)
```

---

## Development Workflows

### Adding a New Feature

1. **Identify the Layer:**
   - Business logic? → Domain layer
   - Use case orchestration? → Application layer
   - External integration? → Infrastructure layer
   - User interface? → Presentation layer

2. **Follow Dependency Rules:**
   - Domain depends on NOTHING
   - Application depends on Domain interfaces only
   - Infrastructure implements Application interfaces
   - Presentation depends on Application layer

3. **Write Tests First (TDD Recommended):**
   - Unit tests for domain objects
   - Integration tests for infrastructure
   - Use mocks for external dependencies

4. **Update Documentation:**
   - JSDoc comments for public APIs
   - Update ARCHITECTURE.md if changing structure
   - Update README.md if adding user-facing features

### Modifying Existing Code

1. **Understand the Context:**
   - Read existing tests to understand behavior
   - Check domain events to understand side effects
   - Review error handling patterns

2. **Maintain Immutability:**
   - Domain objects are immutable (`Object.freeze()`)
   - Return new instances instead of mutating

3. **Preserve Business Rules:**
   - AFIP 10-day rule for invoicing
   - Type C invoice format for monotributistas
   - Duplicate prevention using order numbers

---

## Code Conventions

### Naming Conventions

- **Classes:** PascalCase (e.g., `OrderProcessor`, `Money`)
- **Methods/Functions:** camelCase (e.g., `calculateVAT`, `isValid`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `MAX_RETRY_ATTEMPTS`)
- **Private properties:** Prefix with `_` (e.g., `this._amount`)
- **Interfaces:** Prefix with `I` (e.g., `IOrderRepository`)

### File Organization

- **One class per file:** Each file exports one main class/function
- **File naming:** Match the class name (e.g., `Order.js` exports `Order`)
- **Index files:** Re-export modules for cleaner imports

### JSDoc Documentation

All public APIs must have JSDoc comments:

```javascript
/**
 * Calculates VAT for a given amount
 * @param {Money} netAmount - Net amount before VAT
 * @param {number} vatRate - VAT rate (e.g., 0.21 for 21%)
 * @returns {Money} VAT amount
 * @throws {ValidationError} If netAmount is negative
 */
calculateVAT(netAmount, vatRate) {
  // Implementation
}
```

### Error Handling

Use the custom error hierarchy:

```javascript
// Domain errors
throw new DomainError('Order cannot be processed: exceeds 10-day limit');

// Validation errors
throw new ValidationError('CUIT must be 11 digits');

// Infrastructure errors
throw new InfrastructureError('AFIP API connection failed', { originalError });

// Not found errors
throw new NotFoundError('Order', orderNumber);
```

### Immutability Pattern

Domain objects MUST be immutable:

```javascript
class Order {
  constructor(data) {
    this._orderNumber = OrderNumber.of(data.orderNumber);
    this._amount = Money.of(data.amount, data.currency);
    Object.freeze(this); // Enforce immutability
  }

  // Changes return new instance
  markAsProcessed(invoiceResult) {
    return new Order({
      ...this.toJSON(),
      processedAt: new Date(),
      invoiceResult
    });
  }
}
```

### Data Mapper Pattern

Repositories convert between domain and database representations:

```javascript
class SQLiteOrderRepository {
  async save(order) {
    const dbData = this._toDatabase(order);
    await this.db.insertOrder(dbData);
    return order;
  }

  async findByOrderNumber(orderNumber) {
    const dbData = await this.db.getOrder(orderNumber.value);
    return this._toDomain(dbData);
  }

  _toDomain(dbData) {
    return Order.fromJSON({
      orderNumber: dbData.order_number,
      amount: parseFloat(dbData.amount),
      // ... other fields
    });
  }

  _toDatabase(order) {
    return {
      order_number: order.orderNumber.value,
      amount: order.amount.amount,
      // ... other fields
    };
  }
}
```

---

## Testing Guidelines

### Test Structure

```
tests/
├── unit/                    # Isolated tests (no external dependencies)
│   ├── domain/              # 241+ tests for domain layer
│   ├── shared/              # Utilities, config, errors
│   └── services/            # Service logic
└── integration/             # Tests with external systems
    └── database/            # Database integration tests
```

### Test Configuration

- **Framework:** Jest
- **Coverage Threshold:** 57% (branches, functions, lines, statements)
- **Test Environment:** Node.js
- **Mocking:** `jest.mock()` for external dependencies
- **HTTP Mocking:** `nock` for API calls

### Writing Tests

**Unit Test Example:**

```javascript
describe('Money', () => {
  describe('of()', () => {
    it('should create money with valid amount and currency', () => {
      const money = Money.of(100, 'ARS');
      expect(money.amount).toBe(100);
      expect(money.currency).toBe('ARS');
    });

    it('should throw ValidationError for negative amounts', () => {
      expect(() => Money.of(-100, 'ARS'))
        .toThrow(ValidationError);
    });

    it('should be immutable', () => {
      const money = Money.of(100, 'ARS');
      expect(() => { money.amount = 200; }).toThrow();
    });
  });
});
```

**Integration Test Example:**

```javascript
describe('SQLiteOrderRepository', () => {
  let db;
  let repository;

  beforeEach(async () => {
    db = new Database(':memory:');
    await db.initialize();
    repository = new SQLiteOrderRepository(db);
  });

  it('should persist and retrieve order correctly', async () => {
    const order = Order.fromJSON({
      orderNumber: '123456789',
      amount: 100,
      currency: 'USDT'
    });

    await repository.save(order);
    const retrieved = await repository.findByOrderNumber('123456789');

    expect(retrieved.orderNumber.value).toBe('123456789');
    expect(retrieved.amount.amount).toBe(100);
  });
});
```

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Best Practices

1. **Arrange-Act-Assert Pattern:**
   ```javascript
   it('should mark order as processed', () => {
     // Arrange
     const order = Order.fromJSON({ orderNumber: '123' });
     const result = InvoiceResult.success('CAE123', 100);

     // Act
     const processed = order.markAsProcessed(result);

     // Assert
     expect(processed.isProcessed()).toBe(true);
     expect(processed.cae).toBe('CAE123');
   });
   ```

2. **Test One Thing:** Each test should verify a single behavior
3. **Clear Test Names:** Use descriptive names that explain the scenario
4. **Avoid Test Interdependence:** Tests should run independently
5. **Mock External Dependencies:** Use mocks for APIs, databases in unit tests

---

## Git Workflow

### Branch Naming

Follow the convention:
- `feature/add-invoice-validation`
- `fix/correct-tax-calculation`
- `docs/update-readme`
- `refactor/extract-domain-service`

### Commit Messages

Use conventional commits:
```
feat: add invoice date validation
fix: correct AFIP tax code calculation
docs: update architecture documentation
test: add unit tests for Money value object
refactor: extract OrderProcessor domain service
```

### Pull Request Process

1. **Before Creating PR:**
   ```bash
   # Run all tests
   npm test

   # Check coverage
   npm run test:coverage

   # Ensure no linting errors
   npm run lint --if-present
   ```

2. **PR Requirements:**
   - All CI checks must pass (Node 18.x, 20.x)
   - Coverage threshold met (57%)
   - No security vulnerabilities (moderate or higher)
   - Clear description of changes
   - Tests for new features

3. **Automated Checks (GitHub Actions):**
   - ✅ Build check
   - ✅ Unit tests
   - ✅ Coverage report (uploaded to Codecov)
   - ✅ Security audit (`npm audit`)
   - ✅ Matrix testing (Node 18.x, 20.x)

### CI/CD Pipeline

**Triggers:** PR to `main` or `develop`, push to `main` or `develop`

**Jobs:**
1. **build-and-test:**
   - Checkout code
   - Setup Node.js (18.x, 20.x)
   - Install dependencies (`npm ci`)
   - Run linting (optional)
   - Run unit tests
   - Generate coverage
   - Upload to Codecov

2. **code-quality:**
   - Security audit (`npm audit --audit-level=moderate`)

---

## Common Tasks

### 1. Add a New Value Object

```javascript
// src/domain/value-objects/Email.js
const { ValidationError } = require('../../shared/errors');

class Email {
  constructor(value) {
    if (!this._isValid(value)) {
      throw new ValidationError('Invalid email format');
    }
    this._value = value;
    Object.freeze(this);
  }

  static of(value) {
    return new Email(value);
  }

  get value() {
    return this._value;
  }

  _isValid(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  equals(other) {
    return other instanceof Email && this._value === other._value;
  }
}

module.exports = Email;
```

### 2. Add a New Domain Service

```javascript
// src/domain/services/InvoiceNumberGenerator.js
class InvoiceNumberGenerator {
  /**
   * Generates next invoice number for point of sale
   * @param {number} pointOfSale - Point of sale number
   * @param {number} lastVoucherNumber - Last used voucher number
   * @returns {number} Next voucher number
   */
  generateNext(pointOfSale, lastVoucherNumber) {
    return lastVoucherNumber + 1;
  }
}

module.exports = InvoiceNumberGenerator;
```

### 3. Add a New Repository Method

```javascript
// src/infrastructure/repositories/SQLiteOrderRepository.js
async findByDateRange(startDate, endDate) {
  const rows = await this.db.query(
    'SELECT * FROM orders WHERE create_time >= ? AND create_time <= ?',
    [startDate.toISOString(), endDate.toISOString()]
  );
  return rows.map(row => this._toDomain(row));
}
```

### 4. Add a New CLI Command

```javascript
// src/cli/commands/StatisticsCommand.js
class StatisticsCommand {
  constructor(orderRepository) {
    this.orderRepository = orderRepository;
  }

  async execute() {
    const stats = await this.orderRepository.getStatistics();

    console.log('Order Statistics:');
    console.log(`Total Orders: ${stats.total}`);
    console.log(`Processed: ${stats.processed}`);
    console.log(`Pending: ${stats.pending}`);

    return { success: true, stats };
  }
}

module.exports = StatisticsCommand;
```

### 5. Add a New Test

```javascript
// tests/unit/domain/value-objects/Email.test.js
const Email = require('../../../../src/domain/value-objects/Email');
const { ValidationError } = require('../../../../src/shared/errors');

describe('Email', () => {
  describe('of()', () => {
    it('should create email with valid format', () => {
      const email = Email.of('user@example.com');
      expect(email.value).toBe('user@example.com');
    });

    it('should throw ValidationError for invalid format', () => {
      expect(() => Email.of('invalid-email'))
        .toThrow(ValidationError);
    });

    it('should be immutable', () => {
      const email = Email.of('user@example.com');
      expect(() => { email._value = 'other@example.com'; }).toThrow();
    });
  });

  describe('equals()', () => {
    it('should return true for same email', () => {
      const email1 = Email.of('user@example.com');
      const email2 = Email.of('user@example.com');
      expect(email1.equals(email2)).toBe(true);
    });

    it('should return false for different emails', () => {
      const email1 = Email.of('user1@example.com');
      const email2 = Email.of('user2@example.com');
      expect(email1.equals(email2)).toBe(false);
    });
  });
});
```

---

## Important Constraints

### Business Rules

1. **AFIP 10-Day Rule:**
   - Invoices MUST be created within 10 days of the order date
   - Enforced by `InvoiceDateValidator.js`
   - Violations throw `DomainError`

2. **Type C Invoices:**
   - For monotributistas (simplified tax regime)
   - No VAT breakdown required
   - `CbteTipo: 11` in AFIP system

3. **Service Invoicing:**
   - `Concepto: 2` (services, not goods)
   - Service dates (from/to) required
   - Service period typically matches order date

4. **Duplicate Prevention:**
   - Orders tracked by unique `orderNumber`
   - Enforced at database level with UNIQUE constraint
   - Repository checks before saving

### Technical Constraints

1. **Node.js Version:**
   - Minimum: 18.0.0 (specified in package.json)
   - Tested on: 18.x, 20.x (CI matrix)

2. **Database:**
   - SQLite file-based (no external server)
   - ACID transaction compliance
   - Path: `./data/afip-orders.db`

3. **Environment Variables:**
   - Required: `AFIP_CUIT`, `AFIP_CERT_PATH`, `AFIP_KEY_PATH`, `AFIP_ENVIRONMENT`, `AFIP_PTOVTA`
   - Optional: `BINANCE_API_KEY`, `BINANCE_SECRET_KEY` (for automation)
   - Never commit `.env` file (gitignored)

4. **External API Limits:**
   - **AFIP:** Certificate-based authentication, rate limits apply
   - **Binance:** 30-day max per request, 6-month historical limit

5. **Test Coverage:**
   - Minimum: 57% (branches, functions, lines, statements)
   - Enforced by Jest configuration
   - CI fails if threshold not met

### Security Constraints

1. **Certificates:**
   - Never commit to version control
   - Store in `./certificates/` (gitignored)
   - Production requires valid AFIP certificate

2. **API Keys:**
   - Environment variables only
   - No hardcoded credentials
   - Use `.env.example` for template

3. **Sensitive Data:**
   - Personal trading data not committed
   - Database files gitignored
   - Processing results gitignored

---

## Key Documentation Files

- **README.md** - User documentation, quick start, command reference
- **ARCHITECTURE.md** - Detailed architecture, layered design, migration plan
- **PROJECT_STATUS.md** - Current status, completed features, known issues
- **CONTRIBUTING.md** - Contribution guidelines, PR process
- **docs/development/** - Development guides (code quality, logging, error handling, JSDoc)
- **docs/architecture/** - Architecture diagrams and design decisions
- **docs/migrations/** - Migration guides (TypeScript, Azure)

---

## Development Principles

1. **Clean Architecture:** Dependencies point inward
2. **Domain-Driven Design:** Rich domain models, ubiquitous language
3. **SOLID Principles:** Single responsibility, dependency inversion
4. **Test-Driven Development:** Write tests first
5. **Immutability:** Domain objects are immutable
6. **Explicit is Better:** Clear naming, no magic
7. **Fail Fast:** Validate at boundaries
8. **Documentation:** JSDoc for all public APIs

---

## Quick Reference

### Run Commands
```bash
# Fetch and process orders
npm run binance:auto

# Process pending orders
npm run orders

# Generate monthly report
npm run report

# Check system status
npm run status

# Query invoice
npm run query-full <voucher_number>

# Run tests
npm test
npm run test:coverage
```

### Key Files to Review Before Changes
- `src/domain/` - Business logic (understand first)
- `tests/` - Test suite (understand expected behavior)
- `ARCHITECTURE.md` - Architecture decisions
- `package.json` - Dependencies and scripts

### When You're Stuck
1. Read the tests for the module you're modifying
2. Check `docs/development/` for relevant guides
3. Review `ARCHITECTURE.md` for layer responsibilities
4. Look for similar patterns in existing code

---

## Conclusion

This codebase follows enterprise-grade architectural patterns with clear separation of concerns. When making changes:

1. **Understand the layer** you're working in
2. **Follow dependency rules** (dependencies point inward)
3. **Maintain immutability** in domain objects
4. **Write tests** for all changes
5. **Document** with JSDoc comments
6. **Respect business rules** (AFIP regulations, tax compliance)

For questions or clarifications, refer to the documentation in `docs/` or review existing code patterns.

**Last Updated:** November 16, 2025
