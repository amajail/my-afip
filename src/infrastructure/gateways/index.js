/**
 * Infrastructure Gateways
 *
 * Export all gateway implementations
 */

const AfipGatewayAdapter = require('./AfipGatewayAdapter');
const BinanceGatewayAdapter = require('./BinanceGatewayAdapter');

module.exports = {
  AfipGatewayAdapter,
  BinanceGatewayAdapter
};
