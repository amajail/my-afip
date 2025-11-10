/**
 * Invoice Entity (Aggregate Root)
 *
 * Represents an AFIP invoice in the domain model.
 * Encapsulates business logic for invoice creation and validation.
 * Following DDD principles with rich domain behavior.
 */

const Money = require('../value-objects/Money');
const CUIT = require('../value-objects/CUIT');
const OrderNumber = require('../value-objects/OrderNumber');
const { ValidationError, DomainError } = require('../../shared/errors');

/**
 * Invoice concepts (AFIP)
 */
const InvoiceConcept = {
  PRODUCTS: 1,
  SERVICES: 2,
  PRODUCTS_AND_SERVICES: 3
};

/**
 * Invoice types (AFIP)
 */
const InvoiceType = {
  TYPE_B: 6,  // With VAT breakdown
  TYPE_C: 11  // Monotributista - no VAT
};

/**
 * Document types (AFIP)
 */
const DocumentType = {
  CUIT: 80,
  CUIL: 86,
  CDI: 87,
  LE: 89,
  LC: 90,
  CI_EXTRANJERA: 91,
  EN_TRAMITE: 92,
  ACTA_NACIMIENTO: 93,
  CI_BS_AS: 95,
  DNI: 96,
  PASAPORTE: 94,
  SIN_IDENTIFICAR: 99
};

/**
 * @typedef {Object} InvoiceData
 * @property {OrderNumber|string} orderNumber - Associated order number
 * @property {Money|number} netAmount - Net amount (before VAT)
 * @property {Money|number} vatAmount - VAT amount
 * @property {Money|number} totalAmount - Total amount (including VAT)
 * @property {string} currency - Currency code ('ARS' or 'USD')
 * @property {string} invoiceDate - Invoice date (YYYY-MM-DD)
 * @property {number} [concept=2] - Invoice concept (1=Products, 2=Services, 3=Both)
 * @property {CUIT|string} [clientCUIT] - Client's CUIT (optional for consumer)
 * @property {number} [docType] - Document type if not CUIT
 * @property {string} [docNumber] - Document number if not CUIT
 * @property {string} [serviceFrom] - Service start date
 * @property {string} [serviceTo] - Service end date
 * @property {string} [dueDate] - Payment due date
 */

/**
 * Invoice entity represents an AFIP electronic invoice
 */
class Invoice {
  /**
   * Create an Invoice instance
   * @param {InvoiceData} data - Invoice data
   * @throws {ValidationError} If invoice data is invalid
   */
  constructor(data) {
    // Order reference
    this._orderNumber = data.orderNumber instanceof OrderNumber
      ? data.orderNumber
      : OrderNumber.of(data.orderNumber);

    // Amounts as Money value objects
    const currency = data.currency || 'ARS';
    this._netAmount = data.netAmount instanceof Money
      ? data.netAmount
      : new Money(parseFloat(data.netAmount), currency);

    this._vatAmount = data.vatAmount instanceof Money
      ? data.vatAmount
      : new Money(parseFloat(data.vatAmount || 0), currency);

    this._totalAmount = data.totalAmount instanceof Money
      ? data.totalAmount
      : new Money(parseFloat(data.totalAmount), currency);

    // Invoice metadata
    this._invoiceDate = data.invoiceDate;
    this._concept = data.concept || InvoiceConcept.SERVICES;

    // Client identification (optional for final consumer)
    this._clientCUIT = data.clientCUIT
      ? (data.clientCUIT instanceof CUIT ? data.clientCUIT : CUIT.of(data.clientCUIT))
      : null;
    this._docType = data.docType || (this._clientCUIT ? DocumentType.CUIT : DocumentType.SIN_IDENTIFICAR);
    this._docNumber = data.docNumber || (this._clientCUIT ? this._clientCUIT.value : null);

    // Service dates (required for services)
    this._serviceFrom = data.serviceFrom || this._invoiceDate;
    this._serviceTo = data.serviceTo || this._invoiceDate;
    this._dueDate = data.dueDate || this._invoiceDate;

    // Timestamps
    this._createdAt = data.createdAt || new Date();

    // Validate
    this._validate();

    // Freeze the object to ensure immutability
    Object.freeze(this);
  }

  /**
   * Validate invoice data
   * @private
   * @throws {ValidationError} If validation fails
   */
  _validate() {
    const errors = [];

    // Validate amounts
    if (this._netAmount.amount <= 0) {
      errors.push('Net amount must be positive');
    }

    if (this._vatAmount.amount < 0) {
      errors.push('VAT amount cannot be negative');
    }

    if (this._totalAmount.amount <= 0) {
      errors.push('Total amount must be positive');
    }

    // Validate currency consistency
    if (this._netAmount.currency !== this._totalAmount.currency ||
        this._vatAmount.currency !== this._totalAmount.currency) {
      errors.push('All amounts must be in the same currency');
    }

    // Validate amount calculation
    const calculatedTotal = this._netAmount.add(this._vatAmount);
    if (Math.abs(calculatedTotal.amount - this._totalAmount.amount) > 0.01) {
      errors.push('Total amount must equal net amount plus VAT amount');
    }

    // Validate invoice date
    if (!this._invoiceDate || !/^\d{4}-\d{2}-\d{2}$/.test(this._invoiceDate)) {
      errors.push('Invoice date must be in YYYY-MM-DD format');
    }

    // Validate invoice date is within AFIP's 10-day rule
    const invoiceDate = new Date(this._invoiceDate);
    const today = new Date();
    const daysDiff = Math.floor((today - invoiceDate) / (1000 * 60 * 60 * 24));

    if (daysDiff < 0) {
      errors.push('Invoice date cannot be in the future');
    }

    if (daysDiff > 10) {
      errors.push('Invoice date must be within the last 10 days (AFIP regulation)');
    }

    // Validate concept
    if (![InvoiceConcept.PRODUCTS, InvoiceConcept.SERVICES, InvoiceConcept.PRODUCTS_AND_SERVICES].includes(this._concept)) {
      errors.push('Invalid invoice concept');
    }

    // Validate service dates for services
    if (this._concept === InvoiceConcept.SERVICES || this._concept === InvoiceConcept.PRODUCTS_AND_SERVICES) {
      if (!this._serviceFrom || !this._serviceTo || !this._dueDate) {
        errors.push('Service dates are required for service invoices');
      }
    }

    if (errors.length > 0) {
      throw ValidationError.forField('invoice', errors.join(', '));
    }
  }

  // Getters
  get orderNumber() { return this._orderNumber; }
  get netAmount() { return this._netAmount; }
  get vatAmount() { return this._vatAmount; }
  get totalAmount() { return this._totalAmount; }
  get invoiceDate() { return this._invoiceDate; }
  get concept() { return this._concept; }
  get clientCUIT() { return this._clientCUIT; }
  get docType() { return this._docType; }
  get docNumber() { return this._docNumber; }
  get serviceFrom() { return this._serviceFrom; }
  get serviceTo() { return this._serviceTo; }
  get dueDate() { return this._dueDate; }
  get createdAt() { return this._createdAt; }

  /**
   * Check if invoice has VAT
   * @returns {boolean}
   */
  hasVAT() {
    return this._vatAmount.amount > 0;
  }

  /**
   * Get invoice type (B or C) based on VAT
   * @returns {number} Invoice type code
   */
  getInvoiceType() {
    return this.hasVAT() ? InvoiceType.TYPE_B : InvoiceType.TYPE_C;
  }

  /**
   * Check if invoice is for a final consumer (no CUIT)
   * @returns {boolean}
   */
  isFinalConsumer() {
    return this._clientCUIT === null;
  }

  /**
   * Check if invoice is for services
   * @returns {boolean}
   */
  isServiceInvoice() {
    return this._concept === InvoiceConcept.SERVICES ||
           this._concept === InvoiceConcept.PRODUCTS_AND_SERVICES;
  }

  /**
   * Get the VAT rate applied
   * @returns {number} VAT rate (e.g., 0.21 for 21%)
   */
  getVATRate() {
    if (!this.hasVAT()) {
      return 0;
    }
    return this._vatAmount.amount / this._netAmount.amount;
  }

  /**
   * Convert to AFIP format (for submission)
   * @param {number} pointOfSale - AFIP point of sale number
   * @returns {Object} Invoice in AFIP format
   */
  toAFIPFormat(pointOfSale) {
    const invoiceType = this.getInvoiceType();
    const afipCurrency = this._totalAmount.currency === 'ARS' ? 'PES' : 'DOL';

    const baseInvoice = {
      CantReg: 1,
      PtoVta: pointOfSale,
      CbteTipo: invoiceType,
      Concepto: this._concept,
      DocTipo: this._docType,
      DocNro: this._docNumber || 0,
      CbteDesde: 1,
      CbteHasta: 1,
      CbteFch: this._formatDateForAFIP(this._invoiceDate),
      ImpTotal: this._totalAmount.amount,
      ImpTotConc: 0,
      ImpNeto: this._netAmount.amount,
      ImpOpEx: 0,
      ImpIVA: this._vatAmount.amount,
      ImpTrib: 0,
      MonId: afipCurrency,
      MonCotiz: 1,
      CondicionIVAReceptorId: 5 // Consumidor Final (most common)
    };

    // Add service dates for services
    if (this.isServiceInvoice()) {
      baseInvoice.FchServDesde = this._formatDateForAFIP(this._serviceFrom);
      baseInvoice.FchServHasta = this._formatDateForAFIP(this._serviceTo);
      baseInvoice.FchVtoPago = this._formatDateForAFIP(this._dueDate);
    }

    // Add VAT breakdown for Type B invoices
    if (invoiceType === InvoiceType.TYPE_B) {
      baseInvoice.Iva = [{
        Id: 5, // 21% VAT
        BaseImp: this._netAmount.amount,
        Importe: this._vatAmount.amount
      }];
    }

    return baseInvoice;
  }

  /**
   * Format date for AFIP (YYYYMMDD)
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {string} Date in YYYYMMDD format
   * @private
   */
  _formatDateForAFIP(dateStr) {
    return dateStr.replace(/-/g, '');
  }

  /**
   * Convert to plain object (for persistence)
   * @returns {Object}
   */
  toJSON() {
    return {
      orderNumber: this._orderNumber.value,
      netAmount: this._netAmount.amount,
      vatAmount: this._vatAmount.amount,
      totalAmount: this._totalAmount.amount,
      currency: this._totalAmount.currency,
      invoiceDate: this._invoiceDate,
      concept: this._concept,
      clientCUIT: this._clientCUIT ? this._clientCUIT.value : null,
      docType: this._docType,
      docNumber: this._docNumber,
      serviceFrom: this._serviceFrom,
      serviceTo: this._serviceTo,
      dueDate: this._dueDate,
      createdAt: this._createdAt
    };
  }

  /**
   * Create Invoice from plain object
   * @param {Object} data - Plain object data
   * @returns {Invoice}
   */
  static fromJSON(data) {
    return new Invoice(data);
  }

  /**
   * Create Invoice from Order
   * @param {Order} order - Order entity
   * @param {Object} options - Additional options
   * @param {boolean} [options.includeVAT=false] - Whether to include VAT
   * @param {number} [options.vatRate=0.21] - VAT rate (default 21%)
   * @param {string} [options.invoiceDate] - Override invoice date
   * @returns {Invoice}
   */
  static fromOrder(order, options = {}) {
    const includeVAT = options.includeVAT || false;
    const vatRate = options.vatRate || 0.21;
    const invoiceDate = options.invoiceDate || order.orderDate;

    const totalAmount = order.totalAmount;
    const netAmount = includeVAT
      ? totalAmount.divide(1 + vatRate)
      : totalAmount;
    const vatAmount = includeVAT
      ? totalAmount.subtract(netAmount)
      : new Money(0, totalAmount.currency);

    const servicePeriod = order.getServicePeriod();

    return new Invoice({
      orderNumber: order.orderNumber,
      netAmount: netAmount,
      vatAmount: vatAmount,
      totalAmount: totalAmount,
      currency: totalAmount.currency,
      invoiceDate: invoiceDate,
      concept: InvoiceConcept.SERVICES, // Crypto trading is a service
      serviceFrom: servicePeriod.from,
      serviceTo: servicePeriod.to,
      dueDate: servicePeriod.to
    });
  }
}

// Export constants
Invoice.Concept = InvoiceConcept;
Invoice.Type = InvoiceType;
Invoice.DocumentType = DocumentType;

module.exports = Invoice;
