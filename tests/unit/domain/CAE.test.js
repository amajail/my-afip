/**
 * CAE Value Object Tests
 */

const CAE = require('../../../src/domain/value-objects/CAE');
const { ValidationError } = require('../../../src/shared/errors');

describe('CAE Value Object', () => {
  describe('constructor', () => {
    test('should create CAE with valid value (14 digits)', () => {
      const cae = new CAE('12345678901234');
      expect(cae.value).toBe('12345678901234');
    });

    test('should create CAE from number', () => {
      const cae = new CAE(12345678901234);
      expect(cae.value).toBe('12345678901234');
    });

    test('should pad shorter values', () => {
      const cae = new CAE('1234');
      expect(cae.value).toBe('00000000001234');
    });

    test('should remove hyphens from formatted input', () => {
      const cae = new CAE('12345-67890-1234');
      expect(cae.value).toBe('12345678901234');
    });

    test('should create CAE with expiration date', () => {
      const expDate = new Date('2025-12-31');
      const cae = new CAE('12345678901234', expDate);
      expect(cae.expirationDate).toEqual(expDate);
    });

    test('should create CAE with expiration date string', () => {
      const cae = new CAE('12345678901234', '2025-12-31');
      expect(cae.expirationDate).toBeInstanceOf(Date);
    });

    test('should throw ValidationError for non-digit characters', () => {
      expect(() => new CAE('123ABC')).toThrow(ValidationError);
    });

    test('should throw ValidationError for too long value', () => {
      expect(() => new CAE('123456789012345')).toThrow(ValidationError);
    });

    test('should throw ValidationError for invalid expiration date', () => {
      expect(() => new CAE('12345678901234', 'invalid')).toThrow(ValidationError);
    });

    test('should be immutable', () => {
      const cae = new CAE('12345678901234');
      const old = cae.value; cae.value = '98765432109876'; expect(cae.value).toBe(old);
    });
  });

  describe('formatted', () => {
    test('should return formatted CAE (XXXXX-XXXXX-XXXX)', () => {
      const cae = new CAE('12345678901234');
      expect(cae.formatted).toBe('12345-67890-1234');
    });
  });

  describe('isExpired', () => {
    test('should return false when no expiration date', () => {
      const cae = new CAE('12345678901234');
      expect(cae.isExpired()).toBe(false);
    });

    test('should return false for future expiration date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const cae = new CAE('12345678901234', futureDate);
      expect(cae.isExpired()).toBe(false);
    });

    test('should return true for past expiration date', () => {
      const pastDate = new Date('2020-01-01');
      const cae = new CAE('12345678901234', pastDate);
      expect(cae.isExpired()).toBe(true);
    });
  });

  describe('isValid', () => {
    test('should return true for non-expired CAE', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const cae = new CAE('12345678901234', futureDate);
      expect(cae.isValid()).toBe(true);
    });

    test('should return false for expired CAE', () => {
      const pastDate = new Date('2020-01-01');
      const cae = new CAE('12345678901234', pastDate);
      expect(cae.isValid()).toBe(false);
    });
  });

  describe('daysUntilExpiration', () => {
    test('should return null when no expiration date', () => {
      const cae = new CAE('12345678901234');
      expect(cae.daysUntilExpiration()).toBeNull();
    });

    test('should return positive days for future date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const cae = new CAE('12345678901234', futureDate);
      const days = cae.daysUntilExpiration();
      expect(days).toBeGreaterThan(9);
      expect(days).toBeLessThan(11);
    });

    test('should return negative days for past date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const cae = new CAE('12345678901234', pastDate);
      const days = cae.daysUntilExpiration();
      expect(days).toBeLessThan(0);
    });
  });

  describe('equals', () => {
    test('should return true for equal CAEs', () => {
      const cae1 = new CAE('12345678901234');
      const cae2 = new CAE('12345-67890-1234');
      expect(cae1.equals(cae2)).toBe(true);
    });

    test('should return false for different CAEs', () => {
      const cae1 = new CAE('12345678901234');
      const cae2 = new CAE('98765432109876');
      expect(cae1.equals(cae2)).toBe(false);
    });

    test('should return false for non-CAE object', () => {
      const cae = new CAE('12345678901234');
      expect(cae.equals('12345678901234')).toBe(false);
      expect(cae.equals({})).toBe(false);
    });
  });

  describe('toString', () => {
    test('should return formatted CAE', () => {
      const cae = new CAE('12345678901234');
      expect(cae.toString()).toBe('12345-67890-1234');
    });
  });

  describe('toJSON', () => {
    test('should serialize to JSON without expiration date', () => {
      const cae = new CAE('12345678901234');
      const json = cae.toJSON();
      expect(json).toEqual({
        value: '12345678901234',
        formatted: '12345-67890-1234',
        expirationDate: null
      });
    });

    test('should serialize to JSON with expiration date', () => {
      const expDate = new Date('2025-12-31T00:00:00.000Z');
      const cae = new CAE('12345678901234', expDate);
      const json = cae.toJSON();
      expect(json.expirationDate).toBe(expDate.toISOString());
    });
  });

  describe('static factory methods', () => {
    test('of should create CAE instance', () => {
      const cae = CAE.of('12345678901234');
      expect(cae).toBeInstanceOf(CAE);
      expect(cae.value).toBe('12345678901234');
    });

    test('of should create CAE with expiration date', () => {
      const expDate = new Date('2025-12-31');
      const cae = CAE.of('12345678901234', expDate);
      expect(cae.expirationDate).toEqual(expDate);
    });

    test('fromJSON should create CAE from JSON object', () => {
      const cae = CAE.fromJSON({ value: '12345678901234' });
      expect(cae.value).toBe('12345678901234');
    });

    test('fromJSON should create CAE with expiration date', () => {
      const cae = CAE.fromJSON({
        value: '12345678901234',
        expirationDate: '2025-12-31'
      });
      expect(cae.expirationDate).toBeInstanceOf(Date);
    });

    test('fromJSON should throw for invalid JSON', () => {
      expect(() => CAE.fromJSON(null)).toThrow(ValidationError);
      expect(() => CAE.fromJSON({})).toThrow(ValidationError);
    });

    test('isValid should validate CAE without creating instance', () => {
      expect(CAE.isValid('12345678901234')).toBe(true);
      expect(CAE.isValid('123ABC')).toBe(false);
      expect(CAE.isValid('123456789012345')).toBe(false);
    });
  });
});
