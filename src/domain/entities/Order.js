/**
 * Order Entity (Aggregate Root)
 *
 * Represents a Binance P2P order in the domain model.
 * Encapsulates business logic for order processing and invoice creation.
 * Following DDD principles with rich domain behavior.
 */

const OrderNumber = require('../value-objects/OrderNumber');
const Money = require('../value-objects/Money');
const CAE = require('../value-objects/CAE');
const { ValidationError, DomainError } = require('../../shared/errors');

/**
 * @typedef {Object} OrderData
 * @property {string} orderNumber - Unique order identifier
 * @property {number} amount - Crypto amount
 * @property {number} price - Unit price in fiat
 * @property {number} totalPrice - Total price (amount * price)
 * @property {string} asset - Crypto asset (e.g., 'USDT')
 * @property {string} fiat - Fiat currency (e.g., 'ARS')
 * @property {string} [buyerNickname] - Buyer's nickname
 * @property {string} [sellerNickname] - Seller's nickname
 * @property {string} tradeType - 'BUY' or 'SELL'
 * @property {number} createTime - Unix timestamp (milliseconds)
 * @property {string} orderDate - ISO date string (YYYY-MM-DD)
 */

/**
 * Order entity represents a Binance P2P trade order
 */
class Order {
  /**
   * Create an Order instance
   * @param {OrderData} data - Order data
   * @throws {ValidationError} If order data is invalid
   */
  constructor(data) {
    // Validate and create value objects
    this._orderNumber = OrderNumber.of(data.orderNumber);
    this._totalAmount = new Money(parseFloat(data.totalPrice), data.fiat === 'ARS' ? 'ARS' : 'USD');

    // Core order data
    this._amount = parseFloat(data.amount);
    this._price = parseFloat(data.price);
    this._asset = data.asset;
    this._fiat = data.fiat;
    this._tradeType = data.tradeType;
    this._createTime = data.createTime;
    this._orderDate = data.orderDate;

    // Optional trader information
    this._buyerNickname = data.buyerNickname || null;
    this._sellerNickname = data.sellerNickname || null;

    // Processing status
    this._processedAt = data.processedAt || null;
    this._processingMethod = data.processingMethod || null; // 'automatic' or 'manual'
    this._success = data.success !== undefined ? data.success : null;

    // Invoice information
    this._cae = data.cae ? CAE.of(data.cae) : null;
    this._voucherNumber = data.voucherNumber || null;
    this._invoiceDate = data.invoiceDate || null;

    // Error handling
    this._errorMessage = data.errorMessage || null;
    this._notes = data.notes || null;

    // Timestamps
    this._createdAt = data.createdAt || new Date();
    this._updatedAt = data.updatedAt || new Date();

    // Validate
    this._validate();

    // Freeze the object to ensure immutability
    Object.freeze(this);
  }

  /**
   * Validate order data
   * @private
   * @throws {ValidationError} If validation fails
   */
  _validate() {
    const errors = [];

    if (this._amount <= 0) {
      errors.push('Amount must be positive');
    }

    if (this._price <= 0) {
      errors.push('Price must be positive');
    }

    if (!['BUY', 'SELL'].includes(this._tradeType)) {
      errors.push('Trade type must be BUY or SELL');
    }

    if (this._createTime <= 0) {
      errors.push('Create time must be a valid timestamp');
    }

    if (this._processingMethod && !['automatic', 'manual'].includes(this._processingMethod)) {
      errors.push('Processing method must be automatic or manual');
    }

    if (errors.length > 0) {
      throw ValidationError.forField('order', errors.join(', '));
    }
  }

  // Getters
  get orderNumber() { return this._orderNumber; }
  get amount() { return this._amount; }
  get price() { return this._price; }
  get totalAmount() { return this._totalAmount; }
  get asset() { return this._asset; }
  get fiat() { return this._fiat; }
  get buyerNickname() { return this._buyerNickname; }
  get sellerNickname() { return this._sellerNickname; }
  get tradeType() { return this._tradeType; }
  get createTime() { return this._createTime; }
  get orderDate() { return this._orderDate; }
  get processedAt() { return this._processedAt; }
  get processingMethod() { return this._processingMethod; }
  get success() { return this._success; }
  get cae() { return this._cae; }
  get voucherNumber() { return this._voucherNumber; }
  get invoiceDate() { return this._invoiceDate; }
  get errorMessage() { return this._errorMessage; }
  get notes() { return this._notes; }
  get createdAt() { return this._createdAt; }
  get updatedAt() { return this._updatedAt; }

  /**
   * Check if order has been processed
   * @returns {boolean}
   */
  isProcessed() {
    return this._processedAt !== null;
  }

  /**
   * Check if order processing was successful
   * @returns {boolean}
   */
  isSuccessful() {
    return this._success === true;
  }

  /**
   * Check if order processing failed
   * @returns {boolean}
   */
  isFailed() {
    return this._success === false;
  }

  /**
   * Check if order is a SELL trade (invoice needed)
   * @returns {boolean}
   */
  isSellTrade() {
    return this._tradeType === 'SELL';
  }

  /**
   * Check if order is a BUY trade (no invoice needed)
   * @returns {boolean}
   */
  isBuyTrade() {
    return this._tradeType === 'BUY';
  }

  /**
   * Check if order can be processed (not yet processed and is a SELL trade)
   * @returns {boolean}
   */
  canBeProcessed() {
    return !this.isProcessed() && this.isSellTrade();
  }

  /**
   * Check if order is ready for invoicing
   * Based on AFIP 10-day rule: invoices must be created within 10 days
   * @returns {boolean}
   */
  isReadyForInvoicing() {
    if (!this.canBeProcessed()) {
      return false;
    }

    const orderDate = new Date(this._orderDate);
    const today = new Date();
    const daysDiff = Math.floor((today - orderDate) / (1000 * 60 * 60 * 24));

    // Can invoice within 10 days
    return daysDiff <= 10;
  }

  /**
   * Mark order as processed with result
   * @param {Object} result - Processing result
   * @param {boolean} result.success - Processing success status
   * @param {string} [result.cae] - CAE number if successful
   * @param {number} [result.voucherNumber] - Invoice voucher number
   * @param {string} [result.invoiceDate] - Invoice date (YYYY-MM-DD)
   * @param {string} [result.errorMessage] - Error message if failed
   * @param {string} processingMethod - 'automatic' or 'manual'
   * @returns {Order} New Order instance with updated status
   */
  markAsProcessed(result, processingMethod = 'automatic') {
    if (this.isProcessed()) {
      throw new DomainError('Order already processed');
    }

    return new Order({
      orderNumber: this._orderNumber.value,
      amount: this._amount,
      price: this._price,
      totalPrice: this._totalAmount.amount,
      asset: this._asset,
      fiat: this._fiat,
      buyerNickname: this._buyerNickname,
      sellerNickname: this._sellerNickname,
      tradeType: this._tradeType,
      createTime: this._createTime,
      orderDate: this._orderDate,
      processedAt: new Date(),
      processingMethod,
      success: result.success,
      cae: result.cae || null,
      voucherNumber: result.voucherNumber || null,
      invoiceDate: result.invoiceDate || null,
      errorMessage: result.errorMessage || null,
      notes: this._notes,
      createdAt: this._createdAt,
      updatedAt: new Date()
    });
  }

  /**
   * Add notes to the order
   * @param {string} notes - Notes to add
   * @returns {Order} New Order instance with notes
   */
  addNotes(notes) {
    return new Order({
      orderNumber: this._orderNumber.value,
      amount: this._amount,
      price: this._price,
      totalPrice: this._totalAmount.amount,
      asset: this._asset,
      fiat: this._fiat,
      buyerNickname: this._buyerNickname,
      sellerNickname: this._sellerNickname,
      tradeType: this._tradeType,
      createTime: this._createTime,
      orderDate: this._orderDate,
      processedAt: this._processedAt,
      processingMethod: this._processingMethod,
      success: this._success,
      cae: this._cae ? this._cae.value : null,
      voucherNumber: this._voucherNumber,
      invoiceDate: this._invoiceDate,
      errorMessage: this._errorMessage,
      notes: notes,
      createdAt: this._createdAt,
      updatedAt: new Date()
    });
  }

  /**
   * Calculate service period for invoice
   * For services, we need to specify service dates
   * @returns {{from: string, to: string}} Service period
   */
  getServicePeriod() {
    // Service period is the order date
    return {
      from: this._orderDate,
      to: this._orderDate
    };
  }

  /**
   * Convert to plain object (for persistence)
   * @returns {Object}
   */
  toJSON() {
    return {
      orderNumber: this._orderNumber.value,
      amount: this._amount,
      price: this._price,
      totalPrice: this._totalAmount.amount,
      asset: this._asset,
      fiat: this._fiat,
      buyerNickname: this._buyerNickname,
      sellerNickname: this._sellerNickname,
      tradeType: this._tradeType,
      createTime: this._createTime,
      orderDate: this._orderDate,
      processedAt: this._processedAt,
      processingMethod: this._processingMethod,
      success: this._success,
      cae: this._cae ? this._cae.value : null,
      voucherNumber: this._voucherNumber,
      invoiceDate: this._invoiceDate,
      errorMessage: this._errorMessage,
      notes: this._notes,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }

  /**
   * Create Order from plain object
   * @param {Object} data - Plain object data
   * @returns {Order}
   */
  static fromJSON(data) {
    return new Order(data);
  }

  /**
   * Check if two orders are equal
   * @param {Order} other - Order to compare
   * @returns {boolean}
   */
  equals(other) {
    if (!(other instanceof Order)) {
      return false;
    }
    return this._orderNumber.equals(other._orderNumber);
  }
}

module.exports = Order;
