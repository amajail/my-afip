const Afip = require('@afipsdk/afip.js');
const fs = require('fs');
require('dotenv').config();

async function debugWSAA() {
  console.log('🔐 WSAA Authentication Deep Debug');
  console.log('='.repeat(50));

  const certContent = fs.readFileSync(process.env.AFIP_CERT_PATH, 'utf8');
  const keyContent = fs.readFileSync(process.env.AFIP_KEY_PATH, 'utf8');

  try {
    const afip = new Afip({
      CUIT: process.env.AFIP_CUIT,
      production: process.env.AFIP_ENVIRONMENT === 'production',
      cert: certContent,
      key: keyContent
    });

    console.log('📋 Certificate Details:');
    console.log('- New Serial:', '46620D6616353F05');
    console.log('- Valid from:', 'Sep 23 23:20:02 2025 GMT');
    console.log('- Valid until:', 'Sep 23 23:20:02 2027 GMT');
    console.log('- Subject:', 'CN = ADRI MAJAIL SERVICES, serialNumber = CUIT 20283536638');

    // Check if we can manually create a WSAA request
    console.log('\n🎫 WSAA Token Analysis:');

    // Try to get WSAA token details
    try {
      // Access internal WSAA properties if possible
      if (afip.wsaa) {
        console.log('- WSAA service found');
        console.log('- Production mode:', afip.wsaa.production);

        // Try to manually login to WSAA
        console.log('\n🔑 Attempting WSAA Login:');
        const loginResult = await afip.wsaa.login();
        console.log('✅ WSAA Login successful:', loginResult);
      } else {
        console.log('❌ No WSAA service found');
      }
    } catch (wsaaError) {
      console.log('❌ WSAA Error:', wsaaError.message);

      // Try to get more details from the error
      if (wsaaError.response) {
        console.log('- HTTP Status:', wsaaError.response.status);
        console.log('- Response headers:', wsaaError.response.headers);
        console.log('- Response data:', wsaaError.response.data);
      }
    }

    // Test specific services
    console.log('\n🧪 Service-specific Tests:');

    // Test WSFE directly
    try {
      console.log('Testing WSFEv1 service directly...');
      const wsfe = afip.ElectronicBilling;

      // Check if service is available
      console.log('- Service object:', wsfe ? 'Available' : 'Not found');

    } catch (serviceError) {
      console.log('❌ Service error:', serviceError.message);
    }

    // Manual certificate verification
    console.log('\n🔍 Manual Certificate Tests:');

    // Test if certificate is being read correctly
    const certStart = certContent.substring(0, 50);
    const certEnd = certContent.substring(certContent.length - 50);
    console.log('- Certificate start:', certStart);
    console.log('- Certificate end:', certEnd);
    console.log('- Certificate format valid:',
      certContent.includes('-----BEGIN CERTIFICATE-----') &&
      certContent.includes('-----END CERTIFICATE-----'));

    const keyStart = keyContent.substring(0, 50);
    console.log('- Private key format valid:',
      keyContent.includes('-----BEGIN PRIVATE KEY-----') &&
      keyContent.includes('-----END PRIVATE KEY-----'));

  } catch (error) {
    console.log('💥 Fatal error:', error.message);
    console.log('Stack:', error.stack);
  }
}

debugWSAA().catch(console.error);