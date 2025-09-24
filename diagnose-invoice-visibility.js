const { AfipServices } = require('facturajs');
require('dotenv').config();

async function diagnoseInvoiceVisibility() {
  console.log('🔍 Diagnosing Invoice Visibility in AFIP Portal');
  console.log('='.repeat(60));

  try {
    const config = {
      certPath: process.env.AFIP_CERT_PATH,
      privateKeyPath: process.env.AFIP_KEY_PATH,
      cacheTokensPath: './.afip-tokens-diag',
      homo: process.env.AFIP_ENVIRONMENT !== 'production',
      tokensExpireInHours: 12
    };

    const afip = new AfipServices(config);
    const cuit = parseInt(process.env.AFIP_CUIT);

    console.log('📋 Configuration:');
    console.log('- CUIT:', cuit);
    console.log('- Environment:', config.homo ? 'Homologation' : 'Production');
    console.log('- Point of Sale: 3');

    // 1. Check server status
    console.log('\n🌐 Step 1: Checking AFIP server status...');
    try {
      const serverStatus = await afip.execRemote('wsfe', 'FEDummy', {
        Auth: { Cuit: cuit }
      });
      console.log('✅ Server status:', serverStatus);
    } catch (error) {
      console.log('❌ Server status error:', error.message);
    }

    // 2. Get available sales points
    console.log('\n🏪 Step 2: Getting available sales points...');
    try {
      const salesPointsResponse = await afip.execRemote('wsfe', 'FEParamGetPtosVenta', {
        Auth: { Cuit: cuit }
      });

      if (salesPointsResponse && salesPointsResponse.ResultGet) {
        const salesPoints = salesPointsResponse.ResultGet.PtoVenta;
        console.log('✅ Available sales points:');
        if (Array.isArray(salesPoints)) {
          salesPoints.forEach(sp => {
            console.log(`   - POS ${sp.Nro}: ${sp.EmisionTipo} (${sp.Bloqueado === 'N' ? 'Active' : 'Blocked'})`);
          });
        } else if (salesPoints) {
          console.log(`   - POS ${salesPoints.Nro}: ${salesPoints.EmisionTipo} (${salesPoints.Bloqueado === 'N' ? 'Active' : 'Blocked'})`);
        }
      } else {
        console.log('❌ No sales points data received');
      }
    } catch (error) {
      console.log('❌ Sales points error:', error.message);
    }

    // 3. Get voucher types
    console.log('\n📄 Step 3: Getting available voucher types...');
    try {
      const voucherTypesResponse = await afip.execRemote('wsfe', 'FEParamGetTiposCbte', {
        Auth: { Cuit: cuit }
      });

      if (voucherTypesResponse && voucherTypesResponse.ResultGet) {
        const types = voucherTypesResponse.ResultGet.CbteTipo;
        console.log('✅ Available voucher types:');
        if (Array.isArray(types)) {
          types.forEach(type => {
            if ([6, 11].includes(parseInt(type.Id))) { // Show only B and C types
              console.log(`   - Type ${type.Id}: ${type.Desc} (Valid from: ${type.FchDesde} to: ${type.FchHasta || 'current'})`);
            }
          });
        }
      }
    } catch (error) {
      console.log('❌ Voucher types error:', error.message);
    }

    // 4. Check last authorized voucher again with detailed info
    console.log('\n🔢 Step 4: Getting detailed last voucher info...');
    try {
      const lastVoucherResponse = await afip.execRemote('wsfe', 'FECompUltimoAutorizado', {
        Auth: { Cuit: cuit },
        params: {
          PtoVta: 3,
          CbteTipo: 11
        }
      });
      console.log('✅ Last voucher response:', JSON.stringify(lastVoucherResponse, null, 2));
    } catch (error) {
      console.log('❌ Last voucher error:', error.message);
    }

    // 5. Try to query a specific voucher that we know exists (voucher 20)
    console.log('\n🔍 Step 5: Attempting to query specific voucher (20)...');
    try {
      // Method 1: Try FECompConsultar
      console.log('Trying FECompConsultar method...');
      const queryResponse = await afip.execRemote('wsfe', 'FECompConsultar', {
        Auth: { Cuit: cuit },
        params: {
          FeCompConsReq: {
            CbteTipo: 11,
            PtoVta: 3,
            CbteNro: 20
          }
        }
      });
      console.log('✅ Voucher 20 details:', JSON.stringify(queryResponse, null, 2));
    } catch (error) {
      console.log('❌ Voucher query error:', error.message);
    }

    // 6. Check if there's a delay in AFIP portal synchronization
    console.log('\n⏰ Step 6: Portal Synchronization Check...');
    console.log('💡 AFIP Portal Visibility Notes:');
    console.log('   - Web Services (API) and Portal may have different sync times');
    console.log('   - Portal updates can take 1-24 hours to reflect API operations');
    console.log('   - Electronic invoices created via API may appear in different sections');

    // 7. Environment verification
    console.log('\n🌍 Step 7: Environment Verification...');
    console.log('Current environment settings:');
    console.log('- AFIP_ENVIRONMENT:', process.env.AFIP_ENVIRONMENT);
    console.log('- Using production endpoints:', !config.homo);
    console.log('- Certificate for production:', config.certPath);

    if (config.homo) {
      console.log('⚠️  WARNING: You are in HOMOLOGATION mode!');
      console.log('   Homologation invoices will NOT appear in the production portal');
      console.log('   Check homologation portal instead');
    } else {
      console.log('✅ Production mode - invoices should appear in production portal');
    }

    console.log('\n📍 Where to look in AFIP Portal:');
    console.log('1. Main path: Comprobantes en línea → Consultas');
    console.log('2. Alternative: Servicios Web → WSFEv1 → Comprobantes');
    console.log('3. Electronic Billing: Factura Electrónica → Mis Comprobantes');
    console.log('4. Search filters: Date = 2025-09-24, POS = 3, Type = C');

  } catch (error) {
    console.log('💥 Diagnosis failed:', error.message);
    console.log('Stack:', error.stack);
  }
}

diagnoseInvoiceVisibility().catch(console.error);