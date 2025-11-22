/**
 * Comprehensive Domain Layer Tests
 * Tests domain services and events
 */

const { InvoiceCalculator, InvoiceDateValidator, OrderProcessor } = require('../../../src/domain/services');
const { InvoiceCreated, OrderProcessed } = require('../../../src/domain/events');
const Money = require('../../../src/domain/value-objects/Money');
const Order = require('../../../src/domain/entities/Order');
const { ValidationError, DomainError } = require('../../../src/shared/errors');

describe('Domain Services', () => {
  describe('InvoiceCalculator', () => {
    test('should calculate VAT correctly', () => {
      const netAmount = new Money(100, 'ARS');
      const vat = InvoiceCalculator.calculateVAT(netAmount, 0.21);

      expect(vat.amount).toBe(21);
      expect(vat.currency).toBe('ARS');
    });

    test('should calculate total from net and VAT', () => {
      const net = new Money(100, 'ARS');
      const vat = new Money(21, 'ARS');
      const total = InvoiceCalculator.calculateTotal(net, vat);

      expect(total.amount).toBe(121);
    });

    test('should calculate net from total with VAT', () => {
      const total = new Money(121, 'ARS');
      const net = InvoiceCalculator.calculateNetFromTotal(total, 0.21);

      expect(net.amount).toBeCloseTo(100, 2);
    });

    test('should split total into net and VAT', () => {
      const total = new Money(121, 'ARS');
      const split = InvoiceCalculator.splitTotal(total, 0.21);

      expect(split.net.amount).toBeCloseTo(100, 2);
      expect(split.vat.amount).toBeCloseTo(21, 2);
      expect(split.total).toBe(total);
    });

    test('should validate amounts consistency', () => {
      const net = new Money(100, 'ARS');
      const vat = new Money(21, 'ARS');
      const total = new Money(121, 'ARS');

      expect(InvoiceCalculator.validateAmounts(net, vat, total)).toBe(true);
    });

    test('should round amounts correctly', () => {
      const amount = new Money(100.456, 'ARS');
      const rounded = InvoiceCalculator.roundAmount(amount);

      expect(rounded.amount).toBe(100.46);
    });
  });

  describe('InvoiceDateValidator', () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    test('should validate date format', () => {
      expect(InvoiceDateValidator.isValidDateFormat('2025-01-15')).toBe(true);
      expect(InvoiceDateValidator.isValidDateFormat('01/15/2025')).toBe(false);
      expect(InvoiceDateValidator.isValidDateFormat('invalid')).toBe(false);
    });

    test('should reject future dates', () => {
      const future = new Date(today);
      future.setDate(future.getDate() + 1);
      const futureStr = future.toISOString().split('T')[0];

      const result = InvoiceDateValidator.validateNotFuture(futureStr, today);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('future');
    });

    test('should validate 10-day rule', () => {
      const recent = new Date(today);
      recent.setDate(recent.getDate() - 5);
      const recentStr = recent.toISOString().split('T')[0];

      const result = InvoiceDateValidator.validateTenDayRule(recentStr, todayStr);

      expect(result.valid).toBe(true);
      expect(result.daysAfter).toBe(5);
    });

    test('should reject dates older than 10 days', () => {
      const old = new Date(today);
      old.setDate(old.getDate() - 11);
      const oldStr = old.toISOString().split('T')[0];

      const result = InvoiceDateValidator.validateTenDayRule(oldStr, todayStr);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('10 days');
    });

    test('should check if can still invoice', () => {
      const recent = new Date(today);
      recent.setDate(recent.getDate() - 5);
      const recentStr = recent.toISOString().split('T')[0];

      const status = InvoiceDateValidator.canStillInvoice(recentStr, today);

      expect(status.canInvoice).toBe(true);
      expect(status.daysRemaining).toBe(5);
    });

    test('should get maximum invoice date', () => {
      const txDate = '2025-01-01';
      const maxDate = InvoiceDateValidator.getMaxInvoiceDate(txDate);

      expect(maxDate).toBe('2025-01-11');
    });
  });

  describe('OrderProcessor', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const validOrderData = {
      orderNumber: 'ORDER-12345',
      amount: 100,
      price: 400,
      totalPrice: 40000,
      asset: 'USDT',
      fiat: 'ARS',
      tradeType: 'SELL',
      createTime: Date.now(),
      orderDate: todayStr
    };

    test('should determine order can be processed', () => {
      const order = new Order(validOrderData);
      const result = OrderProcessor.canProcess(order);

      expect(result.canProcess).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    test('should reject BUY orders', () => {
      const buyOrder = new Order({ ...validOrderData, tradeType: 'BUY' });
      const result = OrderProcessor.canProcess(buyOrder);

      expect(result.canProcess).toBe(false);
      expect(result.reasons).toContain('Only SELL trades can be processed');
    });

    test('should reject already processed orders', () => {
      const processedOrder = new Order({
        ...validOrderData,
        processedAt: new Date(),
        success: true
      });
      const result = OrderProcessor.canProcess(processedOrder);

      expect(result.canProcess).toBe(false);
      expect(result.reasons).toContain('Order has already been processed');
    });

    test('should create invoice from order', () => {
      const order = new Order(validOrderData);
      const invoice = OrderProcessor.createInvoiceFromOrder(order);

      expect(invoice.orderNumber.value).toBe('ORDER-12345');
      expect(invoice.totalAmount.amount).toBe(40000);
      expect(invoice.concept).toBe(2); // Services
    });

    test('should categorize orders', () => {
      const order1 = new Order(validOrderData);
      const order2 = new Order({ ...validOrderData, orderNumber: 'ORDER-999', tradeType: 'BUY' });

      const result = OrderProcessor.categorizeOrders([order1, order2]);

      expect(result.processable).toHaveLength(1);
      expect(result.unprocessable).toHaveLength(1);
    });

    test('should calculate statistics', () => {
      const order1 = new Order(validOrderData);
      const order2 = new Order({
        ...validOrderData,
        orderNumber: 'ORDER-999',
        processedAt: new Date(),
        success: true
      });

      const stats = OrderProcessor.calculateStatistics([order1, order2]);

      expect(stats.total).toBe(2);
      expect(stats.processed).toBe(1);
      expect(stats.successful).toBe(1);
      expect(stats.sellTrades).toBe(2);
    });

    test('should get processing recommendation', () => {
      const order = new Order(validOrderData);
      const recommendation = OrderProcessor.getProcessingRecommendation(order);

      expect(recommendation.action).toBe('process');
      expect(recommendation.priority).toBeDefined();
    });
  });
});

describe('Domain Events', () => {
  describe('InvoiceCreated', () => {
    const eventData = {
      orderNumber: 'ORDER-12345',
      cae: '12345678901234',
      voucherNumber: 100,
      invoiceDate: '2025-01-15',
      totalAmount: 100000,
      currency: 'ARS'
    };

    test('should create event', () => {
      const event = new InvoiceCreated(eventData);

      expect(event.eventName).toBe('InvoiceCreated');
      expect(event.orderNumber).toBe('ORDER-12345');
      expect(event.cae).toBe('12345678901234');
      expect(event.voucherNumber).toBe(100);
      expect(event.occurredAt).toBeInstanceOf(Date);
    });

    test('should be immutable', () => {
      const event = new InvoiceCreated(eventData);
      const oldCae = event.cae;
      event._cae = 'changed';
      expect(event.cae).toBe(oldCae);
    });

    test('should serialize to JSON', () => {
      const event = new InvoiceCreated(eventData);
      const json = event.toJSON();

      expect(json.eventName).toBe('InvoiceCreated');
      expect(json.orderNumber).toBe('ORDER-12345');
      expect(json.occurredAt).toBeDefined();
    });

    test('should deserialize from JSON', () => {
      const event = new InvoiceCreated(eventData);
      const json = event.toJSON();
      const restored = InvoiceCreated.fromJSON(json);

      expect(restored.orderNumber).toBe(event.orderNumber);
      expect(restored.cae).toBe(event.cae);
    });
  });

  describe('OrderProcessed', () => {
    const eventData = {
      orderNumber: 'ORDER-12345',
      success: true,
      cae: '12345678901234',
      voucherNumber: 100,
      processingMethod: 'automatic'
    };

    test('should create successful event', () => {
      const event = new OrderProcessed(eventData);

      expect(event.eventName).toBe('OrderProcessed');
      expect(event.orderNumber).toBe('ORDER-12345');
      expect(event.success).toBe(true);
      expect(event.isSuccessful()).toBe(true);
      expect(event.isFailed()).toBe(false);
    });

    test('should create failed event', () => {
      const failedData = {
        orderNumber: 'ORDER-999',
        success: false,
        errorMessage: 'AFIP Error',
        processingMethod: 'manual'
      };
      const event = new OrderProcessed(failedData);

      expect(event.success).toBe(false);
      expect(event.isSuccessful()).toBe(false);
      expect(event.isFailed()).toBe(true);
      expect(event.errorMessage).toBe('AFIP Error');
    });

    test('should be immutable', () => {
      const event = new OrderProcessed(eventData);
      const oldSuccess = event.success;
      event._success = false;
      expect(event.success).toBe(oldSuccess);
    });

    test('should serialize and deserialize', () => {
      const event = new OrderProcessed(eventData);
      const json = event.toJSON();
      const restored = OrderProcessed.fromJSON(json);

      expect(restored.orderNumber).toBe(event.orderNumber);
      expect(restored.success).toBe(event.success);
      expect(restored.processingMethod).toBe(event.processingMethod);
    });
  });
});
