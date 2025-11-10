/**
 * Logger Module (Backward Compatibility Layer)
 *
 * This file now re-exports from the new shared logging layer.
 * It maintains backward compatibility for existing code.
 *
 * @deprecated Use '../shared/logging' directly in new code
 */

// Re-export the default logger from shared logging layer
const logging = require('../shared/logging');

// Export the default logger with all its methods
module.exports = logging.default;

// Also export convenience methods directly on the module
module.exports.error = logging.error;
module.exports.warn = logging.warn;
module.exports.info = logging.info;
module.exports.http = logging.http;
module.exports.debug = logging.debug;
module.exports.log = logging.log;

// Export domain-specific helpers
module.exports.logInvoiceCreation = logging.logInvoiceCreation;
module.exports.logInvoiceFailure = logging.logInvoiceFailure;
module.exports.logBinanceOrder = logging.logBinanceOrder;
module.exports.logDatabaseOperation = logging.logDatabaseOperation;
