const AfipService = require('./src/services/AfipService');
require('dotenv').config();

async function testNewAfipService() {
  console.log('🧪 Testing New AFIP Service (facturajs)');
  console.log('='.repeat(50));

  const config = {
    cuit: process.env.AFIP_CUIT,
    environment: process.env.AFIP_ENVIRONMENT,
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
    console.log('\n🔧 Initializing AFIP Service...');
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

    // Test getting last voucher for different points of sale
    console.log('\n🏪 Testing different Points of Sale:');
    for (const pos of [1, 2, 3]) {
      try {
        const lastVoucher = await afipService.getLastVoucherNumber(pos, 11);
        console.log(`✅ POS ${pos}: Last voucher ${lastVoucher}`);
      } catch (error) {
        console.log(`❌ POS ${pos}: ${error.message}`);
      }
    }

  } catch (error) {
    console.log('💥 Test failed:', error.message);
    if (error.stack) {
      console.log('Stack:', error.stack);
    }
  }
}

testNewAfipService().catch(console.error);