const config = require('../config');
const { InvoiceValidator } = require('../utils/validators');

/**
 * @typedef {Object} InvoiceData
 * @property {number} [docType=11] - Document type (80=CUIT, 96=DNI, 99=Sin Identificar)
 * @property {string} [docNumber] - Document number (CUIT/DNI)
 * @property {string} docDate - Invoice date (YYYY-MM-DD format)
 * @property {number} [concept=1] - Invoice concept (1=Products, 2=Services, 3=Both)
 * @property {string} [currency='PES'] - Currency code (PES, DOL, EUR)
 * @property {number} [exchange=1] - Exchange rate
 * @property {number} netAmount - Net amount (before VAT)
 * @property {number} totalAmount - Total amount (including VAT)
 * @property {number} [vatAmount=0] - VAT amount
 * @property {string} [serviceFrom] - Service start date (required for concept 2 or 3)
 * @property {string} [serviceTo] - Service end date (required for concept 2 or 3)
 * @property {string} [dueDate] - Payment due date (required for concept 2 or 3)
 * @property {Array<Object>} [taxes=[]] - Additional taxes
 * @property {Array<Object>} [associatedDocs=[]] - Associated documents
 * @property {string} [orderNumber] - Associated Binance order number
 */

/**
 * @typedef {Object} AfipInvoiceFormat
 * @property {number} CantReg - Number of records (always 1)
 * @property {number} PtoVta - Point of sale number
 * @property {number} CbteTipo - Invoice type (6=Type B, 11=Type C)
 * @property {number} Concepto - Concept (1=Products, 2=Services, 3=Both)
 * @property {number} DocTipo - Document type
 * @property {string|number} DocNro - Document number
 * @property {number} CbteDesde - Invoice number from
 * @property {number} CbteHasta - Invoice number to
 * @property {string} CbteFch - Invoice date (YYYYMMDD)
 * @property {number} ImpTotal - Total amount
 * @property {number} ImpTotConc - Non-taxable amount
 * @property {number} ImpNeto - Net amount
 * @property {number} ImpOpEx - Exempt amount
 * @property {number} ImpIVA - VAT amount
 * @property {number} ImpTrib - Tributes amount
 * @property {string} MonId - Currency code
 * @property {number} MonCotiz - Exchange rate
 * @property {number} CondicionIVAReceptorId - VAT condition of receiver
 * @property {string} [FchServDesde] - Service start date (YYYYMMDD)
 * @property {string} [FchServHasta] - Service end date (YYYYMMDD)
 * @property {string} [FchVtoPago] - Payment due date (YYYYMMDD)
 * @property {Array<Object>} [Iva] - VAT breakdown (for Type B invoices)
 */

/**
 * Invoice model for AFIP electronic invoicing
 *
 * Represents an invoice that can be submitted to AFIP for authorization.
 * Supports both Type C (Monotributista - no VAT) and Type B (with VAT) invoices.
 *
 * @class
 */
class Invoice {
  /**
   * Creates a new Invoice instance
   *
   * @param {InvoiceData} data - Invoice data
   * @throws {ValidationError} If invoice data is invalid (when validateOrThrow is called)
   *
   * @example
   * const invoice = new Invoice({
   *   docDate: '2025-01-15',
   *   concept: 2,
   *   netAmount: 100000,
   *   totalAmount: 100000,
   *   vatAmount: 0
   * });
   */
  constructor(data) {
    /** @type {number} - Document type (80=CUIT, 96=DNI, 99=Sin Identificar) */
    this.docType = data.docType || 11;

    /** @type {string|undefined} - Document number (CUIT/DNI) */
    this.docNumber = data.docNumber;

    /** @type {string} - Invoice date (YYYY-MM-DD format) */
    this.docDate = data.docDate;

    /** @type {number} - Invoice concept (1=Products, 2=Services, 3=Both) */
    this.concept = data.concept || 1;

    /** @type {string} - Currency code (PES, DOL, EUR) */
    this.currency = data.currency || 'PES';

    /** @type {number} - Exchange rate */
    this.exchange = data.exchange || 1;

    /** @type {number} - Net amount (before VAT) */
    this.netAmount = parseFloat(data.netAmount);

    /** @type {number} - Total amount (including VAT) */
    this.totalAmount = parseFloat(data.totalAmount);

    /** @type {number} - VAT amount */
    this.vatAmount = parseFloat(data.vatAmount || 0);

    /** @type {string|undefined} - Service start date (required for concept 2 or 3) */
    this.serviceFrom = data.serviceFrom;

    /** @type {string|undefined} - Service end date (required for concept 2 or 3) */
    this.serviceTo = data.serviceTo;

    /** @type {string|undefined} - Payment due date (required for concept 2 or 3) */
    this.dueDate = data.dueDate;

    /** @type {Array<Object>} - Additional taxes */
    this.taxes = data.taxes || [];

    /** @type {Array<Object>} - Associated documents */
    this.associatedDocs = data.associatedDocs || [];

    /** @type {string|undefined} - Associated Binance order number */
    this.orderNumber = data.orderNumber;
  }

  /**
   * Validates the invoice data
   *
   * @returns {{isValid: boolean, errors: string[]}} Validation result
   *
   * @example
   * const validation = invoice.validate();
   * if (!validation.isValid) {
   *   console.error('Validation errors:', validation.errors);
   * }
   */
  validate() {
    // Use comprehensive InvoiceValidator
    const result = InvoiceValidator.validate(this);

    return {
      isValid: result.valid,
      errors: result.errors
    };
  }

  /**
   * Validates the invoice data and throws an error if invalid
   *
   * @throws {ValidationError} If invoice data is invalid
   *
   * @example
   * try {
   *   invoice.validateOrThrow();
   * } catch (error) {
   *   console.error('Invalid invoice:', error.message);
   * }
   */
  validateOrThrow() {
    InvoiceValidator.validateOrThrow(this);
  }

  /**
   * Converts the invoice to AFIP's required format
   *
   * Automatically determines invoice type:
   * - Type C (11) for Monotributista (no VAT)
   * - Type B (6) for invoices with VAT
   *
   * @returns {AfipInvoiceFormat} Invoice in AFIP format
   *
   * @example
   * const afipData = invoice.toAfipFormat();
   * console.log(afipData.CbteTipo); // 11 for Type C, 6 for Type B
   */
  toAfipFormat() {
    // Monotributistas use Type C (11) for no VAT, Type B (6) for with VAT
    const invoiceType = this.vatAmount > 0 ? 6 : 11;
    
    const baseInvoice = {
      CantReg: 1,
      PtoVta: config.afip.ptoVta, // Point of Sale from centralized config
      CbteTipo: invoiceType, // Factura C (11) for Monotributista, B (6) for others
      Concepto: this.concept,
      DocTipo: this.docNumber ? this.docType : 99, // 99 for "Sin Identificar" (unidentified)
      DocNro: this.docNumber || 0, // 0 for consumer without identification
      CbteDesde: 1,
      CbteHasta: 1,
      CbteFch: this.formatDate(this.docDate),
      ImpTotal: this.totalAmount,
      ImpTotConc: 0,
      ImpNeto: this.netAmount,
      ImpOpEx: 0,
      ImpIVA: this.vatAmount,
      ImpTrib: 0,
      MonId: this.currency,
      MonCotiz: this.exchange,
      // Required for Resolution 5616 - VAT condition of receiver
      CondicionIVAReceptorId: 5 // Consumidor Final (most common)
    };

    // Add service dates only for services (Concept 2 or 3)
    if (this.concept === 2 || this.concept === 3) {
      baseInvoice.FchServDesde = this.serviceFrom ? this.formatDate(this.serviceFrom) : this.formatDate(this.docDate);
      baseInvoice.FchServHasta = this.serviceTo ? this.formatDate(this.serviceTo) : this.formatDate(this.docDate);
      baseInvoice.FchVtoPago = this.dueDate ? this.formatDate(this.dueDate) : this.formatDate(this.docDate);
    }

    // For Type C invoices (Monotributista - no VAT), don't include IVA array
    if (invoiceType === 11) {
      // Type C - No VAT breakdown needed
      return baseInvoice;
    } else {
      // Type B - Include VAT breakdown
      return {
        ...baseInvoice,
        Iva: [{
          Id: 5, // 21%
          BaseImp: this.netAmount,
          Importe: this.vatAmount
        }]
      };
    }
  }

  /**
   * Formats a date to AFIP's required format (YYYYMMDD)
   *
   * @param {string|Date} dateStr - Date to format (ISO string or Date object)
   * @returns {string} Date in YYYYMMDD format
   *
   * @example
   * invoice.formatDate('2025-01-15'); // Returns '20250115'
   * invoice.formatDate(new Date()); // Returns current date as '20250115'
   */
  formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.getFullYear().toString() +
           (date.getMonth() + 1).toString().padStart(2, '0') +
           date.getDate().toString().padStart(2, '0');
  }
}

module.exports = Invoice;