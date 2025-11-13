/**
 * Date Utilities Tests
 */

const dateUtils = require('../../../src/shared/utils/date.utils');

describe('Date Utilities', () => {
  describe('formatToYYYYMMDD', () => {
    test('should format Date object to YYYY-MM-DD', () => {
      const date = new Date('2025-03-15');
      expect(dateUtils.formatToYYYYMMDD(date)).toBe('2025-03-15');
    });

    test('should format string date to YYYY-MM-DD', () => {
      expect(dateUtils.formatToYYYYMMDD('2025-03-15')).toBe('2025-03-15');
    });

    test('should pad single-digit months and days', () => {
      const date = new Date('2025-01-05');
      expect(dateUtils.formatToYYYYMMDD(date)).toBe('2025-01-05');
    });
  });

  describe('formatToDDMMYYYY', () => {
    test('should format Date object to DD/MM/YYYY', () => {
      const date = new Date('2025-03-15');
      expect(dateUtils.formatToDDMMYYYY(date)).toBe('15/03/2025');
    });

    test('should format string date to DD/MM/YYYY', () => {
      expect(dateUtils.formatToDDMMYYYY('2025-03-15')).toBe('15/03/2025');
    });

    test('should pad single-digit months and days', () => {
      const date = new Date('2025-01-05');
      expect(dateUtils.formatToDDMMYYYY(date)).toBe('05/01/2025');
    });
  });

  describe('formatForAfip', () => {
    test('should format date to YYYYMMDD (AFIP format)', () => {
      const date = new Date('2025-03-15');
      expect(dateUtils.formatForAfip(date)).toBe('20250315');
    });

    test('should format string date to YYYYMMDD', () => {
      expect(dateUtils.formatForAfip('2025-03-15')).toBe('20250315');
    });

    test('should pad single-digit months and days', () => {
      const date = new Date('2025-01-05');
      expect(dateUtils.formatForAfip(date)).toBe('20250105');
    });
  });

  describe('getToday', () => {
    test('should return today at midnight', () => {
      const today = dateUtils.getToday();
      expect(today).toBeInstanceOf(Date);
      expect(today.getHours()).toBe(0);
      expect(today.getMinutes()).toBe(0);
      expect(today.getSeconds()).toBe(0);
      expect(today.getMilliseconds()).toBe(0);
    });
  });

  describe('getDaysAgo', () => {
    test('should return date N days ago', () => {
      const threeDaysAgo = dateUtils.getDaysAgo(3);
      const expected = new Date();
      expected.setDate(expected.getDate() - 3);
      expected.setHours(0, 0, 0, 0);

      expect(threeDaysAgo.getDate()).toBe(expected.getDate());
      expect(threeDaysAgo.getMonth()).toBe(expected.getMonth());
      expect(threeDaysAgo.getFullYear()).toBe(expected.getFullYear());
    });

    test('should handle zero days', () => {
      const today = dateUtils.getDaysAgo(0);
      const expected = new Date();
      expected.setHours(0, 0, 0, 0);

      expect(today.getDate()).toBe(expected.getDate());
    });
  });

  describe('getDaysFromNow', () => {
    test('should return date N days from now', () => {
      const threeDaysFromNow = dateUtils.getDaysFromNow(3);
      const expected = new Date();
      expected.setDate(expected.getDate() + 3);
      expected.setHours(0, 0, 0, 0);

      expect(threeDaysFromNow.getDate()).toBe(expected.getDate());
      expect(threeDaysFromNow.getMonth()).toBe(expected.getMonth());
    });
  });

  describe('getStartOfCurrentMonth', () => {
    test('should return first day of current month', () => {
      const start = dateUtils.getStartOfCurrentMonth();
      expect(start.getDate()).toBe(1);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
    });
  });

  describe('getEndOfCurrentMonth', () => {
    test('should return last day of current month', () => {
      const end = dateUtils.getEndOfCurrentMonth();
      const nextMonth = new Date(end);
      nextMonth.setDate(nextMonth.getDate() + 1);
      expect(nextMonth.getDate()).toBe(1);
    });
  });

  describe('getStartOfMonth', () => {
    test('should return first day of specified month', () => {
      const start = dateUtils.getStartOfMonth(2025, 3);
      expect(start.getFullYear()).toBe(2025);
      expect(start.getMonth()).toBe(2); // March (0-indexed)
      expect(start.getDate()).toBe(1);
    });
  });

  describe('getEndOfMonth', () => {
    test('should return last day of specified month', () => {
      const end = dateUtils.getEndOfMonth(2025, 3);
      expect(end.getFullYear()).toBe(2025);
      expect(end.getMonth()).toBe(2); // March (0-indexed)
      expect(end.getDate()).toBe(31);
    });

    test('should handle February in non-leap year', () => {
      const end = dateUtils.getEndOfMonth(2025, 2);
      expect(end.getDate()).toBe(28);
    });

    test('should handle February in leap year', () => {
      const end = dateUtils.getEndOfMonth(2024, 2);
      expect(end.getDate()).toBe(29);
    });
  });

  describe('getDaysDifference', () => {
    test('should calculate positive difference', () => {
      const date1 = new Date('2025-03-15');
      const date2 = new Date('2025-03-10');
      expect(dateUtils.getDaysDifference(date1, date2)).toBe(5);
    });

    test('should calculate negative difference', () => {
      const date1 = new Date('2025-03-10');
      const date2 = new Date('2025-03-15');
      expect(dateUtils.getDaysDifference(date1, date2)).toBe(-5);
    });

    test('should return 0 for same date', () => {
      const date1 = new Date('2025-03-15');
      const date2 = new Date('2025-03-15');
      expect(dateUtils.getDaysDifference(date1, date2)).toBe(0);
    });

    test('should work with string dates', () => {
      expect(dateUtils.getDaysDifference('2025-03-15', '2025-03-10')).toBe(5);
    });
  });

  describe('isWithinAfip10DayRule', () => {
    test('should return true for invoice on same day as service', () => {
      const invoiceDate = new Date('2025-03-15');
      const serviceDate = new Date('2025-03-15');
      expect(dateUtils.isWithinAfip10DayRule(invoiceDate, serviceDate)).toBe(true);
    });

    test('should return true for invoice 5 days after service', () => {
      const invoiceDate = new Date('2025-03-15');
      const serviceDate = new Date('2025-03-10');
      expect(dateUtils.isWithinAfip10DayRule(invoiceDate, serviceDate)).toBe(true);
    });

    test('should return true for invoice 10 days after service', () => {
      const invoiceDate = new Date('2025-03-20');
      const serviceDate = new Date('2025-03-10');
      expect(dateUtils.isWithinAfip10DayRule(invoiceDate, serviceDate)).toBe(true);
    });

    test('should return false for invoice 11 days after service', () => {
      const invoiceDate = new Date('2025-03-21');
      const serviceDate = new Date('2025-03-10');
      expect(dateUtils.isWithinAfip10DayRule(invoiceDate, serviceDate)).toBe(false);
    });

    test('should return false for invoice before service', () => {
      const invoiceDate = new Date('2025-03-10');
      const serviceDate = new Date('2025-03-15');
      expect(dateUtils.isWithinAfip10DayRule(invoiceDate, serviceDate)).toBe(false);
    });
  });

  describe('isToday', () => {
    test('should return true for today', () => {
      const today = new Date();
      expect(dateUtils.isToday(today)).toBe(true);
    });

    test('should return false for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(dateUtils.isToday(yesterday)).toBe(false);
    });

    test('should return false for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(dateUtils.isToday(tomorrow)).toBe(false);
    });
  });

  describe('isPast', () => {
    test('should return true for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(dateUtils.isPast(yesterday)).toBe(true);
    });

    test('should return false for today', () => {
      const today = new Date();
      expect(dateUtils.isPast(today)).toBe(false);
    });

    test('should return false for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(dateUtils.isPast(tomorrow)).toBe(false);
    });
  });

  describe('isFuture', () => {
    test('should return true for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(dateUtils.isFuture(tomorrow)).toBe(true);
    });

    test('should return false for today', () => {
      const today = new Date();
      expect(dateUtils.isFuture(today)).toBe(false);
    });

    test('should return false for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(dateUtils.isFuture(yesterday)).toBe(false);
    });
  });

  describe('parseDate', () => {
    test('should parse YYYY-MM-DD format', () => {
      const date = dateUtils.parseDate('2025-03-15');
      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(2); // March
      expect(date.getDate()).toBe(15);
    });

    test('should parse DD/MM/YYYY format', () => {
      const date = dateUtils.parseDate('15/03/2025');
      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(2); // March
      expect(date.getDate()).toBe(15);
    });

    test('should parse YYYYMMDD format (AFIP)', () => {
      const date = dateUtils.parseDate('20250315');
      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(2); // March
      expect(date.getDate()).toBe(15);
    });

    test('should return null for invalid date', () => {
      expect(dateUtils.parseDate('invalid')).toBeNull();
    });

    test('should return null for empty string', () => {
      expect(dateUtils.parseDate('')).toBeNull();
    });

    test('should return null for null', () => {
      expect(dateUtils.parseDate(null)).toBeNull();
    });
  });

  describe('fromTimestamp', () => {
    test('should convert timestamp to Date', () => {
      const timestamp = 1710518400000; // 2024-03-15T12:00:00.000Z
      const date = dateUtils.fromTimestamp(timestamp);
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBe(timestamp);
    });
  });

  describe('toTimestamp', () => {
    test('should convert Date to timestamp', () => {
      const date = new Date('2025-03-15T12:00:00.000Z');
      const timestamp = dateUtils.toTimestamp(date);
      expect(timestamp).toBe(date.getTime());
    });

    test('should convert string date to timestamp', () => {
      const timestamp = dateUtils.toTimestamp('2025-03-15');
      expect(typeof timestamp).toBe('number');
      expect(timestamp).toBeGreaterThan(0);
    });
  });

  describe('addMonths', () => {
    test('should add months to date', () => {
      const date = new Date('2025-03-15');
      const result = dateUtils.addMonths(date, 2);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(4); // May
      expect(result.getDate()).toBe(15);
    });

    test('should handle negative months', () => {
      const date = new Date('2025-03-15');
      const result = dateUtils.addMonths(date, -2);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(15);
    });

    test('should handle year boundary', () => {
      const date = new Date('2025-11-15');
      const result = dateUtils.addMonths(date, 3);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(1); // February
    });
  });

  describe('getMonthName', () => {
    test('should return correct month names', () => {
      expect(dateUtils.getMonthName(1)).toBe('Enero');
      expect(dateUtils.getMonthName(3)).toBe('Marzo');
      expect(dateUtils.getMonthName(6)).toBe('Junio');
      expect(dateUtils.getMonthName(12)).toBe('Diciembre');
    });

    test('should return empty string for invalid month', () => {
      expect(dateUtils.getMonthName(0)).toBe('');
      expect(dateUtils.getMonthName(13)).toBe('');
    });
  });
});
