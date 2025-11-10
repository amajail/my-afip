/**
 * Money Value Object Tests
 */

const Money = require('../../../src/domain/value-objects/Money');
const { ValidationError, DomainError } = require('../../../src/shared/errors');

describe('Money Value Object', () => {
  describe('constructor', () => {
    test('should create Money with valid amount and default currency', () => {
      const money = new Money(100);
      expect(money.amount).toBe(100);
      expect(money.currency).toBe('ARS');
    });

    test('should create Money with valid amount and custom currency', () => {
      const money = new Money(100, 'USD');
      expect(money.amount).toBe(100);
      expect(money.currency).toBe('USD');
    });

    test('should normalize AFIP currency codes', () => {
      const money = new Money(100, 'PES');
      expect(money.currency).toBe('ARS');
    });

    test('should round amount to 2 decimal places', () => {
      const money = new Money(100.567, 'ARS');
      expect(money.amount).toBe(100.57);
    });

    test('should accept zero amount', () => {
      const money = new Money(0, 'ARS');
      expect(money.amount).toBe(0);
    });

    test('should throw ValidationError for invalid amount', () => {
      expect(() => new Money('invalid')).toThrow(ValidationError);
      expect(() => new Money(NaN)).toThrow(ValidationError);
    });

    test('should throw ValidationError for invalid currency', () => {
      expect(() => new Money(100, 'XXX')).toThrow(ValidationError);
    });

    test('should be immutable', () => {
      const money = new Money(100, 'ARS');
      const oldAmount = money.amount; money.amount = 200; expect(money.amount).toBe(oldAmount);
      const oldCurrency = money.currency; money.currency = 'USD'; expect(money.currency).toBe(oldCurrency);
    });
  });

  describe('isZero', () => {
    test('should return true for zero amount', () => {
      const money = new Money(0, 'ARS');
      expect(money.isZero()).toBe(true);
    });

    test('should return false for non-zero amount', () => {
      const money = new Money(100, 'ARS');
      expect(money.isZero()).toBe(false);
    });
  });

  describe('isPositive', () => {
    test('should return true for positive amount', () => {
      const money = new Money(100, 'ARS');
      expect(money.isPositive()).toBe(true);
    });

    test('should return false for zero', () => {
      const money = new Money(0, 'ARS');
      expect(money.isPositive()).toBe(false);
    });

    test('should return false for negative amount', () => {
      const money = new Money(-100, 'ARS');
      expect(money.isPositive()).toBe(false);
    });
  });

  describe('isNegative', () => {
    test('should return true for negative amount', () => {
      const money = new Money(-100, 'ARS');
      expect(money.isNegative()).toBe(true);
    });

    test('should return false for zero', () => {
      const money = new Money(0, 'ARS');
      expect(money.isNegative()).toBe(false);
    });

    test('should return false for positive amount', () => {
      const money = new Money(100, 'ARS');
      expect(money.isNegative()).toBe(false);
    });
  });

  describe('add', () => {
    test('should add two Money instances with same currency', () => {
      const money1 = new Money(100, 'ARS');
      const money2 = new Money(50, 'ARS');
      const result = money1.add(money2);
      expect(result.amount).toBe(150);
      expect(result.currency).toBe('ARS');
    });

    test('should return new Money instance (immutability)', () => {
      const money1 = new Money(100, 'ARS');
      const money2 = new Money(50, 'ARS');
      const result = money1.add(money2);
      expect(result).not.toBe(money1);
      expect(result).not.toBe(money2);
      expect(money1.amount).toBe(100);
    });

    test('should throw DomainError for different currencies', () => {
      const money1 = new Money(100, 'ARS');
      const money2 = new Money(50, 'USD');
      expect(() => money1.add(money2)).toThrow(DomainError);
    });

    test('should throw DomainError for non-Money operand', () => {
      const money = new Money(100, 'ARS');
      expect(() => money.add(50)).toThrow(DomainError);
    });
  });

  describe('subtract', () => {
    test('should subtract two Money instances with same currency', () => {
      const money1 = new Money(100, 'ARS');
      const money2 = new Money(30, 'ARS');
      const result = money1.subtract(money2);
      expect(result.amount).toBe(70);
      expect(result.currency).toBe('ARS');
    });

    test('should handle negative result', () => {
      const money1 = new Money(30, 'ARS');
      const money2 = new Money(100, 'ARS');
      const result = money1.subtract(money2);
      expect(result.amount).toBe(-70);
    });

    test('should throw DomainError for different currencies', () => {
      const money1 = new Money(100, 'ARS');
      const money2 = new Money(50, 'USD');
      expect(() => money1.subtract(money2)).toThrow(DomainError);
    });
  });

  describe('multiply', () => {
    test('should multiply Money by number', () => {
      const money = new Money(100, 'ARS');
      const result = money.multiply(3);
      expect(result.amount).toBe(300);
      expect(result.currency).toBe('ARS');
    });

    test('should handle decimal multiplier', () => {
      const money = new Money(100, 'ARS');
      const result = money.multiply(0.5);
      expect(result.amount).toBe(50);
    });

    test('should round result', () => {
      const money = new Money(100, 'ARS');
      const result = money.multiply(1.567);
      expect(result.amount).toBe(156.7);
    });

    test('should throw ValidationError for invalid multiplier', () => {
      const money = new Money(100, 'ARS');
      expect(() => money.multiply('invalid')).toThrow(ValidationError);
      expect(() => money.multiply(NaN)).toThrow(ValidationError);
    });
  });

  describe('divide', () => {
    test('should divide Money by number', () => {
      const money = new Money(100, 'ARS');
      const result = money.divide(4);
      expect(result.amount).toBe(25);
    });

    test('should round result', () => {
      const money = new Money(100, 'ARS');
      const result = money.divide(3);
      expect(result.amount).toBe(33.33);
    });

    test('should throw ValidationError for zero divisor', () => {
      const money = new Money(100, 'ARS');
      expect(() => money.divide(0)).toThrow(ValidationError);
    });

    test('should throw ValidationError for invalid divisor', () => {
      const money = new Money(100, 'ARS');
      expect(() => money.divide('invalid')).toThrow(ValidationError);
    });
  });

  describe('percentage', () => {
    test('should calculate percentage correctly', () => {
      const money = new Money(100, 'ARS');
      const result = money.percentage(21);
      expect(result.amount).toBe(21);
      expect(result.currency).toBe('ARS');
    });

    test('should handle decimal percentages', () => {
      const money = new Money(1000, 'ARS');
      const result = money.percentage(10.5);
      expect(result.amount).toBe(105);
    });
  });

  describe('convertTo', () => {
    test('should convert to another currency', () => {
      const money = new Money(100, 'USD');
      const result = money.convertTo('ARS', 350);
      expect(result.amount).toBe(35000);
      expect(result.currency).toBe('ARS');
    });

    test('should normalize target currency code', () => {
      const money = new Money(350, 'ARS');
      const result = money.convertTo('DOL', 0.002857);
      expect(result.currency).toBe('USD');
    });

    test('should throw ValidationError for invalid currency', () => {
      const money = new Money(100, 'ARS');
      expect(() => money.convertTo('XXX', 1)).toThrow(ValidationError);
    });
  });

  describe('compareTo', () => {
    test('should return 0 for equal amounts', () => {
      const money1 = new Money(100, 'ARS');
      const money2 = new Money(100, 'ARS');
      expect(money1.compareTo(money2)).toBe(0);
    });

    test('should return 1 for greater amount', () => {
      const money1 = new Money(150, 'ARS');
      const money2 = new Money(100, 'ARS');
      expect(money1.compareTo(money2)).toBe(1);
    });

    test('should return -1 for lesser amount', () => {
      const money1 = new Money(50, 'ARS');
      const money2 = new Money(100, 'ARS');
      expect(money1.compareTo(money2)).toBe(-1);
    });

    test('should throw DomainError for different currencies', () => {
      const money1 = new Money(100, 'ARS');
      const money2 = new Money(100, 'USD');
      expect(() => money1.compareTo(money2)).toThrow(DomainError);
    });
  });

  describe('equals', () => {
    test('should return true for equal Money instances', () => {
      const money1 = new Money(100, 'ARS');
      const money2 = new Money(100, 'ARS');
      expect(money1.equals(money2)).toBe(true);
    });

    test('should return false for different amounts', () => {
      const money1 = new Money(100, 'ARS');
      const money2 = new Money(150, 'ARS');
      expect(money1.equals(money2)).toBe(false);
    });

    test('should return false for different currencies', () => {
      const money1 = new Money(100, 'ARS');
      const money2 = new Money(100, 'USD');
      expect(money1.equals(money2)).toBe(false);
    });

    test('should return false for non-Money object', () => {
      const money = new Money(100, 'ARS');
      expect(money.equals(100)).toBe(false);
      expect(money.equals({})).toBe(false);
    });
  });

  describe('comparison methods', () => {
    test('isGreaterThan should work correctly', () => {
      const money1 = new Money(150, 'ARS');
      const money2 = new Money(100, 'ARS');
      expect(money1.isGreaterThan(money2)).toBe(true);
      expect(money2.isGreaterThan(money1)).toBe(false);
    });

    test('isLessThan should work correctly', () => {
      const money1 = new Money(50, 'ARS');
      const money2 = new Money(100, 'ARS');
      expect(money1.isLessThan(money2)).toBe(true);
      expect(money2.isLessThan(money1)).toBe(false);
    });

    test('isGreaterThanOrEqual should work correctly', () => {
      const money1 = new Money(100, 'ARS');
      const money2 = new Money(100, 'ARS');
      const money3 = new Money(150, 'ARS');
      expect(money1.isGreaterThanOrEqual(money2)).toBe(true);
      expect(money3.isGreaterThanOrEqual(money1)).toBe(true);
    });

    test('isLessThanOrEqual should work correctly', () => {
      const money1 = new Money(100, 'ARS');
      const money2 = new Money(100, 'ARS');
      const money3 = new Money(50, 'ARS');
      expect(money1.isLessThanOrEqual(money2)).toBe(true);
      expect(money3.isLessThanOrEqual(money1)).toBe(true);
    });
  });

  describe('abs', () => {
    test('should return absolute value', () => {
      const money = new Money(-100, 'ARS');
      const result = money.abs();
      expect(result.amount).toBe(100);
      expect(result.currency).toBe('ARS');
    });

    test('should not modify positive value', () => {
      const money = new Money(100, 'ARS');
      const result = money.abs();
      expect(result.amount).toBe(100);
    });
  });

  describe('negate', () => {
    test('should negate positive amount', () => {
      const money = new Money(100, 'ARS');
      const result = money.negate();
      expect(result.amount).toBe(-100);
    });

    test('should negate negative amount', () => {
      const money = new Money(-100, 'ARS');
      const result = money.negate();
      expect(result.amount).toBe(100);
    });
  });

  describe('format', () => {
    test('should format as currency string', () => {
      const money = new Money(1234.56, 'ARS');
      const formatted = money.format();
      expect(formatted).toContain('1');
      expect(formatted).toContain('234');
      expect(formatted).toContain('56');
    });
  });

  describe('toJSON', () => {
    test('should serialize to JSON', () => {
      const money = new Money(100.50, 'USD');
      const json = money.toJSON();
      expect(json).toEqual({
        amount: 100.50,
        currency: 'USD'
      });
    });
  });

  describe('toString', () => {
    test('should return formatted string', () => {
      const money = new Money(100, 'ARS');
      const str = money.toString();
      expect(typeof str).toBe('string');
      expect(str).toContain('100');
    });
  });

  describe('static factory methods', () => {
    test('of should create Money instance', () => {
      const money = Money.of(100, 'USD');
      expect(money).toBeInstanceOf(Money);
      expect(money.amount).toBe(100);
      expect(money.currency).toBe('USD');
    });

    test('zero should create zero Money', () => {
      const money = Money.zero('USD');
      expect(money.amount).toBe(0);
      expect(money.currency).toBe('USD');
    });

    test('fromJSON should create Money from JSON object', () => {
      const money = Money.fromJSON({ amount: 100, currency: 'USD' });
      expect(money.amount).toBe(100);
      expect(money.currency).toBe('USD');
    });

    test('fromJSON should throw for invalid JSON', () => {
      expect(() => Money.fromJSON(null)).toThrow(ValidationError);
      expect(() => Money.fromJSON({})).toThrow(ValidationError);
      expect(() => Money.fromJSON({ amount: 100 })).toThrow(ValidationError);
    });
  });

  describe('static methods', () => {
    test('sum should add multiple Money instances', () => {
      const money1 = new Money(100, 'ARS');
      const money2 = new Money(50, 'ARS');
      const money3 = new Money(30, 'ARS');
      const result = Money.sum(money1, money2, money3);
      expect(result.amount).toBe(180);
      expect(result.currency).toBe('ARS');
    });

    test('sum should throw for no arguments', () => {
      expect(() => Money.sum()).toThrow(DomainError);
    });

    test('sum should throw for different currencies', () => {
      const money1 = new Money(100, 'ARS');
      const money2 = new Money(50, 'USD');
      expect(() => Money.sum(money1, money2)).toThrow(DomainError);
    });

    test('min should return minimum Money', () => {
      const money1 = new Money(100, 'ARS');
      const money2 = new Money(50, 'ARS');
      const money3 = new Money(150, 'ARS');
      const result = Money.min(money1, money2, money3);
      expect(result.amount).toBe(50);
    });

    test('max should return maximum Money', () => {
      const money1 = new Money(100, 'ARS');
      const money2 = new Money(50, 'ARS');
      const money3 = new Money(150, 'ARS');
      const result = Money.max(money1, money2, money3);
      expect(result.amount).toBe(150);
    });
  });
});
