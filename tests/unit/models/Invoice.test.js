const Invoice = require('../../../src/models/Invoice');
const MockFactory = require('../../helpers/mock-factory');
const AssertionHelpers = require('../../helpers/assertion-helpers');

describe('Invoice Model', () => {
  describe('constructor', () => {
    it('should create invoice with default values', () => {
      const invoice = new Invoice({
        docDate: '2025-09-24',
        netAmount: 1000,
        totalAmount: 1000
      });

      expect(invoice.docType).toBe(11); // Default to Type C
      expect(invoice.concept).toBe(1); // Default to Products
      expect(invoice.currency).toBe('PES');
      expect(invoice.exchange).toBe(1);
      expect(invoice.vatAmount).toBe(0);
    });

    it('should create invoice with custom values', () => {
      const invoiceData = {
        docType: 6,
        docNumber: '12345678',
        docDate: '2025-09-24',
        concept: 2,
        currency: 'USD',
        exchange: 1000,
        netAmount: 1000,
        totalAmount: 1210,
        vatAmount: 210,
        serviceFrom: '2025-09-01',
        serviceTo: '2025-09-30',
        dueDate: '2025-10-24'
      };

      const invoice = new Invoice(invoiceData);

      expect(invoice.docType).toBe(6);
      expect(invoice.docNumber).toBe('12345678');
      expect(invoice.concept).toBe(2);
      expect(invoice.currency).toBe('USD');
      expect(invoice.exchange).toBe(1000);
      expect(invoice.netAmount).toBe(1000);
      expect(invoice.totalAmount).toBe(1210);
      expect(invoice.vatAmount).toBe(210);
      expect(invoice.serviceFrom).toBe('2025-09-01');
      expect(invoice.serviceTo).toBe('2025-09-30');
      expect(invoice.dueDate).toBe('2025-10-24');
    });

    it('should handle string amounts', () => {
      const invoice = new Invoice({
        docDate: '2025-09-24',
        netAmount: '1000.50',
        totalAmount: '1000.50',
        vatAmount: '0.00'
      });

      expect(invoice.netAmount).toBe(1000.50);
      expect(invoice.totalAmount).toBe(1000.50);
      expect(invoice.vatAmount).toBe(0);
    });
  });

  describe('validate', () => {
    it('should validate correct invoice', () => {
      const invoice = new Invoice({
        docDate: '2025-09-24',
        netAmount: 1000,
        totalAmount: 1000
      });

      const validation = invoice.validate();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should require document date', () => {
      const invoice = new Invoice({
        netAmount: 1000,
        totalAmount: 1000
      });

      const validation = invoice.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Document date is required');
    });

    it('should require positive net amount', () => {
      const invoice = new Invoice({
        docDate: '2025-09-24',
        netAmount: 0,
        totalAmount: 1000
      });

      const validation = invoice.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Net amount must be greater than 0');
    });

    it('should require positive total amount', () => {
      const invoice = new Invoice({
        docDate: '2025-09-24',
        netAmount: 1000,
        totalAmount: -100
      });

      const validation = invoice.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Total amount must be greater than 0');
    });

    it('should collect multiple validation errors', () => {
      const invoice = new Invoice({
        netAmount: -100,
        totalAmount: 0
      });

      const validation = invoice.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(3); // Missing date, invalid net, invalid total
    });
  });

  describe('toAfipFormat', () => {
    it('should generate Type C (11) format for monotributista', () => {
      const invoice = new Invoice({
        docDate: '2025-09-24',
        netAmount: 120000,
        totalAmount: 120000,
        vatAmount: 0
      });

      const afipFormat = invoice.toAfipFormat();

      AssertionHelpers.expectValidAfipInvoiceFormat(afipFormat);
      expect(afipFormat.CbteTipo).toBe(11); // Type C
      expect(afipFormat.DocTipo).toBe(99); // Sin Identificar
      expect(afipFormat.DocNro).toBe(0);
      expect(afipFormat.ImpTotal).toBe(120000);
      expect(afipFormat.ImpNeto).toBe(120000);
      expect(afipFormat.ImpIVA).toBe(0);
      expect(afipFormat.CbteFch).toBeValidAfipDate();
      expect(afipFormat.Concepto).toBe(1);
      expect(afipFormat.MonId).toBe('PES');
      expect(afipFormat.MonCotiz).toBe(1);
      expect(afipFormat.CondicionIVAReceptorId).toBe(5); // Consumidor Final
    });

    it('should generate Type B (6) format with VAT', () => {
      const invoice = new Invoice({
        docType: 80, // CUIT
        docNumber: '20123456789',
        docDate: '2025-09-24',
        netAmount: 100000,
        totalAmount: 121000,
        vatAmount: 21000
      });

      const afipFormat = invoice.toAfipFormat();

      expect(afipFormat.CbteTipo).toBe(6); // Type B
      expect(afipFormat.DocTipo).toBe(80); // CUIT
      expect(afipFormat.DocNro).toBe('20123456789');
      expect(afipFormat.ImpTotal).toBe(121000);
      expect(afipFormat.ImpNeto).toBe(100000);
      expect(afipFormat.ImpIVA).toBe(21000);
      expect(afipFormat.Iva).toEqual([{
        Id: 5, // 21%
        BaseImp: 100000,
        Importe: 21000
      }]);
    });

    it('should include service dates for services concept', () => {
      const invoice = new Invoice({
        docDate: '2025-09-24',
        concept: 2, // Services
        serviceFrom: '2025-09-01',
        serviceTo: '2025-09-30',
        dueDate: '2025-10-24',
        netAmount: 50000,
        totalAmount: 50000
      });

      const afipFormat = invoice.toAfipFormat();

      expect(afipFormat.Concepto).toBe(2);
      expect(afipFormat.FchServDesde).toBe('20250901');
      expect(afipFormat.FchServHasta).toBe('20250930');
      expect(afipFormat.FchVtoPago).toBe('20251024');
    });

    it('should use document date as default for service dates', () => {
      const invoice = new Invoice({
        docDate: '2025-09-24',
        concept: 2, // Services
        netAmount: 50000,
        totalAmount: 50000
      });

      const afipFormat = invoice.toAfipFormat();

      expect(afipFormat.FchServDesde).toBe('20250924');
      expect(afipFormat.FchServHasta).toBe('20250924');
      expect(afipFormat.FchVtoPago).toBe('20250924');
    });

    it('should not include service dates for products concept', () => {
      const invoice = new Invoice({
        docDate: '2025-09-24',
        concept: 1, // Products
        netAmount: 50000,
        totalAmount: 50000
      });

      const afipFormat = invoice.toAfipFormat();

      expect(afipFormat.Concepto).toBe(1);
      expect(afipFormat.FchServDesde).toBeUndefined();
      expect(afipFormat.FchServHasta).toBeUndefined();
      expect(afipFormat.FchVtoPago).toBeUndefined();
    });

    it('should handle mixed products and services concept', () => {
      const invoice = new Invoice({
        docDate: '2025-09-24',
        concept: 3, // Products and Services
        serviceFrom: '2025-09-01',
        serviceTo: '2025-09-30',
        netAmount: 50000,
        totalAmount: 50000
      });

      const afipFormat = invoice.toAfipFormat();

      expect(afipFormat.Concepto).toBe(3);
      expect(afipFormat.FchServDesde).toBe('20250901');
      expect(afipFormat.FchServHasta).toBe('20250930');
    });
  });

  describe('formatDate', () => {
    it('should format date correctly for AFIP', () => {
      const invoice = new Invoice({
        docDate: '2025-09-24',
        netAmount: 1000,
        totalAmount: 1000
      });

      const formatted = invoice.formatDate('2025-09-24');
      expect(formatted).toBe('20250924');
      expect(formatted).toBeValidAfipDate();
    });

    it('should handle Date objects', () => {
      const invoice = new Invoice({
        docDate: '2025-09-24',
        netAmount: 1000,
        totalAmount: 1000
      });

      const date = new Date('2025-09-24');
      const formatted = invoice.formatDate(date);
      expect(formatted).toBe('20250924');
    });

    it('should handle different date formats', () => {
      const invoice = new Invoice({
        docDate: '2025-09-24',
        netAmount: 1000,
        totalAmount: 1000
      });

      expect(invoice.formatDate('2025-01-05')).toBe('20250105');
      expect(invoice.formatDate('2025-12-31')).toBe('20251231');
    });
  });

  describe('edge cases', () => {
    it('should handle decimal precision correctly', () => {
      const invoice = new Invoice({
        docDate: '2025-09-24',
        netAmount: 1234.567, // Should be handled properly
        totalAmount: 1234.567,
        vatAmount: 0.123
      });

      expect(invoice.netAmount).toBe(1234.567);
      expect(invoice.totalAmount).toBe(1234.567);
      expect(invoice.vatAmount).toBe(0.123);
    });

    it('should handle large amounts', () => {
      const invoice = new Invoice({
        docDate: '2025-09-24',
        netAmount: 999999999.99,
        totalAmount: 999999999.99
      });

      const afipFormat = invoice.toAfipFormat();
      expect(afipFormat.ImpTotal).toBe(999999999.99);
      expect(afipFormat.ImpNeto).toBe(999999999.99);
    });

    it('should handle undefined optional fields', () => {
      const invoice = new Invoice({
        docDate: '2025-09-24',
        netAmount: 1000,
        totalAmount: 1000
      });

      expect(() => invoice.toAfipFormat()).not.toThrow();
    });
  });
});