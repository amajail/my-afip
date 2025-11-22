/**
 * FetchBinanceOrders Use Case
 *
 * Fetches orders from Binance API and saves them to the repository.
 * Part of Application Layer - orchestrates domain and infrastructure.
 */

const UseCase = require('../UseCase');
const logger = require('../../../utils/logger');

/**
 * @typedef {Object} FetchBinanceOrdersInput
 * @property {number} [days=7] - Number of days to fetch
 * @property {string} [tradeType='SELL'] - Trade type (SELL or BUY)
 */

/**
 * @typedef {Object} FetchBinanceOrdersOutput
 * @property {number} totalOrders - Total orders fetched from Binance
 * @property {number} newOrders - New orders saved to repository
 * @property {number} existingOrders - Orders that already existed
 */

class FetchBinanceOrders extends UseCase {
  /**
   * @param {IBinanceGateway} binanceGateway - Binance gateway
   * @param {IOrderRepository} orderRepository - Order repository
   */
  constructor(binanceGateway, orderRepository) {
    super();
    this.binanceGateway = binanceGateway;
    this.orderRepository = orderRepository;
  }

  /**
   * Validate input parameters
   * @override
   */
  validateInput(input) {
    super.validateInput(input);

    const { ValidationError } = require('../../../shared/errors');

    if (input.days !== undefined) {
      if (typeof input.days !== 'number' || input.days < 1 || input.days > 90) {
        throw new ValidationError('days must be a number between 1 and 90');
      }
    }

    if (input.tradeType !== undefined) {
      const validTypes = ['SELL', 'BUY'];
      if (!validTypes.includes(input.tradeType)) {
        throw new ValidationError(`tradeType must be one of: ${validTypes.join(', ')}`);
      }
    }
  }

  /**
   * Execute the use case
   *
   * @param {FetchBinanceOrdersInput} input - Input parameters
   * @returns {Promise<FetchBinanceOrdersOutput>} Fetch results
   */
  async execute(input = {}) {
    this.validateInput(input);

    const { days = 7, tradeType = 'SELL' } = input;

    logger.info('Fetching Binance orders', { days, tradeType });

    try {
      // Fetch orders from Binance
      const binanceOrders = await this.binanceGateway.fetchOrders({ days, tradeType });

      logger.info(`Fetched ${binanceOrders.length} orders from Binance`);

      if (binanceOrders.length === 0) {
        return {
          totalOrders: 0,
          newOrders: 0,
          existingOrders: 0
        };
      }

      // Gateway already returns domain Order entities, no conversion needed
      const orders = binanceOrders;

      // Filter out orders that already exist
      const newOrders = await this._filterNewOrders(orders);

      // Save new orders to repository
      if (newOrders.length > 0) {
        await this.orderRepository.saveMany(newOrders);
        logger.info(`Saved ${newOrders.length} new orders`);
      }

      const existingCount = orders.length - newOrders.length;

      return {
        totalOrders: orders.length,
        newOrders: newOrders.length,
        existingOrders: existingCount
      };
    } catch (error) {
      logger.error('Failed to fetch Binance orders', {
        error: error.message,
        days,
        tradeType
      });
      throw error;
    }
  }

  /**
   * Filter out orders that already exist in the repository
   *
   * @private
   * @param {Order[]} orders - Orders to filter
   * @returns {Promise<Order[]>} New orders only
   */
  async _filterNewOrders(orders) {
    const newOrders = [];

    for (const order of orders) {
      const existing = await this.orderRepository.findByOrderNumber(order.orderNumber);
      if (!existing) {
        newOrders.push(order);
      }
    }

    return newOrders;
  }
}

module.exports = FetchBinanceOrders;
