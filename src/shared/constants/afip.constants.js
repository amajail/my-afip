/**
 * AFIP Constants
 *
 * Centralized constants for AFIP API integration
 * These values are defined by AFIP and should not be modified
 */

/**
 * Document Types (Tipo de Documento)
 * Used to identify the type of taxpayer identification
 */
const AFIP_DOC_TYPE = {
  CUIT: 80,           // Tax ID for companies and professionals
  CUIL: 86,           // Tax ID for employees
  CDI: 87,            // Tax ID Card
  LE: 89,             // Libreta de Enrolamiento
  LC: 90,             // Libreta Cívica
  DNI: 96,            // National Identity Document
  PASSPORT: 94,       // Passport
  NO_ID: 99,          // Without identification (for foreign customers)
  FOREIGN_DOC: 91     // Foreign document
};

/**
 * Invoice Concepts (Concepto de Factura)
 * Defines what is being invoiced
 */
const AFIP_CONCEPT = {
  PRODUCTS: 1,        // Products only (strict 5-day rule)
  SERVICES: 2,        // Services only (allows wider date range)
  PRODUCTS_AND_SERVICES: 3  // Both products and services
};

/**
 * Voucher Types (Tipo de Comprobante)
 * Different types of invoices and credit/debit notes
 */
const AFIP_VOUCHER_TYPE = {
  // Facturas tipo A (IVA discriminado)
  INVOICE_A: 1,
  CREDIT_NOTE_A: 2,
  DEBIT_NOTE_A: 3,

  // Facturas tipo B (IVA incluido)
  INVOICE_B: 6,
  CREDIT_NOTE_B: 7,
  DEBIT_NOTE_B: 8,

  // Facturas tipo C (Monotributo)
  INVOICE_C: 11,      // Most commonly used for monotributistas
  CREDIT_NOTE_C: 12,
  DEBIT_NOTE_C: 13,

  // Facturas tipo M (exportación)
  INVOICE_M: 51,

  // Recibos
  RECEIPT: 4
};

/**
 * Sale Point (Punto de Venta)
 * Default sale point for invoice emission
 */
const DEFAULT_SALE_POINT = 1;

/**
 * VAT Rates (Alícuotas de IVA)
 * Standard VAT percentages in Argentina
 */
const VAT_RATE = {
  GENERAL: 21,        // General rate (21%)
  REDUCED: 10.5,      // Reduced rate (10.5%)
  MINIMUM: 2.5,       // Minimum rate (2.5%)
  ZERO: 0,            // Zero rate (0%)
  EXEMPT: -1          // Exempt from VAT
};

/**
 * VAT Condition Codes (Condición frente al IVA)
 * Taxpayer VAT status
 */
const VAT_CONDITION = {
  REGISTERED: 1,              // Responsable Inscripto
  REGISTERED_SIMPLIFIED: 2,   // Responsable No Inscripto
  EXEMPT: 4,                  // Exento
  NON_TAXABLE: 5,            // No Alcanzado
  MONOTAX: 6,                // Monotributista
  FINAL_CONSUMER: 7,         // Consumidor Final
  FOREIGN: 8                 // Cliente del Exterior
};

/**
 * Invoice Date Validation Rules
 * Maximum days in the past allowed for invoice dates
 */
const INVOICE_DATE_RULES = {
  PRODUCTS_MAX_DAYS: 5,       // For concept 1 (products)
  SERVICES_MAX_DAYS: 10,      // For concept 2 (services)
  FUTURE_MAX_DAYS: 10         // Maximum days in the future
};

/**
 * Currency Codes (Códigos de Moneda)
 * ISO currency codes used by AFIP
 */
const CURRENCY_CODE = {
  ARS: 'PES',     // Argentine Peso
  USD: 'DOL',     // US Dollar
  EUR: '060',     // Euro
  BRL: '012'      // Brazilian Real
};

module.exports = {
  AFIP_DOC_TYPE,
  AFIP_CONCEPT,
  AFIP_VOUCHER_TYPE,
  DEFAULT_SALE_POINT,
  VAT_RATE,
  VAT_CONDITION,
  INVOICE_DATE_RULES,
  CURRENCY_CODE
};
