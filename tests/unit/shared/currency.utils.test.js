/**
 * Currency Utilities Tests
 */

const currencyUtils = require('../../../src/shared/utils/currency.utils');

describe('Currency Utilities', () => {
  describe('roundCurrency', () => {
    test('should round to 2 decimals by default', () => {
      expect(currencyUtils.roundCurrency(1234.567)).toBe(1234.57);
      expect(currencyUtils.roundCurrency(1234.563)).toBe(1234.56);
    });

    test('should round to custom decimals', () => {
      expect(currencyUtils.roundCurrency(1234.5678, 3)).toBe(1234.568);
      expect(currencyUtils.roundCurrency(1234.5678, 1)).toBe(1234.6);
    });

    test('should handle whole numbers', () => {
      expect(currencyUtils.roundCurrency(1234)).toBe(1234);
    });

    test('should throw error for invalid amount', () => {
      expect(() => currencyUtils.roundCurrency('invalid')).toThrow('Amount must be a valid number');
      expect(() => currencyUtils.roundCurrency(NaN)).toThrow('Amount must be a valid number');
    });
  });

  describe('convertCurrency', () => {
    test('should convert between currencies', () => {
      const result = currencyUtils.convertCurrency(100, 'USD', 'ARS', 350);
      expect(result).toBe(35000);
    });

    test('should return same amount for same currency', () => {
      const result = currencyUtils.convertCurrency(100, 'ARS', 'ARS', 1);
      expect(result).toBe(100);
    });

    test('should handle AFIP currency codes (PES -> DOL)', () => {
      const result = currencyUtils.convertCurrency(350, 'PES', 'DOL', 0.002857);
      expect(result).toBe(1);
    });

    test('should round result to 2 decimals', () => {
      const result = currencyUtils.convertCurrency(100, 'USD', 'ARS', 350.789);
      expect(result).toBe(35078.9);
    });

    test('should throw error for invalid amount', () => {
      expect(() => currencyUtils.convertCurrency('invalid', 'USD', 'ARS', 350)).toThrow();
    });

    test('should throw error for invalid exchange rate', () => {
      expect(() => currencyUtils.convertCurrency(100, 'USD', 'ARS', 0)).toThrow();
      expect(() => currencyUtils.convertCurrency(100, 'USD', 'ARS', -1)).toThrow();
    });
  });

  describe('calculateVAT', () => {
    test('should calculate VAT correctly', () => {
      expect(currencyUtils.calculateVAT(100, 21)).toBe(21);
      expect(currencyUtils.calculateVAT(1000, 10.5)).toBe(105);
    });

    test('should round to 2 decimals', () => {
      expect(currencyUtils.calculateVAT(100, 21.5)).toBe(21.5);
    });

    test('should handle zero VAT', () => {
      expect(currencyUtils.calculateVAT(100, 0)).toBe(0);
    });

    test('should throw error for invalid inputs', () => {
      expect(() => currencyUtils.calculateVAT('invalid', 21)).toThrow();
      expect(() => currencyUtils.calculateVAT(100, 'invalid')).toThrow();
      expect(() => currencyUtils.calculateVAT(100, -1)).toThrow();
    });
  });

  describe('calculateTotal', () => {
    test('should calculate total correctly', () => {
      expect(currencyUtils.calculateTotal(100, 21)).toBe(121);
      expect(currencyUtils.calculateTotal(1000, 210)).toBe(1210);
    });

    test('should handle zero VAT', () => {
      expect(currencyUtils.calculateTotal(100, 0)).toBe(100);
      expect(currencyUtils.calculateTotal(100)).toBe(100);
    });

    test('should round to 2 decimals', () => {
      expect(currencyUtils.calculateTotal(100.555, 21.555)).toBe(122.11);
    });

    test('should throw error for invalid inputs', () => {
      expect(() => currencyUtils.calculateTotal('invalid', 21)).toThrow();
      expect(() => currencyUtils.calculateTotal(100, 'invalid')).toThrow();
    });
  });

  describe('calculateNetFromTotal', () => {
    test('should calculate net from total', () => {
      expect(currencyUtils.calculateNetFromTotal(121, 21)).toBe(100);
      expect(currencyUtils.calculateNetFromTotal(1210, 21)).toBe(1000);
    });

    test('should handle zero VAT', () => {
      expect(currencyUtils.calculateNetFromTotal(100, 0)).toBe(100);
    });

    test('should round to 2 decimals', () => {
      const result = currencyUtils.calculateNetFromTotal(121.5, 21);
      expect(result).toBeCloseTo(100.41, 2);
    });

    test('should throw error for invalid inputs', () => {
      expect(() => currencyUtils.calculateNetFromTotal('invalid', 21)).toThrow();
      expect(() => currencyUtils.calculateNetFromTotal(100, 'invalid')).toThrow();
    });
  });

  describe('addAmounts', () => {
    test('should add multiple amounts', () => {
      expect(currencyUtils.addAmounts(10, 20, 30)).toBe(60);
      expect(currencyUtils.addAmounts(10.5, 20.3, 30.2)).toBe(61);
    });

    test('should handle single amount', () => {
      expect(currencyUtils.addAmounts(10)).toBe(10);
    });

    test('should return 0 for no amounts', () => {
      expect(currencyUtils.addAmounts()).toBe(0);
    });

    test('should round result', () => {
      expect(currencyUtils.addAmounts(10.555, 20.555)).toBe(31.11);
    });

    test('should throw error for invalid amounts', () => {
      expect(() => currencyUtils.addAmounts(10, 'invalid', 30)).toThrow();
    });
  });

  describe('subtractAmounts', () => {
    test('should subtract amounts', () => {
      expect(currencyUtils.subtractAmounts(100, 30)).toBe(70);
      expect(currencyUtils.subtractAmounts(50.5, 20.3)).toBe(30.2);
    });

    test('should handle negative result', () => {
      expect(currencyUtils.subtractAmounts(10, 20)).toBe(-10);
    });

    test('should round result', () => {
      expect(currencyUtils.subtractAmounts(100.555, 20.555)).toBe(80);
    });

    test('should throw error for invalid amounts', () => {
      expect(() => currencyUtils.subtractAmounts('invalid', 20)).toThrow();
      expect(() => currencyUtils.subtractAmounts(100, 'invalid')).toThrow();
    });
  });

  describe('multiplyAmount', () => {
    test('should multiply amount', () => {
      expect(currencyUtils.multiplyAmount(10, 3)).toBe(30);
      expect(currencyUtils.multiplyAmount(10.5, 2)).toBe(21);
    });

    test('should handle decimal multiplier', () => {
      expect(currencyUtils.multiplyAmount(100, 0.5)).toBe(50);
    });

    test('should round result', () => {
      expect(currencyUtils.multiplyAmount(10.555, 2)).toBe(21.11);
    });

    test('should throw error for invalid inputs', () => {
      expect(() => currencyUtils.multiplyAmount('invalid', 2)).toThrow();
      expect(() => currencyUtils.multiplyAmount(10, 'invalid')).toThrow();
    });
  });

  describe('divideAmount', () => {
    test('should divide amount', () => {
      expect(currencyUtils.divideAmount(100, 2)).toBe(50);
      expect(currencyUtils.divideAmount(100, 3)).toBe(33.33);
    });

    test('should round result', () => {
      expect(currencyUtils.divideAmount(10, 3)).toBe(3.33);
    });

    test('should throw error for zero divisor', () => {
      expect(() => currencyUtils.divideAmount(100, 0)).toThrow();
    });

    test('should throw error for invalid inputs', () => {
      expect(() => currencyUtils.divideAmount('invalid', 2)).toThrow();
      expect(() => currencyUtils.divideAmount(10, 'invalid')).toThrow();
    });
  });

  describe('compareCurrencyAmounts', () => {
    test('should return 0 for equal amounts', () => {
      expect(currencyUtils.compareCurrencyAmounts(100, 100)).toBe(0);
      expect(currencyUtils.compareCurrencyAmounts(100.00, 100.005)).toBe(0);
    });

    test('should return 1 for greater amount', () => {
      expect(currencyUtils.compareCurrencyAmounts(100, 50)).toBe(1);
    });

    test('should return -1 for lesser amount', () => {
      expect(currencyUtils.compareCurrencyAmounts(50, 100)).toBe(-1);
    });

    test('should handle custom tolerance', () => {
      expect(currencyUtils.compareCurrencyAmounts(100, 100.5, 1)).toBe(0);
      expect(currencyUtils.compareCurrencyAmounts(100, 102, 1)).toBe(-1);
    });

    test('should throw error for invalid amounts', () => {
      expect(() => currencyUtils.compareCurrencyAmounts('invalid', 100)).toThrow();
      expect(() => currencyUtils.compareCurrencyAmounts(100, 'invalid')).toThrow();
    });
  });

  describe('areAmountsEqual', () => {
    test('should return true for equal amounts', () => {
      expect(currencyUtils.areAmountsEqual(100, 100)).toBe(true);
      expect(currencyUtils.areAmountsEqual(100.00, 100.005)).toBe(true);
    });

    test('should return false for different amounts', () => {
      expect(currencyUtils.areAmountsEqual(100, 101)).toBe(false);
    });

    test('should handle custom tolerance', () => {
      expect(currencyUtils.areAmountsEqual(100, 100.5, 1)).toBe(true);
      expect(currencyUtils.areAmountsEqual(100, 102, 1)).toBe(false);
    });
  });

  describe('parseCurrencyAmount', () => {
    test('should parse simple number string', () => {
      expect(currencyUtils.parseCurrencyAmount('1234.56')).toBe(1234.56);
    });

    test('should parse with thousand separators (US format)', () => {
      expect(currencyUtils.parseCurrencyAmount('1,234.56')).toBe(1234.56);
    });

    test('should parse European format (comma as decimal)', () => {
      expect(currencyUtils.parseCurrencyAmount('1.234,56')).toBe(1234.56);
    });

    test('should parse with currency symbols', () => {
      expect(currencyUtils.parseCurrencyAmount('$1,234.56')).toBe(1234.56);
      expect(currencyUtils.parseCurrencyAmount('€1.234,56')).toBe(1234.56);
    });

    test('should return null for invalid input', () => {
      expect(currencyUtils.parseCurrencyAmount('invalid')).toBeNull();
      expect(currencyUtils.parseCurrencyAmount('')).toBeNull();
    });

    test('should return null for non-string', () => {
      expect(currencyUtils.parseCurrencyAmount(null)).toBeNull();
      expect(currencyUtils.parseCurrencyAmount(undefined)).toBeNull();
    });
  });

  describe('validateCurrencyCode', () => {
    test('should validate common currency codes', () => {
      expect(currencyUtils.validateCurrencyCode('ARS')).toBe(true);
      expect(currencyUtils.validateCurrencyCode('USD')).toBe(true);
      expect(currencyUtils.validateCurrencyCode('EUR')).toBe(true);
    });

    test('should validate AFIP currency codes', () => {
      expect(currencyUtils.validateCurrencyCode('PES')).toBe(true);
      expect(currencyUtils.validateCurrencyCode('DOL')).toBe(true);
    });

    test('should be case insensitive', () => {
      expect(currencyUtils.validateCurrencyCode('ars')).toBe(true);
      expect(currencyUtils.validateCurrencyCode('usd')).toBe(true);
    });

    test('should reject invalid codes', () => {
      expect(currencyUtils.validateCurrencyCode('XXX')).toBe(false);
      expect(currencyUtils.validateCurrencyCode('')).toBe(false);
      expect(currencyUtils.validateCurrencyCode('123')).toBe(false);
    });
  });

  describe('normalizeCurrencyCode', () => {
    test('should convert AFIP codes to ISO codes', () => {
      expect(currencyUtils.normalizeCurrencyCode('PES')).toBe('ARS');
      expect(currencyUtils.normalizeCurrencyCode('DOL')).toBe('USD');
    });

    test('should keep ISO codes unchanged', () => {
      expect(currencyUtils.normalizeCurrencyCode('ARS')).toBe('ARS');
      expect(currencyUtils.normalizeCurrencyCode('USD')).toBe('USD');
      expect(currencyUtils.normalizeCurrencyCode('EUR')).toBe('EUR');
    });

    test('should be case insensitive', () => {
      expect(currencyUtils.normalizeCurrencyCode('pes')).toBe('ARS');
      expect(currencyUtils.normalizeCurrencyCode('dol')).toBe('USD');
    });

    test('should handle non-string input', () => {
      expect(currencyUtils.normalizeCurrencyCode(null)).toBeNull();
      expect(currencyUtils.normalizeCurrencyCode(undefined)).toBeUndefined();
    });
  });

  describe('toAfipCurrencyCode', () => {
    test('should convert ISO codes to AFIP codes', () => {
      expect(currencyUtils.toAfipCurrencyCode('ARS')).toBe('PES');
      expect(currencyUtils.toAfipCurrencyCode('USD')).toBe('DOL');
    });

    test('should keep AFIP codes unchanged', () => {
      expect(currencyUtils.toAfipCurrencyCode('PES')).toBe('PES');
      expect(currencyUtils.toAfipCurrencyCode('DOL')).toBe('DOL');
    });

    test('should keep EUR unchanged (no AFIP equivalent)', () => {
      expect(currencyUtils.toAfipCurrencyCode('EUR')).toBe('EUR');
    });

    test('should be case insensitive', () => {
      expect(currencyUtils.toAfipCurrencyCode('ars')).toBe('PES');
      expect(currencyUtils.toAfipCurrencyCode('usd')).toBe('DOL');
    });
  });

  describe('formatCurrencyAmount', () => {
    test('should format amount with ARS by default', () => {
      const result = currencyUtils.formatCurrencyAmount(1234.56);
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toContain('56');
    });

    test('should format with custom currency', () => {
      const result = currencyUtils.formatCurrencyAmount(1234.56, 'USD');
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toContain('56');
    });

    test('should normalize AFIP codes', () => {
      const result = currencyUtils.formatCurrencyAmount(1234.56, 'PES');
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toContain('56');
    });

    test('should return N/A for invalid amount', () => {
      expect(currencyUtils.formatCurrencyAmount(NaN)).toBe('N/A');
      expect(currencyUtils.formatCurrencyAmount('invalid')).toBe('N/A');
    });
  });

  describe('calculatePercentage', () => {
    test('should calculate percentage correctly', () => {
      expect(currencyUtils.calculatePercentage(100, 10)).toBe(10);
      expect(currencyUtils.calculatePercentage(1000, 21)).toBe(210);
    });

    test('should round to 2 decimals', () => {
      expect(currencyUtils.calculatePercentage(100, 10.5)).toBe(10.5);
    });

    test('should handle zero percentage', () => {
      expect(currencyUtils.calculatePercentage(100, 0)).toBe(0);
    });

    test('should throw error for invalid inputs', () => {
      expect(() => currencyUtils.calculatePercentage('invalid', 10)).toThrow();
      expect(() => currencyUtils.calculatePercentage(100, 'invalid')).toThrow();
    });
  });

  describe('splitAmount', () => {
    test('should split amount according to percentages', () => {
      const result = currencyUtils.splitAmount(100, [50, 30, 20]);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(50);
      expect(result[1]).toBe(30);
      expect(result[2]).toBe(20);
    });

    test('should adjust last part for rounding errors', () => {
      const result = currencyUtils.splitAmount(100, [33.33, 33.33, 33.34]);
      expect(result).toHaveLength(3);
      const sum = result.reduce((acc, val) => acc + val, 0);
      expect(sum).toBeCloseTo(100, 2);
    });

    test('should throw error if percentages do not sum to 100', () => {
      expect(() => currencyUtils.splitAmount(100, [50, 30])).toThrow();
      expect(() => currencyUtils.splitAmount(100, [50, 30, 30])).toThrow();
    });

    test('should throw error for invalid amount', () => {
      expect(() => currencyUtils.splitAmount('invalid', [50, 50])).toThrow();
    });

    test('should throw error for invalid percentages', () => {
      expect(() => currencyUtils.splitAmount(100, [])).toThrow();
      expect(() => currencyUtils.splitAmount(100, 'invalid')).toThrow();
    });
  });
});
