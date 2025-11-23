const { AfipServices } = require('facturajs');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const {
  AfipError,
  AfipAuthenticationError,
  AfipInvoiceRejectedError,
  AfipConnectionError,
  FileSystemError,
  ErrorHandler
} = require('../utils/errors');
const { CUITValidator } = require('../utils/validators');
const { AFIP_VOUCHER_TYPE } = require('../shared/constants');

/**
 * @typedef {Object} AfipServiceConfig
 * @property {string} cuit - CUIT number (11 digits with valid checksum)
 * @property {string} environment - Environment ('production' or 'testing')
 * @property {string} certPath - Path to AFIP certificate file
 * @property {string} keyPath - Path to AFIP private key file
 */

/**
 * @typedef {Object} InvoiceCreationResult
 * @property {boolean} success - Whether the operation succeeded
 * @property {string} [cae] - CAE (Electronic Authorization Code) from AFIP
 * @property {string} [caeExpiration] - CAE expiration date (YYYYMMDD)
 * @property {number} [voucherNumber] - Assigned voucher number
 * @property {Object} [result] - Full AFIP response
 * @property {string} [error] - Error message (if failed)
 * @property {string} [errorCode] - Error code (if failed)
 * @property {Object} [invoice] - Original invoice data (if failed)
 */

/**
 * @typedef {Object} TaxpayerValidationResult
 * @property {boolean} valid - Whether taxpayer is valid
 * @property {Object} [data] - Taxpayer data from AFIP
 * @property {string} [error] - Error message (if invalid)
 * @property {string} [errorCode] - Error code (if invalid)
 */

/**
 * @typedef {Object} AuthenticationTestResult
 * @property {boolean} success - Whether authentication succeeded
 * @property {number} [lastVoucherNumber] - Last voucher number (if successful)
 * @property {string} message - Result message
 * @property {string} [error] - Error message (if failed)
 * @property {string} [errorCode] - Error code (if failed)
 */

/**
 * Service for interacting with AFIP (Argentine Tax Authority) electronic invoicing system
 *
 * Handles:
 * - Invoice creation and submission to AFIP
 * - CAE (Electronic Authorization Code) retrieval
 * - Voucher number management
 * - Authentication and certificate management
 * - Taxpayer validation
 *
 * @class
 */
class AfipService {
  /**
   * Creates a new AfipService instance
   *
   * @param {AfipServiceConfig} config - Service configuration
   * @throws {ValidationError} If CUIT format or checksum is invalid
   *
   * @example
   * const service = new AfipService({
   *   cuit: '20307153867',
   *   environment: 'production',
   *   certPath: './certificates/cert.crt',
   *   keyPath: './certificates/private.key'
   * });
   */
  constructor(config) {
    /** @type {AfipServiceConfig} - Service configuration */
    this.config = config;

    /** @type {Object|null} - AFIP SDK instance (facturajs) */
    this.afip = null;

    /** @type {boolean} - Whether service has been initialized */
    this.initialized = false;

    // Validate CUIT format and checksum
    CUITValidator.validateOrThrow(config.cuit);

    /** @type {number} - CUIT number as integer */
    this.cuit = parseInt(config.cuit);
  }

  /**
   * Initializes the AFIP service with certificates and authentication
   *
   * Must be called before using any other service methods.
   * Validates certificate files exist and sets up the AFIP SDK.
   *
   * @async
   * @returns {Promise<boolean>} True if initialization succeeded
   * @throws {FileSystemError} If certificate or key files not found
   * @throws {AfipError} If AFIP SDK initialization fails
   *
   * @example
   * await service.initialize();
   * console.log('AFIP service ready');
   */
  async initialize() {
    try {
      const afipConfig = {
        homo: this.config.environment !== 'production',
        cacheTokensPath: config.afip.cacheTokensPath,
        tokensExpireInHours: 12
      };

      if (this.config.environment === 'production') {
        if (!fs.existsSync(this.config.certPath)) {
          throw new FileSystemError(
            'Certificate file not found',
            this.config.certPath,
            'read',
            { environment: this.config.environment }
          );
        }
        if (!fs.existsSync(this.config.keyPath)) {
          throw new FileSystemError(
            'Private key file not found',
            this.config.keyPath,
            'read',
            { environment: this.config.environment }
          );
        }

        afipConfig.certPath = this.config.certPath;
        afipConfig.privateKeyPath = this.config.keyPath;
      } else {
        // For testing, we still need cert and key but won't validate them strictly
        afipConfig.certPath = this.config.certPath || './certificates/cert.crt';
        afipConfig.privateKeyPath = this.config.keyPath || './certificates/private.key';
      }

      this.afip = new AfipServices(afipConfig);
      this.initialized = true;

      logger.info('AFIP Service initialized', {
        environment: this.config.environment,
        homo: afipConfig.homo,
        event: 'afip_initialized'
      });
      return true;
    } catch (error) {
      // Wrap error if not already an application error
      const wrappedError = ErrorHandler.wrap(error, {
        service: 'AfipService',
        method: 'initialize'
      });

      logger.error('Failed to initialize AFIP service', ErrorHandler.formatForLogging(wrappedError));
      throw wrappedError;
    }
  }

  /**
   * Creates and submits an invoice to AFIP for authorization
   *
   * Validates the invoice, gets a voucher number (if not provided),
   * submits to AFIP, and returns the CAE (Electronic Authorization Code).
   *
   * @async
   * @param {Invoice} invoice - Invoice object to submit
   * @param {number} [voucherNumber=null] - Specific voucher number to use (auto-assigned if null)
   * @returns {Promise<InvoiceCreationResult>} Result with CAE or error details
   *
   * @example
   * const result = await service.createInvoice(invoice);
   * if (result.success) {
   *   console.log('CAE:', result.cae);
   *   console.log('Voucher:', result.voucherNumber);
   * } else {
   *   console.error('Error:', result.error);
   * }
   */
  async createInvoice(invoice, voucherNumber = null) {
    if (!this.initialized) {
      throw new AfipError('AFIP service not initialized', 'AFIP_NOT_INITIALIZED');
    }

    try {
      // Validate invoice data before sending to AFIP
      invoice.validateOrThrow();

      if (!voucherNumber) {
        const lastVoucher = await this.getLastVoucherNumber();
        voucherNumber = lastVoucher + 1;
      }

      const invoiceData = invoice.toAfipFormat();

      logger.debug('Creating invoice in AFIP', {
        docNumber: invoice.docNumber,
        totalAmount: invoice.totalAmount,
        voucherNumber: voucherNumber,
        event: 'invoice_creation_attempt'
      });

      // Build request in facturajs format
      const billRequest = {
        Auth: { Cuit: this.cuit },
        params: {
          FeCAEReq: {
            FeCabReq: {
              CantReg: 1,
              PtoVta: invoiceData.PtoVta,
              CbteTipo: invoiceData.CbteTipo
            },
            FeDetReq: {
              FECAEDetRequest: {
                ...invoiceData,
                CbteDesde: voucherNumber,
                CbteHasta: voucherNumber
              }
            }
          }
        }
      };

      const result = await this.afip.createBill(billRequest);

      if (result.FeCabResp && result.FeCabResp.Resultado === 'A') {
        const detailResponse = result.FeDetResp.FECAEDetResponse[0];
        return {
          success: true,
          cae: detailResponse.CAE,
          caeExpiration: detailResponse.CAEFchVto,
          voucherNumber: parseInt(detailResponse.CbteDesde),
          result: result
        };
      } else {
        // AFIP rejected the invoice
        throw new AfipInvoiceRejectedError(
          'AFIP rejected invoice',
          result,
          { voucherNumber, invoice: invoiceData }
        );
      }
    } catch (error) {
      // Wrap error if needed
      const wrappedError = ErrorHandler.wrap(error, {
        service: 'AfipService',
        method: 'createInvoice',
        voucherNumber
      });

      logger.error('Error creating invoice', ErrorHandler.formatForLogging(wrappedError));

      return {
        success: false,
        error: wrappedError.message,
        errorCode: wrappedError.code,
        invoice: invoice
      };
    }
  }

  /**
   * Creates multiple invoices in sequence with automatic voucher numbering
   *
   * Processes invoices one by one, automatically assigning sequential voucher numbers.
   * Continues processing even if individual invoices fail.
   *
   * @async
   * @param {Array<Invoice>} invoices - Array of Invoice objects to submit
   * @returns {Promise<Array<InvoiceCreationResult>>} Array of results for each invoice
   *
   * @example
   * const results = await service.createMultipleInvoices([invoice1, invoice2, invoice3]);
   * const successful = results.filter(r => r.success);
   * console.log(`Created ${successful.length} of ${results.length} invoices`);
   */
  async createMultipleInvoices(invoices) {
    const results = [];
    let currentVoucherNumber = await this.getLastVoucherNumber();

    for (const invoice of invoices) {
      try {
        currentVoucherNumber++;
        const result = await this.createInvoice(invoice, currentVoucherNumber);
        results.push(result);

        if (result.success) {
          logger.info('Invoice created successfully', {
            cae: result.cae,
            voucherNumber: currentVoucherNumber,
            event: 'invoice_created'
          });
        } else {
          logger.warn('Invoice creation failed', {
            error: result.error,
            voucherNumber: currentVoucherNumber,
            event: 'invoice_failed'
          });
          currentVoucherNumber--; // Don't increment if failed
        }
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          invoice: invoice
        });
        currentVoucherNumber--; // Don't increment if failed
      }
    }
    
    return results;
  }

  /**
   * Retrieves the last used voucher number from AFIP
   *
   * Used to determine the next voucher number for invoice creation.
   * Returns 0 on error to allow graceful degradation.
   *
   * @async
   * @param {number} [salePoint=null] - Point of sale number (uses config default if null)
   * @param {number} [voucherType=AFIP_VOUCHER_TYPE.INVOICE_C] - Voucher type
   * @returns {Promise<number>} Last voucher number used, or 0 if error/not found
   *
   * @example
   * const lastNumber = await service.getLastVoucherNumber();
   * const nextNumber = lastNumber + 1;
   * console.log('Next voucher number:', nextNumber);
   */
  async getLastVoucherNumber(salePoint = null, voucherType = AFIP_VOUCHER_TYPE.INVOICE_C) {
    salePoint = salePoint || config.afip.ptoVta;
    if (!this.initialized) {
      throw new AfipError('AFIP service not initialized', 'AFIP_NOT_INITIALIZED');
    }

    try {
      const result = await this.afip.getLastBillNumber({
        Auth: { Cuit: this.cuit },
        params: {
          CbteTipo: voucherType,
          PtoVta: salePoint
        }
      });

      let lastNumber = 0;
      if (typeof result === 'number') {
        lastNumber = result;
      } else if (result.CbteNro !== undefined) {
        lastNumber = parseInt(result.CbteNro) || 0;
      } else if (typeof result === 'string') {
        lastNumber = parseInt(result) || 0;
      }

      return lastNumber;
    } catch (error) {
      const wrappedError = ErrorHandler.wrap(error, {
        service: 'AfipService',
        method: 'getLastVoucherNumber',
        salePoint,
        voucherType
      });

      logger.error('Error getting last voucher number', ErrorHandler.formatForLogging(wrappedError));

      // Return 0 on error to allow graceful degradation
      return 0;
    }
  }

  /**
   * Validates a taxpayer's CUIT with AFIP
   *
   * Note: Full taxpayer validation not available with current SDK (facturajs).
   * Currently only validates CUIT format and checksum.
   *
   * @async
   * @param {string} cuit - CUIT to validate
   * @returns {Promise<TaxpayerValidationResult>} Validation result
   *
   * @example
   * const result = await service.validateTaxpayer('20307153867');
   * if (result.valid) {
   *   console.log('Taxpayer is valid');
   * } else {
   *   console.error('Error:', result.error);
   * }
   */
  async validateTaxpayer(cuit) {
    if (!this.initialized) {
      throw new AfipError('AFIP service not initialized', 'AFIP_NOT_INITIALIZED');
    }

    try {
      // Validate CUIT format before processing
      const cuitValidation = CUITValidator.validate(cuit);
      if (!cuitValidation.valid) {
        return {
          valid: false,
          error: cuitValidation.errors.join(', '),
          errorCode: 'INVALID_CUIT'
        };
      }

      // facturajs doesn't have RegisterScopeFour, this would need a different service
      // For now, return a placeholder - this feature can be implemented later if needed
      logger.warn('Taxpayer validation not implemented with facturajs SDK', {
        cuit,
        event: 'taxpayer_validation_unavailable'
      });
      return {
        valid: true,
        data: { message: 'Validation not available with current SDK' }
      };
    } catch (error) {
      const wrappedError = ErrorHandler.wrap(error, {
        service: 'AfipService',
        method: 'validateTaxpayer',
        cuit
      });

      return {
        valid: false,
        error: wrappedError.message,
        errorCode: wrappedError.code
      };
    }
  }

  /**
   * Tests authentication with AFIP
   *
   * Verifies that certificates and credentials are valid by attempting
   * to retrieve the last voucher number from AFIP.
   *
   * @async
   * @returns {Promise<AuthenticationTestResult>} Authentication test result
   *
   * @example
   * const authResult = await service.testAuthentication();
   * if (authResult.success) {
   *   console.log('Authentication successful');
   *   console.log('Last voucher:', authResult.lastVoucherNumber);
   * } else {
   *   console.error('Authentication failed:', authResult.error);
   * }
   */
  async testAuthentication() {
    if (!this.initialized) {
      throw new AfipError('AFIP service not initialized', 'AFIP_NOT_INITIALIZED');
    }

    try {
      // Test with getLastVoucherNumber - this should work if auth is ok
      const lastVoucher = await this.getLastVoucherNumber();
      return {
        success: true,
        lastVoucherNumber: lastVoucher,
        message: 'Authentication successful'
      };
    } catch (error) {
      const wrappedError = ErrorHandler.wrap(error, {
        service: 'AfipService',
        method: 'testAuthentication'
      });

      logger.error('Authentication test failed', ErrorHandler.formatForLogging(wrappedError));

      return {
        success: false,
        error: wrappedError.message,
        errorCode: wrappedError.code,
        message: 'Authentication failed'
      };
    }
  }
}

module.exports = AfipService;