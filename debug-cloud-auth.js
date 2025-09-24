const Afip = require('@afipsdk/afip.js');
const fs = require('fs');
require('dotenv').config();

async function debugCloudAuthentication() {
  console.log('🌐 Cloud Authentication Debug');
  console.log('='.repeat(50));

  const certContent = fs.readFileSync(process.env.AFIP_CERT_PATH, 'utf8');
  const keyContent = fs.readFileSync(process.env.AFIP_KEY_PATH, 'utf8');

  console.log('📋 Configuration:');
  console.log('- CUIT:', process.env.AFIP_CUIT);
  console.log('- Environment:', process.env.AFIP_ENVIRONMENT);
  console.log('- Certificate length:', certContent.length);
  console.log('- Private key length:', keyContent.length);

  try {
    const afip = new Afip({
      CUIT: process.env.AFIP_CUIT,
      production: process.env.AFIP_ENVIRONMENT === 'production',
      cert: certContent,
      key: keyContent
    });

    console.log('\n🔑 Testing Cloud Authentication:');

    // Test direct token authorization
    try {
      console.log('Requesting token authorization...');
      const tokenAuth = await afip.GetServiceTA('wsfe');
      console.log('✅ Token authorization successful:', tokenAuth);

      // Now test server status with valid token
      console.log('\n🌐 Testing server status with token:');
      const serverStatus = await afip.ElectronicBilling.getServerStatus();
      console.log('✅ Server status with token:', serverStatus);

    } catch (tokenError) {
      console.log('❌ Token authorization failed:', tokenError.message);

      if (tokenError.status) {
        console.log('- HTTP Status:', tokenError.status);
        console.log('- Status Text:', tokenError.statusText);
      }

      if (tokenError.data) {
        console.log('- Error Data:', JSON.stringify(tokenError.data, null, 2));
      }

      // Check if it's a certificate issue
      if (tokenError.message.includes('certificate') || tokenError.message.includes('cert')) {
        console.log('\n🔍 Certificate Analysis:');
        console.log('- Certificate starts with:', certContent.substring(0, 50));
        console.log('- Certificate ends with:', certContent.substring(certContent.length - 50));
        console.log('- Private key starts with:', keyContent.substring(0, 50));
        console.log('- Certificate format valid:',
          certContent.includes('-----BEGIN CERTIFICATE-----') &&
          certContent.includes('-----END CERTIFICATE-----'));
        console.log('- Key format valid:',
          keyContent.includes('-----BEGIN PRIVATE KEY-----') &&
          keyContent.includes('-----END PRIVATE KEY-----'));
      }
    }

    // Test with testing environment
    console.log('\n🧪 Testing environment comparison:');
    try {
      const afipTest = new Afip({
        CUIT: process.env.AFIP_CUIT,
        production: false
      });

      const testStatus = await afipTest.ElectronicBilling.getServerStatus();
      console.log('✅ Testing environment (no cert):', testStatus);
    } catch (testError) {
      console.log('❌ Testing environment failed:', testError.message);
    }

  } catch (error) {
    console.log('💥 Setup error:', error.message);
    console.log('Stack:', error.stack);
  }
}

debugCloudAuthentication().catch(console.error);