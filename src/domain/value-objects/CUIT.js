/**
 * CUIT Value Object
 *
 * Represents an Argentine Tax ID (CUIT - Clave Única de Identificación Tributaria).
 * Immutable value object with validation following DDD principles.
 *
 * Format: XX-XXXXXXXX-X (11 digits total)
 */

const { ValidationError } = require('../../shared/errors');
const { CUITValidator } = require('../../shared/validation/validators');

class CUIT {
  /**
   * Create a CUIT instance
   * @param {string|number} value - CUIT value (with or without hyphens)
   * @throws {ValidationError} If CUIT is invalid
   */
  constructor(value) {
    // Validate CUIT
    const validation = CUITValidator.validate(value);
    if (!validation.valid) {
      throw ValidationError.forField('cuit', validation.errors.join(', '));
    }

    // Store normalized value (without hyphens)
    const normalizedValue = String(value).replace(/-/g, '');

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
   * Get the CUIT value (without hyphens)
   * @returns {string}
   */
  get value() {
    return this._value;
  }

  /**
   * Get formatted CUIT (with hyphens: XX-XXXXXXXX-X)
   * @returns {string}
   */
  get formatted() {
    return `${this._value.slice(0, 2)}-${this._value.slice(2, 10)}-${this._value.slice(10)}`;
  }

  /**
   * Get CUIT type (first 2 digits)
   * 20: Male individuals
   * 23: Self-employed male
   * 24: Self-employed male (monotributo)
   * 27: Female individuals / Self-employed female
   * 30: Legal entities (companies)
   * 33: Self-employed foreign
   * 34: Foreign companies
   * @returns {string}
   */
  get type() {
    const prefix = this._value.slice(0, 2);
    const types = {
      '20': 'Male Individual',
      '23': 'Self-employed Male',
      '24': 'Self-employed Male (Monotributo)',
      '27': 'Female Individual / Self-employed Female',
      '30': 'Legal Entity',
      '33': 'Self-employed Foreign',
      '34': 'Foreign Company'
    };
    return types[prefix] || 'Unknown';
  }

  /**
   * Check if this is a company/legal entity CUIT
   * @returns {boolean}
   */
  isCompany() {
    const prefix = this._value.slice(0, 2);
    return prefix === '30' || prefix === '33' || prefix === '34';
  }

  /**
   * Check if this is an individual CUIT
   * @returns {boolean}
   */
  isIndividual() {
    return !this.isCompany();
  }

  /**
   * Check equality with another CUIT
   * @param {CUIT} other - CUIT instance to compare with
   * @returns {boolean}
   */
  equals(other) {
    if (!(other instanceof CUIT)) {
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
      formatted: this.formatted
    };
  }

  /**
   * Static factory method: Create CUIT from string or number
   * @param {string|number} value - CUIT value
   * @returns {CUIT}
   */
  static of(value) {
    return new CUIT(value);
  }

  /**
   * Static factory method: Create CUIT from JSON object
   * @param {Object} json - JSON object with value property
   * @returns {CUIT}
   */
  static fromJSON(json) {
    if (!json || typeof json !== 'object') {
      throw ValidationError.forField('json', 'Invalid JSON object');
    }
    if (!json.hasOwnProperty('value')) {
      throw ValidationError.forField('json', 'JSON must have value property');
    }
    return new CUIT(json.value);
  }

  /**
   * Static method: Validate CUIT without creating instance
   * @param {string|number} value - CUIT value to validate
   * @returns {boolean}
   */
  static isValid(value) {
    const validation = CUITValidator.validate(value);
    return validation.valid;
  }
}

module.exports = CUIT;
