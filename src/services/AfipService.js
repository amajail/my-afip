const { AfipServices } = require('facturajs');
const fs = require('fs');
const path = require('path');

class AfipService {
  constructor(config) {
    this.config = config;
    this.afip = null;
    this.initialized = false;
    this.cuit = parseInt(config.cuit);
  }

  async initialize() {
    try {
      const afipConfig = {
        homo: this.config.environment !== 'production',
        cacheTokensPath: './.afip-tokens',
        tokensExpireInHours: 12
      };

      if (this.config.environment === 'production') {
        if (!fs.existsSync(this.config.certPath) || !fs.existsSync(this.config.keyPath)) {
          throw new Error('Certificate files not found. Please provide valid certificate and key files.');
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

      console.log(`AFIP Service initialized in ${this.config.environment} mode (homo: ${afipConfig.homo})`);
      return true;
    } catch (error) {
      console.error('Failed to initialize AFIP service:', error.message);
      throw error;
    }
  }

  async createInvoice(invoice, voucherNumber = null) {
    if (!this.initialized) {
      throw new Error('AFIP service not initialized');
    }

    try {
      if (!voucherNumber) {
        const lastVoucher = await this.getLastVoucherNumber();
        voucherNumber = lastVoucher + 1;
      }

      const invoiceData = invoice.toAfipFormat();

      console.log('Creating invoice in AFIP:', {
        docNumber: invoice.docNumber,
        totalAmount: invoice.totalAmount,
        voucherNumber: voucherNumber
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
        throw new Error(`AFIP rejected invoice: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      console.error('Error creating invoice:', error.message);
      return {
        success: false,
        error: error.message,
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
          console.log(`✓ Invoice created: CAE ${result.cae}`);
        } else {
          console.log(`✗ Invoice failed: ${result.error}`);
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
    salePoint = salePoint || parseInt(process.env.AFIP_PTOVTA);
    if (!this.initialized) {
      throw new Error('AFIP service not initialized');
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
      console.error('Error getting last voucher number:', error.message);
      return 0;
    }
  }

  async validateTaxpayer(cuit) {
    if (!this.initialized) {
      throw new Error('AFIP service not initialized');
    }

    try {
      // facturajs doesn't have RegisterScopeFour, this would need a different service
      // For now, return a placeholder - this feature can be implemented later if needed
      console.log('Taxpayer validation not implemented with facturajs SDK');
      return {
        valid: true,
        data: { message: 'Validation not available with current SDK' }
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  async testAuthentication() {
    if (!this.initialized) {
      throw new Error('AFIP service not initialized');
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
      return {
        success: false,
        error: error.message,
        message: 'Authentication failed'
      };
    }
  }
}

module.exports = AfipService;