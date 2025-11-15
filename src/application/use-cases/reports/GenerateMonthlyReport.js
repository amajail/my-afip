/**
 * GenerateMonthlyReport Use Case
 *
 * Generates a comprehensive monthly report with order and invoice statistics.
 * Part of Application Layer - orchestrates reporting logic.
 */

const UseCase = require('../UseCase');
const logger = require('../../../utils/logger');
const { formatCurrency } = require('../../../shared/utils/currency.utils');

/**
 * @typedef {Object} GenerateMonthlyReportInput
 * @property {number} [year] - Year (defaults to current year)
 * @property {number} [month] - Month 1-12 (defaults to current month)
 */

/**
 * @typedef {Object} MonthlyReportOutput
 * @property {number} year - Report year
 * @property {number} month - Report month
 * @property {Object} stats - Statistical data
 * @property {Array<Object>} orders - Order details
 */

class GenerateMonthlyReport extends UseCase {
  /**
   * @param {IOrderRepository} orderRepository - Order repository
   */
  constructor(orderRepository) {
    super();
    this.orderRepository = orderRepository;
  }

  /**
   * Validate input parameters
   * @override
   */
  validateInput(input) {
    super.validateInput(input);

    const { ValidationError } = require('../../../shared/errors');

    if (input.year !== undefined) {
      if (typeof input.year !== 'number' || input.year < 2000 || input.year > 2100) {
        throw new ValidationError('year must be a number between 2000 and 2100');
      }
    }

    if (input.month !== undefined) {
      if (typeof input.month !== 'number' || input.month < 1 || input.month > 12) {
        throw new ValidationError('month must be a number between 1 and 12');
      }
    }
  }

  /**
   * Execute the use case
   *
   * @param {GenerateMonthlyReportInput} input - Input parameters
   * @returns {Promise<MonthlyReportOutput>} Monthly report
   */
  async execute(input = {}) {
    this.validateInput(input);

    const now = new Date();
    const year = input.year || now.getFullYear();
    const month = input.month || now.getMonth() + 1;

    logger.info('Generating monthly report', { year, month });

    try {
      // Calculate date range for the month
      const startDate = this._getMonthStartDate(year, month);
      const endDate = this._getMonthEndDate(year, month);

      // Fetch all orders for the month
      const orders = await this.orderRepository.findByDateRange(startDate, endDate);

      // Calculate statistics
      const stats = this._calculateStatistics(orders);

      // Format order details
      const orderDetails = this._formatOrderDetails(orders);

      logger.info('Monthly report generated', {
        year,
        month,
        totalOrders: orders.length
      });

      return {
        year,
        month,
        stats,
        orders: orderDetails
      };

    } catch (error) {
      logger.error('Failed to generate monthly report', {
        error: error.message,
        year,
        month
      });
      throw error;
    }
  }

  /**
   * Calculate statistics from orders
   *
   * @private
   * @param {Order[]} orders - Orders to analyze
   * @returns {Object} Statistics
   */
  _calculateStatistics(orders) {
    const stats = {
      totalOrders: orders.length,
      totalAmount: 0,
      processedOrders: 0,
      successfulInvoices: 0,
      failedInvoices: 0,
      pendingOrders: 0,
      averageAmount: 0,
      byTradeType: {
        SELL: 0,
        BUY: 0
      },
      byCurrency: {}
    };

    if (orders.length === 0) {
      return stats;
    }

    let totalAmountSum = 0;

    for (const order of orders) {
      // Count by status
      if (order.isProcessed()) {
        stats.processedOrders++;
        if (order.isSuccessful()) {
          stats.successfulInvoices++;
        } else {
          stats.failedInvoices++;
        }
      } else {
        stats.pendingOrders++;
      }

      // Count by trade type
      if (order.tradeType === 'SELL' || order.tradeType === 'BUY') {
        stats.byTradeType[order.tradeType]++;
      }

      // Sum amounts
      const amount = order.totalAmount.amount;
      totalAmountSum += amount;

      // Count by currency
      const currency = order.totalAmount.currency;
      if (!stats.byCurrency[currency]) {
        stats.byCurrency[currency] = {
          count: 0,
          total: 0
        };
      }
      stats.byCurrency[currency].count++;
      stats.byCurrency[currency].total += amount;
    }

    stats.totalAmount = totalAmountSum;
    stats.averageAmount = totalAmountSum / orders.length;

    return stats;
  }

  /**
   * Format order details for output
   *
   * @private
   * @param {Order[]} orders - Orders to format
   * @returns {Array<Object>} Formatted order details
   */
  _formatOrderDetails(orders) {
    return orders.map(order => ({
      orderNumber: order.orderNumber.value,
      date: order.orderDate,
      tradeType: order.tradeType,
      amount: order.totalAmount.format(),
      asset: order.asset,
      status: order.isProcessed()
        ? (order.isSuccessful() ? 'success' : 'failed')
        : 'pending',
      cae: order.cae || null,
      errorMessage: order.errorMessage || null
    }));
  }

  /**
   * Get the start date of a month
   *
   * @private
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @returns {string} Date string (YYYY-MM-DD)
   */
  _getMonthStartDate(year, month) {
    return `${year}-${String(month).padStart(2, '0')}-01`;
  }

  /**
   * Get the end date of a month
   *
   * @private
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @returns {string} Date string (YYYY-MM-DD)
   */
  _getMonthEndDate(year, month) {
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }
}

module.exports = GenerateMonthlyReport;
