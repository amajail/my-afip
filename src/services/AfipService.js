const Afip = require('@afipsdk/afip.js');
const fs = require('fs');
const path = require('path');

class AfipService {
  constructor(config) {
    this.config = config;
    this.afip = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      const afipConfig = {
        CUIT: this.config.cuit,
        production: this.config.environment === 'production'
      };

      if (this.config.environment === 'production') {
        if (!fs.existsSync(this.config.certPath) || !fs.existsSync(this.config.keyPath)) {
          throw new Error('Certificate files not found. Please provide valid certificate and key files.');
        }
        
        afipConfig.cert = fs.readFileSync(this.config.certPath, 'utf8');
        afipConfig.key = fs.readFileSync(this.config.keyPath, 'utf8');
      }

      this.afip = new Afip(afipConfig);
      this.initialized = true;
      
      console.log(`AFIP Service initialized in ${this.config.environment} mode`);
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
      invoiceData.CbteDesde = voucherNumber;
      invoiceData.CbteHasta = voucherNumber;
      
      console.log('Creating invoice in AFIP:', {
        docNumber: invoice.docNumber,
        totalAmount: invoice.totalAmount,
        voucherNumber: voucherNumber
      });

      const result = await this.afip.ElectronicBilling.createVoucher(invoiceData);
      
      return {
        success: true,
        cae: result.CAE,
        caeExpiration: result.CAEFchVto,
        voucherNumber: result.CbteNro,
        result: result
      };
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

  async getLastVoucherNumber(salePoint = 2, voucherType = 11) {
    if (!this.initialized) {
      throw new Error('AFIP service not initialized');
    }

    try {
      const result = await this.afip.ElectronicBilling.getLastVoucher(salePoint, voucherType);
      
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
      const result = await this.afip.RegisterScopeFour.getTaxpayerDetails(cuit);
      return {
        valid: true,
        data: result
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
      // Test with server status - this should work if auth is ok
      const result = await this.afip.ElectronicBilling.getServerStatus();
      return {
        success: true,
        serverStatus: result,
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