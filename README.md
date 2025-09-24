# AFIP Electronic Invoicing for Cryptocurrency Trading

A Node.js application for processing cryptocurrency P2P trading orders into AFIP-compliant electronic invoices for Argentine monotributistas.

## ⚡ Features

- **📡 Binance API Integration**: Automatically fetch P2P trading orders from Binance
- **🔄 Automatic Order Processing**: Converts cryptocurrency trading data to AFIP invoices
- **🛡️ Duplicate Prevention**: SQLite database prevents duplicate invoice creation
- **🔧 Manual Invoice Tracking**: Mark orders as manually processed via AFIP portal
- **📊 Comprehensive Reporting**: Database-powered statistics and audit trails
- **🔐 Secure Configuration**: Environment-based configuration with sensitive data protection
- **✅ AFIP WSFEv1 Compliance**: Full support for electronic invoicing regulations
- **🤖 Full Automation**: From Binance API to AFIP invoices in one command
- **💰 100% Free AFIP Integration**: Uses open-source facturajs SDK - no paid licenses required
- **🎯 Direct AFIP Connection**: Native WSFEv1 web service integration with proper authentication

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- AFIP CUIT (tax ID)
- For production: AFIP digital certificates
- For Binance integration: Binance API key and secret

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd my-afip
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   Create `.env` file with your configuration:
   ```bash
   # AFIP Configuration
   AFIP_CUIT=your_cuit_here
   AFIP_CERT_PATH=./certificates/cert.crt
   AFIP_KEY_PATH=./certificates/private.key
   AFIP_ENVIRONMENT=production

   # Binance API Configuration
   BINANCE_API_KEY=your_binance_api_key
   BINANCE_SECRET_KEY=your_binance_secret_key
   ```

4. **Test the application**
   ```bash
   npm run status
   ```

## 📋 Configuration

### Environment Variables (`.env`)

```bash
# AFIP Configuration
AFIP_CUIT=your_cuit_here                 # Your AFIP CUIT (without hyphens)
AFIP_CERT_PATH=./certificates/cert.crt   # Path to AFIP certificate
AFIP_KEY_PATH=./certificates/private.key  # Path to private key
AFIP_ENVIRONMENT=production              # 'testing' or 'production'

# Application Settings
LOG_LEVEL=info
INVOICE_INPUT_PATH=./data/invoices.csv
INVOICE_OUTPUT_PATH=./data/processed

# Binance API Configuration (required for automatic order fetching)
BINANCE_API_KEY=your_binance_api_key
BINANCE_SECRET_KEY=your_binance_secret_key
```

### Environment Modes

- **Testing**: Uses AFIP homologation environment, no certificates needed
- **Production**: Requires valid AFIP certificates associated with "wsfe" service

### Binance API Setup

1. **Create API Key**: Go to Binance.com → Account → API Management
2. **Permissions**: Enable "Enable Reading" permission only
3. **Security**: Restrict to your IP address for additional security
4. **Copy Keys**: Add to `.env` file as shown above

## 🔧 Usage

### Option 1: Automatic Binance Integration (Recommended)

**Full automation workflow:**
```bash
# Test Binance API connection
npm run binance:test

# Fetch recent orders and auto-process to AFIP invoices
npm run binance:auto    # Fetches last 7 days + processes all existing orders
```

**Manual control:**
```bash
# Fetch current month SELL orders only
npm run binance:month

# Fetch specific time period
npm run binance:fetch 30 SELL  # Last 30 days of SELL orders

# Process all existing orders
npm run orders
```

**Database-First Workflow:**
1. **Fetches orders** from Binance P2P API
2. **Stores directly** in SQLite database (no JSON/CSV files)
3. **Prevents duplicates** using intelligent order tracking
4. **Processes directly** from database to AFIP WSFEv1 service
5. **Tracks results** with real-time status updates
6. **Automatic retry** for failed orders (401/400 errors)

**✨ Zero file dependencies** - Pure database-to-AFIP processing!

### Alternative: Manual Invoice Processing

If you prefer to create invoices manually via AFIP portal:
1. **Log into AFIP portal** and create invoices manually
2. **Mark orders as processed** in the system:
   ```bash
   npm run manual <order_number> <cae> <voucher_number> "Manual via AFIP portal"
   ```

**Note**: The system uses a pure database-first approach with no file dependencies.

### Manual Invoice Commands

Mark an order as manually processed:
```bash
npm run manual <order_number> <cae> <voucher_number> "Manual via AFIP portal"
# Example: npm run manual 22798407061264470016 12345678901234 123 "Manual processing"
```

### Status and Reporting

Check overall processing status:
```bash
npm run status
```

Get detailed current month orders report:
```bash
npm run report
# or
npm run month-report
```

The month report shows:
- 📊 **Clear status indicators**: ✅ Success, ❌ Failed, ⏳ Pending
- 💰 **Financial summary**: Total trading volume and successfully invoiced amounts
- 📋 **Detailed order breakdown** with individual status and CAE numbers
- 📈 **Accurate metrics**: Invoice success rate and overall completion
- 💡 **Next action recommendations** for pending orders

### Database-First Processing

Process all pending orders from database:
```bash
npm run orders
```

**Features:**
- ✅ **Automatic retry** for failed orders (401/400 authentication errors)
- ✅ **Real-time status updates** in database
- ✅ **Zero file dependencies** - pure database workflow
- ✅ **Intelligent duplicate detection** based on processing success

## 🔧 AFIP Integration

This application uses the **facturajs** open-source SDK for direct AFIP WSFEv1 integration:

### 🆓 Free & Open Source
- **No paid licenses** required (switched from commercial @afipsdk/afip.js)
- **Direct AFIP connection** via WSFEv1 web services
- **Full authentication** with WSAA (Web Services Authentication and Authorization)

### ✅ Production Ready
- **Valid CAE generation** for all electronic invoices
- **Proper voucher sequencing** with automatic increment management
- **Error handling** with retry logic for temporary failures
- **Production environment** authentication and service authorization

### 🔐 Certificate Requirements
For production use, you need:
1. **Valid AFIP digital certificate** registered to your CUIT
2. **Certificate authorized** for WSFEv1 service in AFIP portal
3. **Point of Sale configured** for electronic billing (default: POS 3)

### 🚀 Recent Improvements (September 2025)
- **Fixed invoice date handling** (uses current date instead of old order dates)
- **Resolved voucher numbering** sequence issues
- **Corrected service authorization** in AFIP portal
- **Updated to free SDK** eliminating monthly subscription costs
- **Verified with 15+ successful invoices** (vouchers 6-20, CAE numbers 75398279xxxxxx)

## 📊 Database Schema

The application uses SQLite (`data/afip-orders.db`) with two main tables:

### Orders Table
- **order_number**: Unique identifier from Binance (prevents duplicates)
- **amount, price, total_price**: Trading amounts in USDT and ARS
- **asset, fiat**: Currency pair (USDT/ARS)
- **trade_type**: SELL/BUY (currently focuses on SELL orders)
- **create_time**: Original transaction timestamp
- **buyer/seller_nickname**: Trading counterparties

### Invoices Table (linked to orders)
- **processing_method**: 'automatic' or 'manual'
- **success**: Boolean status of AFIP submission
- **cae**: CAE number from successful AFIP invoices
- **voucher_number**: AFIP voucher number
- **error_message**: Details of any processing failures

### Database-First Architecture
1. **Direct Storage**: Orders flow directly from Binance API → Database (no JSON/CSV files)
2. **Intelligent Processing**: Only unprocessed/failed orders sent to AFIP
3. **Automatic Retry**: Failed orders automatically retry on next run
4. **Manual Override**: Orders can be marked as manually processed via AFIP portal
5. **Real-time Updates**: Instant status tracking with ACID transaction compliance
6. **Zero File Dependencies**: Pure database-to-AFIP workflow

## 🔒 Security Features

### Data Protection
- **`.gitignore`**: Excludes sensitive files from version control
- **Environment Variables**: Sensitive configuration via `.env` file
- **Certificate Security**: Digital certificates stored locally, never committed

### Protected Data
- AFIP certificates and private keys
- Personal trading order data
- Database files with transaction history
- Processing results with personal information

## 📁 Project Structure

```
my-afip/
├── src/
│   ├── commands/
│   │   ├── report.js         # Current month report logic
│   │   ├── orders.js         # Order processing (DB and legacy)
│   │   ├── status.js         # Status reporting
│   │   ├── process.js        # CSV invoice processing
│   │   ├── manual.js         # Manual invoice marking
│   │   ├── sample.js         # Sample data generation
│   │   └── binance.js        # Binance API commands
│   ├── services/
│   │   ├── AfipService.js
│   │   └── BinanceService.js
│   ├── models/
│   │   └── Invoice.js
│   ├── utils/
│   │   ├── csvParser.js
│   │   ├── DatabaseOrderTracker.js
│   │   └── orderTracker.js
│   ├── database/
│   │   └── Database.js
│   ├── AfipInvoiceApp.js     # Main app class (delegates to commands)
│   └── cli.js                # CLI entrypoint
├── scripts/
│   ├── convertOrders.js
│   └── fetchBinanceOrders.js
├── data/
│   ├── afip-orders.db
│   └── sample-invoices.csv
├── orders/
├── certificates/
│   ├── cert.crt
│   └── private.key
├── package.json
├── .env
└── README.md
```

## 📈 Available Commands

| Command                  | Description                                      |
|--------------------------|--------------------------------------------------|
| `npm run report`         | Current month orders report                      |
| `npm run orders`         | Process all unprocessed orders                   |
| `npm run status`         | Show processing status and statistics            |
| `npm run manual`         | Mark order as manually processed                 |
| `npm run process [file]` | Process invoices from CSV file                   |
| `npm run sample`         | Generate sample CSV file                         |
| `npm run binance:test`   | Test Binance API connection                      |
| `npm run binance:fetch`  | Fetch orders from Binance API                    |
| `npm run binance:month`  | Fetch current month SELL orders                  |
| `npm run binance:auto`   | Fetch from Binance and auto-process to AFIP      |

### Binance Integration Examples

```bash
# Test your API keys
npm run binance:test

# Fetch last 7 days of SELL orders
npm run binance:fetch 7 SELL

# Fully automated: fetch + process + create invoices
npm run binance:auto 30 SELL

# Get detailed current month report
npm run report

# Advanced usage with direct script
node scripts/fetchBinanceOrders.js recent 7 SELL
node scripts/fetchBinanceOrders.js range 2025-09-15 2025-09-20 SELL
```

## 🔍 Troubleshooting

### AFIP Authentication Issues (401 Error)
- Verify AFIP certificate is associated with "wsfe" service
- Allow 24-48 hours for service propagation after certificate creation
- Check CUIT in `.env` file matches certificate

### Binance API Issues
- **API Key Errors**: Verify `BINANCE_API_KEY` and `BINANCE_SECRET_KEY` in `.env`
- **Permission Errors**: Ensure API key has "Enable Reading" permission
- **Rate Limits**: Binance limits API calls - the app automatically handles this
- **Date Range**: Maximum 30 days per request, 6 months historical data limit
- **Test Connection**: Always run `npm run binance:test` first

### Duplicate Detection
- Orders are tracked by unique `orderNumber` in database
- Manual processing updates the same tracking record
- Use `npm run status` to verify processing history

## 📚 AFIP Integration Details

### Supported Invoice Types
- **Type C (11)**: For monotributistas (no VAT)
- **Consumer Invoices**: Supports empty document numbers

### Required Fields
- Service concept (2) with service dates
- Argentine peso (PES) currency
- Point of sale 2 (Factura en Línea)

## ⚠️ Important Notes

- **Never commit sensitive data** (certificates, personal orders, .env files)
- **Test in homologation environment** before production use
- **Backup your database** before major changes
- **Verify AFIP compliance** for your specific tax situation

## 📄 License

This project is licensed under the ISC License.
