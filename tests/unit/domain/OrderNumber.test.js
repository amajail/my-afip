/**
 * OrderNumber Value Object Tests
 */

const OrderNumber = require('../../../src/domain/value-objects/OrderNumber');
const { ValidationError } = require('../../../src/shared/errors');

describe('OrderNumber Value Object', () => {
  describe('constructor', () => {
    test('should create OrderNumber with valid string', () => {
      const orderNumber = new OrderNumber('ORDER-12345');
      expect(orderNumber.value).toBe('ORDER-12345');
    });

    test('should create OrderNumber with numeric string', () => {
      const orderNumber = new OrderNumber('12345');
      expect(orderNumber.value).toBe('12345');
    });

    test('should trim whitespace', () => {
      const orderNumber = new OrderNumber('  ORDER-12345  ');
      expect(orderNumber.value).toBe('ORDER-12345');
    });

    test('should accept alphanumeric with hyphens and underscores', () => {
      const orderNumber = new OrderNumber('ORDER_123-ABC');
      expect(orderNumber.value).toBe('ORDER_123-ABC');
    });

    test('should throw ValidationError for empty string', () => {
      expect(() => new OrderNumber('')).toThrow(ValidationError);
      expect(() => new OrderNumber('   ')).toThrow(ValidationError);
    });

    test('should throw ValidationError for null or undefined', () => {
      expect(() => new OrderNumber(null)).toThrow(ValidationError);
      expect(() => new OrderNumber(undefined)).toThrow(ValidationError);
    });

    test('should throw ValidationError for too long value', () => {
      const longValue = 'A'.repeat(256);
      expect(() => new OrderNumber(longValue)).toThrow(ValidationError);
    });

    test('should throw ValidationError for invalid characters', () => {
      expect(() => new OrderNumber('ORDER@123')).toThrow(ValidationError);
      expect(() => new OrderNumber('ORDER 123')).toThrow(ValidationError);
      expect(() => new OrderNumber('ORDER#123')).toThrow(ValidationError);
    });

    test('should be immutable', () => {
      const orderNumber = new OrderNumber('ORDER-12345');
      const old = orderNumber.value; orderNumber.value = 'ORDER-67890'; expect(orderNumber.value).toBe(old);
    });
  });

  describe('truncated', () => {
    test('should return full value if 20 characters or less', () => {
      const orderNumber = new OrderNumber('ORDER-12345');
      expect(orderNumber.truncated).toBe('ORDER-12345');
    });

    test('should truncate long values', () => {
      const longValue = 'ORDER-1234567890-ABCDEFGHIJKLMNOP';
      const orderNumber = new OrderNumber(longValue);
      const truncated = orderNumber.truncated;
      expect(truncated).toContain('...');
      expect(truncated.length).toBeLessThan(longValue.length);
      expect(truncated).toMatch(/^ORDER-12.+KLMNOP$/);
    });
  });

  describe('isNumeric', () => {
    test('should return true for numeric order number', () => {
      const orderNumber = new OrderNumber('1234567890');
      expect(orderNumber.isNumeric()).toBe(true);
    });

    test('should return false for alphanumeric order number', () => {
      const orderNumber = new OrderNumber('ORDER-12345');
      expect(orderNumber.isNumeric()).toBe(false);
    });

    test('should return false for order number with hyphens', () => {
      const orderNumber = new OrderNumber('12345-67890');
      expect(orderNumber.isNumeric()).toBe(false);
    });
  });

  describe('equals', () => {
    test('should return true for equal order numbers', () => {
      const orderNumber1 = new OrderNumber('ORDER-12345');
      const orderNumber2 = new OrderNumber('ORDER-12345');
      expect(orderNumber1.equals(orderNumber2)).toBe(true);
    });

    test('should return false for different order numbers', () => {
      const orderNumber1 = new OrderNumber('ORDER-12345');
      const orderNumber2 = new OrderNumber('ORDER-67890');
      expect(orderNumber1.equals(orderNumber2)).toBe(false);
    });

    test('should return false for non-OrderNumber object', () => {
      const orderNumber = new OrderNumber('ORDER-12345');
      expect(orderNumber.equals('ORDER-12345')).toBe(false);
      expect(orderNumber.equals({})).toBe(false);
    });
  });

  describe('toString', () => {
    test('should return order number value', () => {
      const orderNumber = new OrderNumber('ORDER-12345');
      expect(orderNumber.toString()).toBe('ORDER-12345');
    });
  });

  describe('toJSON', () => {
    test('should serialize to JSON', () => {
      const orderNumber = new OrderNumber('ORDER-12345');
      const json = orderNumber.toJSON();
      expect(json).toEqual({
        value: 'ORDER-12345'
      });
    });
  });

  describe('static factory methods', () => {
    test('of should create OrderNumber instance', () => {
      const orderNumber = OrderNumber.of('ORDER-12345');
      expect(orderNumber).toBeInstanceOf(OrderNumber);
      expect(orderNumber.value).toBe('ORDER-12345');
    });

    test('fromJSON should create OrderNumber from JSON object', () => {
      const orderNumber = OrderNumber.fromJSON({ value: 'ORDER-12345' });
      expect(orderNumber.value).toBe('ORDER-12345');
    });

    test('fromJSON should throw for invalid JSON', () => {
      expect(() => OrderNumber.fromJSON(null)).toThrow(ValidationError);
      expect(() => OrderNumber.fromJSON({})).toThrow(ValidationError);
    });

    test('isValid should validate order number without creating instance', () => {
      expect(OrderNumber.isValid('ORDER-12345')).toBe(true);
      expect(OrderNumber.isValid('12345')).toBe(true);
      expect(OrderNumber.isValid('')).toBe(false);
      expect(OrderNumber.isValid('ORDER@123')).toBe(false);
    });
  });
});
