const { AfipServices } = require('facturajs');
const fs = require('fs');
require('dotenv').config();

async function queryAfipInvoices() {
  console.log('🔍 Querying AFIP Invoices');
  console.log('='.repeat(50));

  try {
    const config = {
      certPath: process.env.AFIP_CERT_PATH,
      privateKeyPath: process.env.AFIP_KEY_PATH,
      cacheTokensPath: './.afip-tokens-query',
      homo: process.env.AFIP_ENVIRONMENT !== 'production',
      tokensExpireInHours: 12
    };

    const afip = new AfipServices(config);
    const cuit = parseInt(process.env.AFIP_CUIT);

    console.log('📋 Configuration:');
    console.log('- CUIT:', cuit);
    console.log('- Environment:', process.env.AFIP_ENVIRONMENT);
    console.log('- Point of Sale: 3');

    // Get last bill number to see our range
    console.log('\n🔢 Getting current last voucher number...');
    const lastBillResult = await afip.getLastBillNumber({
      Auth: { Cuit: cuit },
      params: {
        CbteTipo: 11, // Type C
        PtoVta: 3     // Point of Sale 3
      }
    });
    console.log('Last voucher number:', lastBillResult.CbteNro);

    // Query specific invoices we created (vouchers 6-20)
    console.log('\n📄 Querying individual invoices...');

    const startVoucher = 6;  // First voucher we created today
    const endVoucher = 20;   // Last voucher we created today

    for (let voucherNum = startVoucher; voucherNum <= endVoucher; voucherNum++) {
      try {
        console.log(`\n🔍 Querying voucher ${voucherNum}...`);

        const invoiceInfo = await afip.execRemote('wsfe', 'FECompConsultar', {
          Auth: { Cuit: cuit },
          params: {
            FeCompConsReq: {
              CbteTipo: 11,    // Type C
              PtoVta: 3,       // Point of Sale 3
              CbteNro: voucherNum
            }
          }
        });

        if (invoiceInfo && invoiceInfo.ResultGet) {
          const invoice = invoiceInfo.ResultGet;
          console.log(`✅ Voucher ${voucherNum}:`);
          console.log(`   - CAE: ${invoice.CodAutorizacion}`);
          console.log(`   - CAE Expiration: ${invoice.FchVto}`);
          console.log(`   - Amount: $${invoice.ImpTotal}`);
          console.log(`   - Date: ${invoice.CbteFch}`);
          console.log(`   - Status: ${invoice.Resultado || 'A'}`);
        } else {
          console.log(`❌ Voucher ${voucherNum}: Not found or no data`);
        }

      } catch (error) {
        console.log(`❌ Voucher ${voucherNum}: ${error.message}`);
      }
    }

    // Alternative: Get voucher information (different method)
    console.log('\n📊 Alternative query method...');
    try {
      const voucherInfo = await afip.execRemote('wsfe', 'FECompTotXRequest', {
        Auth: { Cuit: cuit }
      });
      console.log('Total requests info:', voucherInfo);
    } catch (error) {
      console.log('Total requests query failed:', error.message);
    }

    // Get sales points to verify our configuration
    console.log('\n🏪 Getting available sales points...');
    try {
      const salesPoints = await afip.execRemote('wsfe', 'FEParamGetPtosVenta', {
        Auth: { Cuit: cuit }
      });
      console.log('Available sales points:', salesPoints?.ResultGet?.PtoVenta || 'No data');
    } catch (error) {
      console.log('Sales points query failed:', error.message);
    }

  } catch (error) {
    console.log('💥 Query failed:', error.message);
    console.log('Stack:', error.stack);
  }
}

queryAfipInvoices().catch(console.error);