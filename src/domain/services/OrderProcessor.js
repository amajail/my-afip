/**
 * OrderProcessor Domain Service
 *
 * Stateless service for processing orders into invoices.
 * Orchestrates the business logic for order validation and invoice creation.
 */

const Invoice = require('../entities/Invoice');
const InvoiceCalculator = require('./InvoiceCalculator');
const InvoiceDateValidator = require('./InvoiceDateValidator');
const { DomainError } = require('../../shared/errors');

/**
 * Domain service for order processing
 */
class OrderProcessor {
  /**
   * Check if an order can be processed
   * @param {Order} order - Order to check
   * @returns {{canProcess: boolean, reasons: string[]}} Processing eligibility
   */
  static canProcess(order) {
    const reasons = [];

    // Must be a SELL trade
    if (!order.isSellTrade()) {
      reasons.push('Only SELL trades can be processed');
    }

    // Must not be already processed
    if (order.isProcessed()) {
      reasons.push('Order has already been processed');
    }

    // Must be within invoicing period
    if (!order.isReadyForInvoicing()) {
      const status = InvoiceDateValidator.canStillInvoice(order.orderDate);
      if (!status.canInvoice) {
        reasons.push('Order is outside the 10-day invoicing period');
      }
    }

    return {
      canProcess: reasons.length === 0,
      reasons
    };
  }

  /**
   * Validate order for processing and throw if invalid
   * @param {Order} order - Order to validate
   * @throws {DomainError} If order cannot be processed
   */
  static validateForProcessing(order) {
    const result = OrderProcessor.canProcess(order);

    if (!result.canProcess) {
      throw new DomainError(
        `Order cannot be processed: ${result.reasons.join(', ')}`,
        { orderNumber: order.orderNumber.value, reasons: result.reasons }
      );
    }
  }

  /**
   * Determine optimal invoice date for an order
   * @param {Order} order - Order to process
   * @param {string} [preferredDate] - Preferred invoice date (YYYY-MM-DD)
   * @returns {string} Optimal invoice date (YYYY-MM-DD)
   */
  static determineInvoiceDate(order, preferredDate = null) {
    // If preferred date is provided and valid, use it
    if (preferredDate) {
      const validation = InvoiceDateValidator.validate(
        preferredDate,
        order.orderDate
      );

      if (validation.valid) {
        return preferredDate;
      }
    }

    // Otherwise, suggest the best date
    return InvoiceDateValidator.suggestInvoiceDate(order.orderDate);
  }

  /**
   * Determine if VAT should be included in invoice
   * @param {Order} order - Order to process
   * @param {Object} options - Processing options
   * @param {boolean} [options.forceVAT=false] - Force VAT inclusion
   * @param {boolean} [options.forceNoVAT=false] - Force no VAT
   * @returns {boolean} Whether to include VAT
   */
  static shouldIncludeVAT(order, options = {}) {
    const { forceVAT = false, forceNoVAT = false } = options;

    if (forceVAT && forceNoVAT) {
      throw new DomainError('Cannot force both VAT and no VAT');
    }

    if (forceVAT) return true;
    if (forceNoVAT) return false;

    // Default business rule: Monotributista to final consumer = no VAT
    return InvoiceCalculator.shouldApplyVAT(order.totalAmount, {
      isMonotributista: true,  // Assuming seller is Monotributista
      isFinalConsumer: true     // Assuming buyer is final consumer
    });
  }

  /**
   * Create invoice from order
   * @param {Order} order - Order to convert
   * @param {Object} options - Creation options
   * @param {string} [options.invoiceDate] - Override invoice date
   * @param {boolean} [options.includeVAT] - Whether to include VAT
   * @param {number} [options.vatRate] - VAT rate if including VAT
   * @returns {Invoice} Created invoice
   * @throws {DomainError} If order cannot be processed
   */
  static createInvoiceFromOrder(order, options = {}) {
    // Validate order can be processed
    OrderProcessor.validateForProcessing(order);

    // Determine invoice date
    const invoiceDate = OrderProcessor.determineInvoiceDate(
      order,
      options.invoiceDate
    );

    // Determine VAT inclusion
    const includeVAT = options.includeVAT !== undefined
      ? options.includeVAT
      : OrderProcessor.shouldIncludeVAT(order, options);

    // Calculate amounts
    const amounts = InvoiceCalculator.calculateInvoiceAmounts(
      order.totalAmount,
      {
        includeVAT,
        vatRate: options.vatRate
      }
    );

    // Create invoice using entity factory method
    const invoice = Invoice.fromOrder(order, {
      invoiceDate,
      includeVAT,
      vatRate: options.vatRate
    });

    return invoice;
  }

  /**
   * Process multiple orders and determine which can be processed
   * @param {Order[]} orders - Orders to check
   * @returns {{processable: Order[], unprocessable: Array<{order: Order, reasons: string[]}>}} Categorized orders
   */
  static categorizeOrders(orders) {
    const processable = [];
    const unprocessable = [];

    for (const order of orders) {
      const check = OrderProcessor.canProcess(order);

      if (check.canProcess) {
        processable.push(order);
      } else {
        unprocessable.push({
          order,
          reasons: check.reasons
        });
      }
    }

    return { processable, unprocessable };
  }

  /**
   * Calculate processing statistics for a set of orders
   * @param {Order[]} orders - Orders to analyze
   * @returns {Object} Processing statistics
   */
  static calculateStatistics(orders) {
    const stats = {
      total: orders.length,
      processed: 0,
      unprocessed: 0,
      successful: 0,
      failed: 0,
      sellTrades: 0,
      buyTrades: 0,
      readyForInvoicing: 0,
      expiredForInvoicing: 0
    };

    for (const order of orders) {
      if (order.isProcessed()) {
        stats.processed++;
        if (order.isSuccessful()) {
          stats.successful++;
        } else {
          stats.failed++;
        }
      } else {
        stats.unprocessed++;
      }

      if (order.isSellTrade()) {
        stats.sellTrades++;
      } else {
        stats.buyTrades++;
      }

      if (order.isReadyForInvoicing()) {
        stats.readyForInvoicing++;
      } else if (!order.isProcessed() && order.isSellTrade()) {
        stats.expiredForInvoicing++;
      }
    }

    return stats;
  }

  /**
   * Get processing recommendation for an order
   * @param {Order} order - Order to analyze
   * @returns {{action: string, priority: string, message: string}} Recommendation
   */
  static getProcessingRecommendation(order) {
    const check = OrderProcessor.canProcess(order);

    if (!check.canProcess) {
      return {
        action: 'skip',
        priority: 'none',
        message: check.reasons.join(', ')
      };
    }

    // Check urgency based on days remaining
    const status = InvoiceDateValidator.canStillInvoice(order.orderDate);

    if (status.daysRemaining <= 2) {
      return {
        action: 'process',
        priority: 'urgent',
        message: `Only ${status.daysRemaining} days remaining in invoicing period`
      };
    } else if (status.daysRemaining <= 5) {
      return {
        action: 'process',
        priority: 'high',
        message: `${status.daysRemaining} days remaining in invoicing period`
      };
    } else {
      return {
        action: 'process',
        priority: 'normal',
        message: `${status.daysRemaining} days remaining in invoicing period`
      };
    }
  }
}

module.exports = OrderProcessor;
