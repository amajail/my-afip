const { processOrdersDatabase } = require('./src/commands/orders-db');
require('dotenv').config();

async function testFullProcessing() {
  console.log('🚀 Testing Full Order Processing');
  console.log('='.repeat(50));

  const config = {
    cuit: process.env.AFIP_CUIT,
    environment: process.env.AFIP_ENVIRONMENT,
    certPath: process.env.AFIP_CERT_PATH,
    keyPath: process.env.AFIP_KEY_PATH
  };

  try {
    console.log('📋 Configuration:');
    console.log('- Environment:', config.environment);
    console.log('- CUIT:', config.cuit);

    console.log('\n🔄 Processing orders from database...');
    const result = await processOrdersDatabase(config);

    console.log('\n📊 Results:');
    console.log('- Success:', result.success);
    console.log('- Total processed:', result.totalProcessed || 0);
    console.log('- Successful:', result.successful || 0);
    console.log('- Failed:', result.failed || 0);

    if (result.results) {
      console.log('\n📄 Detailed Results:');
      result.results.forEach((res, index) => {
        if (res.success) {
          console.log(`✅ Order ${index + 1}: CAE ${res.cae}, Voucher ${res.voucherNumber}`);
        } else {
          console.log(`❌ Order ${index + 1}: ${res.error}`);
        }
      });
    }

  } catch (error) {
    console.log('💥 Processing failed:', error.message);
    console.log('Stack:', error.stack);
  }
}

testFullProcessing().catch(console.error);