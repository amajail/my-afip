/**
 * Infrastructure Layer
 *
 * Export all infrastructure implementations (Adapters)
 * - Repository implementations
 * - Gateway implementations
 */

const repositories = require('./repositories');
const gateways = require('./gateways');

module.exports = {
  // Repositories
  SQLiteOrderRepository: repositories.SQLiteOrderRepository,
  SQLiteInvoiceRepository: repositories.SQLiteInvoiceRepository,

  // Gateways
  AfipGatewayAdapter: gateways.AfipGatewayAdapter,
  BinanceGatewayAdapter: gateways.BinanceGatewayAdapter
};
