const config = require('../config');

class Invoice {
  constructor(data) {
    this.docType = data.docType || 11; // CUIT
    this.docNumber = data.docNumber;
    this.docDate = data.docDate;
    this.concept = data.concept || 1; // Productos
    this.currency = data.currency || 'PES';
    this.exchange = data.exchange || 1;
    this.netAmount = parseFloat(data.netAmount);
    this.totalAmount = parseFloat(data.totalAmount);
    this.vatAmount = parseFloat(data.vatAmount || 0);
    this.serviceFrom = data.serviceFrom;
    this.serviceTo = data.serviceTo;
    this.dueDate = data.dueDate;
    this.taxes = data.taxes || [];
    this.associatedDocs = data.associatedDocs || [];
  }

  validate() {
    const errors = [];

    if (!this.docDate) errors.push('Document date is required');
    if (!this.netAmount || this.netAmount <= 0) errors.push('Net amount must be greater than 0');
    if (!this.totalAmount || this.totalAmount <= 0) errors.push('Total amount must be greater than 0');

    return {
      isValid: errors.length === 0,
      errors
    };
  }

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

  formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.getFullYear().toString() +
           (date.getMonth() + 1).toString().padStart(2, '0') +
           date.getDate().toString().padStart(2, '0');
  }
}

module.exports = Invoice;