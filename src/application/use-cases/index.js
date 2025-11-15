/**
 * Application Use Cases
 *
 * Exports all use cases organized by domain
 */

const UseCase = require('./UseCase');
const binanceUseCases = require('./binance');
const invoiceUseCases = require('./invoices');
const reportUseCases = require('./reports');

module.exports = {
  UseCase,
  ...binanceUseCases,
  ...invoiceUseCases,
  ...reportUseCases
};
