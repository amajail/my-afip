# AFIP WSFEv1 Documentation Summary

## Key Authentication Requirements

According to the official AFIP WSFEv1 Manual para el Desarrollador V.4.1:

### Service Authentication (Page 17)
> **"Al momento de solicitar un Ticket de Acceso por medio del WS de Autenticación y Autorización WSAA tener en cuenta que debe enviar el tag service con el valor "wsfe" y que la duración del mismo es de 12 hs."**

**Translation**: When requesting an Access Ticket through the WSAA (Authentication and Authorization Web Service), keep in mind that you must send the service tag with the value "wsfe" and that its duration is 12 hours.

### Service URLs (Page 20)
- **Homologation**: `https://wswhomo.afip.gov.ar/wsfev1/service.asmx`
- **Production**: `https://servicios1.afip.gov.ar/wsfev1/service.asmx`

### Certificate Requirements
1. Must obtain an X.509 digital certificate issued by ARCA's Certification Authority
2. Certificate must be associated with the **"wsfe"** service in AFIP portal
3. For production: Use "Digital Certificate Administrator" web application

### Critical Configuration Points
- **Service Name for WSAA**: "wsfe" (NOT "wsfev1")
- **Endpoint URLs**: Use `/wsfev1/service.asmx` paths
- **Service Operation**: WSFEv1 (Web Service Factura Electrónica V1)

## Type C Invoices (Monotributistas)
- **CbteTipo**: 11 (Factura C)
- **No VAT**: ImpIVA must be 0
- **Service Concept**: Concept 2 requires service dates (FchServDesde, FchServHasta, FchVtoPago)

## Resolution 5616/2024 Compliance
- **CondicionIVAReceptorId**: Now mandatory field
- Specifies receiver's VAT condition

## Error Analysis
- **401 Unauthorized**: Usually indicates certificate not associated with correct service
- **Service Propagation**: Can take 24-48 hours for new certificates
- **Manual vs API**: Different authentication paths - manual interface may work while API fails

## Common Issues
1. Certificate associated with wrong service name
2. Service propagation delays
3. Using outdated WSFE instead of WSFEv1
4. Missing or incorrect CondicionIVAReceptorId field

---
*Documentation Date: June 9, 2025*
*Manual Version: V.4.1*