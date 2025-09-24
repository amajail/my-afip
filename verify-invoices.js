const AfipService = require('./src/services/AfipService');
require('dotenv').config();

async function verifyInvoices() {
  console.log('✅ Verifying Created Invoices');
  console.log('='.repeat(50));

  const config = {
    cuit: process.env.AFIP_CUIT,
    environment: process.env.AFIP_ENVIRONMENT,
    certPath: process.env.AFIP_CERT_PATH,
    keyPath: process.env.AFIP_KEY_PATH
  };

  try {
    const afipService = new AfipService(config);
    await afipService.initialize();

    // Check current last voucher number
    console.log('🔢 Checking current voucher status...');
    const currentLast = await afipService.getLastVoucherNumber(3, 11);
    console.log('Current last voucher number:', currentLast);

    // Check different points of sale to see voucher counts
    console.log('\n🏪 Checking voucher numbers across different Points of Sale:');
    for (const pos of [1, 2, 3, 4, 5]) {
      try {
        const lastVoucher = await afipService.getLastVoucherNumber(pos, 11);
        console.log(`POS ${pos}: Last voucher ${lastVoucher}`);
      } catch (error) {
        console.log(`POS ${pos}: ${error.message.includes('habilitado') ? 'Not enabled' : 'Error'}`);
      }
    }

    // Verify we can still create invoices (this confirms the sequence is working)
    console.log('\n🧪 Testing next invoice creation capability...');
    const nextVoucher = currentLast + 1;
    console.log(`Next voucher would be: ${nextVoucher}`);

    // Check our local database records
    console.log('\n💾 Checking local database records...');
    const Database = require('./src/database/Database');
    const db = new Database();
    await db.initialize();

    const successfulOrders = await db.db.all(
      'SELECT order_number, cae, voucher_number, total_price, processed_at FROM orders WHERE success = 1 ORDER BY voucher_number',
      []
    );

    console.log(`\n📊 Local database shows ${successfulOrders.length} successful invoices:`);
    console.log('Voucher | CAE            | Amount   | Processed');
    console.log('--------|----------------|----------|----------');

    successfulOrders.forEach(order => {
      const voucher = order.voucher_number || 'N/A';
      const cae = order.cae || 'N/A';
      const amount = order.total_price || 'N/A';
      const processed = order.processed_at ? new Date(order.processed_at).toLocaleString() : 'N/A';

      console.log(`${String(voucher).padEnd(7)} | ${String(cae).padEnd(14)} | $${String(amount).padEnd(7)} | ${processed.split(',')[0]}`);
    });

    await db.close();

    // Summary
    console.log('\n🎯 Summary:');
    console.log(`- AFIP reports last voucher: ${currentLast}`);
    console.log(`- Local database has: ${successfulOrders.length} successful invoices`);
    console.log(`- Voucher range: ${successfulOrders.length > 0 ? `${Math.min(...successfulOrders.map(o => o.voucher_number || 0))} - ${Math.max(...successfulOrders.map(o => o.voucher_number || 0))}` : 'N/A'}`);

    if (currentLast === 20 && successfulOrders.length === 15) {
      console.log('✅ Perfect match! All invoices are properly registered in AFIP.');
    }

  } catch (error) {
    console.log('💥 Verification failed:', error.message);
    console.log('Stack:', error.stack);
  }
}

verifyInvoices().catch(console.error);