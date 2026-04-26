const UseCase = require('../UseCase');
const CreateInvoice = require('./CreateInvoice');
const logger = require('../../../utils/logger');

/**
 * @typedef {Object} ProcessMonthOrdersInput
 * @property {number} year - Full year (e.g. 2026)
 * @property {number} month - Month number 1–12
 */

/**
 * @typedef {Object} ProcessMonthOrdersOutput
 * @property {number} year
 * @property {number} month
 * @property {number} totalOrders
 * @property {number} processedOrders
 * @property {number} failedOrders
 * @property {Array<Object>} results
 */

class ProcessMonthOrders extends UseCase {
  constructor(orderRepository, afipGateway) {
    super();
    this.orderRepository = orderRepository;
    this.afipGateway = afipGateway;
    this.createInvoiceUseCase = new CreateInvoice(orderRepository, afipGateway);
  }

  validateInput(input) {
    super.validateInput(input);
    const { ValidationError } = require('../../../shared/errors');
    const { year, month } = input;
    if (!year || !Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new ValidationError('year must be a valid 4-digit number');
    }
    if (!month || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new ValidationError('month must be between 1 and 12');
    }
  }

  async execute(input) {
    this.validateInput(input);

    const { year, month } = input;
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

    // Use today as invoice date — AFIP requires date >= last issued invoice date
    const today = new Date();
    const invoiceDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    logger.info('Processing historical month orders', { yearMonth, invoiceDate });

    const allUnprocessed = await this.orderRepository.findUnprocessed();
    const monthOrders = allUnprocessed
      .filter(o => o.orderDate && o.orderDate.startsWith(yearMonth))
      .sort((a, b) => a.orderDate.localeCompare(b.orderDate));

    logger.info(`Found ${monthOrders.length} pending orders for ${yearMonth}`);

    if (monthOrders.length === 0) {
      return { year, month, totalOrders: 0, processedOrders: 0, failedOrders: 0, results: [] };
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const order of monthOrders) {
      try {
        const result = await this.createInvoiceUseCase.execute({
          orderNumber: order.orderNumber.value,
          invoiceDate,
          skipAgeCheck: true,
        });

        results.push({ orderNumber: result.orderNumber, success: result.success, cae: result.cae, error: result.error });
        result.success ? successCount++ : failCount++;
      } catch (error) {
        logger.error(`Failed to process order ${order.orderNumber.value}`, { error: error.message });
        results.push({ orderNumber: order.orderNumber.value, success: false, error: error.message });
        failCount++;
      }
    }

    logger.info('Month processing completed', { yearMonth, success: successCount, failed: failCount });

    return { year, month, totalOrders: monthOrders.length, processedOrders: successCount, failedOrders: failCount, results };
  }
}

module.exports = ProcessMonthOrders;
