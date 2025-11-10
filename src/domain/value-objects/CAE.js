/**
 * CAE Value Object
 *
 * Represents an AFIP Electronic Authorization Code (CAE - Código de Autorización Electrónico).
 * Immutable value object with validation following DDD principles.
 *
 * Format: 14 digits (displayed as XXXXX-XXXXX-XXXX)
 */

const { ValidationError } = require('../../shared/errors');

class CAE {
  /**
   * Create a CAE instance
   * @param {string|number} value - CAE value (14 digits)
   * @param {Date|string} expirationDate - CAE expiration date (optional)
   * @throws {ValidationError} If CAE is invalid
   */
  constructor(value, expirationDate = null) {
    // Validate CAE
    const validation = CAE._validate(value);
    if (!validation.valid) {
      throw ValidationError.forField('cae', validation.errors.join(', '));
    }

    // Store normalized value (14 digits as string, remove hyphens)
    const normalizedValue = String(value).replace(/-/g, '').padStart(14, '0');

    Object.defineProperty(this, '_value', {
      value: normalizedValue,
      writable: false,
      enumerable: false,
      configurable: false
    });

    // Store expiration date if provided
    let expDate = null;
    if (expirationDate) {
      expDate = expirationDate instanceof Date
        ? expirationDate
        : new Date(expirationDate);

      if (isNaN(expDate.getTime())) {
        throw ValidationError.forField('expirationDate', 'Invalid expiration date');
      }
    }

    Object.defineProperty(this, '_expirationDate', {
      value: expDate,
      writable: false,
      enumerable: false,
      configurable: false
    });

    // Freeze the object to ensure immutability
    Object.freeze(this);
  }

  /**
   * Get the CAE value (14 digits)
   * @returns {string}
   */
  get value() {
    return this._value;
  }

  /**
   * Get formatted CAE (XXXXX-XXXXX-XXXX)
   * @returns {string}
   */
  get formatted() {
    return `${this._value.slice(0, 5)}-${this._value.slice(5, 10)}-${this._value.slice(10)}`;
  }

  /**
   * Get expiration date
   * @returns {Date|null}
   */
  get expirationDate() {
    return this._expirationDate;
  }

  /**
   * Check if CAE is expired
   * @returns {boolean}
   */
  isExpired() {
    if (!this._expirationDate) {
      return false; // No expiration date means not expired
    }
    return new Date() > this._expirationDate;
  }

  /**
   * Check if CAE is valid (not expired)
   * @returns {boolean}
   */
  isValid() {
    return !this.isExpired();
  }

  /**
   * Get days until expiration
   * @returns {number|null} Days until expiration (null if no expiration date)
   */
  daysUntilExpiration() {
    if (!this._expirationDate) {
      return null;
    }
    const diffTime = this._expirationDate.getTime() - new Date().getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check equality with another CAE
   * @param {CAE} other - CAE instance to compare with
   * @returns {boolean}
   */
  equals(other) {
    if (!(other instanceof CAE)) {
      return false;
    }
    return this._value === other._value;
  }

  /**
   * Format as string
   * @returns {string}
   */
  toString() {
    return this.formatted;
  }

  /**
   * Convert to plain object
   * @returns {Object}
   */
  toJSON() {
    return {
      value: this._value,
      formatted: this.formatted,
      expirationDate: this._expirationDate ? this._expirationDate.toISOString() : null
    };
  }

  /**
   * Validate CAE value
   * @param {string|number} value - CAE value to validate
   * @returns {Object} { valid: boolean, errors: string[] }
   * @private
   */
  static _validate(value) {
    const errors = [];

    if (value === null || value === undefined) {
      errors.push('CAE is required');
      return { valid: false, errors };
    }

    // Convert to string and remove any formatting
    const valueStr = String(value).replace(/-/g, '');

    // Check if it's all digits
    if (!/^\d+$/.test(valueStr)) {
      errors.push('CAE must contain only digits');
      return { valid: false, errors };
    }

    // Check length (should be 14 digits)
    if (valueStr.length > 14) {
      errors.push('CAE must be 14 digits or less');
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Static factory method: Create CAE from value
   * @param {string|number} value - CAE value
   * @param {Date|string} expirationDate - Optional expiration date
   * @returns {CAE}
   */
  static of(value, expirationDate = null) {
    return new CAE(value, expirationDate);
  }

  /**
   * Static factory method: Create CAE from JSON object
   * @param {Object} json - JSON object with value and optional expirationDate
   * @returns {CAE}
   */
  static fromJSON(json) {
    if (!json || typeof json !== 'object') {
      throw ValidationError.forField('json', 'Invalid JSON object');
    }
    if (!json.hasOwnProperty('value')) {
      throw ValidationError.forField('json', 'JSON must have value property');
    }
    return new CAE(json.value, json.expirationDate || null);
  }

  /**
   * Static method: Validate CAE without creating instance
   * @param {string|number} value - CAE value to validate
   * @returns {boolean}
   */
  static isValid(value) {
    const validation = CAE._validate(value);
    return validation.valid;
  }
}

module.exports = CAE;
