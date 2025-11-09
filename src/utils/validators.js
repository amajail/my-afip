/**
 * Input Validation Utilities
 *
 * Provides comprehensive validation for AFIP invoicing application.
 * All validators return { valid: boolean, errors: string[] }
 */

const {
  InvalidCUITError,
  InvalidAmountError,
  InvalidDateError,
  ValidationError,
  ConfigurationError
} = require('./errors');

/**
 * CUIT Validator
 *
 * Validates Argentine CUIT (Tax ID) format and checksum.
 * Format: XX-XXXXXXXX-X (11 digits total)
 */
class CUITValidator {
  /**
   * Validate CUIT format and checksum
   * @param {string|number} cuit - CUIT to validate
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  static validate(cuit) {
    const errors = [];

    // Convert to string and remove hyphens
    const cuitStr = String(cuit).replace(/-/g, '');

    // Check length
    if (cuitStr.length !== 11) {
      errors.push(`CUIT must be 11 digits (got ${cuitStr.length})`);
      return { valid: false, errors };
    }

    // Check if all characters are digits
    if (!/^\d+$/.test(cuitStr)) {
      errors.push('CUIT must contain only numbers');
      return { valid: false, errors };
    }

    // Validate checksum using AFIP algorithm
    if (!this.validateChecksum(cuitStr)) {
      errors.push('CUIT checksum is invalid');
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Validate CUIT checksum using AFIP algorithm
   * @param {string} cuit - 11-digit CUIT string
   * @returns {boolean}
   */
  static validateChecksum(cuit) {
    // AFIP CUIT checksum algorithm
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
   * Format CUIT with hyphens
   * @param {string|number} cuit - CUIT to format
   * @returns {string} Formatted CUIT (XX-XXXXXXXX-X)
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
   * @throws {InvalidCUITError}
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
 * Validates monetary amounts for invoices
 */
class AmountValidator {
  /**
   * Validate amount
   * @param {number|string} amount - Amount to validate
   * @param {Object} options - Validation options
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  static validate(amount, options = {}) {
    const {
      min = 0,
      max = 999999999, // AFIP max invoice amount
      allowZero = false,
      fieldName = 'amount'
    } = options;

    const errors = [];
    const numAmount = parseFloat(amount);

    // Check if it's a valid number
    if (isNaN(numAmount)) {
      errors.push(`${fieldName} must be a valid number`);
      return { valid: false, errors };
    }

    // Check if finite
    if (!isFinite(numAmount)) {
      errors.push(`${fieldName} must be a finite number`);
      return { valid: false, errors };
    }

    // Check minimum
    if (!allowZero && numAmount <= min) {
      errors.push(`${fieldName} must be greater than ${min}`);
      return { valid: false, errors };
    }

    if (allowZero && numAmount < min) {
      errors.push(`${fieldName} must be at least ${min}`);
      return { valid: false, errors };
    }

    // Check maximum
    if (numAmount > max) {
      errors.push(`${fieldName} cannot exceed ${max.toLocaleString()}`);
      return { valid: false, errors };
    }

    // Check reasonable precision (max 2 decimal places for currency)
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
   * @param {Object} options - Validation options
   * @throws {InvalidAmountError}
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

/**
 * Date Validator
 *
 * Validates dates according to AFIP rules
 */
class DateValidator {
  /**
   * Validate date format and AFIP rules
   * @param {string|Date} date - Date to validate
   * @param {Object} options - Validation options
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  static validate(date, options = {}) {
    const {
      allowPast = true,
      allowFuture = false,
      maxDaysInPast = null, // For AFIP 5-day rule
      maxDaysInFuture = 0,
      fieldName = 'date'
    } = options;

    const errors = [];

    // Parse date
    let dateObj;
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      // Try to parse YYYY-MM-DD format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        errors.push(`${fieldName} must be in YYYY-MM-DD format`);
        return { valid: false, errors };
      }
      dateObj = new Date(date);
    } else {
      errors.push(`${fieldName} must be a Date object or YYYY-MM-DD string`);
      return { valid: false, errors };
    }

    // Check if valid date
    if (isNaN(dateObj.getTime())) {
      errors.push(`${fieldName} is not a valid date`);
      return { valid: false, errors };
    }

    // Get today at midnight for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dateOnly = new Date(dateObj);
    dateOnly.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((dateOnly - today) / (1000 * 60 * 60 * 24));

    // Check past dates
    if (!allowPast && diffDays < 0) {
      errors.push(`${fieldName} cannot be in the past`);
    }

    // Check future dates
    if (!allowFuture && diffDays > 0) {
      errors.push(`${fieldName} cannot be in the future`);
    }

    // Check max days in past (AFIP 5-day rule for services)
    if (maxDaysInPast !== null && diffDays < -maxDaysInPast) {
      errors.push(`${fieldName} cannot be more than ${maxDaysInPast} days in the past`);
    }

    // Check max days in future
    if (maxDaysInFuture !== null && diffDays > maxDaysInFuture) {
      errors.push(`${fieldName} cannot be more than ${maxDaysInFuture} days in the future`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate invoice date according to AFIP rules
   * For services (concept 2): max 5 days in the past
   * For products (concept 1): same day only
   * @param {string|Date} date - Invoice date
   * @param {number} concept - Invoice concept (1=products, 2=services)
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  static validateInvoiceDate(date, concept = 2) {
    if (concept === 1) {
      // Products: only today's date
      return this.validate(date, {
        allowPast: false,
        allowFuture: false,
        fieldName: 'invoice date'
      });
    } else {
      // Services: up to 5 days in the past
      return this.validate(date, {
        allowPast: true,
        allowFuture: false,
        maxDaysInPast: 5,
        fieldName: 'invoice date'
      });
    }
  }

  /**
   * Validate and throw error if invalid
   * @param {string|Date} date - Date to validate
   * @param {Object} options - Validation options
   * @throws {InvalidDateError}
   */
  static validateOrThrow(date, options = {}) {
    const result = this.validate(date, options);
    if (!result.valid) {
      throw new InvalidDateError(
        date,
        result.errors.join(', '),
        { fieldName: options.fieldName }
      );
    }
  }
}

/**
 * Invoice Validator
 *
 * Validates complete invoice data
 */
class InvoiceValidator {
  /**
   * Validate invoice data
   * @param {Object} invoice - Invoice data to validate
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  static validate(invoice) {
    const errors = [];

    // Required fields
    const requiredFields = ['docType', 'docDate', 'concept', 'currency', 'netAmount', 'totalAmount'];
    for (const field of requiredFields) {
      if (invoice[field] === undefined || invoice[field] === null) {
        errors.push(`${field} is required`);
      }
    }

    // Validate document type
    if (invoice.docType) {
      const validDocTypes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
      if (!validDocTypes.includes(invoice.docType)) {
        errors.push(`Invalid docType: ${invoice.docType}`);
      }
    }

    // Validate concept
    if (invoice.concept) {
      const validConcepts = [1, 2, 3]; // 1=products, 2=services, 3=both
      if (!validConcepts.includes(invoice.concept)) {
        errors.push(`Invalid concept: ${invoice.concept} (must be 1, 2, or 3)`);
      }
    }

    // Validate currency
    if (invoice.currency) {
      const validCurrencies = ['PES', 'DOL', 'EUR', 'USD'];
      if (!validCurrencies.includes(invoice.currency)) {
        errors.push(`Invalid currency: ${invoice.currency}`);
      }
    }

    // Validate amounts
    if (invoice.netAmount !== undefined) {
      const amountResult = AmountValidator.validate(invoice.netAmount, {
        fieldName: 'netAmount'
      });
      if (!amountResult.valid) {
        errors.push(...amountResult.errors);
      }
    }

    if (invoice.totalAmount !== undefined) {
      const amountResult = AmountValidator.validate(invoice.totalAmount, {
        fieldName: 'totalAmount'
      });
      if (!amountResult.valid) {
        errors.push(...amountResult.errors);
      }
    }

    if (invoice.vatAmount !== undefined) {
      const amountResult = AmountValidator.validate(invoice.vatAmount, {
        allowZero: true,
        fieldName: 'vatAmount'
      });
      if (!amountResult.valid) {
        errors.push(...amountResult.errors);
      }
    }

    // Validate total = net + vat
    if (invoice.netAmount !== undefined && invoice.totalAmount !== undefined && invoice.vatAmount !== undefined) {
      const expectedTotal = Math.round((parseFloat(invoice.netAmount) + parseFloat(invoice.vatAmount)) * 100) / 100;
      const actualTotal = Math.round(parseFloat(invoice.totalAmount) * 100) / 100;

      if (Math.abs(expectedTotal - actualTotal) > 0.01) {
        errors.push(`totalAmount (${actualTotal}) must equal netAmount + vatAmount (${expectedTotal})`);
      }
    }

    // Validate invoice date
    if (invoice.docDate) {
      const dateResult = DateValidator.validateInvoiceDate(
        invoice.docDate,
        invoice.concept || 2
      );
      if (!dateResult.valid) {
        errors.push(...dateResult.errors);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate and throw error if invalid
   * @param {Object} invoice - Invoice data
   * @throws {ValidationError}
   */
  static validateOrThrow(invoice) {
    const result = this.validate(invoice);
    if (!result.valid) {
      throw new ValidationError(
        result.errors.join('; '),
        'invoice',
        invoice,
        { errors: result.errors }
      );
    }
  }
}

/**
 * Configuration Validator
 *
 * Validates application configuration and credentials
 */
class ConfigValidator {
  /**
   * Validate AFIP configuration
   * @param {Object} config - AFIP configuration
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  static validateAfipConfig(config) {
    const errors = [];
    const missingKeys = [];

    // Required fields
    if (!config.cuit) {
      missingKeys.push('AFIP_CUIT');
    } else {
      // Validate CUIT format
      const cuitResult = CUITValidator.validate(config.cuit);
      if (!cuitResult.valid) {
        errors.push(`Invalid AFIP_CUIT: ${cuitResult.errors.join(', ')}`);
      }
    }

    if (!config.certPath) {
      missingKeys.push('AFIP_CERT_PATH');
    }

    if (!config.keyPath) {
      missingKeys.push('AFIP_KEY_PATH');
    }

    if (!config.ptoVta) {
      missingKeys.push('AFIP_PTOVTA');
    } else if (isNaN(config.ptoVta) || config.ptoVta < 1) {
      errors.push('AFIP_PTOVTA must be a positive number');
    }

    if (missingKeys.length > 0) {
      errors.push(`Missing required AFIP configuration: ${missingKeys.join(', ')}`);
    }

    return { valid: errors.length === 0, errors, missingKeys };
  }

  /**
   * Validate Binance configuration
   * @param {Object} config - Binance configuration
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  static validateBinanceConfig(config) {
    const errors = [];
    const missingKeys = [];

    if (!config.apiKey) {
      missingKeys.push('BINANCE_API_KEY');
    } else if (config.apiKey.length < 20) {
      errors.push('BINANCE_API_KEY appears to be invalid (too short)');
    }

    if (!config.secretKey) {
      missingKeys.push('BINANCE_SECRET_KEY');
    } else if (config.secretKey.length < 20) {
      errors.push('BINANCE_SECRET_KEY appears to be invalid (too short)');
    }

    if (missingKeys.length > 0) {
      errors.push(`Missing required Binance configuration: ${missingKeys.join(', ')}`);
    }

    return { valid: errors.length === 0, errors, missingKeys };
  }

  /**
   * Validate all configuration on startup
   * @param {Object} config - Complete application config
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  static validateStartup(config) {
    const allErrors = [];
    const allMissingKeys = [];

    // Validate AFIP config
    const afipResult = this.validateAfipConfig(config.afip);
    if (!afipResult.valid) {
      allErrors.push(...afipResult.errors);
      allMissingKeys.push(...afipResult.missingKeys);
    }

    // Validate Binance config
    const binanceResult = this.validateBinanceConfig(config.binance);
    if (!binanceResult.valid) {
      allErrors.push(...binanceResult.errors);
      allMissingKeys.push(...binanceResult.missingKeys);
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      missingKeys: allMissingKeys
    };
  }

  /**
   * Validate and throw error if invalid
   * @param {Object} config - Configuration to validate
   * @throws {ConfigurationError}
   */
  static validateStartupOrThrow(config) {
    const result = this.validateStartup(config);
    if (!result.valid) {
      throw new ConfigurationError(
        result.errors.join('; '),
        result.missingKeys
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
