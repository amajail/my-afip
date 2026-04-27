/**
 * Infrastructure Repositories
 *
 * Export all repository implementations
 */

const AzureOrderRepository = require('./AzureOrderRepository');
const AzureInvoiceRepository = require('./AzureInvoiceRepository');

module.exports = {
  AzureOrderRepository,
  AzureInvoiceRepository
};
