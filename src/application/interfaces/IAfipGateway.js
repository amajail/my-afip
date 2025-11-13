/**
 * IAfipGateway Interface
 *
 * Gateway interface for AFIP operations following Gateway pattern.
 * Defines the contract for AFIP external service communication.
 * Infrastructure layer will implement this interface.
 */

/**
 * AFIP Gateway Interface
 * @interface
 */
class IAfipGateway {
  /**
   * Submit invoice to AFIP for authorization
   * @param {Invoice} invoice - Invoice to submit
   * @param {number} pointOfSale - Point of sale number
   * @returns {Promise<InvoiceResult>} Result of invoice creation
   * @abstract
   */
  async createInvoice(invoice, pointOfSale) {
    throw new Error('Method not implemented: createInvoice');
  }

  /**
   * Query invoice by CAE
   * @param {CAE|string} cae - CAE to query
   * @returns {Promise<Object>} Invoice information from AFIP
   * @abstract
   */
  async queryInvoice(cae) {
    throw new Error('Method not implemented: queryInvoice');
  }

  /**
   * Get last authorized invoice number
   * @param {number} pointOfSale - Point of sale number
   * @param {number} invoiceType - Invoice type (6=B, 11=C)
   * @returns {Promise<number>} Last invoice number
   * @abstract
   */
  async getLastInvoiceNumber(pointOfSale, invoiceType) {
    throw new Error('Method not implemented: getLastInvoiceNumber');
  }

  /**
   * Test AFIP connection
   * @returns {Promise<boolean>} Whether connection is successful
   * @abstract
   */
  async testConnection() {
    throw new Error('Method not implemented: testConnection');
  }

  /**
   * Get AFIP server status
   * @returns {Promise<Object>} Server status information
   * @abstract
   */
  async getServerStatus() {
    throw new Error('Method not implemented: getServerStatus');
  }
}

module.exports = IAfipGateway;
