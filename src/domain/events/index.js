/**
 * Domain Events
 *
 * Export all domain events
 */

const InvoiceCreated = require('./InvoiceCreated');
const OrderProcessed = require('./OrderProcessed');

module.exports = {
  InvoiceCreated,
  OrderProcessed
};
