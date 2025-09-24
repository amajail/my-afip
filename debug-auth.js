const Afip = require('@afipsdk/afip.js');
const fs = require('fs');
require('dotenv').config();

async function debugAuthentication() {
  console.log('🔍 AFIP Authentication Debugging');
  console.log('='.repeat(50));

  const certContent = fs.readFileSync(process.env.AFIP_CERT_PATH, 'utf8');
  const keyContent = fs.readFileSync(process.env.AFIP_KEY_PATH, 'utf8');

  console.log('📋 Configuration:');
  console.log('- CUIT:', process.env.AFIP_CUIT);
  console.log('- Environment:', process.env.AFIP_ENVIRONMENT);
  console.log('- Certificate length:', certContent.length);
  console.log('- Private key length:', keyContent.length);

  // Test 1: Basic SDK initialization
  console.log('\n🧪 Test 1: Basic SDK Initialization');
  try {
    const afip = new Afip({
      CUIT: process.env.AFIP_CUIT,
      production: process.env.AFIP_ENVIRONMENT === 'production',
      cert: certContent,
      key: keyContent
    });
    console.log('✅ SDK initialized successfully');

    // Test 2: Server status
    console.log('\n🧪 Test 2: Server Status');
    try {
      const serverStatus = await afip.ElectronicBilling.getServerStatus();
      console.log('✅ Server status:', serverStatus);
    } catch (error) {
      console.log('❌ Server status error:', error.message);
      if (error.response) {
        console.log('- Status:', error.response.status);
        console.log('- Data:', error.response.data);
      }
    }

    // Test 3: Last voucher number with different POS
    console.log('\n🧪 Test 3: Last Voucher Tests');
    for (const pos of [1, 2, 3, 4, 5]) {
      try {
        const result = await afip.ElectronicBilling.getLastVoucher(pos, 11);
        console.log(`✅ POS ${pos}:`, result);
      } catch (error) {
        console.log(`❌ POS ${pos}:`, error.message);
      }
    }

    // Test 4: WSAA token
    console.log('\n🧪 Test 4: WSAA Token Test');
    try {
      // Try to access the WSAA token directly
      const wsaaToken = afip.wsaa ? afip.wsaa.token : 'Not available';
      console.log('WSAA Token:', wsaaToken ? 'Present' : 'Missing');
    } catch (error) {
      console.log('❌ WSAA error:', error.message);
    }

  } catch (error) {
    console.log('❌ SDK initialization failed:', error.message);
    console.log('Stack:', error.stack);
  }

  // Test 5: Testing environment
  console.log('\n🧪 Test 5: Testing Environment');
  try {
    const afipTesting = new Afip({
      CUIT: process.env.AFIP_CUIT,
      production: false // Force testing mode
    });

    const testingStatus = await afipTesting.ElectronicBilling.getServerStatus();
    console.log('✅ Testing environment status:', testingStatus);
  } catch (error) {
    console.log('❌ Testing environment error:', error.message);
  }
}

debugAuthentication().catch(console.error);