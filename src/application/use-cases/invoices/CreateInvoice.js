/**
 * CreateInvoice Use Case
 *
 * Creates an AFIP invoice from an order, submits it to AFIP,
 * and saves the result.
 * Part of Application Layer - orchestrates domain and infrastructure.
 */

const UseCase = require('../UseCase');
const Invoice = require('../../../domain/entities/Invoice');
const InvoiceDateValidator = require('../../../domain/services/InvoiceDateValidator');
const logger = require('../../../utils/logger');
const { NotFoundError, DomainError } = require('../../../shared/errors');

/**
 * @typedef {Object} CreateInvoiceInput
 * @property {string} orderNumber - Order number to create invoice for
 * @property {string} [invoiceDate] - Optional invoice date (YYYY-MM-DD), defaults to today
 */

/**
 * @typedef {Object} CreateInvoiceOutput
 * @property {boolean} success - Whether invoice creation succeeded
 * @property {string} [cae] - CAE number if successful
 * @property {string} [caeExpiration] - CAE expiration date if successful
 * @property {number} [voucherNumber] - Voucher number if successful
 * @property {string} [error] - Error message if failed
 * @property {string} orderNumber - Order number processed
 */

class CreateInvoice extends UseCase {
  /**
   * @param {IOrderRepository} orderRepository - Order repository
   * @param {IAfipGateway} afipGateway - AFIP gateway
   */
  constructor(orderRepository, afipGateway) {
    super();
    this.orderRepository = orderRepository;
    this.afipGateway = afipGateway;
  }

  /**
   * Validate input parameters
   * @override
   */
  validateInput(input) {
    super.validateInput(input);

    const { ValidationError } = require('../../../shared/errors');

    if (!input.orderNumber) {
      throw new ValidationError('orderNumber is required');
    }

    if (typeof input.orderNumber !== 'string') {
      throw new ValidationError('orderNumber must be a string');
    }

    if (input.invoiceDate) {
      const validation = InvoiceDateValidator.validateDateFormat(input.invoiceDate);
      if (!validation.valid) {
        throw new ValidationError(`Invalid invoice date: ${validation.error}`);
      }
    }
  }

  /**
   * Execute the use case
   *
   * @param {CreateInvoiceInput} input - Input parameters
   * @returns {Promise<CreateInvoiceOutput>} Invoice creation result
   */
  async execute(input) {
    this.validateInput(input);

    const { orderNumber, invoiceDate } = input;

    logger.info('Creating invoice for order', { orderNumber });

    try {
      // 1. Find the order
      const order = await this.orderRepository.findByOrderNumber(orderNumber);
      if (!order) {
        throw new NotFoundError.order(orderNumber);
      }

      // 2. Validate order can be processed
      if (!order.canBeProcessed()) {
        const reason = order.isProcessed()
          ? 'Order already processed'
          : 'Order is not a SELL order';
        throw new DomainError(reason, { orderNumber });
      }

      // 3. Validate order date is within AFIP limits
      if (!order.isReadyForInvoicing()) {
        throw new DomainError(
          'Order is too old to be invoiced (>10 days)',
          { orderNumber, orderDate: order.orderDate }
        );
      }

      // 4. Create invoice from order
      const invoice = Invoice.fromOrder(order, invoiceDate);

      logger.info('Submitting invoice to AFIP', {
        orderNumber,
        invoiceType: invoice.getInvoiceType(),
        total: invoice.totalAmount.format()
      });

      // 5. Submit to AFIP
      const result = await this.afipGateway.createInvoice(invoice);

      // 6. Update order with result
      const updatedOrder = order.markAsProcessed(
        {
          success: result.isSuccessful(),
          cae: result.isSuccessful() ? result.cae.value : null,
          voucherNumber: result.voucherNumber,
          invoiceDate: result.invoiceDate,
          errorMessage: result.isSuccessful() ? null : result.errorMessage
        },
        'automatic'
      );

      // 7. Save updated order
      await this.orderRepository.update(updatedOrder);

      logger.info('Invoice created successfully', {
        orderNumber,
        success: result.isSuccessful(),
        cae: result.cae?.value
      });

      // 8. Return result
      return {
        success: result.isSuccessful(),
        cae: result.cae?.value,
        caeExpiration: result.cae?.expirationDate,
        voucherNumber: result.voucherNumber,
        error: result.errorMessage,
        orderNumber
      };

    } catch (error) {
      logger.error('Failed to create invoice', {
        error: error.message,
        orderNumber
      });

      // Mark order as failed if it exists
      try {
        const order = await this.orderRepository.findByOrderNumber(orderNumber);
        if (order && !order.isProcessed()) {
          const failedOrder = order.markAsProcessed(
            false,
            null,
            error.message,
            'automatic'
          );
          await this.orderRepository.update(failedOrder);
        }
      } catch (updateError) {
        logger.error('Failed to update order after error', {
          error: updateError.message,
          orderNumber
        });
      }

      throw error;
    }
  }
}

module.exports = CreateInvoice;
