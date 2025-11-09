# AFIP Certificate Creation Guide - Step by Step

## 🎯 **Overview**
This guide walks you through creating a new AFIP digital certificate for WSFEv1 (Electronic Invoicing) service when experiencing 401 authentication errors.

## 🔧 **Prerequisites**
- AFIP CUIT: `YOUR_CUIT_HERE`
- Clave Fiscal access
- OpenSSL installed (for certificate request generation)

---

## **Phase 1: Generate Certificate Request (CSR)**

### **Step 1: Create Private Key**
```bash
# Navigate to certificates directory
cd certificates/

# Backup existing files
cp private.key private.key.backup
cp cert.crt cert.crt.backup

# Generate new 2048-bit RSA private key
openssl genrsa -out private_new.key 2048
```

### **Step 2: Create Certificate Signing Request (CSR)**
```bash
# Generate CSR with your CUIT information
openssl req -new -key private_new.key -out certificate_new.csr -subj "/C=AR/O=AFIP/CN=YOUR_CUIT_HERE/serialNumber=CUIT YOUR_CUIT_HERE"
```

### **Step 3: Verify CSR Creation**
```bash
# Check CSR details
openssl req -in certificate_new.csr -text -noout

# Should show:
# Subject: C = AR, O = AFIP, CN = YOUR_CUIT_HERE, serialNumber = CUIT YOUR_CUIT_HERE
```

---

## **Phase 2: AFIP Portal Certificate Creation**

### **Step 1: Access Certificate Manager**
1. Go to: https://auth.afip.gob.ar/contribuyente_/login.xhtml
2. Login with your CUIT and Clave Fiscal
3. Navigate to: **Administración de Certificados Digitales**

### **Step 2: Create New Certificate**
1. Look for **"Generar Nuevo Certificado"** or **"Crear Certificado"**
2. Select certificate type: **"Certificado de Computador"**
3. Choose validity period: **2 years** (maximum)

### **Step 3: Upload CSR**
1. **Upload** the `certificate_new.csr` file created in Phase 1
2. **Verify** the subject information shows correctly:
   - CN: YOUR_CUIT_HERE
   - Serial Number: CUIT YOUR_CUIT_HERE
3. **Submit** the certificate request

### **Step 4: Download Certificate**
1. **Wait** for certificate generation (usually immediate)
2. **Download** the generated certificate (.crt file)
3. **Save** as `cert_new.crt` in certificates directory

---

## **Phase 3: Service Association**

### **Step 1: Associate WSFE Service**
1. In **Administración de Certificados Digitales**
2. Find your new certificate (will have new serial number)
3. Click **"Asociar Servicios"** or go to **"Administrador de Relaciones"**

### **Step 2: Configure WSFE Service**
1. **Service**: Facturación Electrónica WSFEv1
2. **Authorizer**: YOUR_NAME [YOUR_CUIT_HERE]
3. **Represented**: YOUR_NAME [YOUR_CUIT_HERE]
4. **Representative**: Computador Fiscal with new certificate ID
5. **Confirm** the authorization

### **Step 3: Configure Point of Sale**
1. **Associate** Point of Sale 2 ("Factura en Línea - Monotributo")
2. **Verify** invoice type permissions (Type C - Factura C)
3. **Save** configuration

---

## **Phase 4: Update Application Configuration**

### **Step 1: Replace Certificate Files**
```bash
# Replace with new files
mv private_new.key private.key
mv cert_new.crt cert.crt

# Verify permissions
chmod 600 private.key
chmod 644 cert.crt
```

### **Step 2: Update Environment Configuration**
```bash
# Verify .env file points to correct paths
cat .env

# Should show:
# AFIP_CERT_PATH=./certificates/cert.crt
# AFIP_KEY_PATH=./certificates/private.key
```

### **Step 3: Test New Certificate**
```bash
# Test certificate format
openssl x509 -in certificates/cert.crt -text -noout

# Test authentication
npm run status
```

---

## **Phase 5: Verification & Testing**

### **Step 1: Certificate Verification**
```bash
# Check certificate details
openssl x509 -in certificates/cert.crt -noout -dates
openssl x509 -in certificates/cert.crt -noout -subject

# Verify certificate-key pair match
openssl rsa -in certificates/private.key -pubout | openssl dgst -sha256
openssl x509 -in certificates/cert.crt -pubkey -noout | openssl dgst -sha256
# These should output the same hash
```

### **Step 2: AFIP Authentication Test**
```bash
# Create test script
cat > test-new-cert.js << 'EOF'
const AfipService = require('./src/services/AfipService');
require('dotenv').config();

async function testNewCert() {
  const service = new AfipService({
    cuit: process.env.AFIP_CUIT,
    certPath: process.env.AFIP_CERT_PATH,
    keyPath: process.env.AFIP_KEY_PATH,
    environment: 'production'
  });

  await service.initialize();
  const result = await service.testAuthentication();
  console.log('Authentication result:', result);
}

testNewCert().catch(console.error);
EOF

# Run test
node test-new-cert.js
```

### **Step 3: Invoice Creation Test**
```bash
# Test with unprocessed orders
npm run orders

# Or test with Binance auto-processing
npm run binance:auto 3 SELL
```

---

## **Expected Results**

### **Success Indicators** ✅
- Certificate shows "VALIDO" status in AFIP portal
- WSFE service shows "Asociado" in service relations
- Authentication test returns server status (not 401 error)
- Invoice creation generates CAE numbers

### **Troubleshooting** ❌
If still getting 401 errors:

1. **Wait 24-48 hours** for full system propagation
2. **Verify certificate serial number** matches in portal and file
3. **Check certificate expiration** and validity dates
4. **Contact AFIP support**: 0800-999-2347

---

## **Important Notes**

⚠️ **Certificate Backup**: Always backup existing certificates before replacement
⚠️ **Service Downtime**: Certificate replacement may cause temporary service interruption
⚠️ **Validity Period**: New certificates are valid for 2 years from creation date
⚠️ **Point of Sale**: Ensure Point of Sale 2 configuration is maintained

---

## **Files Created/Modified**
- `certificates/private.key` (new private key)
- `certificates/cert.crt` (new certificate)
- `certificates/certificate.csr` (certificate request)
- `certificates/*.backup` (backup files)

---

*Last updated: 2025-09-23*
*For support: Check AFIP documentation or contact mayuda@afip.gov.ar*