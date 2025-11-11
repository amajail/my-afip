/**
 * Application Interfaces (Ports)
 *
 * Export all interfaces for dependency inversion
 */

const IOrderRepository = require('./IOrderRepository');
const IInvoiceRepository = require('./IInvoiceRepository');
const IAfipGateway = require('./IAfipGateway');
const IBinanceGateway = require('./IBinanceGateway');

module.exports = {
  IOrderRepository,
  IInvoiceRepository,
  IAfipGateway,
  IBinanceGateway
};
