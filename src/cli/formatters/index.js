/**
 * CLI Formatters
 *
 * Export all formatters for easy import
 */

const ConsoleFormatter = require('./ConsoleFormatter');
const TableFormatter = require('./TableFormatter');
const ReportFormatter = require('./ReportFormatter');

module.exports = {
  ConsoleFormatter,
  TableFormatter,
  ReportFormatter
};
