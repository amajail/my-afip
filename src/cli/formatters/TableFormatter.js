/**
 * TableFormatter
 *
 * Formats data as ASCII tables for CLI output
 * Part of Presentation Layer (CLI)
 */

class TableFormatter {
  /**
   * Format data as ASCII table
   * @param {Array<Object>} data - Array of objects to display
   * @param {Array<string>} columns - Column names to display
   * @param {Object} [options] - Formatting options
   * @param {Object} [options.headers] - Custom header names
   * @param {Object} [options.formatters] - Custom formatters for columns
   * @param {number} [options.maxWidth] - Maximum column width
   */
  static format(data, columns, options = {}) {
    if (!data || data.length === 0) {
      console.log('No data to display');
      return;
    }

    const {
      headers = {},
      formatters = {},
      maxWidth = 30
    } = options;

    // Calculate column widths
    const widths = {};
    columns.forEach(col => {
      const headerName = headers[col] || this._toHeaderCase(col);
      widths[col] = Math.max(
        headerName.length,
        ...data.map(row => {
          let value = formatters[col]
            ? formatters[col](row[col], row)
            : row[col];
          // Ensure value is a string and has a length property
          const strValue = String(value ?? '');
          return Math.min(strValue.length, maxWidth);
        })
      );
    });

    // Print header
    this._printSeparator(columns, widths);
    this._printRow(
      columns.map(col => headers[col] || this._toHeaderCase(col)),
      widths,
      columns
    );
    this._printSeparator(columns, widths);

    // Print rows
    data.forEach(row => {
      const values = columns.map(col => {
        const value = formatters[col]
          ? formatters[col](row[col], row)
          : String(row[col] || '');
        return this._truncate(value, maxWidth);
      });
      this._printRow(values, widths, columns);
    });

    this._printSeparator(columns, widths);
  }

  /**
   * Format simple two-column table (key-value pairs)
   * @param {Object} data - Object with key-value pairs
   */
  static formatKeyValue(data) {
    const maxKeyLength = Math.max(...Object.keys(data).map(k => k.length));

    console.log('┌' + '─'.repeat(maxKeyLength + 2) + '┬' + '─'.repeat(40) + '┐');

    Object.entries(data).forEach(([key, value]) => {
      const formattedKey = this._toHeaderCase(key).padEnd(maxKeyLength);
      const formattedValue = String(value || '').padEnd(38);
      console.log(`│ ${formattedKey} │ ${formattedValue} │`);
    });

    console.log('└' + '─'.repeat(maxKeyLength + 2) + '┴' + '─'.repeat(40) + '┘');
  }

  /**
   * Print separator line
   * @private
   */
  static _printSeparator(columns, widths) {
    const parts = columns.map(col => '-'.repeat(widths[col] + 2));
    console.log('+' + parts.join('+') + '+');
  }

  /**
   * Print table row
   * @private
   */
  static _printRow(values, widths, columns) {
    const parts = values.map((value, i) => {
      const col = columns[i];
      return ' ' + String(value).padEnd(widths[col]) + ' ';
    });
    console.log('|' + parts.join('|') + '|');
  }

  /**
   * Convert camelCase to Header Case
   * @private
   */
  static _toHeaderCase(str) {
    return str
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .trim();
  }

  /**
   * Truncate string to max length
   * @private
   */
  static _truncate(str, maxLength) {
    // Ensure str is a string
    const strValue = String(str || '');
    if (strValue.length <= maxLength) return strValue;
    return strValue.substring(0, maxLength - 3) + '...';
  }
}

module.exports = TableFormatter;
