const Afip = require('@afipsdk/afip.js');
const fs = require('fs');
require('dotenv').config();

async function detailedDebug() {
  console.log('🕵️ Detailed AFIP Debugging');
  console.log('='.repeat(50));

  try {
    // Test with exactly the same configuration as our service
    const afip = new Afip({
      CUIT: process.env.AFIP_CUIT,
      production: process.env.AFIP_ENVIRONMENT === 'production',
      cert: fs.readFileSync(process.env.AFIP_CERT_PATH, 'utf8'),
      key: fs.readFileSync(process.env.AFIP_KEY_PATH, 'utf8')
    });

    console.log('📋 SDK Configuration:');
    console.log('- CUIT:', process.env.AFIP_CUIT);
    console.log('- Production mode:', process.env.AFIP_ENVIRONMENT === 'production');
    console.log('- Certificate path:', process.env.AFIP_CERT_PATH);
    console.log('- Key path:', process.env.AFIP_KEY_PATH);

    // Check internal SDK structure
    console.log('\n🔍 SDK Internal Structure:');
    console.log('- afip object type:', typeof afip);
    console.log('- afip.CUIT:', afip.CUIT);
    console.log('- afip.production:', afip.production);
    console.log('- afip.cert present:', !!afip.cert);
    console.log('- afip.key present:', !!afip.key);

    // List all available properties/methods
    console.log('- Available properties:', Object.keys(afip));

    // Check ElectronicBilling service
    console.log('\n💼 ElectronicBilling Service:');
    if (afip.ElectronicBilling) {
      console.log('- Service available:', true);
      console.log('- Service methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(afip.ElectronicBilling)));
    } else {
      console.log('- Service available:', false);
    }

    // Try different approaches to get server status
    console.log('\n🌐 Network Tests:');

    // Test 1: Direct method call
    try {
      console.log('Attempting direct getServerStatus call...');
      const result1 = await afip.ElectronicBilling.getServerStatus();
      console.log('✅ Direct call success:', result1);
    } catch (e) {
      console.log('❌ Direct call failed:', e.message);
      if (e.response) {
        console.log('  - Status code:', e.response.status);
        console.log('  - Status text:', e.response.statusText);
        console.log('  - Response headers:', JSON.stringify(e.response.headers, null, 2));
      }
    }

    // Test with specific point of sale
    console.log('\n🏪 Point of Sale Tests:');
    for (const pos of [1, 2, 3]) {
      try {
        console.log(`Testing POS ${pos}...`);
        const voucherResult = await afip.ElectronicBilling.getLastVoucher(pos, 11);
        console.log(`✅ POS ${pos} result:`, voucherResult);
      } catch (e) {
        console.log(`❌ POS ${pos} failed:`, e.message);
      }
    }

    // Check WSAA status
    console.log('\n🔐 WSAA Status:');
    try {
      // Check if wsaa exists and its properties
      console.log('- wsaa property exists:', 'wsaa' in afip);
      if (afip.wsaa) {
        console.log('- wsaa type:', typeof afip.wsaa);
        console.log('- wsaa properties:', Object.keys(afip.wsaa));
      }

      // Check if there's a different way to access WSAA
      console.log('- Checking for WSAA alternatives...');
      const wsaaAlts = ['WSAA', 'webServiceAuthenticationAndAuthorization', 'auth'];
      for (const alt of wsaaAlts) {
        if (afip[alt]) {
          console.log(`  - Found ${alt}:`, typeof afip[alt]);
        }
      }

    } catch (e) {
      console.log('❌ WSAA check failed:', e.message);
    }

  } catch (error) {
    console.log('💥 Setup error:', error.message);
    console.log('Stack:', error.stack);
  }
}

detailedDebug().catch(console.error);