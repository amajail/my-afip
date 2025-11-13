/**
 * Domain Entities
 *
 * Export all domain entities (aggregate roots)
 */

const Order = require('./Order');
const Invoice = require('./Invoice');
const InvoiceResult = require('./InvoiceResult');

module.exports = {
  Order,
  Invoice,
  InvoiceResult
};
