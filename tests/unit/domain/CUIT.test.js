/**
 * CUIT Value Object Tests
 */

const CUIT = require('../../../src/domain/value-objects/CUIT');
const { ValidationError } = require('../../../src/shared/errors');

describe('CUIT Value Object', () => {
  describe('constructor', () => {
    test('should create CUIT with valid value (without hyphens)', () => {
      const cuit = new CUIT('20123456786');
      expect(cuit.value).toBe('20123456786');
    });

    test('should create CUIT with valid value (with hyphens)', () => {
      const cuit = new CUIT('20-12345678-6');
      expect(cuit.value).toBe('20123456786');
    });

    test('should create CUIT from number', () => {
      const cuit = new CUIT(20123456786);
      expect(cuit.value).toBe('20123456786');
    });

    test('should throw ValidationError for invalid length', () => {
      expect(() => new CUIT('123')).toThrow(ValidationError);
    });

    test('should throw ValidationError for invalid checksum', () => {
      expect(() => new CUIT('20123456788')).toThrow(ValidationError);
    });

    test('should be immutable', () => {
      const cuit = new CUIT('20123456786');
      const old = cuit.value; cuit.value = '20123456788'; expect(cuit.value).toBe(old);
    });
  });

  describe('formatted', () => {
    test('should return formatted CUIT with hyphens', () => {
      const cuit = new CUIT('20123456786');
      expect(cuit.formatted).toBe('20-12345678-6');
    });
  });

  describe('type', () => {
    test('should identify male individual (20)', () => {
      const cuit = new CUIT('20123456786');
      expect(cuit.type).toBe('Male Individual');
    });

    test('should identify female individual (27)', () => {
      const cuit = new CUIT('27123456780');
      expect(cuit.type).toBe('Female Individual / Self-employed Female');
    });

    test('should identify legal entity (30)', () => {
      const cuit = new CUIT('30123456781');
      expect(cuit.type).toBe('Legal Entity');
    });

    test('should return Unknown for unrecognized type', () => {
      const cuit = new CUIT('99123456781');
      expect(cuit.type).toBe('Unknown');
    });
  });

  describe('isCompany', () => {
    test('should return true for legal entity (30)', () => {
      const cuit = new CUIT('30123456781');
      expect(cuit.isCompany()).toBe(true);
    });

    test('should return true for foreign company (34)', () => {
      const cuit = new CUIT('34123456787');
      expect(cuit.isCompany()).toBe(true);
    });

    test('should return false for individual (20)', () => {
      const cuit = new CUIT('20123456786');
      expect(cuit.isCompany()).toBe(false);
    });
  });

  describe('isIndividual', () => {
    test('should return true for individual (20)', () => {
      const cuit = new CUIT('20123456786');
      expect(cuit.isIndividual()).toBe(true);
    });

    test('should return false for legal entity (30)', () => {
      const cuit = new CUIT('30123456781');
      expect(cuit.isIndividual()).toBe(false);
    });
  });

  describe('equals', () => {
    test('should return true for equal CUITs', () => {
      const cuit1 = new CUIT('20123456786');
      const cuit2 = new CUIT('20-12345678-6');
      expect(cuit1.equals(cuit2)).toBe(true);
    });

    test('should return false for different CUITs', () => {
      const cuit1 = new CUIT('20123456786');
      const cuit2 = new CUIT('27123456780');
      expect(cuit1.equals(cuit2)).toBe(false);
    });

    test('should return false for non-CUIT object', () => {
      const cuit = new CUIT('20123456786');
      expect(cuit.equals('20123456786')).toBe(false);
      expect(cuit.equals({})).toBe(false);
    });
  });

  describe('toString', () => {
    test('should return formatted CUIT', () => {
      const cuit = new CUIT('20123456786');
      expect(cuit.toString()).toBe('20-12345678-6');
    });
  });

  describe('toJSON', () => {
    test('should serialize to JSON', () => {
      const cuit = new CUIT('20123456786');
      const json = cuit.toJSON();
      expect(json).toEqual({
        value: '20123456786',
        formatted: '20-12345678-6'
      });
    });
  });

  describe('static factory methods', () => {
    test('of should create CUIT instance', () => {
      const cuit = CUIT.of('20123456786');
      expect(cuit).toBeInstanceOf(CUIT);
      expect(cuit.value).toBe('20123456786');
    });

    test('fromJSON should create CUIT from JSON object', () => {
      const cuit = CUIT.fromJSON({ value: '20123456786' });
      expect(cuit.value).toBe('20123456786');
    });

    test('fromJSON should throw for invalid JSON', () => {
      expect(() => CUIT.fromJSON(null)).toThrow(ValidationError);
      expect(() => CUIT.fromJSON({})).toThrow(ValidationError);
    });

    test('isValid should validate CUIT without creating instance', () => {
      expect(CUIT.isValid('20123456786')).toBe(true);
      expect(CUIT.isValid('123')).toBe(false);
      expect(CUIT.isValid('20123456788')).toBe(false);
    });
  });
});
