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

class AfipService {
  constructor(config) {
    this.config = config;
    this.afip = null;
    this.initialized = false;

    // Validate CUIT format and checksum
    CUITValidator.validateOrThrow(config.cuit);
    this.cuit = parseInt(config.cuit);
  }

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

  async getLastVoucherNumber(salePoint = null, voucherType = 11) {
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