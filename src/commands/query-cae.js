const Database = require('../database/Database');
const AfipService = require('../services/AfipService');
const config = require('../config');

class CAEInvoiceQuery {
  constructor(config) {
    this.config = config;
    this.db = new Database();
    this.afipService = new AfipService(config);
  }

  async initialize() {
    await this.db.initialize();
    await this.afipService.initialize();
    console.log('🔗 CAE Query Service initialized');
  }

  async queryByCAE(cae) {
    console.log(`🔍 Searching for CAE: ${cae}`);

    try {
      // First check our local database
      const localResult = await this.queryLocalDatabase(cae);

      if (localResult.found) {
        console.log('✅ Found in local database');

        // Enrich with AFIP verification
        const afipVerification = await this.verifyWithAFIP(localResult.invoice);

        return {
          found: true,
          source: 'local_database',
          invoice: localResult.invoice,
          afipVerification: afipVerification
        };
      }

      console.log('❌ CAE not found in local database');
      return { found: false, source: 'local_database', cae: cae };

    } catch (error) {
      throw new Error(`CAE query failed: ${error.message}`);
    }
  }

  async queryLocalDatabase(cae) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          order_number,
          total_price,
          asset,
          fiat,
          buyer_nickname,
          seller_nickname,
          trade_type,
          create_time,
          order_date,
          processed_at,
          processing_method,
          success,
          cae,
          voucher_number,
          error_message
        FROM orders
        WHERE cae = ? AND success = 1
      `;

      this.db.db.get(sql, [cae], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row) {
          resolve({
            found: true,
            invoice: row
          });
        } else {
          resolve({ found: false });
        }
      });
    });
  }

  async verifyWithAFIP(invoice) {
    try {
      // Verify the voucher number exists in AFIP
      const lastVoucher = await this.afipService.getLastVoucherNumber(3, 11);

      return {
        verified: invoice.voucher_number <= lastVoucher,
        lastVoucherInAFIP: lastVoucher,
        status: invoice.voucher_number <= lastVoucher ? 'Valid' : 'Questionable'
      };
    } catch (error) {
      return {
        verified: false,
        error: error.message,
        status: 'Could not verify'
      };
    }
  }

  formatInvoiceReport(result) {
    if (!result.found) {
      return `
❌ Invoice Not Found
====================
CAE searched: ${result.cae}
Source: ${result.source}

This CAE number was not found in the local database.

💡 Possible reasons:
- CAE number is incorrect
- Invoice was not processed through this system
- CAE is from a different AFIP account
`;
    }

    const inv = result.invoice;
    const afip = result.afipVerification;

    const formatDate = (timestamp) => {
      if (!timestamp) return 'N/A';
      return new Date(timestamp).toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const formatAmount = (amount) => {
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
      }).format(amount);
    };

    return `
✅ AFIP Invoice Report
======================
📋 Basic Information:
   • CAE: ${inv.cae}
   • Voucher Number: ${inv.voucher_number || 'N/A'}
   • Order Number: ${inv.order_number}
   • Processing Method: ${inv.processing_method}

📅 Dates:
   • Original Order Date: ${inv.order_date}
   • Processed At: ${formatDate(inv.processed_at)}
   • Create Time: ${formatDate(inv.create_time)}

💰 Transaction Details:
   • Total Amount: ${formatAmount(inv.total_price)}
   • Currency Pair: ${inv.asset}/${inv.fiat}
   • Trade Type: ${inv.trade_type}

🏢 Trading Parties:
   • Buyer: ${inv.buyer_nickname}
   • Seller: ${inv.seller_nickname}

📊 AFIP Status:
   • Processing Success: ${inv.success ? '✅ Yes' : '❌ No'}
   • Error Message: ${inv.error_message || 'None'}

🔍 AFIP Verification:
   • Status: ${afip.status}
   • Voucher Valid: ${afip.verified ? '✅ Yes' : '❌ No'}
   • Last AFIP Voucher: ${afip.lastVoucherInAFIP || 'N/A'}
   ${afip.error ? `• Verification Error: ${afip.error}` : ''}

💡 Invoice Type: Factura C (Type 11) - Monotributista
💡 Point of Sale: 3
💡 Concept: Products (Cryptocurrency Trading Commission)
`;
  }

  async close() {
    await this.db.close();
  }
}

async function queryCAECommand() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
🔍 CAE Invoice Query Tool
=========================

Usage:
  node src/commands/query-cae.js <CAE_NUMBER>

Examples:
  node src/commands/query-cae.js 75398279001644
  npm run query-cae 75398279001644

This tool searches for invoices by CAE number in:
1. Local database (processed orders)
2. AFIP verification (voucher number validation)

Known CAEs from recent processing:
- 75398279001644 (Voucher 6)
- 75398279001877 (Voucher 7)
- 75398279002158 (Voucher 8)
- ... (Vouchers 6-20)
`);
    return;
  }

  const cae = args[0];

  if (!cae || cae.length < 10) {
    console.log('❌ Invalid CAE number. CAE should be at least 10 digits.');
    return;
  }

  const afipConfig = {
    cuit: config.afip.cuit,
    environment: config.afip.environment,
    certPath: config.afip.certPath,
    keyPath: config.afip.keyPath
  };

  const queryService = new CAEInvoiceQuery(afipConfig);

  try {
    await queryService.initialize();

    const result = await queryService.queryByCAE(cae);
    const report = queryService.formatInvoiceReport(result);
    console.log(report);

    if (result.found) {
      console.log('✅ Query completed successfully');
    } else {
      console.log('❌ Invoice not found');
    }

  } catch (error) {
    console.log('💥 Query failed:', error.message);
  } finally {
    await queryService.close();
  }
}

// Run if called directly
if (require.main === module) {
  queryCAECommand().catch(console.error);
}

module.exports = { CAEInvoiceQuery, queryCAECommand };