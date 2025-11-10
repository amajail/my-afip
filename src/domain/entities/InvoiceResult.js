/**
 * InvoiceResult Entity
 *
 * Represents the result of submitting an invoice to AFIP.
 * Contains authorization details (CAE), voucher number, and status.
 * This is a value object-like entity that encapsulates AFIP response.
 */

const CAE = require('../value-objects/CAE');
const { ValidationError } = require('../../shared/errors');

/**
 * @typedef {Object} InvoiceResultData
 * @property {boolean} success - Whether the invoice was successfully created
 * @property {string} [cae] - CAE number if successful
 * @property {string} [caeExpiration] - CAE expiration date
 * @property {number} [voucherNumber] - Invoice voucher number
 * @property {string} [invoiceDate] - Actual invoice date from AFIP (YYYY-MM-DD)
 * @property {string} [errorMessage] - Error message if failed
 * @property {Array<string>} [errors] - List of error messages
 * @property {Array<string>} [observations] - AFIP observations
 * @property {Object} [metadata] - Additional metadata from AFIP response
 */

/**
 * InvoiceResult represents the outcome of creating an invoice with AFIP
 */
class InvoiceResult {
  /**
   * Create an InvoiceResult instance
   * @param {InvoiceResultData} data - Result data
   */
  constructor(data) {
    this._success = Boolean(data.success);

    // Success data
    this._cae = data.cae ? CAE.of(data.cae, data.caeExpiration) : null;
    this._voucherNumber = data.voucherNumber || null;
    this._invoiceDate = data.invoiceDate || null;

    // Error data
    this._errorMessage = data.errorMessage || null;
    this._errors = data.errors || [];
    this._observations = data.observations || [];

    // Additional metadata
    this._metadata = data.metadata || {};

    // Timestamp
    this._createdAt = data.createdAt || new Date();

    // Validate
    this._validate();

    // Freeze the object to ensure immutability
    Object.freeze(this);
  }

  /**
   * Validate result data
   * @private
   * @throws {ValidationError} If validation fails
   */
  _validate() {
    const errors = [];

    if (this._success) {
      // Successful results must have CAE and voucher number
      if (!this._cae) {
        errors.push('Successful result must have CAE');
      }
      if (!this._voucherNumber) {
        errors.push('Successful result must have voucher number');
      }
      if (!this._invoiceDate) {
        errors.push('Successful result must have invoice date');
      }
    } else {
      // Failed results must have error message or errors
      if (!this._errorMessage && this._errors.length === 0) {
        errors.push('Failed result must have error message or errors');
      }
    }

    if (errors.length > 0) {
      throw ValidationError.forField('invoiceResult', errors.join(', '));
    }
  }

  // Getters
  get success() { return this._success; }
  get cae() { return this._cae; }
  get voucherNumber() { return this._voucherNumber; }
  get invoiceDate() { return this._invoiceDate; }
  get errorMessage() { return this._errorMessage; }
  get errors() { return [...this._errors]; }
  get observations() { return [...this._observations]; }
  get metadata() { return { ...this._metadata }; }
  get createdAt() { return this._createdAt; }

  /**
   * Check if result is successful
   * @returns {boolean}
   */
  isSuccessful() {
    return this._success;
  }

  /**
   * Check if result failed
   * @returns {boolean}
   */
  isFailed() {
    return !this._success;
  }

  /**
   * Check if CAE is expired
   * @returns {boolean}
   */
  isCAEExpired() {
    if (!this._cae) {
      return false;
    }
    return this._cae.isExpired();
  }

  /**
   * Check if result has observations
   * @returns {boolean}
   */
  hasObservations() {
    return this._observations.length > 0;
  }

  /**
   * Get all error messages combined
   * @returns {string}
   */
  getAllErrors() {
    if (this._errorMessage) {
      return this._errorMessage;
    }
    return this._errors.join('; ');
  }

  /**
   * Get formatted result message
   * @returns {string}
   */
  getMessage() {
    if (this._success) {
      return `Invoice created successfully. CAE: ${this._cae.formatted}, Voucher: ${this._voucherNumber}`;
    } else {
      return `Invoice creation failed: ${this.getAllErrors()}`;
    }
  }

  /**
   * Convert to plain object (for persistence)
   * @returns {Object}
   */
  toJSON() {
    return {
      success: this._success,
      cae: this._cae ? this._cae.value : null,
      caeExpiration: this._cae ? this._cae.expirationDate : null,
      voucherNumber: this._voucherNumber,
      invoiceDate: this._invoiceDate,
      errorMessage: this._errorMessage,
      errors: [...this._errors],
      observations: [...this._observations],
      metadata: { ...this._metadata },
      createdAt: this._createdAt
    };
  }

  /**
   * Create InvoiceResult from plain object
   * @param {Object} data - Plain object data
   * @returns {InvoiceResult}
   */
  static fromJSON(data) {
    return new InvoiceResult(data);
  }

  /**
   * Create successful result
   * @param {Object} data - Success data
   * @param {string} data.cae - CAE number
   * @param {string} [data.caeExpiration] - CAE expiration date
   * @param {number} data.voucherNumber - Voucher number
   * @param {string} data.invoiceDate - Invoice date
   * @param {Array<string>} [data.observations] - Observations
   * @param {Object} [data.metadata] - Additional metadata
   * @returns {InvoiceResult}
   */
  static success(data) {
    return new InvoiceResult({
      success: true,
      cae: data.cae,
      caeExpiration: data.caeExpiration,
      voucherNumber: data.voucherNumber,
      invoiceDate: data.invoiceDate,
      observations: data.observations || [],
      metadata: data.metadata || {}
    });
  }

  /**
   * Create failed result
   * @param {string|Array<string>} error - Error message(s)
   * @param {Object} [metadata] - Additional metadata
   * @returns {InvoiceResult}
   */
  static failure(error, metadata = {}) {
    const errors = Array.isArray(error) ? error : [error];
    return new InvoiceResult({
      success: false,
      errorMessage: errors.join('; '),
      errors: errors,
      metadata
    });
  }

  /**
   * Create result from AFIP response
   * @param {Object} afipResponse - Raw AFIP response
   * @returns {InvoiceResult}
   */
  static fromAFIPResponse(afipResponse) {
    // Check if response indicates success
    const isSuccess = afipResponse.CAE && afipResponse.CbteNro;

    if (isSuccess) {
      return InvoiceResult.success({
        cae: afipResponse.CAE,
        caeExpiration: afipResponse.CAEFchVto,
        voucherNumber: afipResponse.CbteNro,
        invoiceDate: afipResponse.CbteFch,
        observations: afipResponse.Observaciones || [],
        metadata: {
          pointOfSale: afipResponse.PtoVta,
          invoiceType: afipResponse.CbteTipo,
          afipResult: afipResponse.Resultado
        }
      });
    } else {
      // Extract error messages
      const errors = [];
      if (afipResponse.Errors) {
        afipResponse.Errors.forEach(err => {
          errors.push(`[${err.Code}] ${err.Msg}`);
        });
      }
      if (afipResponse.Err) {
        errors.push(afipResponse.Err.Msg || afipResponse.Err);
      }
      if (errors.length === 0) {
        errors.push('Unknown AFIP error');
      }

      return InvoiceResult.failure(errors, {
        afipResult: afipResponse.Resultado,
        afipResponse
      });
    }
  }
}

module.exports = InvoiceResult;
