/**
 * ProcessUnprocessedOrders Use Case
 *
 * Processes all unprocessed orders by creating and submitting invoices to AFIP.
 * Part of Application Layer - orchestrates batch invoice processing.
 */

const UseCase = require('../UseCase');
const CreateInvoice = require('./CreateInvoice');
const logger = require('../../../utils/logger');

/**
 * @typedef {Object} ProcessUnprocessedOrdersInput
 * @property {number} [limit] - Maximum number of orders to process
 * @property {string} [tradeType] - Filter by trade type (SELL or BUY)
 */

/**
 * @typedef {Object} ProcessUnprocessedOrdersOutput
 * @property {number} totalOrders - Total unprocessed orders found
 * @property {number} processedOrders - Orders successfully processed
 * @property {number} failedOrders - Orders that failed to process
 * @property {Array<Object>} results - Detailed results for each order
 */

class ProcessUnprocessedOrders extends UseCase {
  /**
   * @param {IOrderRepository} orderRepository - Order repository
   * @param {IAfipGateway} afipGateway - AFIP gateway
   */
  constructor(orderRepository, afipGateway) {
    super();
    this.orderRepository = orderRepository;
    this.afipGateway = afipGateway;
    // Create CreateInvoice use case for processing individual orders
    this.createInvoiceUseCase = new CreateInvoice(orderRepository, afipGateway);
  }

  /**
   * Validate input parameters
   * @override
   */
  validateInput(input) {
    super.validateInput(input);

    const { ValidationError } = require('../../../shared/errors');

    if (input.limit !== undefined) {
      if (typeof input.limit !== 'number' || input.limit < 1) {
        throw new ValidationError('limit must be a positive number');
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
   * @param {ProcessUnprocessedOrdersInput} input - Input parameters
   * @returns {Promise<ProcessUnprocessedOrdersOutput>} Processing results
   */
  async execute(input = {}) {
    this.validateInput(input);

    const { limit, tradeType } = input;

    logger.info('Processing unprocessed orders', { limit, tradeType });

    try {
      // 1. Get all unprocessed orders
      let unprocessedOrders = await this.orderRepository.findUnprocessed();

      // 2. Filter by trade type if specified
      if (tradeType) {
        unprocessedOrders = unprocessedOrders.filter(order => order.tradeType === tradeType);
      }

      // 3. Filter out orders that are too old (>10 days)
      const eligibleOrders = unprocessedOrders.filter(order => order.isReadyForInvoicing());

      logger.info(`Found ${eligibleOrders.length} eligible orders for processing`);

      if (eligibleOrders.length === 0) {
        return {
          totalOrders: 0,
          processedOrders: 0,
          failedOrders: 0,
          results: []
        };
      }

      // 4. Apply limit if specified
      const ordersToProcess = limit
        ? eligibleOrders.slice(0, limit)
        : eligibleOrders;

      // 5. Log orders that will be processed for visibility
      logger.info('Orders to be processed:', {
        count: ordersToProcess.length,
        orders: ordersToProcess.map(o => ({
          orderNumber: o.orderNumber.value,
          orderDate: o.orderDate,
          amount: o.totalAmount.format(),
          currentStatus: o.isProcessed() ? 'processed' : 'unprocessed'
        })),
        event: 'processing_preview'
      });

      // 5. Process each order
      const results = [];
      let successCount = 0;
      let failCount = 0;

      for (const order of ordersToProcess) {
        try {
          logger.info(`Processing order ${order.orderNumber.value}`);

          const result = await this.createInvoiceUseCase.execute({
            orderNumber: order.orderNumber.value
          });

          results.push({
            orderNumber: result.orderNumber,
            success: result.success,
            cae: result.cae,
            error: result.error
          });

          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }

        } catch (error) {
          logger.error(`Failed to process order ${order.orderNumber.value}`, {
            error: error.message
          });

          results.push({
            orderNumber: order.orderNumber.value,
            success: false,
            error: error.message
          });

          failCount++;
        }
      }

      logger.info('Batch processing completed', {
        total: ordersToProcess.length,
        success: successCount,
        failed: failCount
      });

      return {
        totalOrders: ordersToProcess.length,
        processedOrders: successCount,
        failedOrders: failCount,
        results
      };

    } catch (error) {
      logger.error('Failed to process unprocessed orders', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = ProcessUnprocessedOrders;
