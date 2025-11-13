/**
 * InvoiceCreated Domain Event
 *
 * Represents the event of an invoice being successfully created in AFIP.
 * Immutable record of the event with all relevant context.
 */

/**
 * Domain event: Invoice was created
 */
class InvoiceCreated {
  /**
   * Create InvoiceCreated event
   * @param {Object} data - Event data
   * @param {string} data.orderNumber - Associated order number
   * @param {string} data.cae - CAE number
   * @param {number} data.voucherNumber - Invoice voucher number
   * @param {string} data.invoiceDate - Invoice date
   * @param {number} data.totalAmount - Total invoice amount
   * @param {string} data.currency - Currency code
   * @param {Date} [data.occurredAt] - When event occurred
   */
  constructor(data) {
    this._orderNumber = data.orderNumber;
    this._cae = data.cae;
    this._voucherNumber = data.voucherNumber;
    this._invoiceDate = data.invoiceDate;
    this._totalAmount = data.totalAmount;
    this._currency = data.currency;
    this._occurredAt = data.occurredAt || new Date();

    // Freeze to ensure immutability
    Object.freeze(this);
  }

  // Getters
  get orderNumber() { return this._orderNumber; }
  get cae() { return this._cae; }
  get voucherNumber() { return this._voucherNumber; }
  get invoiceDate() { return this._invoiceDate; }
  get totalAmount() { return this._totalAmount; }
  get currency() { return this._currency; }
  get occurredAt() { return this._occurredAt; }

  /**
   * Get event name
   * @returns {string}
   */
  get eventName() {
    return 'InvoiceCreated';
  }

  /**
   * Convert to plain object
   * @returns {Object}
   */
  toJSON() {
    return {
      eventName: this.eventName,
      orderNumber: this._orderNumber,
      cae: this._cae,
      voucherNumber: this._voucherNumber,
      invoiceDate: this._invoiceDate,
      totalAmount: this._totalAmount,
      currency: this._currency,
      occurredAt: this._occurredAt.toISOString()
    };
  }

  /**
   * Create event from plain object
   * @param {Object} data - Plain object data
   * @returns {InvoiceCreated}
   */
  static fromJSON(data) {
    return new InvoiceCreated({
      ...data,
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date()
    });
  }
}

module.exports = InvoiceCreated;
