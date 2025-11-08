# Critical Code Quality Improvements - Prioritized Action Plan

**Date**: 2025-11-08
**Status**: Based on CODE_QUALITY_ANALYSIS.md

---

## Progress Summary

### ✅ Completed (2/15)
1. ✅ **Remove exposed API keys** - DONE
2. ✅ **Centralize configuration** - DONE (src/config/index.js created)

### ⚠️ Pending (13/15)

---

## 🔴 CRITICAL Priority (Must Fix Before Production)

### 1. Fix Failing Tests (77 failures / 118 total)
**Status**: ⚠️ NOT STARTED
**Impact**: HIGH - Cannot deploy to production with 65% test failure rate
**Effort**: 4-6 hours
**File**: Tests across entire test suite

**Issues**:
```
SQLITE_CONSTRAINT: NOT NULL constraint failed: orders.order_date
Test Suites: 6 failed, 1 passed
Tests: 77 failed, 41 passed (35% pass rate)
```

**Root Causes**:
- Database schema constraint violations (order_date NOT NULL)
- Test data not properly formatted
- Database cleanup issues between tests
- SQLite crashes during bulk operations

**Action Items**:
- [ ] Fix test data to include required fields (order_date, etc.)
- [ ] Add proper database cleanup in beforeEach/afterEach
- [ ] Fix memory leaks (worker process force exit warning)
- [ ] Add `--detectOpenHandles` to find leaked resources
- [ ] Review and fix all 6 failing test suites

**Files to Fix**:
- `tests/integration/database/Database.test.js` (bulk insertion test)
- All test files with constraint violations
- Test setup/teardown logic

---

### 2. Implement Proper Logging Framework
**Status**: ⚠️ NOT STARTED
**Impact**: HIGH - 227+ console.log statements, no production logging
**Effort**: 2-3 hours
**Current**: Console.log everywhere, no log levels, emojis in logs

**Issues**:
- No structured logging
- Cannot filter by log level in production
- No log rotation or persistence
- Emojis not suitable for production
- No correlation IDs for debugging

**Recommended Solution**: **Winston** (most popular, production-ready)

**Action Items**:
- [ ] Install Winston: `npm install winston`
- [ ] Create `src/utils/logger.js` wrapper
- [ ] Configure log levels based on `LOG_LEVEL` env var
- [ ] Add JSON formatting for production
- [ ] Replace all 227+ console.log calls
- [ ] Add log rotation for file transport
- [ ] Configure Application Insights integration (for Azure)

**Example Implementation**:
```javascript
// src/utils/logger.js
const winston = require('winston');
const config = require('../config');

const logger = winston.createLogger({
  level: config.app.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    config.app.environment === 'production'
      ? winston.format.json()
      : winston.format.simple()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

module.exports = logger;
```

**Replacement Pattern**:
```javascript
// Before
console.log('🚀 Starting AFIP Invoice Application...');
console.error('Error creating invoice:', error.message);

// After
logger.info('Starting AFIP Invoice Application');
logger.error('Error creating invoice', { error: error.message, stack: error.stack });
```

---

### 3. Standardize Error Handling
**Status**: ⚠️ NOT STARTED
**Impact**: HIGH - Inconsistent error patterns, silent failures
**Effort**: 3-4 hours
**Files**: 20+ files with error handling

**Issues**:
- **3 different error handling patterns**:
  1. Return error object: `{ success: false, error: ... }`
  2. Throw errors
  3. Silent failures (return 0 or default value)
- Errors logged but not propagated
- No custom error classes
- Duplicate error handling logic

**Examples of Inconsistency**:

**Pattern 1** (src/services/AfipService.js:99-106):
```javascript
catch (error) {
  console.error('Error creating invoice:', error.message);
  return { success: false, error: error.message, invoice: invoice };
}
```

**Pattern 2** (src/services/AfipService.js:164):
```javascript
catch (error) {
  console.error('Error getting last voucher number:', error.message);
  return 0;  // Silent failure
}
```

**Pattern 3** (src/utils/DatabaseOrderTracker.js:22-27):
```javascript
catch (error) {
  console.warn(`Warning: Could not insert order ${order.orderNumber}:`, error.message);
  return 0;  // Silent failure
}
```

**Recommended Solution**:
- **Services should throw custom errors**
- **Commands/Controllers should catch and handle**
- **Create custom error classes**

**Action Items**:
- [ ] Create `src/errors/` directory with custom error classes
- [ ] Define error hierarchy (AfipError, BinanceError, DatabaseError, etc.)
- [ ] Update all services to throw errors (not return error objects)
- [ ] Update all commands to catch and handle errors
- [ ] Add error context (order number, CAE, etc.)
- [ ] Remove silent failures

**Example Implementation**:
```javascript
// src/errors/AfipError.js
class AfipError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'AfipError';
    this.code = code;
    this.details = details;
  }
}

// Usage in AfipService
async createInvoice(invoice, voucherNumber) {
  try {
    // ... creation logic
  } catch (error) {
    throw new AfipError(
      'Failed to create AFIP invoice',
      'INVOICE_CREATION_FAILED',
      { voucherNumber, invoice, originalError: error.message }
    );
  }
}

// Usage in Command
try {
  await afipService.createInvoice(invoice, voucherNumber);
} catch (error) {
  if (error instanceof AfipError) {
    logger.error('AFIP invoice creation failed', {
      code: error.code,
      details: error.details
    });
  }
  throw error;
}
```

---

## 🟡 HIGH Priority (Should Fix Before Azure Migration)

### 4. Add Input Validation
**Status**: ⚠️ NOT STARTED
**Impact**: HIGH - Security risk, runtime errors
**Effort**: 2-3 hours
**Files**: `src/models/Invoice.js`, API inputs

**Issues**:
- Invoice constructor accepts any data without validation
- No date format validation
- No numeric range checks
- No required field enforcement
- Type coercion without validation

**Example** (src/models/Invoice.js:9-11):
```javascript
this.netAmount = parseFloat(data.netAmount);      // NaN if invalid
this.totalAmount = parseFloat(data.totalAmount);  // No validation
this.vatAmount = parseFloat(data.vatAmount || 0); // Silent fallback
```

**Recommended Solution**: Use **Joi** validation library

**Action Items**:
- [ ] Install Joi: `npm install joi`
- [ ] Create validation schemas for Invoice, Order, Config
- [ ] Add validation in Invoice constructor
- [ ] Validate Binance API responses
- [ ] Validate user inputs in CLI commands
- [ ] Add validation error handling

**Example Implementation**:
```javascript
const Joi = require('joi');

const invoiceSchema = Joi.object({
  docType: Joi.number().integer().min(1).max(99).default(11),
  docNumber: Joi.string().allow(''),
  docDate: Joi.date().iso().required(),
  concept: Joi.number().integer().valid(1, 2, 3).default(1),
  netAmount: Joi.number().positive().required(),
  totalAmount: Joi.number().positive().required(),
  vatAmount: Joi.number().min(0).default(0)
});

class Invoice {
  constructor(data) {
    const { error, value } = invoiceSchema.validate(data);
    if (error) {
      throw new ValidationError('Invalid invoice data', error.details);
    }
    Object.assign(this, value);
  }
}
```

---

### 5. Remove Legacy Code (OrderTracker)
**Status**: ⚠️ NOT STARTED
**Impact**: MEDIUM - Code bloat, confusion
**Effort**: 30 minutes
**Files**: `src/utils/orderTracker.js` (95 lines)

**Issues**:
- File-based OrderTracker superseded by DatabaseOrderTracker
- Still imported in `src/commands/status.js:34`
- Causes confusion about which tracker to use
- Dead code in production

**Action Items**:
- [ ] Find all references to `orderTracker.js`
- [ ] Replace with `DatabaseOrderTracker`
- [ ] Delete `src/utils/orderTracker.js`
- [ ] Remove from any imports

**Files to Update**:
```bash
# Find references
grep -r "orderTracker" src/
```

---

### 6. Add TypeScript or Comprehensive JSDoc
**Status**: ⚠️ NOT STARTED
**Impact**: MEDIUM - Developer experience, refactoring safety
**Effort**: 8-12 hours (TypeScript) OR 4-6 hours (JSDoc)
**Scope**: All 23 source files

**Issues**:
- No type checking
- Poor IDE autocomplete
- Difficult refactoring
- Runtime type errors

**Recommended Solution**: **JSDoc** (lower effort, no transpilation)

**Action Items**:
- [ ] Add JSDoc comments to all public methods
- [ ] Define types with `@typedef`
- [ ] Add `@param` and `@returns` annotations
- [ ] Configure TypeScript checking via `tsconfig.json` (checkJs: true)
- [ ] Add JSDoc validation to CI/CD

**Example Implementation**:
```javascript
/**
 * @typedef {Object} InvoiceData
 * @property {number} docType - Document type (11 for Type C)
 * @property {string} docNumber - Document number
 * @property {string} docDate - Invoice date (ISO 8601)
 * @property {number} totalAmount - Total invoice amount
 */

/**
 * Creates an AFIP invoice
 * @param {InvoiceData} invoice - Invoice data
 * @param {number} [voucherNumber] - Optional voucher number
 * @returns {Promise<{success: boolean, cae?: string, error?: string}>}
 * @throws {AfipError} When invoice creation fails
 */
async createInvoice(invoice, voucherNumber = null) {
  // ...
}
```

---

## 🟢 MEDIUM Priority (Good to Have)

### 7. Extract Magic Numbers to Constants
**Status**: ⚠️ NOT STARTED
**Impact**: MEDIUM - Maintainability
**Effort**: 1-2 hours
**Files**: `src/services/DirectInvoiceService.js`, `src/models/Invoice.js`

**Issues**:
- Hard-coded values throughout codebase
- No documentation for AFIP constants
- Difficult to understand business rules

**Examples**:
```javascript
// src/services/DirectInvoiceService.js:106-119
docType: 11,        // What is 11?
concept: 2,         // What is 2?
currency: 'PES',    // Why PES?

// src/services/DirectInvoiceService.js:128-129
fiveDaysAgo.setDate(today.getDate() - 5);  // Why 5 days?
```

**Recommended Solution**: Create constants file

**Action Items**:
- [ ] Create `src/constants/afip.js`
- [ ] Extract all magic numbers
- [ ] Add documentation for each constant
- [ ] Replace all hardcoded values

**Example Implementation**:
```javascript
// src/constants/afip.js
/**
 * AFIP Invoice Type Codes
 */
const INVOICE_TYPES = {
  TYPE_A: 1,
  TYPE_B: 6,
  TYPE_C: 11  // For Monotributistas (no VAT)
};

/**
 * AFIP Concept Codes
 */
const CONCEPTS = {
  PRODUCTS: 1,
  SERVICES: 2,
  PRODUCTS_AND_SERVICES: 3
};

/**
 * Currency Codes
 */
const CURRENCIES = {
  ARS: 'PES',  // Argentine Peso
  USD: 'DOL'   // US Dollar
};

/**
 * Business Rules
 */
const RULES = {
  SERVICE_DATE_LIMIT_DAYS: 5,  // AFIP regulation: services must be invoiced within 5 days
  TOKEN_EXPIRY_HOURS: 12
};

module.exports = {
  INVOICE_TYPES,
  CONCEPTS,
  CURRENCIES,
  RULES
};
```

---

### 8. Improve Separation of Concerns
**Status**: ⚠️ NOT STARTED
**Impact**: MEDIUM - Code organization, testability
**Effort**: 2-3 hours
**Files**: `src/cli.js`, services, commands

**Issues**:
- CLI contains business logic validation
- Services access database directly through nested properties
- Configuration loaded in constructors

**Examples**:

**CLI with validation logic** (src/cli.js:27-38):
```javascript
case 'manual': {
  const orderNumber = args[1];
  const cae = args[2];
  const voucherNumber = args[3];
  const notes = args[4] || null;
  if (!orderNumber || !cae || !voucherNumber) {  // Business logic in CLI!
    console.log('Usage: node src/index.js manual ...');
    process.exit(1);
  }
  await app.markManualInvoice(orderNumber, cae, parseInt(voucherNumber), notes);
  break;
}
```

**Service with nested database access** (src/services/DirectInvoiceService.js:56-63):
```javascript
await this.dbTracker.db.markOrderProcessed(  // Should use dbTracker method, not .db directly
  order.order_number,
  result,
  'automatic',
  invoice.docDate
);
```

**Action Items**:
- [ ] Extract validation logic from CLI to validators
- [ ] Create input validators in `src/validators/`
- [ ] Encapsulate database access in DatabaseOrderTracker
- [ ] Move configuration out of constructors
- [ ] Use dependency injection where appropriate

---

### 9. Add Integration Tests for Critical Workflows
**Status**: ⚠️ NOT STARTED
**Impact**: MEDIUM - Quality assurance
**Effort**: 3-4 hours
**Coverage**: Currently missing end-to-end tests

**Missing Test Coverage**:
- Full Binance → Database → AFIP workflow
- Error recovery scenarios
- AFIP authentication failure handling
- Database transaction rollback
- Order deduplication logic

**Action Items**:
- [ ] Create `tests/integration/workflows/` directory
- [ ] Test: Binance fetch → Database insert → AFIP process
- [ ] Test: Error handling and retry logic
- [ ] Test: Duplicate order detection
- [ ] Test: Manual invoice workflow
- [ ] Mock AFIP API responses

---

## 🔵 LOW Priority (Nice to Have)

### 10. Add Code Documentation (JSDoc)
**Status**: ⚠️ NOT STARTED
**Impact**: LOW - Developer onboarding
**Effort**: 4-6 hours
**Note**: Overlaps with #6 if JSDoc approach chosen

### 11. Refactor Promise Wrappers
**Status**: ⚠️ NOT STARTED
**Impact**: LOW - Code cleanliness
**Effort**: 1-2 hours
**File**: `src/database/Database.js` (17 Promise wrappers)

**Current**:
```javascript
async connect() {
  return new Promise((resolve, reject) => {
    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
```

**Recommended**:
```javascript
const { promisify } = require('util');
// Or switch to better-sqlite3 (synchronous API)
```

### 12. Code Deduplication (DRY)
**Status**: ⚠️ NOT STARTED
**Impact**: LOW - Maintenance
**Effort**: 2-3 hours

**Issues**:
- Duplicate date formatting functions
- Duplicate database initialization patterns
- Duplicate AFIP config object construction (in 4 query files)

---

## Recommended Implementation Order

### Phase 1: Critical Fixes (Before ANY deployment)
**Timeline**: 1 week

1. **Fix Failing Tests** (Day 1-2)
   - Highest priority
   - Blocks all other work
   - Required for CI/CD

2. **Implement Logging Framework** (Day 3)
   - Replace console.log statements
   - Production monitoring requirement

3. **Standardize Error Handling** (Day 4-5)
   - Create error classes
   - Update services and commands
   - Critical for debugging

### Phase 2: High Priority (Before Azure Migration)
**Timeline**: 3-4 days

4. **Add Input Validation** (Day 6-7)
   - Security requirement
   - Prevents runtime errors

5. **Remove Legacy Code** (Day 7)
   - Quick win
   - Reduces confusion

6. **JSDoc or TypeScript** (Day 8-9)
   - Choose JSDoc for faster implementation
   - Improves developer experience

### Phase 3: Medium Priority (After Azure Migration)
**Timeline**: 1 week

7. **Extract Magic Numbers** (Day 1)
8. **Improve Separation of Concerns** (Day 2-3)
9. **Add Integration Tests** (Day 4-5)

---

## Success Metrics

### Before Starting:
- ❌ Test Pass Rate: 35% (41/118)
- ❌ Console.log statements: 227+
- ❌ Error handling patterns: 3 different types
- ❌ Input validation: None
- ❌ Magic numbers: ~20+ instances

### After Phase 1 (Critical):
- ✅ Test Pass Rate: >95% (>112/118)
- ✅ Structured logging: Winston configured
- ✅ Error handling: Standardized with custom errors
- ⏳ Input validation: Pending
- ⏳ Magic numbers: Pending

### After Phase 2 (High Priority):
- ✅ Test Pass Rate: >95%
- ✅ Structured logging: Production-ready
- ✅ Error handling: Fully standardized
- ✅ Input validation: Joi schemas implemented
- ✅ Legacy code: Removed
- ✅ Type safety: JSDoc annotations complete
- ⏳ Magic numbers: Pending

### After Phase 3 (Complete):
- ✅ All metrics at target
- ✅ Magic numbers: Extracted to constants
- ✅ Separation of concerns: Improved
- ✅ Integration tests: Added
- ✅ Production-ready codebase

---

## Effort Summary

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 🔴 Critical | Fix Failing Tests | 4-6h | HIGH |
| 🔴 Critical | Logging Framework | 2-3h | HIGH |
| 🔴 Critical | Error Handling | 3-4h | HIGH |
| 🟡 High | Input Validation | 2-3h | HIGH |
| 🟡 High | Remove Legacy Code | 0.5h | MEDIUM |
| 🟡 High | JSDoc/TypeScript | 4-6h | MEDIUM |
| 🟢 Medium | Magic Numbers | 1-2h | MEDIUM |
| 🟢 Medium | Separation of Concerns | 2-3h | MEDIUM |
| 🟢 Medium | Integration Tests | 3-4h | MEDIUM |
| 🔵 Low | Code Documentation | 4-6h | LOW |
| 🔵 Low | Promise Wrappers | 1-2h | LOW |
| 🔵 Low | Deduplication | 2-3h | LOW |

**Total Effort**:
- **Critical**: 9-13 hours
- **High Priority**: 6.5-9.5 hours
- **Medium Priority**: 6-9 hours
- **Low Priority**: 7-11 hours

**Grand Total**: ~28-42 hours (3.5-5 working days)

---

## Next Steps

**Immediate Action**: Which priority level do you want to start with?

1. **Start with Critical (Recommended)**: Fix tests, logging, error handling
2. **Skip to High Priority**: If tests are acceptable as-is
3. **Quick wins first**: Start with "Remove Legacy Code" (30 min)

**Ready to implement?** Let me know which task to start with!

---

**Last Updated**: 2025-11-08
**Based On**: CODE_QUALITY_ANALYSIS.md
