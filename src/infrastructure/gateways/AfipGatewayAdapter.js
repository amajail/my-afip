/**
 * AfipGatewayAdapter
 *
 * Adapter implementing IAfipGateway interface
 * Wraps AfipService to provide clean gateway interface
 * Part of Infrastructure Layer
 */

const IAfipGateway = require('../../application/interfaces/IAfipGateway');
const AfipService = require('../../services/AfipService');
const InvoiceResult = require('../../domain/entities/InvoiceResult');
const CAE = require('../../domain/value-objects/CAE');
const logger = require('../../utils/logger');
const config = require('../../config');

class AfipGatewayAdapter extends IAfipGateway {
  /**
   * @param {AfipService} [afipService=null] - Optional AfipService instance (for testing)
   */
  constructor(afipService = null) {
    super();

    // Use provided service or create new one with config
    this.afipService = afipService || new AfipService({
      cuit: config.afip.cuit,
      environment: config.afip.environment,
      certPath: config.afip.certPath,
      keyPath: config.afip.keyPath
    });

    this.initialized = false;
  }

  /**
   * Initialize AFIP connection
   */
  async initialize() {
    if (!this.initialized) {
      await this.afipService.initialize();
      this.initialized = true;
    }
  }

  /**
   * Submit invoice to AFIP for authorization
   * @param {Invoice} invoice - Invoice domain entity to submit
   * @param {number} pointOfSale - Point of sale number
   * @returns {Promise<InvoiceResult>} Domain InvoiceResult entity
   */
  async createInvoice(invoice, pointOfSale) {
    await this.initialize();

    try {
      // Call the underlying AfipService
      const result = await this.afipService.createInvoice(invoice);

      // Convert service result to domain InvoiceResult
      if (result.success) {
        // Convert AFIP date format (YYYYMMDD) to ISO string
        const caeExpiration = this._convertAfipDate(result.caeExpiration);

        return InvoiceResult.success({
          cae: result.cae,
          caeExpiration: caeExpiration,
          voucherNumber: result.voucherNumber,
          invoiceDate: invoice.invoiceDate, // Use invoice date from original invoice
          observations: [],
          metadata: {
            rawResponse: result.result
          }
        });
      } else {
        return InvoiceResult.failure(
          result.error,
          {
            errorCode: result.errorCode,
            rawResponse: result.invoice
          }
        );
      }
    } catch (error) {
      logger.error('AFIP gateway error creating invoice', {
        error: error.message,
        event: 'afip_gateway_create_invoice_error'
      });

      return InvoiceResult.failure(
        error.message,
        {
          errorCode: error.code || 'AFIP_GATEWAY_ERROR',
          invoice: invoice.toJSON()
        }
      );
    }
  }

  /**
   * Query invoice by CAE
   * @param {CAE|string} cae - CAE to query
   * @returns {Promise<Object>} Invoice information from AFIP
   */
  async queryInvoice(cae) {
    await this.initialize();

    const caeValue = typeof cae === 'object' ? cae.value : cae;

    try {
      // Note: facturajs doesn't have a direct queryInvoice method
      // This would need to be implemented if AFIP provides such endpoint
      logger.warn('Query invoice not implemented in current AFIP SDK', {
        cae: caeValue,
        event: 'afip_query_not_available'
      });

      return {
        success: false,
        message: 'Query invoice not available in current SDK',
        cae: caeValue
      };
    } catch (error) {
      logger.error('AFIP gateway error querying invoice', {
        cae: caeValue,
        error: error.message,
        event: 'afip_gateway_query_error'
      });

      throw error;
    }
  }

  /**
   * Get last authorized invoice number
   * @param {number} pointOfSale - Point of sale number
   * @param {number} invoiceType - Invoice type (6=B, 11=C)
   * @returns {Promise<number>} Last invoice number
   */
  async getLastInvoiceNumber(pointOfSale, invoiceType) {
    await this.initialize();

    try {
      const lastNumber = await this.afipService.getLastVoucherNumber(
        pointOfSale,
        invoiceType
      );

      logger.debug('Retrieved last invoice number', {
        pointOfSale,
        invoiceType,
        lastNumber,
        event: 'afip_last_number_retrieved'
      });

      return lastNumber;
    } catch (error) {
      logger.error('AFIP gateway error getting last invoice number', {
        pointOfSale,
        invoiceType,
        error: error.message,
        event: 'afip_gateway_last_number_error'
      });

      throw error;
    }
  }

  /**
   * Test AFIP connection
   * @returns {Promise<boolean>} Whether connection is successful
   */
  async testConnection() {
    try {
      await this.initialize();

      const result = await this.afipService.testAuthentication();

      logger.info('AFIP connection test result', {
        success: result.success,
        event: 'afip_connection_test'
      });

      return result.success;
    } catch (error) {
      logger.error('AFIP connection test failed', {
        error: error.message,
        event: 'afip_connection_test_failed'
      });

      return false;
    }
  }

  /**
   * Get AFIP server status
   * @returns {Promise<Object>} Server status information
   */
  async getServerStatus() {
    await this.initialize();

    try {
      // Use testAuthentication as a proxy for server status
      const authResult = await this.afipService.testAuthentication();

      return {
        online: authResult.success,
        authenticated: authResult.success,
        lastVoucherNumber: authResult.lastVoucherNumber,
        message: authResult.message,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('AFIP gateway error getting server status', {
        error: error.message,
        event: 'afip_gateway_status_error'
      });

      return {
        online: false,
        authenticated: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Convert AFIP date format (YYYYMMDD) to ISO string (YYYY-MM-DD)
   * @param {string} afipDate - Date in YYYYMMDD format
   * @returns {string} Date in YYYY-MM-DD format
   * @private
   */
  _convertAfipDate(afipDate) {
    if (!afipDate || afipDate.length !== 8) {
      return null;
    }
    const year = afipDate.substring(0, 4);
    const month = afipDate.substring(4, 6);
    const day = afipDate.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
}

module.exports = AfipGatewayAdapter;
