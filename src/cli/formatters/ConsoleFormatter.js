/**
 * ConsoleFormatter
 *
 * Handles formatted console output for CLI
 * Part of Presentation Layer (CLI)
 */

class ConsoleFormatter {
  /**
   * Format success message
   * @param {string} message - Success message
   */
  static success(message) {
    console.log(`✅ ${message}`);
  }

  /**
   * Format error message
   * @param {string} message - Error message
   * @param {Error} [error] - Optional error object
   */
  static error(message, error = null) {
    console.error(`❌ ${message}`);
    if (error && error.message) {
      console.error(`   ${error.message}`);
    }
  }

  /**
   * Format warning message
   * @param {string} message - Warning message
   */
  static warning(message) {
    console.warn(`⚠️  ${message}`);
  }

  /**
   * Format info message
   * @param {string} message - Info message
   */
  static info(message) {
    console.log(`ℹ️  ${message}`);
  }

  /**
   * Format section header
   * @param {string} title - Section title
   */
  static header(title) {
    console.log('');
    console.log(`${'='.repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${'='.repeat(60)}`);
    console.log('');
  }

  /**
   * Format subsection header
   * @param {string} title - Subsection title
   */
  static subheader(title) {
    console.log('');
    console.log(`${title}`);
    console.log(`${'-'.repeat(title.length)}`);
  }

  /**
   * Format key-value pair
   * @param {string} key - Key name
   * @param {*} value - Value
   * @param {number} [indent=0] - Indentation level
   */
  static keyValue(key, value, indent = 0) {
    const spaces = '  '.repeat(indent);
    console.log(`${spaces}${key}: ${value}`);
  }

  /**
   * Format list item
   * @param {string} item - Item text
   * @param {number} [indent=0] - Indentation level
   */
  static listItem(item, indent = 0) {
    const spaces = '  '.repeat(indent);
    console.log(`${spaces}• ${item}`);
  }

  /**
   * Print empty line
   */
  static newLine() {
    console.log('');
  }

  /**
   * Format progress indicator
   * @param {string} message - Progress message
   */
  static progress(message) {
    console.log(`⏳ ${message}...`);
  }

  /**
   * Format statistics summary
   * @param {Object} stats - Statistics object
   */
  static stats(stats) {
    this.subheader('Statistics');
    Object.entries(stats).forEach(([key, value]) => {
      const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
      const capitalizedKey = formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);
      this.keyValue(capitalizedKey, value, 1);
    });
    this.newLine();
  }
}

module.exports = ConsoleFormatter;
