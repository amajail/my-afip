const AfipService = require('./src/services/AfipService');
const Invoice = require('./src/models/Invoice');
require('dotenv').config();

async function debugVoucherSequence() {
  console.log('🔢 Debugging Voucher Number Sequence');
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

    // Check current last voucher
    console.log('🔍 Getting current last voucher number...');
    const currentLast = await afipService.getLastVoucherNumber();
    console.log('Current last voucher:', currentLast);

    // Create 3 test invoices to see sequencing
    const testInvoices = [
      new Invoice({
        docDate: '2025-09-24',
        netAmount: 100,
        totalAmount: 100,
        vatAmount: 0
      }),
      new Invoice({
        docDate: '2025-09-24',
        netAmount: 200,
        totalAmount: 200,
        vatAmount: 0
      }),
      new Invoice({
        docDate: '2025-09-24',
        netAmount: 300,
        totalAmount: 300,
        vatAmount: 0
      })
    ];

    console.log('\n🚀 Creating multiple invoices with sequence tracking...');

    // Let's manually check what createMultipleInvoices does step by step
    console.log('📋 Step 1: Getting last voucher in createMultipleInvoices...');
    let currentVoucherNumber = await afipService.getLastVoucherNumber();
    console.log('Starting voucher number:', currentVoucherNumber);

    const results = [];

    for (let i = 0; i < testInvoices.length; i++) {
      const invoice = testInvoices[i];
      currentVoucherNumber++;

      console.log(`\n📄 Invoice ${i + 1}:`);
      console.log('- Amount:', invoice.totalAmount);
      console.log('- Attempting voucher number:', currentVoucherNumber);

      try {
        const result = await afipService.createInvoice(invoice, currentVoucherNumber);

        if (result.success) {
          console.log('✅ Success! CAE:', result.cae, 'Voucher:', result.voucherNumber);
        } else {
          console.log('❌ Failed:', result.error);
          currentVoucherNumber--; // Rollback on failure
        }

        results.push(result);

        // Check last voucher after each creation
        const newLast = await afipService.getLastVoucherNumber();
        console.log('AFIP last voucher after creation:', newLast);

      } catch (error) {
        console.log('❌ Error:', error.message);
        currentVoucherNumber--; // Rollback on failure
        results.push({ success: false, error: error.message });
      }
    }

    console.log('\n📊 Final Results:');
    results.forEach((result, index) => {
      console.log(`Invoice ${index + 1}: ${result.success ? '✅ CAE ' + result.cae : '❌ ' + result.error}`);
    });

  } catch (error) {
    console.log('💥 Debug failed:', error.message);
  }
}

debugVoucherSequence().catch(console.error);