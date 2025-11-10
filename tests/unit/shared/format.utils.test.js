/**
 * Format Utilities Tests
 */

const formatUtils = require('../../../src/shared/utils/format.utils');

describe('Format Utilities', () => {
  describe('formatCurrency', () => {
    test('should format ARS with symbol by default', () => {
      const result = formatUtils.formatCurrency(1234.56);
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toContain('56');
    });

    test('should format with custom currency', () => {
      const result = formatUtils.formatCurrency(1234.56, { currency: 'USD' });
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toContain('56');
    });

    test('should format without symbol', () => {
      const result = formatUtils.formatCurrency(1234.56, { showSymbol: false });
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toContain('56');
    });

    test('should format with custom decimals', () => {
      const result = formatUtils.formatCurrency(1234.567, { decimals: 3 });
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toContain('567');
    });
  });

  describe('formatNumber', () => {
    test('should format number without decimals by default', () => {
      const result = formatUtils.formatNumber(1234);
      expect(result).toContain('1');
      expect(result).toContain('234');
    });

    test('should format number with custom decimals', () => {
      const result = formatUtils.formatNumber(1234.56, 2);
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toContain('56');
    });
  });

  describe('formatCUIT', () => {
    test('should format 11-digit CUIT with hyphens', () => {
      expect(formatUtils.formatCUIT('20123456789')).toBe('20-12345678-9');
    });

    test('should format numeric CUIT', () => {
      expect(formatUtils.formatCUIT(20123456789)).toBe('20-12345678-9');
    });

    test('should remove existing hyphens and reformat', () => {
      expect(formatUtils.formatCUIT('20-12345678-9')).toBe('20-12345678-9');
    });

    test('should return unchanged if not 11 digits', () => {
      expect(formatUtils.formatCUIT('123')).toBe('123');
    });
  });

  describe('formatCAE', () => {
    test('should format 14-digit CAE', () => {
      expect(formatUtils.formatCAE('12345678901234')).toBe('12345-67890-1234');
    });

    test('should format numeric CAE', () => {
      expect(formatUtils.formatCAE(12345678901234)).toBe('12345-67890-1234');
    });

    test('should return unchanged if not 14 digits', () => {
      expect(formatUtils.formatCAE('123')).toBe('123');
    });
  });

  describe('formatVoucherNumber', () => {
    test('should pad voucher number to 8 digits by default', () => {
      expect(formatUtils.formatVoucherNumber(123)).toBe('00000123');
    });

    test('should pad to custom length', () => {
      expect(formatUtils.formatVoucherNumber(123, 5)).toBe('00123');
    });

    test('should not truncate longer numbers', () => {
      expect(formatUtils.formatVoucherNumber(123456789, 5)).toBe('123456789');
    });
  });

  describe('formatOrderNumber', () => {
    test('should return order number unchanged if not too long', () => {
      expect(formatUtils.formatOrderNumber('ORDER123')).toBe('ORDER123');
    });

    test('should truncate long order numbers when requested', () => {
      const longOrder = 'ORDER1234567890123456789';
      const result = formatUtils.formatOrderNumber(longOrder, true);
      expect(result).toContain('...');
      expect(result.length).toBeLessThan(longOrder.length);
    });

    test('should return N/A for null or undefined', () => {
      expect(formatUtils.formatOrderNumber(null)).toBe('N/A');
      expect(formatUtils.formatOrderNumber(undefined)).toBe('N/A');
    });
  });

  describe('formatPercentage', () => {
    test('should format percentage with 2 decimals by default', () => {
      expect(formatUtils.formatPercentage(21.5)).toBe('21.50%');
    });

    test('should format with custom decimals', () => {
      expect(formatUtils.formatPercentage(21.567, 3)).toBe('21.567%');
    });

    test('should format whole numbers', () => {
      expect(formatUtils.formatPercentage(21, 0)).toBe('21%');
    });
  });

  describe('formatFileSize', () => {
    test('should format bytes', () => {
      expect(formatUtils.formatFileSize(0)).toBe('0 B');
      expect(formatUtils.formatFileSize(500)).toBe('500.00 B');
    });

    test('should format kilobytes', () => {
      expect(formatUtils.formatFileSize(1024)).toBe('1.00 KB');
      expect(formatUtils.formatFileSize(2048)).toBe('2.00 KB');
    });

    test('should format megabytes', () => {
      expect(formatUtils.formatFileSize(1048576)).toBe('1.00 MB');
    });

    test('should format gigabytes', () => {
      expect(formatUtils.formatFileSize(1073741824)).toBe('1.00 GB');
    });
  });

  describe('truncate', () => {
    test('should truncate text longer than maxLength', () => {
      expect(formatUtils.truncate('Hello World', 8)).toBe('Hello...');
    });

    test('should not truncate text shorter than maxLength', () => {
      expect(formatUtils.truncate('Hello', 10)).toBe('Hello');
    });

    test('should use custom ellipsis', () => {
      expect(formatUtils.truncate('Hello World', 8, '---')).toBe('Hello---');
    });

    test('should handle empty string', () => {
      expect(formatUtils.truncate('', 10)).toBe('');
    });
  });

  describe('padString', () => {
    test('should pad on right by default', () => {
      expect(formatUtils.padString('test', 10)).toBe('test      ');
    });

    test('should pad on left when requested', () => {
      expect(formatUtils.padString('test', 10, ' ', true)).toBe('      test');
    });

    test('should use custom pad character', () => {
      expect(formatUtils.padString('test', 10, '0')).toBe('test000000');
    });

    test('should not modify string already at target length', () => {
      expect(formatUtils.padString('test', 4)).toBe('test');
    });

    test('should not truncate string longer than target', () => {
      expect(formatUtils.padString('testing', 4)).toBe('testing');
    });
  });

  describe('formatInvoiceType', () => {
    test('should format Factura A', () => {
      expect(formatUtils.formatInvoiceType(1)).toBe('Factura A');
    });

    test('should format Factura B', () => {
      expect(formatUtils.formatInvoiceType(6)).toBe('Factura B');
    });

    test('should format Factura C', () => {
      expect(formatUtils.formatInvoiceType(11)).toBe('Factura C');
    });

    test('should handle unknown type', () => {
      expect(formatUtils.formatInvoiceType(99)).toBe('Tipo 99');
    });
  });

  describe('formatInvoiceConcept', () => {
    test('should format Productos', () => {
      expect(formatUtils.formatInvoiceConcept(1)).toBe('Productos');
    });

    test('should format Servicios', () => {
      expect(formatUtils.formatInvoiceConcept(2)).toBe('Servicios');
    });

    test('should format Productos y Servicios', () => {
      expect(formatUtils.formatInvoiceConcept(3)).toBe('Productos y Servicios');
    });

    test('should handle unknown concept', () => {
      expect(formatUtils.formatInvoiceConcept(99)).toBe('Concepto 99');
    });
  });

  describe('getCurrencySymbol', () => {
    test('should return $ for ARS', () => {
      expect(formatUtils.getCurrencySymbol('ARS')).toBe('$');
    });

    test('should return $ for PES', () => {
      expect(formatUtils.getCurrencySymbol('PES')).toBe('$');
    });

    test('should return US$ for USD', () => {
      expect(formatUtils.getCurrencySymbol('USD')).toBe('US$');
    });

    test('should return US$ for DOL', () => {
      expect(formatUtils.getCurrencySymbol('DOL')).toBe('US$');
    });

    test('should return € for EUR', () => {
      expect(formatUtils.getCurrencySymbol('EUR')).toBe('€');
    });

    test('should return currency code for unknown currency', () => {
      expect(formatUtils.getCurrencySymbol('XXX')).toBe('XXX');
    });
  });

  describe('formatStatus', () => {
    test('should format success status', () => {
      const result = formatUtils.formatStatus('success');
      expect(result).toContain('✓');
      expect(result).toContain('success');
    });

    test('should format failed status', () => {
      const result = formatUtils.formatStatus('failed');
      expect(result).toContain('✗');
      expect(result).toContain('failed');
    });

    test('should format pending status', () => {
      const result = formatUtils.formatStatus('pending');
      expect(result).toContain('○');
      expect(result).toContain('pending');
    });

    test('should format processing status', () => {
      const result = formatUtils.formatStatus('processing');
      expect(result).toContain('◐');
      expect(result).toContain('processing');
    });

    test('should format error status', () => {
      const result = formatUtils.formatStatus('error');
      expect(result).toContain('✗');
      expect(result).toContain('error');
    });

    test('should format warning status', () => {
      const result = formatUtils.formatStatus('warning');
      expect(result).toContain('⚠');
      expect(result).toContain('warning');
    });

    test('should handle unknown status', () => {
      const result = formatUtils.formatStatus('unknown');
      expect(result).toContain('•');
      expect(result).toContain('unknown');
    });
  });

  describe('formatDuration', () => {
    test('should format milliseconds', () => {
      expect(formatUtils.formatDuration(500)).toBe('500ms');
    });

    test('should format seconds', () => {
      expect(formatUtils.formatDuration(5000)).toBe('5.00s');
    });

    test('should format minutes and seconds', () => {
      expect(formatUtils.formatDuration(125000)).toBe('2m 5s');
    });

    test('should format hours and minutes', () => {
      expect(formatUtils.formatDuration(7325000)).toBe('2h 2m');
    });
  });

  describe('capitalize', () => {
    test('should capitalize first letter', () => {
      expect(formatUtils.capitalize('hello')).toBe('Hello');
    });

    test('should lowercase rest of string', () => {
      expect(formatUtils.capitalize('HELLO')).toBe('Hello');
    });

    test('should handle single character', () => {
      expect(formatUtils.capitalize('h')).toBe('H');
    });

    test('should handle empty string', () => {
      expect(formatUtils.capitalize('')).toBe('');
    });
  });

  describe('toTitleCase', () => {
    test('should convert camelCase to Title Case', () => {
      expect(formatUtils.toTitleCase('helloWorld')).toBe('Hello World');
    });

    test('should convert PascalCase to Title Case', () => {
      expect(formatUtils.toTitleCase('HelloWorld')).toBe('Hello World');
    });

    test('should convert snake_case to Title Case', () => {
      expect(formatUtils.toTitleCase('hello_world')).toBe('Hello World');
    });

    test('should handle single word', () => {
      expect(formatUtils.toTitleCase('hello')).toBe('Hello');
    });

    test('should handle empty string', () => {
      expect(formatUtils.toTitleCase('')).toBe('');
    });
  });
});
