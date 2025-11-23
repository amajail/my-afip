/**
 * SQLiteInvoiceRepository
 *
 * SQLite implementation of IInvoiceRepository interface
 * Part of Infrastructure Layer
 */

const IInvoiceRepository = require('../../application/interfaces/IInvoiceRepository');
const Database = require('../../database/Database');
const logger = require('../../utils/logger');

class SQLiteInvoiceRepository extends IInvoiceRepository {
  constructor(database = null) {
    super();
    this.db = database || new Database();
    this.initialized = false;
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    if (!this.initialized) {
      await this.db.initialize();
      this.initialized = true;
    }
  }

  /**
   * Save a new invoice result
   * @param {Object} invoiceData - Invoice data to save
   * @param {string} invoiceData.orderNumber - Associated order number
   * @param {InvoiceResult} invoiceData.result - Invoice result
   * @param {Invoice} invoiceData.invoice - Invoice entity
   * @returns {Promise<Object>} Saved invoice record
   */
  async save(invoiceData) {
    await this.initialize();

    const { orderNumber, result, invoice } = invoiceData;

    const recordData = {
      order_number: orderNumber,
      cae: result.isSuccess ? result.cae.value : null,
      status: result.isSuccess ? 'Success' : 'Failed',
      processing_method: result.processingMethod || 'automatic',
      invoice_date: result.isSuccess ? result.invoiceDate : null,
      error_message: result.isSuccess ? null : result.errorMessage,
      afip_response: result.rawResponse ? JSON.stringify(result.rawResponse) : null
    };

    try {
      await this.db.saveInvoiceResult(recordData);

      logger.info('Invoice saved', {
        orderNumber,
        status: recordData.status,
        cae: recordData.cae,
        event: 'invoice_saved'
      });

      return {
        ...recordData,
        id: null, // SQLite doesn't return last insert ID in current implementation
        created_at: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to save invoice', {
        orderNumber,
        error: error.message,
        event: 'invoice_save_failed'
      });
      throw error;
    }
  }

  /**
   * Find invoice by CAE
   * @param {CAE|string} cae - CAE to find
   * @returns {Promise<Object|null>} Found invoice or null
   */
  async findByCAE(cae) {
    await this.initialize();

    const caeStr = typeof cae === 'object' ? cae.value : cae;

    try {
      const rows = await this.db.getInvoiceByCAE(caeStr);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Failed to find invoice by CAE', {
        cae: caeStr,
        error: error.message,
        event: 'invoice_find_by_cae_failed'
      });
      return null;
    }
  }

  /**
   * Find invoice by order number
   * @param {OrderNumber|string} orderNumber - Order number
   * @returns {Promise<Object|null>} Found invoice or null
   */
  async findByOrderNumber(orderNumber) {
    await this.initialize();

    const orderNumberStr = typeof orderNumber === 'object'
      ? orderNumber.value
      : orderNumber;

    try {
      const rows = await this.db.getInvoiceByOrderNumber(orderNumberStr);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Failed to find invoice by order number', {
        orderNumber: orderNumberStr,
        error: error.message,
        event: 'invoice_find_by_order_failed'
      });
      return null;
    }
  }

  /**
   * Find invoices by date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object[]>} Invoices in date range
   */
  async findByDateRange(startDate, endDate) {
    await this.initialize();

    try {
      const rows = await this.db.getInvoicesByDateRange(startDate, endDate);
      return rows;
    } catch (error) {
      logger.error('Failed to find invoices by date range', {
        startDate,
        endDate,
        error: error.message,
        event: 'invoices_date_range_find_failed'
      });
      return [];
    }
  }

  /**
   * Find successful invoices
   * @returns {Promise<Object[]>} Successful invoices
   */
  async findSuccessful() {
    await this.initialize();

    try {
      const rows = await this.db.getSuccessfullyProcessedOrders();
      return rows;
    } catch (error) {
      logger.error('Failed to find successful invoices', {
        error: error.message,
        event: 'successful_invoices_find_failed'
      });
      return [];
    }
  }

  /**
   * Find failed invoices
   * @returns {Promise<Object[]>} Failed invoices
   */
  async findFailed() {
    await this.initialize();

    try {
      const rows = await this.db.getFailedOrders();
      return rows;
    } catch (error) {
      logger.error('Failed to find failed invoices', {
        error: error.message,
        event: 'failed_invoices_find_failed'
      });
      return [];
    }
  }

  /**
   * Get total count of invoices
   * @returns {Promise<number>} Total invoice count
   */
  async count() {
    await this.initialize();

    try {
      const stats = await this.db.getStats();
      const total = (stats.successful_orders || 0) + (stats.failed_orders || 0);
      return total;
    } catch (error) {
      logger.error('Failed to count invoices', {
        error: error.message,
        event: 'invoice_count_failed'
      });
      return 0;
    }
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.initialized) {
      await this.db.close();
      this.initialized = false;
    }
  }

  /**
   * Cleanup resources (alias for close)
   */
  async cleanup() {
    return this.close();
  }
}

module.exports = SQLiteInvoiceRepository;
