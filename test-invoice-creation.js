const AfipService = require('./src/services/AfipService');
const Invoice = require('./src/models/Invoice');
require('dotenv').config();

async function testInvoiceCreation() {
  console.log('📄 Testing Invoice Creation with Free AFIP SDK');
  console.log('='.repeat(50));

  const config = {
    cuit: process.env.AFIP_CUIT,
    environment: process.env.AFIP_ENVIRONMENT,
    certPath: process.env.AFIP_CERT_PATH,
    keyPath: process.env.AFIP_KEY_PATH
  };

  try {
    // Initialize service
    console.log('🔧 Initializing AFIP Service...');
    const afipService = new AfipService(config);
    await afipService.initialize();
    console.log('✅ Service initialized');

    // Create test invoice
    console.log('\n📋 Creating test invoice...');
    const testInvoice = new Invoice({
      docType: 99, // Consumer without identification
      docNumber: null,
      docDate: new Date().toISOString().split('T')[0],
      concept: 1, // Products
      currency: 'PES',
      exchange: 1,
      netAmount: 100.00,
      totalAmount: 100.00,
      vatAmount: 0, // Monotributista - no VAT
    });

    console.log('Invoice data:', {
      docDate: testInvoice.docDate,
      netAmount: testInvoice.netAmount,
      totalAmount: testInvoice.totalAmount,
      vatAmount: testInvoice.vatAmount
    });

    // Validate invoice
    const validation = testInvoice.validate();
    if (!validation.isValid) {
      console.log('❌ Invoice validation failed:', validation.errors);
      return;
    }
    console.log('✅ Invoice validation passed');

    // Get next voucher number
    console.log('\n🔢 Getting next voucher number...');
    const lastVoucher = await afipService.getLastVoucherNumber(3, 11);
    const nextVoucher = lastVoucher + 1;
    console.log(`Last voucher: ${lastVoucher}, Next voucher: ${nextVoucher}`);

    // Create invoice in AFIP
    console.log('\n🚀 Creating invoice in AFIP...');
    const result = await afipService.createInvoice(testInvoice, nextVoucher);

    if (result.success) {
      console.log('🎉 Invoice created successfully!');
      console.log('- CAE:', result.cae);
      console.log('- CAE Expiration:', result.caeExpiration);
      console.log('- Voucher Number:', result.voucherNumber);
    } else {
      console.log('❌ Invoice creation failed:', result.error);
    }

  } catch (error) {
    console.log('💥 Test failed:', error.message);

    if (error.message.includes('no autorizado')) {
      console.log('\n💡 This error indicates the certificate needs to be authorized for WSFEv1 service in AFIP portal');
      console.log('   Steps to fix:');
      console.log('   1. Go to https://auth.afip.gob.ar/contribuyente_/');
      console.log('   2. Navigate to Digital Certificates');
      console.log('   3. Find your certificate and authorize it for WSFEv1/Factura Electrónica service');
      console.log('   4. Ensure Point of Sale 3 is configured for electronic billing');
    }
  }
}

testInvoiceCreation().catch(console.error);