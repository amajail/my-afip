/**
 * InvoiceDateValidator Domain Service
 *
 * Stateless service for validating invoice dates according to AFIP regulations.
 * Implements the 10-day rule and other date-related business rules.
 */

const { ValidationError, DomainError } = require('../../shared/errors');

/**
 * Domain service for invoice date validation
 */
class InvoiceDateValidator {
  /**
   * AFIP regulation: Invoices must be created within 10 days of transaction
   */
  static MAX_DAYS_AFTER_TRANSACTION = 10;

  /**
   * Validate that a date string is in correct format (YYYY-MM-DD)
   * @param {string} dateStr - Date string to validate
   * @returns {boolean} Whether date format is valid
   */
  static isValidDateFormat(dateStr) {
    if (typeof dateStr !== 'string') {
      return false;
    }
    return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  }

  /**
   * Parse date string to Date object
   * @param {string} dateStr - Date string (YYYY-MM-DD)
   * @returns {Date} Parsed date
   * @throws {ValidationError} If date format is invalid
   */
  static parseDate(dateStr) {
    if (!InvoiceDateValidator.isValidDateFormat(dateStr)) {
      throw ValidationError.forField('date', 'Date must be in YYYY-MM-DD format');
    }

    const date = new Date(dateStr + 'T00:00:00.000Z');
    if (isNaN(date.getTime())) {
      throw ValidationError.forField('date', 'Invalid date value');
    }

    return date;
  }

  /**
   * Calculate days difference between two dates
   * @param {Date} date1 - First date
   * @param {Date} date2 - Second date
   * @returns {number} Number of days difference (can be negative)
   */
  static daysBetween(date1, date2) {
    const msPerDay = 1000 * 60 * 60 * 24;
    const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
    return Math.floor((utc2 - utc1) / msPerDay);
  }

  /**
   * Validate that invoice date is not in the future
   * @param {string} invoiceDate - Invoice date (YYYY-MM-DD)
   * @param {Date} [referenceDate=new Date()] - Reference date (defaults to today)
   * @returns {{valid: boolean, error: string|null}} Validation result
   */
  static validateNotFuture(invoiceDate, referenceDate = new Date()) {
    try {
      const date = InvoiceDateValidator.parseDate(invoiceDate);
      const refDateOnly = new Date(referenceDate.toISOString().split('T')[0]);

      if (date > refDateOnly) {
        return {
          valid: false,
          error: 'Invoice date cannot be in the future'
        };
      }

      return { valid: true, error: null };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Validate AFIP's 10-day rule: invoices must be created within 10 days
   * @param {string} transactionDate - Transaction/order date (YYYY-MM-DD)
   * @param {string} invoiceDate - Proposed invoice date (YYYY-MM-DD)
   * @returns {{valid: boolean, error: string|null, daysAfter: number}} Validation result
   */
  static validateTenDayRule(transactionDate, invoiceDate) {
    try {
      const txDate = InvoiceDateValidator.parseDate(transactionDate);
      const invDate = InvoiceDateValidator.parseDate(invoiceDate);

      const daysAfter = InvoiceDateValidator.daysBetween(txDate, invDate);

      if (daysAfter < 0) {
        return {
          valid: false,
          error: 'Invoice date cannot be before transaction date',
          daysAfter
        };
      }

      if (daysAfter > InvoiceDateValidator.MAX_DAYS_AFTER_TRANSACTION) {
        return {
          valid: false,
          error: `Invoice must be created within ${InvoiceDateValidator.MAX_DAYS_AFTER_TRANSACTION} days of transaction (AFIP regulation)`,
          daysAfter
        };
      }

      return { valid: true, error: null, daysAfter };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        daysAfter: 0
      };
    }
  }

  /**
   * Comprehensive invoice date validation
   * @param {string} invoiceDate - Invoice date to validate
   * @param {string} transactionDate - Transaction date
   * @param {Date} [referenceDate=new Date()] - Reference date for "today"
   * @returns {{valid: boolean, errors: string[]}} Validation result
   */
  static validate(invoiceDate, transactionDate, referenceDate = new Date()) {
    const errors = [];

    // Check format
    if (!InvoiceDateValidator.isValidDateFormat(invoiceDate)) {
      errors.push('Invoice date must be in YYYY-MM-DD format');
      return { valid: false, errors };
    }

    if (!InvoiceDateValidator.isValidDateFormat(transactionDate)) {
      errors.push('Transaction date must be in YYYY-MM-DD format');
      return { valid: false, errors };
    }

    // Check not future
    const futureCheck = InvoiceDateValidator.validateNotFuture(invoiceDate, referenceDate);
    if (!futureCheck.valid) {
      errors.push(futureCheck.error);
    }

    // Check 10-day rule
    const tenDayCheck = InvoiceDateValidator.validateTenDayRule(transactionDate, invoiceDate);
    if (!tenDayCheck.valid) {
      errors.push(tenDayCheck.error);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate and throw if invalid
   * @param {string} invoiceDate - Invoice date to validate
   * @param {string} transactionDate - Transaction date
   * @param {Date} [referenceDate=new Date()] - Reference date
   * @throws {ValidationError} If validation fails
   */
  static validateOrThrow(invoiceDate, transactionDate, referenceDate = new Date()) {
    const result = InvoiceDateValidator.validate(invoiceDate, transactionDate, referenceDate);

    if (!result.valid) {
      throw ValidationError.forField('invoiceDate', result.errors.join(', '));
    }
  }

  /**
   * Get the maximum valid invoice date for a transaction
   * @param {string} transactionDate - Transaction date (YYYY-MM-DD)
   * @returns {string} Maximum invoice date (YYYY-MM-DD)
   */
  static getMaxInvoiceDate(transactionDate) {
    const txDate = InvoiceDateValidator.parseDate(transactionDate);
    const maxDate = new Date(txDate);
    maxDate.setDate(maxDate.getDate() + InvoiceDateValidator.MAX_DAYS_AFTER_TRANSACTION);

    return maxDate.toISOString().split('T')[0];
  }

  /**
   * Check if transaction date is still within valid invoicing period
   * @param {string} transactionDate - Transaction date (YYYY-MM-DD)
   * @param {Date} [referenceDate=new Date()] - Reference date (defaults to today)
   * @returns {{canInvoice: boolean, daysRemaining: number}} Invoicing status
   */
  static canStillInvoice(transactionDate, referenceDate = new Date()) {
    try {
      const txDate = InvoiceDateValidator.parseDate(transactionDate);
      const refDateOnly = new Date(referenceDate.toISOString().split('T')[0]);

      const daysPassed = InvoiceDateValidator.daysBetween(txDate, refDateOnly);
      const daysRemaining = InvoiceDateValidator.MAX_DAYS_AFTER_TRANSACTION - daysPassed;

      return {
        canInvoice: daysRemaining >= 0,
        daysRemaining: Math.max(0, daysRemaining)
      };
    } catch (error) {
      return {
        canInvoice: false,
        daysRemaining: 0
      };
    }
  }

  /**
   * Suggest a valid invoice date
   * @param {string} transactionDate - Transaction date (YYYY-MM-DD)
   * @param {Date} [referenceDate=new Date()] - Reference date
   * @returns {string} Suggested invoice date (YYYY-MM-DD)
   */
  static suggestInvoiceDate(transactionDate, referenceDate = new Date()) {
    const status = InvoiceDateValidator.canStillInvoice(transactionDate, referenceDate);

    if (!status.canInvoice) {
      // Too late - use transaction date (will fail validation, but that's expected)
      return transactionDate;
    }

    // Use today if within valid period
    return referenceDate.toISOString().split('T')[0];
  }
}

module.exports = InvoiceDateValidator;
