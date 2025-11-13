/**
 * Order Entity Tests
 */

const Order = require('../../../../src/domain/entities/Order');
const OrderNumber = require('../../../../src/domain/value-objects/OrderNumber');
const Money = require('../../../../src/domain/value-objects/Money');
const CAE = require('../../../../src/domain/value-objects/CAE');
const { ValidationError, DomainError } = require('../../../../src/shared/errors');

describe('Order Entity', () => {
  const validOrderData = {
    orderNumber: 'ORDER-12345',
    amount: 100.5,
    price: 450.75,
    totalPrice: 45000,
    asset: 'USDT',
    fiat: 'ARS',
    buyerNickname: 'buyer123',
    sellerNickname: 'seller456',
    tradeType: 'SELL',
    createTime: 1704067200000, // 2024-01-01
    orderDate: '2024-01-01'
  };

  describe('constructor', () => {
    test('should create Order with valid data', () => {
      const order = new Order(validOrderData);

      expect(order.orderNumber).toBeInstanceOf(OrderNumber);
      expect(order.orderNumber.value).toBe('ORDER-12345');
      expect(order.amount).toBe(100.5);
      expect(order.price).toBe(450.75);
      expect(order.totalAmount).toBeInstanceOf(Money);
      expect(order.totalAmount.amount).toBe(45000);
      expect(order.totalAmount.currency).toBe('ARS');
      expect(order.asset).toBe('USDT');
      expect(order.fiat).toBe('ARS');
      expect(order.tradeType).toBe('SELL');
    });

    test('should create Order with USD currency', () => {
      const orderData = { ...validOrderData, fiat: 'USD' };
      const order = new Order(orderData);

      expect(order.totalAmount.currency).toBe('USD');
    });

    test('should handle optional fields', () => {
      const minimalData = {
        orderNumber: 'ORDER-123',
        amount: 100,
        price: 400,
        totalPrice: 40000,
        asset: 'USDT',
        fiat: 'ARS',
        tradeType: 'SELL',
        createTime: 1704067200000,
        orderDate: '2024-01-01'
      };

      const order = new Order(minimalData);

      expect(order.buyerNickname).toBeNull();
      expect(order.sellerNickname).toBeNull();
      expect(order.processedAt).toBeNull();
      expect(order.cae).toBeNull();
    });

    test('should throw ValidationError for negative amount', () => {
      const invalidData = { ...validOrderData, amount: -100 };
      expect(() => new Order(invalidData)).toThrow(ValidationError);
    });

    test('should throw ValidationError for negative price', () => {
      const invalidData = { ...validOrderData, price: -450 };
      expect(() => new Order(invalidData)).toThrow(ValidationError);
    });

    test('should throw ValidationError for invalid trade type', () => {
      const invalidData = { ...validOrderData, tradeType: 'INVALID' };
      expect(() => new Order(invalidData)).toThrow(ValidationError);
    });

    test('should throw ValidationError for invalid processing method', () => {
      const invalidData = { ...validOrderData, processingMethod: 'invalid' };
      expect(() => new Order(invalidData)).toThrow(ValidationError);
    });

    test('should be immutable', () => {
      const order = new Order(validOrderData);
      const oldAmount = order.amount;
      order._amount = 999; // Attempt to mutate
      expect(order.amount).toBe(oldAmount); // Should remain unchanged
    });
  });

  describe('status methods', () => {
    test('isProcessed should return false for unprocessed order', () => {
      const order = new Order(validOrderData);
      expect(order.isProcessed()).toBe(false);
    });

    test('isProcessed should return true for processed order', () => {
      const processedData = {
        ...validOrderData,
        processedAt: new Date()
      };
      const order = new Order(processedData);
      expect(order.isProcessed()).toBe(true);
    });

    test('isSuccessful should return true for successful order', () => {
      const successfulData = {
        ...validOrderData,
        processedAt: new Date(),
        success: true
      };
      const order = new Order(successfulData);
      expect(order.isSuccessful()).toBe(true);
    });

    test('isFailed should return true for failed order', () => {
      const failedData = {
        ...validOrderData,
        processedAt: new Date(),
        success: false,
        errorMessage: 'Test error'
      };
      const order = new Order(failedData);
      expect(order.isFailed()).toBe(true);
    });
  });

  describe('trade type methods', () => {
    test('isSellTrade should return true for SELL trade', () => {
      const order = new Order(validOrderData);
      expect(order.isSellTrade()).toBe(true);
    });

    test('isBuyTrade should return true for BUY trade', () => {
      const buyData = { ...validOrderData, tradeType: 'BUY' };
      const order = new Order(buyData);
      expect(order.isBuyTrade()).toBe(true);
      expect(order.isSellTrade()).toBe(false);
    });
  });

  describe('canBeProcessed', () => {
    test('should return true for unprocessed SELL order', () => {
      const order = new Order(validOrderData);
      expect(order.canBeProcessed()).toBe(true);
    });

    test('should return false for processed SELL order', () => {
      const processedData = {
        ...validOrderData,
        processedAt: new Date()
      };
      const order = new Order(processedData);
      expect(order.canBeProcessed()).toBe(false);
    });

    test('should return false for BUY order', () => {
      const buyData = { ...validOrderData, tradeType: 'BUY' };
      const order = new Order(buyData);
      expect(order.canBeProcessed()).toBe(false);
    });
  });

  describe('isReadyForInvoicing', () => {
    test('should return true for recent SELL order', () => {
      const today = new Date();
      const recentData = {
        ...validOrderData,
        orderDate: today.toISOString().split('T')[0],
        createTime: today.getTime()
      };
      const order = new Order(recentData);
      expect(order.isReadyForInvoicing()).toBe(true);
    });

    test('should return false for old order (>10 days)', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 11);
      const oldData = {
        ...validOrderData,
        orderDate: oldDate.toISOString().split('T')[0],
        createTime: oldDate.getTime()
      };
      const order = new Order(oldData);
      expect(order.isReadyForInvoicing()).toBe(false);
    });

    test('should return false for processed order', () => {
      const today = new Date();
      const processedData = {
        ...validOrderData,
        orderDate: today.toISOString().split('T')[0],
        createTime: today.getTime(),
        processedAt: new Date()
      };
      const order = new Order(processedData);
      expect(order.isReadyForInvoicing()).toBe(false);
    });
  });

  describe('markAsProcessed', () => {
    test('should mark order as successfully processed', () => {
      const order = new Order(validOrderData);
      const result = {
        success: true,
        cae: '12345678901234',
        voucherNumber: 100,
        invoiceDate: '2024-01-01'
      };

      const processedOrder = order.markAsProcessed(result, 'automatic');

      expect(processedOrder.isProcessed()).toBe(true);
      expect(processedOrder.isSuccessful()).toBe(true);
      expect(processedOrder.cae).toBeInstanceOf(CAE);
      expect(processedOrder.cae.value).toBe('12345678901234');
      expect(processedOrder.voucherNumber).toBe(100);
      expect(processedOrder.invoiceDate).toBe('2024-01-01');
      expect(processedOrder.processingMethod).toBe('automatic');
    });

    test('should mark order as failed', () => {
      const order = new Order(validOrderData);
      const result = {
        success: false,
        errorMessage: 'AFIP Error'
      };

      const processedOrder = order.markAsProcessed(result, 'manual');

      expect(processedOrder.isProcessed()).toBe(true);
      expect(processedOrder.isFailed()).toBe(true);
      expect(processedOrder.errorMessage).toBe('AFIP Error');
      expect(processedOrder.processingMethod).toBe('manual');
    });

    test('should throw DomainError if already processed', () => {
      const processedData = {
        ...validOrderData,
        processedAt: new Date()
      };
      const order = new Order(processedData);

      expect(() => {
        order.markAsProcessed({ success: true }, 'automatic');
      }).toThrow(DomainError);
    });

    test('should return new instance (immutability)', () => {
      const order = new Order(validOrderData);
      const processedOrder = order.markAsProcessed({ success: true }, 'automatic');

      expect(processedOrder).not.toBe(order);
      expect(order.isProcessed()).toBe(false);
      expect(processedOrder.isProcessed()).toBe(true);
    });
  });

  describe('addNotes', () => {
    test('should add notes to order', () => {
      const order = new Order(validOrderData);
      const orderWithNotes = order.addNotes('Test notes');

      expect(orderWithNotes.notes).toBe('Test notes');
    });

    test('should return new instance (immutability)', () => {
      const order = new Order(validOrderData);
      const orderWithNotes = order.addNotes('Test notes');

      expect(orderWithNotes).not.toBe(order);
      expect(order.notes).toBeNull();
      expect(orderWithNotes.notes).toBe('Test notes');
    });
  });

  describe('getServicePeriod', () => {
    test('should return order date as service period', () => {
      const order = new Order(validOrderData);
      const servicePeriod = order.getServicePeriod();

      expect(servicePeriod).toEqual({
        from: '2024-01-01',
        to: '2024-01-01'
      });
    });
  });

  describe('toJSON', () => {
    test('should convert to plain object', () => {
      const order = new Order(validOrderData);
      const json = order.toJSON();

      expect(json.orderNumber).toBe('ORDER-12345');
      expect(json.amount).toBe(100.5);
      expect(json.totalPrice).toBe(45000);
      expect(json.tradeType).toBe('SELL');
      expect(json.cae).toBeNull();
    });

    test('should include CAE in JSON when present', () => {
      const processedData = {
        ...validOrderData,
        processedAt: new Date(),
        cae: '12345678901234'
      };
      const order = new Order(processedData);
      const json = order.toJSON();

      expect(json.cae).toBe('12345678901234');
    });
  });

  describe('fromJSON', () => {
    test('should create Order from JSON', () => {
      const json = {
        orderNumber: 'ORDER-999',
        amount: 50,
        price: 400,
        totalPrice: 20000,
        asset: 'USDT',
        fiat: 'ARS',
        tradeType: 'SELL',
        createTime: 1704067200000,
        orderDate: '2024-01-01'
      };

      const order = Order.fromJSON(json);

      expect(order).toBeInstanceOf(Order);
      expect(order.orderNumber.value).toBe('ORDER-999');
      expect(order.amount).toBe(50);
    });
  });

  describe('equals', () => {
    test('should return true for orders with same order number', () => {
      const order1 = new Order(validOrderData);
      const order2 = new Order(validOrderData);

      expect(order1.equals(order2)).toBe(true);
    });

    test('should return false for orders with different order numbers', () => {
      const order1 = new Order(validOrderData);
      const order2Data = { ...validOrderData, orderNumber: 'ORDER-99999' };
      const order2 = new Order(order2Data);

      expect(order1.equals(order2)).toBe(false);
    });

    test('should return false for non-Order object', () => {
      const order = new Order(validOrderData);

      expect(order.equals('ORDER-12345')).toBe(false);
      expect(order.equals({})).toBe(false);
    });
  });
});
