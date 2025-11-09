# JSDoc Type Annotations - Practical Example

This shows how to add TypeScript-compatible JSDoc to your existing JavaScript code without changing to `.ts` files.

---

## Example 1: Invoice Model (Before & After)

### BEFORE (Current JavaScript)
```javascript
// src/models/Invoice.js
class Invoice {
  constructor(data) {
    this.docType = data.docType || 11;
    this.docNumber = data.docNumber;
    this.docDate = data.docDate;
    this.concept = data.concept || 1;
    this.currency = data.currency || 'PES';
    this.netAmount = parseFloat(data.netAmount);
    this.totalAmount = parseFloat(data.totalAmount);
    this.vatAmount = parseFloat(data.vatAmount || 0);
  }

  toAfipFormat() {
    const invoiceType = this.vatAmount > 0 ? 6 : 11;
    return {
      CbteTipo: invoiceType,
      PtoVta: config.afip.ptoVta,
      // ...
    };
  }
}
```

### AFTER (With JSDoc)
```javascript
// src/models/Invoice.js

/**
 * @typedef {Object} InvoiceData
 * @property {number} [docType=11] - Document type (11=CUIT, 80=CUIT, etc.)
 * @property {string} [docNumber] - Client's document number (CUIT/DNI)
 * @property {string} docDate - Invoice date in YYYY-MM-DD format
 * @property {1|2|3} [concept=1] - Invoice concept (1=Products, 2=Services, 3=Both)
 * @property {'PES'|'DOL'|'EUR'} [currency='PES'] - Currency code
 * @property {number} [exchange=1] - Exchange rate
 * @property {number} netAmount - Net amount (before VAT)
 * @property {number} totalAmount - Total amount (including VAT)
 * @property {number} [vatAmount=0] - VAT amount
 * @property {string} [serviceFrom] - Service start date (required for concept 2 or 3)
 * @property {string} [serviceTo] - Service end date (required for concept 2 or 3)
 * @property {string} [dueDate] - Payment due date
 * @property {Array} [taxes=[]] - Additional taxes
 * @property {Array} [associatedDocs=[]] - Associated documents
 */

/**
 * @typedef {Object} AfipInvoiceFormat
 * @property {number} CantReg - Number of records
 * @property {number} PtoVta - Point of sale number
 * @property {6|11} CbteTipo - Invoice type (6=Type B, 11=Type C)
 * @property {1|2|3} Concepto - Invoice concept
 * @property {number} DocTipo - Document type
 * @property {number} DocNro - Document number
 * @property {number} CbteDesde - Invoice number from
 * @property {number} CbteHasta - Invoice number to
 * @property {string} CbteFch - Invoice date (YYYYMMDD)
 * @property {number} ImpTotal - Total amount
 * @property {number} ImpNeto - Net amount
 * @property {number} ImpIVA - VAT amount
 * @property {string} MonId - Currency code
 * @property {number} MonCotiz - Exchange rate
 */

/**
 * Invoice model representing an AFIP-compliant electronic invoice
 */
class Invoice {
  /**
   * Create a new invoice
   * @param {InvoiceData} data - Invoice data
   */
  constructor(data) {
    /** @type {number} */
    this.docType = data.docType || 11;

    /** @type {string|undefined} */
    this.docNumber = data.docNumber;

    /** @type {string} */
    this.docDate = data.docDate;

    /** @type {1|2|3} */
    this.concept = data.concept || 1;

    /** @type {'PES'|'DOL'|'EUR'} */
    this.currency = data.currency || 'PES';

    /** @type {number} */
    this.exchange = data.exchange || 1;

    /** @type {number} */
    this.netAmount = parseFloat(data.netAmount);

    /** @type {number} */
    this.totalAmount = parseFloat(data.totalAmount);

    /** @type {number} */
    this.vatAmount = parseFloat(data.vatAmount || 0);

    /** @type {string|undefined} */
    this.serviceFrom = data.serviceFrom;

    /** @type {string|undefined} */
    this.serviceTo = data.serviceTo;

    /** @type {string|undefined} */
    this.dueDate = data.dueDate;

    /** @type {Array} */
    this.taxes = data.taxes || [];

    /** @type {Array} */
    this.associatedDocs = data.associatedDocs || [];
  }

  /**
   * Validate invoice data
   * @returns {{isValid: boolean, errors: string[]}}
   */
  validate() {
    const result = InvoiceValidator.validate(this);
    return {
      isValid: result.valid,
      errors: result.errors
    };
  }

  /**
   * Validate and throw error if invalid
   * @throws {ValidationError}
   * @returns {void}
   */
  validateOrThrow() {
    InvoiceValidator.validateOrThrow(this);
  }

  /**
   * Convert invoice to AFIP API format
   * @returns {AfipInvoiceFormat}
   */
  toAfipFormat() {
    // Monotributistas use Type C (11) for no VAT, Type B (6) for with VAT
    const invoiceType = this.vatAmount > 0 ? 6 : 11;

    const baseInvoice = {
      CantReg: 1,
      PtoVta: config.afip.ptoVta,
      CbteTipo: invoiceType,
      Concepto: this.concept,
      DocTipo: this.docNumber ? this.docType : 99,
      DocNro: this.docNumber || 0,
      CbteDesde: 1,
      CbteHasta: 1,
      CbteFch: this.formatDate(this.docDate),
      ImpTotal: this.totalAmount,
      ImpTotConc: 0,
      ImpNeto: this.netAmount,
      ImpOpEx: 0,
      ImpIVA: this.vatAmount,
      ImpTrib: 0,
      MonId: this.currency,
      MonCotiz: this.exchange,
      CondicionIVAReceptorId: 5
    };

    // ... rest of method
    return baseInvoice;
  }

  /**
   * Format date string to AFIP format (YYYYMMDD)
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {string} Date in YYYYMMDD format
   */
  formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.getFullYear().toString() +
           (date.getMonth() + 1).toString().padStart(2, '0') +
           date.getDate().toString().padStart(2, '0');
  }
}

module.exports = Invoice;
```

**What You Get**:
- ✅ IDE autocomplete for `new Invoice({ ... })` knows all properties
- ✅ VSCode shows inline documentation on hover
- ✅ Type checking: `invoice.concept = 5` would show an error (must be 1, 2, or 3)
- ✅ Refactoring support: Rename `docType` and it updates everywhere
- ✅ No build step required - runs as normal JavaScript

---

## Example 2: Config Module (Before & After)

### BEFORE (Current)
```javascript
// src/config/index.js
function getRequired(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

module.exports = {
  afip: {
    cuit: getRequired('AFIP_CUIT'),
    certPath: getRequired('AFIP_CERT_PATH'),
    environment: get('AFIP_ENVIRONMENT', 'production'),
    ptoVta: getInt('AFIP_PTOVTA', 2),
  }
};
```

### AFTER (With JSDoc)
```javascript
// src/config/index.js

/**
 * @typedef {Object} AfipConfig
 * @property {string} cuit - AFIP CUIT number (11 digits)
 * @property {string} certPath - Path to AFIP certificate file
 * @property {string} keyPath - Path to AFIP private key file
 * @property {'production'|'homologation'} environment - AFIP environment
 * @property {number} ptoVta - Point of sale number
 * @property {string} cacheTokensPath - Path to cache AFIP tokens
 */

/**
 * @typedef {Object} BinanceConfig
 * @property {string} apiKey - Binance API key
 * @property {string} secretKey - Binance secret key
 * @property {string} apiUrl - Binance API base URL
 */

/**
 * @typedef {Object} DatabaseConfig
 * @property {string} path - Path to SQLite database file
 */

/**
 * @typedef {Object} AppConfig
 * @property {'debug'|'info'|'warn'|'error'} logLevel - Logging level
 * @property {string} invoiceInputPath - Path to invoice CSV input
 * @property {string} invoiceOutputPath - Path to processed invoice output
 */

/**
 * @typedef {Object} Config
 * @property {AfipConfig} afip - AFIP configuration
 * @property {BinanceConfig} binance - Binance API configuration
 * @property {DatabaseConfig} database - Database configuration
 * @property {AppConfig} app - Application settings
 * @property {() => boolean} isProduction - Check if running in production
 * @property {() => boolean} isTest - Check if running in test mode
 */

/**
 * Get required environment variable or throw error
 * @param {string} key - Environment variable name
 * @returns {string} Environment variable value
 * @throws {Error} If environment variable is not set
 */
function getRequired(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Get optional environment variable with fallback
 * @param {string} key - Environment variable name
 * @param {string} [defaultValue=''] - Default value if not set
 * @returns {string} Environment variable value or default
 */
function get(key, defaultValue = '') {
  return process.env[key] || defaultValue;
}

/**
 * Parse integer from environment variable with fallback
 * @param {string} key - Environment variable name
 * @param {number} defaultValue - Default value if not set or invalid
 * @returns {number} Parsed integer or default
 */
function getInt(key, defaultValue) {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/** @type {Config} */
module.exports = {
  afip: {
    cuit: getRequired('AFIP_CUIT'),
    certPath: getRequired('AFIP_CERT_PATH'),
    keyPath: getRequired('AFIP_KEY_PATH'),
    environment: get('AFIP_ENVIRONMENT', 'production'),
    ptoVta: getInt('AFIP_PTOVTA', 2),
    cacheTokensPath: get('AFIP_CACHE_TOKENS_PATH', './.afip-tokens')
  },

  binance: {
    apiKey: getRequired('BINANCE_API_KEY'),
    secretKey: getRequired('BINANCE_SECRET_KEY'),
    apiUrl: get('BINANCE_API_URL', 'https://api.binance.com')
  },

  database: {
    path: get('DB_PATH', './data/afip-orders.db')
  },

  app: {
    logLevel: get('LOG_LEVEL', 'info'),
    invoiceInputPath: get('INVOICE_INPUT_PATH', './data/invoices.csv'),
    invoiceOutputPath: get('INVOICE_OUTPUT_PATH', './data/processed')
  },

  isProduction() {
    return this.afip.environment === 'production';
  },

  isTest() {
    return process.env.NODE_ENV === 'test';
  }
};
```

**What You Get**:
- ✅ `config.afip.environment` autocomplete shows only 'production' or 'homologation'
- ✅ `config.app.logLevel` shows only valid log levels
- ✅ Typo `config.binace.apiKey` caught immediately (red squiggly in IDE)
- ✅ All config usage across project is type-checked

---

## Example 3: Validators (Before & After)

### BEFORE (Current)
```javascript
// src/utils/validators.js
class CUITValidator {
  static validate(cuit) {
    const errors = [];
    const cuitStr = String(cuit).replace(/-/g, '');

    if (cuitStr.length !== 11) {
      errors.push(`CUIT must be 11 digits`);
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  }
}
```

### AFTER (With JSDoc)
```javascript
// src/utils/validators.js

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string[]} errors - Array of error messages
 */

/**
 * @typedef {Object} AmountValidationOptions
 * @property {number} [min=0] - Minimum allowed value
 * @property {number} [max=999999999] - Maximum allowed value
 * @property {boolean} [allowZero=false] - Whether zero is allowed
 * @property {string} [fieldName='amount'] - Field name for error messages
 */

/**
 * @typedef {Object} DateValidationOptions
 * @property {boolean} [allowPast=true] - Whether past dates are allowed
 * @property {boolean} [allowFuture=false] - Whether future dates are allowed
 * @property {number|null} [maxDaysInPast=null] - Maximum days in past (AFIP: 5 days for services)
 * @property {number|null} [maxDaysInFuture=0] - Maximum days in future
 * @property {string} [fieldName='date'] - Field name for error messages
 */

/**
 * CUIT Validator
 *
 * Validates Argentine CUIT (Tax ID) format and checksum using AFIP algorithm.
 * Format: XX-XXXXXXXX-X (11 digits total)
 */
class CUITValidator {
  /**
   * Validate CUIT format and checksum
   * @param {string|number} cuit - CUIT to validate (with or without hyphens)
   * @returns {ValidationResult} Validation result
   *
   * @example
   * CUITValidator.validate('20-12345678-9')
   * // Returns: { valid: true, errors: [] }
   *
   * @example
   * CUITValidator.validate('invalid')
   * // Returns: { valid: false, errors: ['CUIT must be 11 digits'] }
   */
  static validate(cuit) {
    const errors = [];
    const cuitStr = String(cuit).replace(/-/g, '');

    if (cuitStr.length !== 11) {
      errors.push(`CUIT must be 11 digits (got ${cuitStr.length})`);
      return { valid: false, errors };
    }

    if (!/^\d+$/.test(cuitStr)) {
      errors.push('CUIT must contain only numbers');
      return { valid: false, errors };
    }

    if (!this.validateChecksum(cuitStr)) {
      errors.push('CUIT checksum is invalid');
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Validate CUIT checksum using AFIP algorithm
   * @param {string} cuit - 11-digit CUIT string (no hyphens)
   * @returns {boolean} True if checksum is valid
   * @private
   */
  static validateChecksum(cuit) {
    const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cuit[i]) * multipliers[i];
    }
    const remainder = sum % 11;
    const checkDigit = remainder === 0 ? 0 : remainder === 1 ? 9 : 11 - remainder;
    return checkDigit === parseInt(cuit[10]);
  }

  /**
   * Format CUIT with hyphens (XX-XXXXXXXX-X)
   * @param {string|number} cuit - CUIT to format
   * @returns {string} Formatted CUIT with hyphens
   *
   * @example
   * CUITValidator.format('20123456789')
   * // Returns: '20-12345678-9'
   */
  static format(cuit) {
    const cuitStr = String(cuit).replace(/-/g, '');
    if (cuitStr.length !== 11) {
      return cuitStr;
    }
    return `${cuitStr.slice(0, 2)}-${cuitStr.slice(2, 10)}-${cuitStr.slice(10)}`;
  }

  /**
   * Validate and throw error if invalid
   * @param {string|number} cuit - CUIT to validate
   * @throws {InvalidCUITError} If CUIT is invalid
   * @returns {void}
   */
  static validateOrThrow(cuit) {
    const result = this.validate(cuit);
    if (!result.valid) {
      throw new InvalidCUITError(cuit, { errors: result.errors });
    }
  }
}

/**
 * Amount Validator
 *
 * Validates monetary amounts for invoices with precision and range checks.
 */
class AmountValidator {
  /**
   * Validate monetary amount
   * @param {number|string} amount - Amount to validate
   * @param {AmountValidationOptions} [options={}] - Validation options
   * @returns {ValidationResult} Validation result
   *
   * @example
   * AmountValidator.validate(100.50)
   * // Returns: { valid: true, errors: [] }
   *
   * @example
   * AmountValidator.validate(100.123)
   * // Returns: { valid: false, errors: ['amount cannot have more than 2 decimal places'] }
   */
  static validate(amount, options = {}) {
    const {
      min = 0,
      max = 999999999,
      allowZero = false,
      fieldName = 'amount'
    } = options;

    const errors = [];
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount)) {
      errors.push(`${fieldName} must be a valid number`);
      return { valid: false, errors };
    }

    if (!isFinite(numAmount)) {
      errors.push(`${fieldName} must be a finite number`);
      return { valid: false, errors };
    }

    if (!allowZero && numAmount <= min) {
      errors.push(`${fieldName} must be greater than ${min}`);
      return { valid: false, errors };
    }

    if (numAmount > max) {
      errors.push(`${fieldName} cannot exceed ${max.toLocaleString()}`);
      return { valid: false, errors };
    }

    const decimalPlaces = (String(numAmount).split('.')[1] || '').length;
    if (decimalPlaces > 2) {
      errors.push(`${fieldName} cannot have more than 2 decimal places`);
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Validate and throw error if invalid
   * @param {number|string} amount - Amount to validate
   * @param {AmountValidationOptions} [options={}] - Validation options
   * @throws {InvalidAmountError} If amount is invalid
   * @returns {void}
   */
  static validateOrThrow(amount, options = {}) {
    const result = this.validate(amount, options);
    if (!result.valid) {
      throw new InvalidAmountError(
        amount,
        result.errors.join(', '),
        { fieldName: options.fieldName }
      );
    }
  }
}

module.exports = {
  CUITValidator,
  AmountValidator,
  DateValidator,
  InvoiceValidator,
  ConfigValidator
};
```

**What You Get**:
- ✅ Autocomplete for validation options
- ✅ JSDoc shows examples in IDE on hover
- ✅ Return type `{ valid: boolean, errors: string[] }` enforced
- ✅ IDE shows documentation for AFIP rules inline

---

## How to Enable JSDoc Type Checking

### Option 1: VSCode Settings (Per Project)

Create `.vscode/settings.json`:
```json
{
  "javascript.implicitProjectConfig.checkJs": true,
  "javascript.suggest.completeFunctionCalls": true,
  "javascript.inlayHints.parameterNames.enabled": "all"
}
```

### Option 2: jsconfig.json (Recommended)

Create `jsconfig.json` in project root:
```json
{
  "compilerOptions": {
    "checkJs": true,
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "allowJs": true,
    "noEmit": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Option 3: Add TypeScript for Type Checking Only

```bash
npm install -D typescript
```

Add to `package.json`:
```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "type-check:watch": "tsc --noEmit --watch"
  }
}
```

Now you can run:
```bash
npm run type-check
```

This validates all JSDoc types WITHOUT compiling to TypeScript.

---

## IDE Benefits (VSCode Example)

### 1. Autocomplete

When you type `new Invoice({`, VSCode shows:
```
InvoiceData
  - docType?: number
  - docNumber?: string
  - docDate: string      ← Required field highlighted
  - concept?: 1 | 2 | 3
  - currency?: 'PES' | 'DOL' | 'EUR'
  - netAmount: number    ← Required field highlighted
  ...
```

### 2. Inline Documentation

Hover over `CUITValidator.validate()` shows:
```
CUITValidator.validate(cuit: string | number): ValidationResult

Validate CUIT format and checksum

@param cuit - CUIT to validate (with or without hyphens)
@returns Validation result

Example:
  CUITValidator.validate('20-12345678-9')
  // Returns: { valid: true, errors: [] }
```

### 3. Error Detection

```javascript
// ❌ Type error (red squiggly)
const invoice = new Invoice({
  docDate: '2025-01-01',
  concept: 5,  // ❌ Error: Type '5' is not assignable to type '1 | 2 | 3'
  netAmount: 100
});

// ❌ Type error
config.afip.cuit.toUpperCase();  // ❌ Error: Property 'toUpperCase' does not exist on type 'number'
```

### 4. Refactoring

Right-click on `docType` → Rename Symbol → Updates everywhere including:
- Constructor parameter
- Property assignment
- toAfipFormat usage
- All files that reference it

---

## Common JSDoc Patterns

### Union Types
```javascript
/**
 * @param {'production'|'homologation'} env - Environment
 */
```

### Optional Parameters
```javascript
/**
 * @param {string} [name] - Optional name
 * @param {number} [count=10] - Optional with default
 */
```

### Complex Objects
```javascript
/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {number} [age] - Optional
 */

/**
 * @param {User} user
 */
```

### Promises
```javascript
/**
 * @returns {Promise<Invoice>}
 */
async function createInvoice() {
  // ...
}
```

### Arrays
```javascript
/**
 * @param {string[]} tags
 * @param {Invoice[]} invoices
 */
```

### Generic Types
```javascript
/**
 * @template T
 * @param {T[]} items
 * @returns {T|undefined}
 */
function first(items) {
  return items[0];
}
```

---

## Comparison: JSDoc vs Full TypeScript

| Feature | JSDoc | Full TypeScript |
|---------|-------|----------------|
| Type checking | ✅ Yes | ✅ Yes |
| IDE autocomplete | ✅ Yes | ✅ Yes |
| Build step | ✅ No | ❌ Yes (tsc) |
| Runtime overhead | ✅ Zero | ✅ Zero (compiles to JS) |
| File extension | `.js` | `.ts` |
| Learning curve | 🟢 Low | 🟡 Medium |
| Type inference | ⚠️ Limited | ✅ Excellent |
| Complex generics | ❌ Verbose | ✅ Clean |
| Integration with facturajs | ⚠️ Manual `.d.ts` | ⚠️ Manual `.d.ts` |
| Refactoring | ✅ Good | ✅ Excellent |
| Production risk | 🟢 Zero | ⚠️ Medium |

---

## Next Steps

1. **Try It**: Add JSDoc to one file (`src/models/Invoice.js`) and see the benefits
2. **Install TypeScript**: `npm install -D typescript` (for type checking only)
3. **Create jsconfig.json**: Enable type checking
4. **Iterate**: Add types to critical files first, then expand
5. **Run Type Check**: `npx tsc --noEmit` to validate

---

## Conclusion

JSDoc gives you **80% of TypeScript's benefits** with **0% of the migration risk**.

Start with JSDoc today. Upgrade to full TypeScript later if needed.
