/**
 * OrderProcessed Domain Event
 *
 * Represents the event of an order being processed (successfully or unsuccessfully).
 * Immutable record of the processing attempt with outcome.
 */

/**
 * Domain event: Order was processed
 */
class OrderProcessed {
  /**
   * Create OrderProcessed event
   * @param {Object} data - Event data
   * @param {string} data.orderNumber - Order number
   * @param {boolean} data.success - Whether processing succeeded
   * @param {string} [data.cae] - CAE number if successful
   * @param {number} [data.voucherNumber] - Voucher number if successful
   * @param {string} [data.errorMessage] - Error message if failed
   * @param {string} data.processingMethod - 'automatic' or 'manual'
   * @param {Date} [data.occurredAt] - When event occurred
   */
  constructor(data) {
    this._orderNumber = data.orderNumber;
    this._success = data.success;
    this._cae = data.cae || null;
    this._voucherNumber = data.voucherNumber || null;
    this._errorMessage = data.errorMessage || null;
    this._processingMethod = data.processingMethod;
    this._occurredAt = data.occurredAt || new Date();

    // Freeze to ensure immutability
    Object.freeze(this);
  }

  // Getters
  get orderNumber() { return this._orderNumber; }
  get success() { return this._success; }
  get cae() { return this._cae; }
  get voucherNumber() { return this._voucherNumber; }
  get errorMessage() { return this._errorMessage; }
  get processingMethod() { return this._processingMethod; }
  get occurredAt() { return this._occurredAt; }

  /**
   * Get event name
   * @returns {string}
   */
  get eventName() {
    return 'OrderProcessed';
  }

  /**
   * Check if processing was successful
   * @returns {boolean}
   */
  isSuccessful() {
    return this._success;
  }

  /**
   * Check if processing failed
   * @returns {boolean}
   */
  isFailed() {
    return !this._success;
  }

  /**
   * Convert to plain object
   * @returns {Object}
   */
  toJSON() {
    return {
      eventName: this.eventName,
      orderNumber: this._orderNumber,
      success: this._success,
      cae: this._cae,
      voucherNumber: this._voucherNumber,
      errorMessage: this._errorMessage,
      processingMethod: this._processingMethod,
      occurredAt: this._occurredAt.toISOString()
    };
  }

  /**
   * Create event from plain object
   * @param {Object} data - Plain object data
   * @returns {OrderProcessed}
   */
  static fromJSON(data) {
    return new OrderProcessed({
      ...data,
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date()
    });
  }
}

module.exports = OrderProcessed;
