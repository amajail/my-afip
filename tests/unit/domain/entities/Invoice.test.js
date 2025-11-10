/**
 * Invoice Entity Tests
 */

const Invoice = require('../../../../src/domain/entities/Invoice');
const Order = require('../../../../src/domain/entities/Order');
const Money = require('../../../../src/domain/value-objects/Money');
const CUIT = require('../../../../src/domain/value-objects/CUIT');
const OrderNumber = require('../../../../src/domain/value-objects/OrderNumber');
const { ValidationError } = require('../../../../src/shared/errors');

describe('Invoice Entity', () => {
  const today = new Date().toISOString().split('T')[0];

  const validInvoiceData = {
    orderNumber: 'ORDER-12345',
    netAmount: 100000,
    vatAmount: 0,
    totalAmount: 100000,
    currency: 'ARS',
    invoiceDate: today,
    concept: 2 // Services
  };

  describe('constructor', () => {
    test('should create Invoice with valid data', () => {
      const invoice = new Invoice(validInvoiceData);

      expect(invoice.orderNumber).toBeInstanceOf(OrderNumber);
      expect(invoice.netAmount).toBeInstanceOf(Money);
      expect(invoice.vatAmount).toBeInstanceOf(Money);
      expect(invoice.totalAmount).toBeInstanceOf(Money);
      expect(invoice.netAmount.amount).toBe(100000);
      expect(invoice.totalAmount.amount).toBe(100000);
      expect(invoice.concept).toBe(2);
    });

    test('should create Invoice with VAT', () => {
      const invoiceData = {
        ...validInvoiceData,
        netAmount: 100000,
        vatAmount: 21000,
        totalAmount: 121000
      };

      const invoice = new Invoice(invoiceData);

      expect(invoice.netAmount.amount).toBe(100000);
      expect(invoice.vatAmount.amount).toBe(21000);
      expect(invoice.totalAmount.amount).toBe(121000);
    });

    test('should create Invoice with CUIT', () => {
      const invoiceData = {
        ...validInvoiceData,
        clientCUIT: '20123456786'
      };

      const invoice = new Invoice(invoiceData);

      expect(invoice.clientCUIT).toBeInstanceOf(CUIT);
      expect(invoice.clientCUIT.value).toBe('20123456786');
    });

    test('should throw ValidationError for negative net amount', () => {
      const invalidData = { ...validInvoiceData, netAmount: -1000 };
      expect(() => new Invoice(invalidData)).toThrow(ValidationError);
    });

    test('should throw ValidationError for negative VAT', () => {
      const invalidData = { ...validInvoiceData, vatAmount: -100 };
      expect(() => new Invoice(invalidData)).toThrow(ValidationError);
    });

    test('should throw ValidationError for invalid total calculation', () => {
      const invalidData = {
        ...validInvoiceData,
        netAmount: 100000,
        vatAmount: 21000,
        totalAmount: 100000 // Should be 121000
      };
      expect(() => new Invoice(invalidData)).toThrow(ValidationError);
    });

    test('should throw error for inconsistent currencies', () => {
      const invalidData = {
        orderNumber: 'ORDER-123',
        netAmount: new Money(100000, 'ARS'),
        vatAmount: new Money(21000, 'USD'), // Different currency
        totalAmount: new Money(121000, 'ARS'),
        invoiceDate: today
      };
      expect(() => new Invoice(invalidData)).toThrow(); // Money will throw DomainError when adding different currencies
    });

    test('should throw ValidationError for invalid date format', () => {
      const invalidData = { ...validInvoiceData, invoiceDate: '01/01/2024' };
      expect(() => new Invoice(invalidData)).toThrow(ValidationError);
    });

    test('should throw ValidationError for future date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const invalidData = {
        ...validInvoiceData,
        invoiceDate: futureDate.toISOString().split('T')[0]
      };
      expect(() => new Invoice(invalidData)).toThrow(ValidationError);
    });

    test('should throw ValidationError for date older than 10 days', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 11);
      const invalidData = {
        ...validInvoiceData,
        invoiceDate: oldDate.toISOString().split('T')[0]
      };
      expect(() => new Invoice(invalidData)).toThrow(ValidationError);
    });

    test('should be immutable', () => {
      const invoice = new Invoice(validInvoiceData);
      const oldAmount = invoice.netAmount;
      invoice._netAmount = new Money(999, 'ARS'); // Attempt to mutate
      expect(invoice.netAmount).toBe(oldAmount); // Should remain unchanged
    });
  });

  describe('hasVAT', () => {
    test('should return false when VAT is zero', () => {
      const invoice = new Invoice(validInvoiceData);
      expect(invoice.hasVAT()).toBe(false);
    });

    test('should return true when VAT is present', () => {
      const invoiceData = {
        ...validInvoiceData,
        netAmount: 100000,
        vatAmount: 21000,
        totalAmount: 121000
      };
      const invoice = new Invoice(invoiceData);
      expect(invoice.hasVAT()).toBe(true);
    });
  });

  describe('getInvoiceType', () => {
    test('should return Type C (11) for no VAT', () => {
      const invoice = new Invoice(validInvoiceData);
      expect(invoice.getInvoiceType()).toBe(Invoice.Type.TYPE_C);
      expect(invoice.getInvoiceType()).toBe(11);
    });

    test('should return Type B (6) for with VAT', () => {
      const invoiceData = {
        ...validInvoiceData,
        netAmount: 100000,
        vatAmount: 21000,
        totalAmount: 121000
      };
      const invoice = new Invoice(invoiceData);
      expect(invoice.getInvoiceType()).toBe(Invoice.Type.TYPE_B);
      expect(invoice.getInvoiceType()).toBe(6);
    });
  });

  describe('isFinalConsumer', () => {
    test('should return true when no CUIT', () => {
      const invoice = new Invoice(validInvoiceData);
      expect(invoice.isFinalConsumer()).toBe(true);
    });

    test('should return false when CUIT is present', () => {
      const invoiceData = {
        ...validInvoiceData,
        clientCUIT: '20123456786'
      };
      const invoice = new Invoice(invoiceData);
      expect(invoice.isFinalConsumer()).toBe(false);
    });
  });

  describe('isServiceInvoice', () => {
    test('should return true for service concept', () => {
      const invoice = new Invoice({ ...validInvoiceData, concept: 2 });
      expect(invoice.isServiceInvoice()).toBe(true);
    });

    test('should return true for products and services concept', () => {
      const invoice = new Invoice({ ...validInvoiceData, concept: 3 });
      expect(invoice.isServiceInvoice()).toBe(true);
    });

    test('should return false for products only', () => {
      const invoice = new Invoice({ ...validInvoiceData, concept: 1 });
      expect(invoice.isServiceInvoice()).toBe(false);
    });
  });

  describe('getVATRate', () => {
    test('should return 0 for no VAT', () => {
      const invoice = new Invoice(validInvoiceData);
      expect(invoice.getVATRate()).toBe(0);
    });

    test('should calculate VAT rate correctly', () => {
      const invoiceData = {
        ...validInvoiceData,
        netAmount: 100000,
        vatAmount: 21000,
        totalAmount: 121000
      };
      const invoice = new Invoice(invoiceData);
      expect(invoice.getVATRate()).toBeCloseTo(0.21, 2);
    });
  });

  describe('toAFIPFormat', () => {
    test('should convert to AFIP format without VAT', () => {
      const invoice = new Invoice(validInvoiceData);
      const afipFormat = invoice.toAFIPFormat(1);

      expect(afipFormat.PtoVta).toBe(1);
      expect(afipFormat.CbteTipo).toBe(11); // Type C
      expect(afipFormat.Concepto).toBe(2);
      expect(afipFormat.DocTipo).toBe(99); // Sin Identificar
      expect(afipFormat.ImpTotal).toBe(100000);
      expect(afipFormat.ImpNeto).toBe(100000);
      expect(afipFormat.ImpIVA).toBe(0);
      expect(afipFormat.MonId).toBe('PES');
      expect(afipFormat.Iva).toBeUndefined();
    });

    test('should convert to AFIP format with VAT', () => {
      const invoiceData = {
        ...validInvoiceData,
        netAmount: 100000,
        vatAmount: 21000,
        totalAmount: 121000
      };
      const invoice = new Invoice(invoiceData);
      const afipFormat = invoice.toAFIPFormat(1);

      expect(afipFormat.CbteTipo).toBe(6); // Type B
      expect(afipFormat.ImpIVA).toBe(21000);
      expect(afipFormat.Iva).toBeDefined();
      expect(afipFormat.Iva[0].Id).toBe(5); // 21%
      expect(afipFormat.Iva[0].BaseImp).toBe(100000);
      expect(afipFormat.Iva[0].Importe).toBe(21000);
    });

    test('should include service dates for services', () => {
      const invoice = new Invoice(validInvoiceData);
      const afipFormat = invoice.toAFIPFormat(1);

      expect(afipFormat.FchServDesde).toBeDefined();
      expect(afipFormat.FchServHasta).toBeDefined();
      expect(afipFormat.FchVtoPago).toBeDefined();
    });

    test('should convert USD to DOL currency code', () => {
      const invoiceData = {
        ...validInvoiceData,
        currency: 'USD'
      };
      const invoice = new Invoice(invoiceData);
      const afipFormat = invoice.toAFIPFormat(1);

      expect(afipFormat.MonId).toBe('DOL');
    });
  });

  describe('toJSON', () => {
    test('should convert to plain object', () => {
      const invoice = new Invoice(validInvoiceData);
      const json = invoice.toJSON();

      expect(json.orderNumber).toBe('ORDER-12345');
      expect(json.netAmount).toBe(100000);
      expect(json.currency).toBe('ARS');
      expect(json.clientCUIT).toBeNull();
    });
  });

  describe('fromJSON', () => {
    test('should create Invoice from JSON', () => {
      const json = {
        orderNumber: 'ORDER-999',
        netAmount: 50000,
        vatAmount: 0,
        totalAmount: 50000,
        currency: 'ARS',
        invoiceDate: today,
        concept: 2
      };

      const invoice = Invoice.fromJSON(json);

      expect(invoice).toBeInstanceOf(Invoice);
      expect(invoice.orderNumber.value).toBe('ORDER-999');
    });
  });

  describe('fromOrder', () => {
    const orderData = {
      orderNumber: 'ORDER-12345',
      amount: 100.5,
      price: 450.75,
      totalPrice: 45300,
      asset: 'USDT',
      fiat: 'ARS',
      tradeType: 'SELL',
      createTime: Date.now(),
      orderDate: today
    };

    test('should create Invoice from Order without VAT', () => {
      const order = new Order(orderData);
      const invoice = Invoice.fromOrder(order);

      expect(invoice).toBeInstanceOf(Invoice);
      expect(invoice.orderNumber.value).toBe('ORDER-12345');
      expect(invoice.totalAmount.amount).toBe(45300);
      expect(invoice.vatAmount.amount).toBe(0);
      expect(invoice.concept).toBe(Invoice.Concept.SERVICES);
    });

    test('should create Invoice from Order with VAT', () => {
      const order = new Order(orderData);
      const invoice = Invoice.fromOrder(order, { includeVAT: true, vatRate: 0.21 });

      expect(invoice.hasVAT()).toBe(true);
      expect(invoice.getVATRate()).toBeCloseTo(0.21, 2);
      const calculatedTotal = invoice.netAmount.add(invoice.vatAmount);
      expect(calculatedTotal.amount).toBeCloseTo(45300, 0);
    });

    test('should use custom invoice date if provided', () => {
      const order = new Order(orderData);
      // Use a date within the last 10 days (AFIP rule)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 2);
      const customDate = recentDate.toISOString().split('T')[0];
      const invoice = Invoice.fromOrder(order, { invoiceDate: customDate });

      expect(invoice.invoiceDate).toBe(customDate);
    });
  });

  describe('constants', () => {
    test('should have Concept constants', () => {
      expect(Invoice.Concept.PRODUCTS).toBe(1);
      expect(Invoice.Concept.SERVICES).toBe(2);
      expect(Invoice.Concept.PRODUCTS_AND_SERVICES).toBe(3);
    });

    test('should have Type constants', () => {
      expect(Invoice.Type.TYPE_B).toBe(6);
      expect(Invoice.Type.TYPE_C).toBe(11);
    });

    test('should have DocumentType constants', () => {
      expect(Invoice.DocumentType.CUIT).toBe(80);
      expect(Invoice.DocumentType.DNI).toBe(96);
      expect(Invoice.DocumentType.SIN_IDENTIFICAR).toBe(99);
    });
  });
});
