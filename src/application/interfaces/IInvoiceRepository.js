/**
 * IInvoiceRepository Interface
 *
 * Repository interface for Invoice persistence following Repository pattern.
 * Defines the contract for Invoice data access operations.
 * Infrastructure layer will implement this interface.
 */

/**
 * Invoice Repository Interface
 * @interface
 */
class IInvoiceRepository {
  /**
   * Save a new invoice result
   * @param {Object} invoiceData - Invoice data to save
   * @param {string} invoiceData.orderNumber - Associated order number
   * @param {InvoiceResult} invoiceData.result - Invoice result
   * @param {Invoice} invoiceData.invoice - Invoice entity
   * @returns {Promise<Object>} Saved invoice record
   * @abstract
   */
  async save(invoiceData) {
    throw new Error('Method not implemented: save');
  }

  /**
   * Find invoice by CAE
   * @param {CAE|string} cae - CAE to find
   * @returns {Promise<Object|null>} Found invoice or null
   * @abstract
   */
  async findByCAE(cae) {
    throw new Error('Method not implemented: findByCAE');
  }

  /**
   * Find invoice by order number
   * @param {OrderNumber|string} orderNumber - Order number
   * @returns {Promise<Object|null>} Found invoice or null
   * @abstract
   */
  async findByOrderNumber(orderNumber) {
    throw new Error('Method not implemented: findByOrderNumber');
  }

  /**
   * Find invoices by date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object[]>} Invoices in date range
   * @abstract
   */
  async findByDateRange(startDate, endDate) {
    throw new Error('Method not implemented: findByDateRange');
  }

  /**
   * Find successful invoices
   * @returns {Promise<Object[]>} Successful invoices
   * @abstract
   */
  async findSuccessful() {
    throw new Error('Method not implemented: findSuccessful');
  }

  /**
   * Find failed invoices
   * @returns {Promise<Object[]>} Failed invoices
   * @abstract
   */
  async findFailed() {
    throw new Error('Method not implemented: findFailed');
  }

  /**
   * Get total count of invoices
   * @returns {Promise<number>} Total invoice count
   * @abstract
   */
  async count() {
    throw new Error('Method not implemented: count');
  }
}

module.exports = IInvoiceRepository;
