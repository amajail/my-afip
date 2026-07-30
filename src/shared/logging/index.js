/**
 * Logging Layer Exports
 *
 * Provides a centralized logging system with support for:
 * - Console logging (CLI/development)
 * - Application Insights (Azure Functions)
 * - Automatic logger selection based on environment
 */

const Logger = require('./Logger');
const ConsoleLogger = require('./loggers/ConsoleLogger');
const ApplicationInsightsLogger = require('./loggers/ApplicationInsightsLogger');
const LoggerFactory = require('./LoggerFactory');

// LOG_LEVEL is read straight from the env (same default as shared/config's
// app.logLevel) instead of via require('../config'): that module eagerly
// validates AFIP cert vars the deployed Function App does not set, so a
// logger that drags it in throws in every module that logs — which is how
// the MCP tools returned config errors on a box where /api/* works fine.
const defaultLogger = LoggerFactory.createLogger({
  level: process.env.LOG_LEVEL || 'info'
});

module.exports = {
  // Export classes for manual instantiation
  Logger,
  ConsoleLogger,
  ApplicationInsightsLogger,
  LoggerFactory,

  // Export default logger instance
  default: defaultLogger,

  // Export convenience methods from default logger
  error: defaultLogger.error.bind(defaultLogger),
  warn: defaultLogger.warn.bind(defaultLogger),
  info: defaultLogger.info.bind(defaultLogger),
  http: defaultLogger.http.bind(defaultLogger),
  debug: defaultLogger.debug.bind(defaultLogger),
  log: defaultLogger.log.bind(defaultLogger),

  // Export domain-specific helpers
  logInvoiceCreation: defaultLogger.logInvoiceCreation.bind(defaultLogger),
  logInvoiceFailure: defaultLogger.logInvoiceFailure.bind(defaultLogger),
  logBinanceOrder: defaultLogger.logBinanceOrder.bind(defaultLogger),
  logDatabaseOperation: defaultLogger.logDatabaseOperation.bind(defaultLogger),
  logAfipApiCall: defaultLogger.logAfipApiCall.bind(defaultLogger),
  logStartup: defaultLogger.logStartup.bind(defaultLogger),
  logShutdown: defaultLogger.logShutdown.bind(defaultLogger)
};
