const { AfipServices } = require('facturajs');
const fs = require('fs');
require('dotenv').config();

async function debugDetailedAuth() {
  console.log('🔍 Detailed AFIP Authentication Debug');
  console.log('='.repeat(50));

  try {
    // Clear any existing cache
    if (fs.existsSync('./.afip-tokens')) {
      fs.unlinkSync('./.afip-tokens');
      console.log('🗑️ Cleared token cache');
    }

    const config = {
      certPath: process.env.AFIP_CERT_PATH,
      privateKeyPath: process.env.AFIP_KEY_PATH,
      cacheTokensPath: './.afip-tokens-debug',
      homo: false, // Production mode
      tokensExpireInHours: 12
    };

    console.log('📋 Configuration:');
    console.log('- Certificate path:', config.certPath);
    console.log('- Private key path:', config.privateKeyPath);
    console.log('- Homologation mode:', config.homo);

    const afip = new AfipServices(config);
    const cuit = parseInt(process.env.AFIP_CUIT);

    console.log('\n🎫 Step 1: Testing direct execRemote call for server status...');
    try {
      const serverStatus = await afip.execRemote('wsfe', 'FEDummy', {
        Auth: { Cuit: cuit }
      });
      console.log('✅ Server status (FEDummy):', serverStatus);
    } catch (error) {
      console.log('❌ Server status error:', error.message);

      // Check if it's specifically about service authorization
      if (error.message.includes('no autorizado')) {
        console.log('🚨 Service not authorized - this usually means:');
        console.log('   1. Certificate not properly authorized for WSFEv1');
        console.log('   2. Point of Sale not configured');
        console.log('   3. Authorization takes time to propagate (up to 24h)');
      }
    }

    console.log('\n🎫 Step 2: Testing getLastBillNumber...');
    try {
      const lastBill = await afip.getLastBillNumber({
        Auth: { Cuit: cuit },
        params: {
          CbteTipo: 11,
          PtoVta: 3
        }
      });
      console.log('✅ Last bill number:', lastBill);
    } catch (error) {
      console.log('❌ Last bill error:', error.message);

      // Parse the error for more details
      if (error.message.includes('ns1:coe')) {
        console.log('🔍 WSAA Authentication Error Details:');
        const match = error.message.match(/hostname":"([^"]+)"/);
        if (match) {
          console.log('   - AFIP Server:', match[1]);
        }

        console.log('   - This indicates an issue with WSAA token generation');
        console.log('   - Either certificate auth failed or service not authorized');
      }
    }

    console.log('\n🎫 Step 3: Check if token cache was created...');
    if (fs.existsSync(config.cacheTokensPath)) {
      const tokenData = fs.readFileSync(config.cacheTokensPath, 'utf8');
      console.log('📄 Token cache created:', tokenData.substring(0, 200) + '...');
    } else {
      console.log('❌ No token cache created - authentication likely failed');
    }

    console.log('\n🎫 Step 4: Test with specific error handling...');
    try {
      // Try a very simple request
      const simpleTest = await afip.execRemote('wsfe', 'FECompUltimoAutorizado', {
        Auth: { Cuit: cuit },
        params: {
          PtoVta: 3,
          CbteTipo: 11
        }
      });
      console.log('✅ Simple test result:', simpleTest);
    } catch (error) {
      console.log('❌ Simple test failed:', error.message);

      // Try to get more structured error info
      if (error.response) {
        console.log('🔍 HTTP Response Details:');
        console.log('   - Status:', error.response.status);
        console.log('   - Headers:', error.response.headers);
        console.log('   - Data:', error.response.data);
      }
    }

  } catch (error) {
    console.log('💥 Fatal error:', error.message);
    console.log('Stack:', error.stack);
  }
}

debugDetailedAuth().catch(console.error);