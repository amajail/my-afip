const AfipService = require('./src/services/AfipService');
require('dotenv').config();

async function testAfipHomologation() {
  console.log('🧪 Testing AFIP Service in Homologation Mode');
  console.log('='.repeat(50));

  const config = {
    cuit: process.env.AFIP_CUIT,
    environment: 'testing', // Force testing mode
    certPath: process.env.AFIP_CERT_PATH,
    keyPath: process.env.AFIP_KEY_PATH
  };

  console.log('📋 Configuration:');
  console.log('- CUIT:', config.cuit);
  console.log('- Environment:', config.environment);
  console.log('- Certificate path:', config.certPath);
  console.log('- Key path:', config.keyPath);

  try {
    // Initialize service
    console.log('\n🔧 Initializing AFIP Service in testing mode...');
    const afipService = new AfipService(config);
    await afipService.initialize();
    console.log('✅ Service initialized successfully');

    // Test authentication
    console.log('\n🔐 Testing authentication...');
    const authTest = await afipService.testAuthentication();
    if (authTest.success) {
      console.log('✅ Authentication successful!');
      console.log('- Last voucher number:', authTest.lastVoucherNumber);
    } else {
      console.log('❌ Authentication failed:', authTest.error);
    }

    // Test getting last voucher
    console.log('\n🏪 Testing Point of Sale 3:');
    try {
      const lastVoucher = await afipService.getLastVoucherNumber(3, 11);
      console.log(`✅ POS 3: Last voucher ${lastVoucher}`);
    } catch (error) {
      console.log(`❌ POS 3: ${error.message}`);
    }

  } catch (error) {
    console.log('💥 Test failed:', error.message);
    if (error.stack) {
      console.log('Stack:', error.stack);
    }
  }
}

testAfipHomologation().catch(console.error);