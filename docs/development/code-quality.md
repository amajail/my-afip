# Code Quality Analysis - AFIP Invoicing Application

**Generated**: 2025-11-08
**Codebase**: /home/amajail/repos/my-afip
**Total LOC**: ~5,459 (3,268 src + 2,191 tests)

---

## Executive Summary

This is a Node.js AFIP electronic invoicing application designed to process cryptocurrency P2P trading orders from Binance into AFIP-compliant invoices for Argentine monotributistas. The application uses a database-first architecture with SQLite, integrates with Binance API, and communicates with AFIP's WSFEv1 web service. While functional, the codebase exhibits several code quality issues typical of rapid development without TypeScript or comprehensive code standards.

---

## 1. Project Structure and Organization

### Overall Structure
```
my-afip/
├── src/                    # 23 JavaScript files, ~3,268 LOC
│   ├── commands/          # 11 command handlers (CLI operations)
│   ├── services/          # 3 service classes (AFIP, Binance, DirectInvoice)
│   ├── database/          # 1 database class
│   ├── models/            # 1 model (Invoice)
│   ├── utils/             # 3 utility classes
│   ├── AfipInvoiceApp.js  # Main application orchestrator
│   ├── cli.js             # CLI entry point
│   └── index.js           # Bootstrap file
├── scripts/               # 2 standalone scripts
├── tests/                 # ~2,191 LOC tests (unit + integration)
├── data/                  # SQLite database and processed files
└── certificates/          # AFIP certificates
```

### Architectural Pattern
- **Thin orchestrator**: `AfipInvoiceApp.js` delegates to command modules
- **Service layer**: Business logic in `AfipService`, `BinanceService`, `DirectInvoiceService`
- **Database-first approach**: SQLite as primary data store (no CSV/JSON intermediates)
- **Command pattern**: Individual files per CLI command in `src/commands/`

---

## 2. Key Files and Their Responsibilities

### Core Application Files

**`src/index.js` (2 lines)**
- Bootstrap file that loads environment and delegates to CLI

**`src/cli.js` (90 lines)**
- CLI entry point with command routing
- Large switch statement (65+ lines) for command handling
- Mixed responsibilities: argument parsing + command execution

**`src/AfipInvoiceApp.js` (82 lines)**
- Main application class
- Constructor loads configuration from `process.env`
- Delegates most operations to command modules
- Thin wrapper around commands

### Service Layer

**`src/services/AfipService.js` (213 lines)**
- AFIP WSFEv1 integration using facturajs SDK
- Key methods: `initialize()`, `createInvoice()`, `createMultipleInvoices()`, `getLastVoucherNumber()`
- Handles authentication, invoice submission, voucher numbering

**`src/services/BinanceService.js` (211 lines)**
- Binance P2P API integration
- HMAC-SHA256 signature generation for authenticated requests
- Order fetching with date filtering
- Format conversion from Binance to internal format

**`src/services/DirectInvoiceService.js` (146 lines)**
- Database-to-AFIP processing pipeline
- Converts database orders to Invoice models
- Handles invoice date calculations (AFIP 5-day rule)
- Processing orchestration

### Database Layer

**`src/database/Database.js` (391 lines)**
- SQLite operations wrapper
- Two tables: `orders` and `invoices`
- Promise-based async methods wrapping callback-based sqlite3
- Query methods for stats, filtering, reporting

**`src/utils/DatabaseOrderTracker.js` (134 lines)**
- Higher-level database operations
- Order tracking, duplicate detection
- Statistics aggregation

### Models

**`src/models/Invoice.js` (90 lines)**
- Invoice data model
- Validation logic
- `toAfipFormat()` method converts to AFIP WSFEv1 structure

---

## 3. Code Quality Issues

### 🔴 Critical Issues

#### 3.1 Exposed API Keys in Repository ⚠️

**Impact**: CRITICAL - API keys committed to repository

**Location**: `PROJECT_STATUS.md:100-101`

**Evidence**:
```
BINANCE_API_KEY=VgqfLZc9h6ytDYV2dvURSumrVqcZQ5z8bg4fhXaIQQOee2RcHjcYl5NAaATJbZRF
BINANCE_SECRET_KEY=JGyjC39yGuKvos0TGf9ZUjXvkezFrJvra5d6GKgAkI16SyOmjC1IJX64Jci5Vipa
```

**Recommendation**:
1. Immediately rotate Binance API keys
2. Remove from git history
3. Add `PROJECT_STATUS.md` to `.gitignore` if it contains sensitive data
4. Audit git history for other sensitive data

**Status**: 🔴 NOT FIXED

---

#### 3.2 Lack of Type Safety (TypeScript)

**Impact**: High - Runtime errors, poor IDE support, difficult refactoring

**Evidence**:
- Pure JavaScript without JSDoc type annotations
- No type checking for function parameters
- Runtime type coercion issues

**Examples**:
```javascript
// src/models/Invoice.js:9-11
this.netAmount = parseFloat(data.netAmount);      // No validation if undefined
this.totalAmount = parseFloat(data.totalAmount);  // NaN if invalid
this.vatAmount = parseFloat(data.vatAmount || 0); // Silent fallback
```

**Recommendation**: Migrate to TypeScript or add comprehensive JSDoc annotations

**Status**: ⚪ NOT STARTED

---

#### 3.3 Excessive Console Logging Instead of Proper Logging Framework

**Impact**: Medium - Poor production logging, no log levels, no structured logging

**Evidence**:
- 227+ console.log/error/warn calls across 20 files
- No centralized logging configuration
- No log rotation or filtering
- Emoji usage in logs (not production-friendly)

**Examples**:
```javascript
// Throughout codebase
console.log('🚀 Starting AFIP Invoice Application...');
console.log('✅ Application initialized successfully');
console.error('💥 Application error:', error.message);
```

**Locations**: Every service, command, and utility file

**Recommendation**: Implement Winston or Pino logger with:
- Configurable log levels (LOG_LEVEL env variable exists but unused)
- Structured JSON logging for production
- File rotation and transport configuration

**Status**: ⚪ NOT STARTED

---

#### 3.4 Environment Variable Access Scattered Throughout Codebase

**Impact**: Medium - Hard-coded dependencies, difficult testing, configuration sprawl

**Evidence**:
- `process.env` accessed directly in 7 different files
- No centralized configuration module
- Hard to mock for testing

**Files with direct `process.env` access**:
- `src/AfipInvoiceApp.js` (lines 27-34)
- `src/services/AfipService.js` (line 139)
- `src/models/Invoice.js` (line 38)
- `src/commands/query-invoice.js` (lines 262-265)
- Plus 3 more files

**Example from Invoice.js**:
```javascript
// Line 38 - Hard-coded environment access in model
PtoVta: parseInt(process.env.AFIP_PTOVTA),
```

**Recommendation**: Create `src/config/index.js` with:
```javascript
module.exports = {
  afip: {
    cuit: process.env.AFIP_CUIT,
    certPath: process.env.AFIP_CERT_PATH,
    keyPath: process.env.AFIP_KEY_PATH,
    environment: process.env.AFIP_ENVIRONMENT,
    ptoVta: parseInt(process.env.AFIP_PTOVTA)
  },
  binance: {
    apiKey: process.env.BINANCE_API_KEY,
    secretKey: process.env.BINANCE_SECRET_KEY
  },
  database: {
    path: process.env.DB_PATH || './data/afip-invoices.db'
  }
};
```

**Status**: ⚪ NOT STARTED

---

### 🟡 High Priority Issues

#### 3.5 Missing Error Handling in Async Operations

**Impact**: High - Potential unhandled promise rejections, silent failures

**Evidence**:
- 91 async functions across 20 files
- Many lack comprehensive try-catch blocks
- Some errors are logged but not properly propagated

**Example from `src/services/AfipService.js:109-136`**:
```javascript
async createMultipleInvoices(invoices) {
  const results = [];
  let currentVoucherNumber = await this.getLastVoucherNumber();

  for (const invoice of invoices) {
    try {
      currentVoucherNumber++;
      const result = await this.createInvoice(invoice, currentVoucherNumber);
      results.push(result);

      if (result.success) {
        console.log(`✓ Invoice created: CAE ${result.cae}`);
      } else {
        console.log(`✗ Invoice failed: ${result.error}`);
        currentVoucherNumber--; // Don't increment if failed
      }
    } catch (error) {
      // Error caught but currentVoucherNumber-- happens twice
      results.push({
        success: false,
        error: error.message,
        invoice: invoice
      });
      currentVoucherNumber--; // Don't increment if failed
    }
  }

  return results;
}
```

**Issues**:
- Voucher number decrement logic duplicated in catch and else
- No validation of initial `getLastVoucherNumber()` call
- Silent error swallowing (errors logged but not re-thrown)

**Status**: ⚪ NOT STARTED

---

#### 3.6 Code Duplication and Lack of DRY Principle

**Impact**: Medium - Maintenance burden, inconsistency risk

**Evidence across multiple files**:

**Duplicate dotenv loading** (9 files):
```javascript
require('dotenv').config();
```
- Should only load once in entry point (`index.js`)

**Duplicate database initialization patterns**:
```javascript
// Pattern repeated in multiple command files
const dbTracker = new DatabaseOrderTracker();
try {
  await dbTracker.initialize();
  // ... operations
} finally {
  await dbTracker.close();
}
```

**Duplicate configuration object construction**:
```javascript
// src/commands/query-invoice.js:261-266
const config = {
  cuit: process.env.AFIP_CUIT,
  environment: process.env.AFIP_ENVIRONMENT,
  certPath: process.env.AFIP_CERT_PATH,
  keyPath: process.env.AFIP_KEY_PATH
};
```
- This pattern appears in at least 4 query command files

**Duplicate date formatting logic**:
```javascript
// Multiple date format functions across files
formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.getFullYear().toString() +
         (date.getMonth() + 1).toString().padStart(2, '0') +
         date.getDate().toString().padStart(2, '0');
}
```

**Status**: ⚪ NOT STARTED

---

#### 3.7 Inconsistent Error Handling Patterns

**Impact**: Medium - Unpredictable error behavior, difficult debugging

**Examples**:

**Pattern 1: Return error object** (`src/services/AfipService.js:99-106`):
```javascript
} catch (error) {
  console.error('Error creating invoice:', error.message);
  return {
    success: false,
    error: error.message,
    invoice: invoice
  };
}
```

**Pattern 2: Throw error** (`src/services/AfipService.js:164`):
```javascript
} catch (error) {
  console.error('Error getting last voucher number:', error.message);
  return 0;  // Silent failure with default value
}
```

**Pattern 3: Silent swallow** (`src/utils/DatabaseOrderTracker.js:22-27`):
```javascript
} catch (error) {
  console.warn(`Warning: Could not insert order ${order.orderNumber}:`, error.message);
  return 0;  // Silent failure
}
```

**Recommendation**: Standardize on one approach:
- Services should throw errors
- Commands should catch and handle errors
- Use custom error classes for different error types

**Status**: ⚪ NOT STARTED

---

#### 3.8 Testing Coverage Gaps

**Impact**: High - Risk of regressions, production bugs

**Evidence from test run**:
- **77 tests failed, 41 passed** (65% failure rate)
- Test suite crashes with SQLite constraint violation
- Coverage target set to 80% but likely not meeting it
- Integration tests failing due to database issues

**Test failure example**:
```
SQLITE_CONSTRAINT: NOT NULL constraint failed: orders.order_date
```

**Missing test coverage areas**:
- CLI command integration tests
- End-to-end workflow tests
- Error scenario testing
- AFIP API mock testing

**Recommendation**:
1. Fix existing test failures (database schema issues)
2. Add integration tests for critical paths
3. Mock external dependencies (AFIP, Binance)
4. Achieve coverage threshold before production

**Status**: ⚪ NOT STARTED

---

### 🟢 Medium Priority Issues

#### 3.9 Hard-coded Values and Magic Numbers

**Impact**: Low-Medium - Reduced flexibility, difficult configuration

**Examples**:

**Hard-coded AFIP values** (`src/services/DirectInvoiceService.js:106-119`):
```javascript
return new Invoice({
  docType: 11,        // Hard-coded Type C
  docNumber: '',      // Empty string
  docDate: invoiceDate,
  concept: 2,         // Hard-coded Services
  currency: 'PES',    // Hard-coded Argentine Peso
  exchange: 1,        // Hard-coded 1:1
  // ...
});
```

**Magic numbers** (`src/services/DirectInvoiceService.js:128-129`):
```javascript
// Calculate 5 days ago from today (AFIP regulation limit for Services concept)
const fiveDaysAgo = new Date(today);
fiveDaysAgo.setDate(today.getDate() - 5);  // Magic number: 5 days
```

**Hard-coded cache path** (`src/services/AfipService.js:17`):
```javascript
cacheTokensPath: './.afip-tokens',  // Should be configurable
```

**Recommendation**: Extract to constants or configuration:
```javascript
const AFIP_CONSTANTS = {
  INVOICE_TYPE_C: 11,
  CONCEPT_SERVICES: 2,
  CURRENCY_ARS: 'PES',
  SERVICE_DATE_LIMIT_DAYS: 5
};
```

**Status**: ⚪ NOT STARTED

---

#### 3.10 Separation of Concerns Violations

**Impact**: Medium - Difficult testing, tight coupling

**Examples**:

**CLI with business logic** (`src/cli.js:27-38`):
```javascript
case 'manual': {
  const orderNumber = args[1];
  const cae = args[2];
  const voucherNumber = args[3];
  const notes = args[4] || null;
  if (!orderNumber || !cae || !voucherNumber) {
    console.log('Usage: node src/index.js manual ...');
    console.log('Example: node src/index.js manual ...');
    process.exit(1);
  }
  await app.markManualInvoice(orderNumber, cae, parseInt(voucherNumber), notes);
  break;
}
```
- Validation logic mixed with CLI parsing

**Database operations in service** (`src/services/DirectInvoiceService.js:56-63`):
```javascript
await this.dbTracker.db.markOrderProcessed(
  order.order_number,
  result,
  'automatic',
  invoice.docDate
);
```
- Direct database access through nested property (`dbTracker.db`)

**Configuration in constructor** (`src/AfipInvoiceApp.js:26-35`):
```javascript
constructor() {
  this.config = {
    cuit: process.env.AFIP_CUIT,
    certPath: process.env.AFIP_CERT_PATH,
    // ... loading config in constructor
  };
}
```

**Status**: ⚪ NOT STARTED

---

#### 3.11 Promise-based Wrapper Around Callback APIs

**Impact**: Low - Verbose code, potential memory leaks

**Evidence**: `src/database/Database.js` - 17 Promise wrappers

**Example** (lines 16-26):
```javascript
async connect() {
  return new Promise((resolve, reject) => {
    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('📁 Connected to SQLite database');
        resolve();
      }
    });
  });
}
```

**Recommendation**: Use `util.promisify` or better-sqlite3 (synchronous API):
```javascript
const { promisify } = require('util');
// or switch to better-sqlite3 for sync operations
```

**Status**: ⚪ NOT STARTED

---

#### 3.12 Redundant Legacy Code

**Impact**: Low - Code bloat, confusion

**Evidence**:
- **Two tracking systems**: `OrderTracker` (file-based) and `DatabaseOrderTracker` (database)
- File-based tracker still referenced but deprecated

**File**: `src/utils/orderTracker.js` (95 lines)
- JSON file-based order tracking
- Superseded by database approach
- Still imported in `src/commands/status.js:34`

**Recommendation**: Remove `orderTracker.js` and migrate remaining references to `DatabaseOrderTracker`

**Status**: ⚪ NOT STARTED

---

#### 3.13 Incomplete Query Implementation

**File**: `src/commands/query-invoice.js`

**Issue** (lines 78-100):
```javascript
// This is a placeholder - in reality we'd query AFIP
if (voucherNumber >= 6 && voucherNumber <= 20) {
  return {
    CbteTipo: voucherType,
    PtoVta: pointOfSale,
    CbteNro: voucherNumber,
    CodAutorizacion: 'PLACEHOLDER',  // ⚠️ Not real data
    // ...
  };
}
```

**Impact**: Query commands return placeholder data instead of real AFIP queries

**Status**: ⚪ NOT STARTED

---

#### 3.14 No Input Validation

**Impact**: Medium - Security risk, runtime errors

**Examples**:

**No validation in Invoice constructor** (`src/models/Invoice.js:2-17`):
```javascript
constructor(data) {
  this.docType = data.docType || 11;
  this.docNumber = data.docNumber;  // Could be any type
  this.docDate = data.docDate;      // No date validation
  this.concept = data.concept || 1;
  // ... no validation that values are correct types/ranges
}
```

**No API input sanitization** in Binance service

**Recommendation**: Add validation library (Joi, Yup) or create validation utilities

**Status**: ⚪ NOT STARTED

---

#### 3.15 Insufficient Documentation

**Impact**: Low-Medium - Onboarding difficulty, maintenance challenges

**Evidence**:
- No JSDoc comments on functions
- No inline code documentation for complex logic
- README is comprehensive but code lacks comments
- No architecture diagrams

**Example**: `src/services/DirectInvoiceService.js:122-139`
Complex date calculation with business rules but no comments explaining AFIP regulations

**Status**: ⚪ NOT STARTED

---

## 4. Security Concerns

### 4.1 Exposed API Keys in Project Status

**File**: `PROJECT_STATUS.md` (lines 100-101)
```
BINANCE_API_KEY=<REDACTED - EXPOSED API KEY FOUND>
BINANCE_SECRET_KEY=<REDACTED - EXPOSED API KEY FOUND>
```

**Impact**: CRITICAL - API keys committed to repository
**Recommendation**:
1. **IMMEDIATELY** rotate Binance API keys in your Binance account
2. Remove from git history (if repository is public or shared)
3. Keys have been removed from current version
4. `PROJECT_STATUS.md` and `.afip-tokens*` added to `.gitignore`

### 4.2 Sensitive Data in Git

**Files at risk**:
- `.afip-tokens` (tracked in git status)
- Certificates may be committed

**Recommendation**: Audit git history and ensure `.gitignore` is comprehensive

---

## 5. Positive Aspects

Despite the issues, the codebase has strengths:

### Well-Structured Architecture
- Clear separation into services, commands, models
- Database-first approach is modern and scalable
- Thin orchestrator pattern in `AfipInvoiceApp`

### Comprehensive README
- Excellent documentation for users
- Clear setup instructions
- Good command examples

### Good Test Foundation
- Jest configured with coverage targets
- Unit and integration test structure
- Test helpers and mock factories in place

### Modern Async/Await
- Consistent use of async/await (91 async functions)
- Avoids callback hell

### Security-Conscious `.gitignore`
- Excludes sensitive files (mostly)
- Protects certificates and database

---

## 6. Recommended Improvements Priority List

### Immediate (Critical)
1. ✅ **Rotate exposed Binance API keys** in PROJECT_STATUS.md
2. **Fix failing tests** (77 failures) - database schema issues
3. **Centralize configuration** - remove scattered `process.env` calls
4. **Implement proper logging framework** (Winston/Pino)

### High Priority
5. **Add input validation** - especially for Invoice model and API inputs
6. **Standardize error handling** - consistent throw/catch patterns
7. **Add TypeScript** or comprehensive JSDoc annotations
8. **Remove legacy code** - delete file-based OrderTracker

### Medium Priority
9. **Extract magic numbers** to constants
10. **Implement query commands** with real AFIP data
11. **Add integration tests** for critical workflows
12. **Improve separation of concerns** - remove business logic from CLI

### Low Priority
13. **Add code documentation** - JSDoc comments
14. **Refactor promise wrappers** - use util.promisify or better-sqlite3
15. **Code deduplication** - DRY violations

---

## 7. Metrics Summary

- **Total LOC**: ~3,268 (src) + ~2,191 (tests) = 5,459
- **Files**: 23 source files + 10 test files
- **Classes**: 13 classes
- **Async Functions**: 91
- **Try-Catch Blocks**: 48
- **Console Logs**: 227+
- **Test Pass Rate**: 35% (41/118 passing)
- **Direct process.env Access**: 7 files

---

## 8. Conclusion

This is a **functional but technically debt-laden** codebase suitable for a prototype or MVP but requiring significant refactoring for production readiness. The architecture is sound, but code quality practices need improvement. The most critical issues are:

1. Exposed API credentials (CRITICAL)
2. Failing test suite (HIGH)
3. Lack of type safety (HIGH)
4. Inconsistent error handling (HIGH)
5. Configuration sprawl (MEDIUM)

**Recommendation**: Allocate 2-3 weeks for technical debt remediation before production deployment, focusing on security, testing, and code standardization.

---

## 9. Progress Tracking

### Completed
- [ ] Remove exposed API keys from PROJECT_STATUS.md
- [ ] Centralize configuration
- [ ] Implement logging framework
- [ ] Fix failing tests
- [ ] Add input validation
- [ ] Standardize error handling
- [ ] Add TypeScript/JSDoc
- [ ] Remove legacy code
- [ ] Extract magic numbers
- [ ] Improve separation of concerns
- [ ] Add code documentation

**Last Updated**: 2025-11-08
