const AfipService = require('./src/services/AfipService');
const Invoice = require('./src/models/Invoice');
require('dotenv').config();

async function testCurrentDateInvoice() {
  console.log('📅 Testing Invoice with Current Date');
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

    // Create invoice with TODAY's date
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    console.log('Using date:', today);

    const testInvoice = new Invoice({
      docType: 99, // Consumer without identification
      docNumber: null,
      docDate: today, // TODAY's date
      concept: 1, // Products (not services)
      currency: 'PES',
      exchange: 1,
      netAmount: 199200, // Same amount as the failing orders
      totalAmount: 199200,
      vatAmount: 0
    });

    console.log('\n📄 Invoice details:');
    console.log('- Date:', testInvoice.docDate);
    console.log('- Amount:', testInvoice.totalAmount);
    console.log('- Concept:', testInvoice.concept, '(1=Products, 2=Services)');

    // Get next voucher
    const currentLast = await afipService.getLastVoucherNumber();
    const nextVoucher = currentLast + 1;
    console.log('\n🔢 Voucher numbers:');
    console.log('- Current last:', currentLast);
    console.log('- Next to create:', nextVoucher);

    // Create invoice
    console.log('\n🚀 Creating invoice...');
    const result = await afipService.createInvoice(testInvoice, nextVoucher);

    if (result.success) {
      console.log('🎉 SUCCESS!');
      console.log('- CAE:', result.cae);
      console.log('- Voucher:', result.voucherNumber);
      console.log('- Expiration:', result.caeExpiration);
    } else {
      console.log('❌ FAILED:', result.error);
    }

  } catch (error) {
    console.log('💥 Error:', error.message);
  }
}

testCurrentDateInvoice().catch(console.error);