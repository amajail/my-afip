/**
 * Domain Value Objects
 *
 * Exports all domain value objects.
 * Value objects are immutable domain concepts with equality based on their values.
 */

const Money = require('./Money');
const CUIT = require('./CUIT');
const CAE = require('./CAE');
const OrderNumber = require('./OrderNumber');

module.exports = {
  Money,
  CUIT,
  CAE,
  OrderNumber
};
