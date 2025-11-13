/**
 * OrderNumber Value Object
 *
 * Represents a Binance order identifier.
 * Immutable value object with validation following DDD principles.
 */

const { ValidationError } = require('../../shared/errors');

class OrderNumber {
  /**
   * Create an OrderNumber instance
   * @param {string} value - Order number value
   * @throws {ValidationError} If order number is invalid
   */
  constructor(value) {
    // Validate order number
    const validation = OrderNumber._validate(value);
    if (!validation.valid) {
      throw ValidationError.forField('orderNumber', validation.errors.join(', '));
    }

    // Store normalized value (trim whitespace)
    const normalizedValue = String(value).trim();

    Object.defineProperty(this, '_value', {
      value: normalizedValue,
      writable: false,
      enumerable: false,
      configurable: false
    });

    // Freeze the object to ensure immutability
    Object.freeze(this);
  }

  /**
   * Get the order number value
   * @returns {string}
   */
  get value() {
    return this._value;
  }

  /**
   * Get truncated order number for display (first 8 + last 8 characters)
   * @returns {string}
   */
  get truncated() {
    if (this._value.length <= 20) {
      return this._value;
    }
    return `${this._value.substring(0, 8)}...${this._value.substring(this._value.length - 8)}`;
  }

  /**
   * Check if this is a numeric order ID
   * @returns {boolean}
   */
  isNumeric() {
    return /^\d+$/.test(this._value);
  }

  /**
   * Check equality with another OrderNumber
   * @param {OrderNumber} other - OrderNumber instance to compare with
   * @returns {boolean}
   */
  equals(other) {
    if (!(other instanceof OrderNumber)) {
      return false;
    }
    return this._value === other._value;
  }

  /**
   * Format as string
   * @returns {string}
   */
  toString() {
    return this._value;
  }

  /**
   * Convert to plain object
   * @returns {Object}
   */
  toJSON() {
    return {
      value: this._value
    };
  }

  /**
   * Validate order number value
   * @param {string} value - Order number value to validate
   * @returns {Object} { valid: boolean, errors: string[] }
   * @private
   */
  static _validate(value) {
    const errors = [];

    if (value === null || value === undefined) {
      errors.push('Order number is required');
      return { valid: false, errors };
    }

    const valueStr = String(value).trim();

    if (valueStr.length === 0) {
      errors.push('Order number cannot be empty');
      return { valid: false, errors };
    }

    if (valueStr.length > 255) {
      errors.push('Order number cannot exceed 255 characters');
      return { valid: false, errors };
    }

    // Check for valid characters (alphanumeric, hyphens, underscores)
    if (!/^[a-zA-Z0-9_-]+$/.test(valueStr)) {
      errors.push('Order number can only contain alphanumeric characters, hyphens, and underscores');
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Static factory method: Create OrderNumber from string
   * @param {string} value - Order number value
   * @returns {OrderNumber}
   */
  static of(value) {
    return new OrderNumber(value);
  }

  /**
   * Static factory method: Create OrderNumber from JSON object
   * @param {Object} json - JSON object with value property
   * @returns {OrderNumber}
   */
  static fromJSON(json) {
    if (!json || typeof json !== 'object') {
      throw ValidationError.forField('json', 'Invalid JSON object');
    }
    if (!json.hasOwnProperty('value')) {
      throw ValidationError.forField('json', 'JSON must have value property');
    }
    return new OrderNumber(json.value);
  }

  /**
   * Static method: Validate order number without creating instance
   * @param {string} value - Order number value to validate
   * @returns {boolean}
   */
  static isValid(value) {
    const validation = OrderNumber._validate(value);
    return validation.valid;
  }
}

module.exports = OrderNumber;
