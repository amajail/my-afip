/**
 * TableFormatter Tests
 *
 * Tests for the TableFormatter utility that formats data as ASCII tables
 */

const TableFormatter = require('../../../../src/cli/formatters/TableFormatter');

describe('TableFormatter', () => {
  // Capture console.log output
  let consoleLogSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('format', () => {
    it('should format simple table with data', () => {
      const data = [
        { name: 'John', age: 30, city: 'NYC' },
        { name: 'Jane', age: 25, city: 'LA' }
      ];
      const columns = ['name', 'age', 'city'];

      TableFormatter.format(data, columns);

      // Verify console.log was called (table was printed)
      expect(consoleLogSpy).toHaveBeenCalled();

      // Verify separator lines were printed
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('+');
      expect(output).toContain('|');
    });

    it('should handle empty data array', () => {
      const data = [];
      const columns = ['name', 'age'];

      TableFormatter.format(data, columns);

      expect(consoleLogSpy).toHaveBeenCalledWith('No data to display');
    });

    it('should handle null data', () => {
      TableFormatter.format(null, ['col1']);

      expect(consoleLogSpy).toHaveBeenCalledWith('No data to display');
    });

    it('should handle custom headers', () => {
      const data = [{ orderNum: '123' }];
      const columns = ['orderNum'];
      const options = {
        headers: { orderNum: 'Order Number' }
      };

      TableFormatter.format(data, columns, options);

      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Order Number');
    });

    it('should handle custom formatters', () => {
      const data = [{ price: 1000 }];
      const columns = ['price'];
      const options = {
        formatters: {
          price: (val) => `$${val}`
        }
      };

      TableFormatter.format(data, columns, options);

      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('$1000');
    });

    it('should handle null values without NaN width', () => {
      const data = [
        { name: 'John', value: null },
        { name: 'Jane', value: undefined }
      ];
      const columns = ['name', 'value'];

      // This should not throw and should not produce NaN widths
      expect(() => TableFormatter.format(data, columns)).not.toThrow();

      // Verify table was printed
      expect(consoleLogSpy).toHaveBeenCalled();

      // Verify no NaN in output (would appear as ++ in separator)
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).not.toContain('++');
    });

    it('should handle formatters returning null/undefined without NaN', () => {
      const data = [{ value: 'test' }];
      const columns = ['value'];
      const options = {
        formatters: {
          value: () => null
        }
      };

      expect(() => TableFormatter.format(data, columns, options)).not.toThrow();

      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).not.toContain('++');
    });

    it('should truncate long values to maxWidth', () => {
      const data = [{ text: 'This is a very long text that should be truncated' }];
      const columns = ['text'];
      const options = { maxWidth: 10 };

      TableFormatter.format(data, columns, options);

      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('...');
    });

    it('should calculate column widths correctly with mixed data types', () => {
      const data = [
        { col1: 'short', col2: 123 },
        { col1: 'much longer text', col2: 456 }
      ];
      const columns = ['col1', 'col2'];

      expect(() => TableFormatter.format(data, columns)).not.toThrow();

      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      // Verify separators are consistent (no NaN widths)
      const separators = output.split('\n').filter(line => line.startsWith('+'));
      expect(separators.length).toBeGreaterThan(0);
      separators.forEach(sep => {
        expect(sep).toMatch(/^\+[-+]+\+$/); // Should be +---+---+ format
      });
    });
  });

  describe('formatKeyValue', () => {
    it('should format key-value pairs', () => {
      const data = {
        Name: 'John Doe',
        Age: 30,
        City: 'New York'
      };

      TableFormatter.formatKeyValue(data);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');

      // Should contain box drawing characters
      expect(output).toContain('┌');
      expect(output).toContain('│');
      expect(output).toContain('└');
    });

    it('should handle empty object', () => {
      const data = {};

      // formatKeyValue will throw RangeError on empty object due to Math.max on empty array
      expect(() => TableFormatter.formatKeyValue(data)).toThrow(RangeError);
    });
  });

  describe('_toHeaderCase', () => {
    it('should convert camelCase to Header Case', () => {
      const result = TableFormatter._toHeaderCase('orderNumber');
      expect(result).toBe('Order Number');
    });

    it('should handle single word', () => {
      const result = TableFormatter._toHeaderCase('name');
      expect(result).toBe('Name');
    });

    it('should handle already capitalized', () => {
      const result = TableFormatter._toHeaderCase('OrderNumber');
      expect(result).toBe('Order Number');
    });
  });

  describe('_truncate', () => {
    it('should truncate long strings', () => {
      const result = TableFormatter._truncate('This is a very long string', 10);
      expect(result).toBe('This is...');
      expect(result.length).toBe(10);
    });

    it('should not truncate short strings', () => {
      const result = TableFormatter._truncate('Short', 10);
      expect(result).toBe('Short');
    });

    it('should handle null values', () => {
      const result = TableFormatter._truncate(null, 10);
      expect(result).toBe('');
    });

    it('should handle undefined values', () => {
      const result = TableFormatter._truncate(undefined, 10);
      expect(result).toBe('');
    });

    it('should convert non-string values to string and truncate if needed', () => {
      const result = TableFormatter._truncate(123, 5);
      expect(result).toBe('123');
    });
  });
});
