const AfipService = require('./src/services/AfipService');
require('dotenv').config();

async function verifyProductionInvoices() {
  console.log('🔍 Production Invoice Verification');
  console.log('='.repeat(50));

  try {
    const config = {
      cuit: process.env.AFIP_CUIT,
      environment: process.env.AFIP_ENVIRONMENT,
      certPath: process.env.AFIP_CERT_PATH,
      keyPath: process.env.AFIP_KEY_PATH
    };

    const afipService = new AfipService(config);
    await afipService.initialize();

    console.log('📋 Environment Verification:');
    console.log('- AFIP Environment:', process.env.AFIP_ENVIRONMENT);
    console.log('- Certificate Path:', process.env.AFIP_CERT_PATH);

    // Check if we're really in production
    const isProduction = process.env.AFIP_ENVIRONMENT === 'production';
    console.log('- Confirmed Production Mode:', isProduction);

    if (!isProduction) {
      console.log('⚠️  WARNING: You are in HOMOLOGATION mode!');
      console.log('   Homologation invoices appear in: https://wswhomo.afip.gov.ar/');
      console.log('   NOT in the main production portal!');
      return;
    }

    // Check current status
    console.log('\n🔢 Current AFIP Status:');
    const lastVoucher = await afipService.getLastVoucherNumber(3, 11);
    console.log('- Last voucher number POS 3:', lastVoucher);

    // Test authentication is still working
    console.log('\n🔐 Authentication Test:');
    const authResult = await afipService.testAuthentication();
    console.log('- Auth Status:', authResult.success ? '✅ Working' : '❌ Failed');

    // Show exactly what was created
    console.log('\n📊 Invoices Created Today:');
    console.log('Voucher | CAE Number     | Amount  | Status');
    console.log('--------|----------------|---------|-------');

    // Get from database
    const Database = require('./src/database/Database');
    const db = new Database();
    await db.initialize();

    const todayInvoices = await new Promise((resolve, reject) => {
      const today = new Date().toISOString().split('T')[0];
      db.db.all(
        `SELECT voucher_number, cae, total_price, processed_at
         FROM orders
         WHERE success = 1 AND date(processed_at) = date('now')
         ORDER BY voucher_number`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    if (todayInvoices.length > 0) {
      todayInvoices.forEach(inv => {
        const voucher = String(inv.voucher_number || 'N/A').padEnd(7);
        const cae = String(inv.cae || 'N/A').padEnd(14);
        const amount = String(inv.total_price || 'N/A').padEnd(7);
        console.log(`${voucher} | ${cae} | $${amount} | ✅ OK`);
      });
    } else {
      console.log('No invoices found for today in database');
    }

    await db.close();

    console.log('\n🌐 AFIP Portal Access Instructions:');
    console.log('1. Go to: https://auth.afip.gob.ar/contribuyente_/');
    console.log('2. Login with CUIT 20283536638');
    console.log('3. Navigate to one of these sections:');
    console.log('   📂 "Comprobantes en línea" → "Consulta"');
    console.log('   📂 "Factura Electrónica" → "Consulta de Comprobantes"');
    console.log('   📂 "Servicios Web" → "WSFEv1" → "Comprobantes"');

    console.log('\n🔍 Search Filters to Use:');
    console.log('- Fecha/Date: 2025-09-24');
    console.log('- Punto de Venta/POS: 3');
    console.log('- Tipo/Type: C (Factura C) or 11');
    console.log(`- Números: ${lastVoucher >= 20 ? '6-20' : '1-' + lastVoucher}`);

    console.log('\n⏰ Important Notes:');
    console.log('- Portal sync can take 1-24 hours');
    console.log('- Different portal sections may show different views');
    console.log('- Some portals separate "API invoices" from "manual invoices"');
    console.log('- CAE numbers confirm AFIP acceptance regardless of portal visibility');

  } catch (error) {
    console.log('💥 Verification failed:', error.message);
  }
}

verifyProductionInvoices().catch(console.error);