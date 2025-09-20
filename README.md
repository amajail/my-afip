# AFIP Electronic Invoicing for Cryptocurrency Trading

A Node.js application for processing cryptocurrency P2P trading orders into AFIP-compliant electronic invoices for Argentine monotributistas.

## ⚡ Features

- **🔄 Automatic Order Processing**: Converts cryptocurrency trading JSON data to AFIP invoices
- **🛡️ Duplicate Prevention**: SQLite database prevents duplicate invoice creation
- **🔧 Manual Invoice Tracking**: Mark orders as manually processed via AFIP portal
- **📊 Comprehensive Reporting**: Database-powered statistics and audit trails
- **🔐 Secure Configuration**: Environment-based configuration with sensitive data protection
- **✅ AFIP WSFEv1 Compliance**: Full support for electronic invoicing regulations

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- AFIP CUIT (tax ID)
- For production: AFIP digital certificates

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
   ```bash
   cp .env.example .env
   # Edit .env with your AFIP CUIT and settings
   ```

4. **Test the application**
   ```bash
   npm run status
   ```

## 📋 Configuration

### Environment Variables (`.env`)

```bash
# Your AFIP CUIT (without hyphens) - REPLACE WITH YOUR ACTUAL CUIT
AFIP_CUIT=your_cuit_here

# Environment: 'testing' for homologation, 'production' for live
AFIP_ENVIRONMENT=testing

# AFIP Certificate paths (production only)
AFIP_CERT_PATH=./certificates/cert.crt
AFIP_KEY_PATH=./certificates/private.key
```

### Testing vs Production

- **Testing**: Uses AFIP homologation environment, no certificates needed
- **Production**: Requires valid AFIP certificates associated with "wsfe" service

## 🔧 Usage

### Processing Cryptocurrency Orders

1. **Add order files** to `./orders/` directory (JSON format from crypto exchange)
2. **Process orders** automatically:
   ```bash
   npm run orders
   ```

### Manual Invoice Tracking

Mark an order as manually processed:
```bash
node src/index.js manual 22798407061264470016 12345678901234 123 "Manual via AFIP portal"
# Format: orderNumber CAE voucherNumber notes
```

### Status and Reporting

Check processing status:
```bash
npm run status
```

### Processing CSV Files

Process invoices from CSV:
```bash
npm run process data/invoices.csv
```

## 📊 Database Schema

The application uses SQLite to track:

- **Orders**: Cryptocurrency trading data with processing status
- **Processing Method**: Automatic vs manual invoice creation
- **Results**: CAE numbers, voucher numbers, error messages
- **Audit Trail**: Timestamps and processing history

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
│   ├── services/AfipService.js      # AFIP API integration
│   ├── models/Invoice.js            # Invoice data model
│   ├── utils/csvParser.js           # CSV file processing
│   ├── utils/DatabaseOrderTracker.js # Database operations
│   └── database/Database.js         # SQLite database layer
├── scripts/
│   └── convertOrders.js             # Order conversion utility
├── examples/
│   ├── orders/sample-orders.json    # Example order format
│   └── certificates/README.md       # Certificate guide
├── data/                            # Generated data (gitignored)
├── orders/                          # Your order files (gitignored)
├── certificates/                    # AFIP certificates (gitignored)
└── .env                            # Configuration (gitignored)
```

## 📈 Available Commands

| Command | Description |
|---------|-------------|
| `npm run orders` | Process cryptocurrency orders to AFIP invoices |
| `npm run status` | Check database status and statistics |
| `npm run manual` | Mark order as manually processed |
| `npm run process [file]` | Process invoices from CSV file |
| `npm run sample` | Generate sample CSV file |

## 🔍 Troubleshooting

### Authentication Issues (401 Error)
- Verify AFIP certificate is associated with "wsfe" service
- Allow 24-48 hours for service propagation after certificate creation
- Check CUIT in `.env` file matches certificate

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