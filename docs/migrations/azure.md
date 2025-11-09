# Azure Functions + Azure Table Storage Migration Plan

**Application**: AFIP Invoice Processing System
**Target**: Azure Functions (Consumption Plan) + Azure Table Storage
**Estimated Cost**: ~$0.60/year
**Migration Time**: 1-2 days
**Date**: 2025-11-08

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture Comparison](#architecture-comparison)
3. [Azure Resources Required](#azure-resources-required)
4. [Local Development Setup](#local-development-setup)
5. [Database Migration](#database-migration)
6. [Code Changes](#code-changes)
7. [Azure Functions Structure](#azure-functions-structure)
8. [Deployment Steps](#deployment-steps)
9. [Cost Breakdown](#cost-breakdown)
10. [Testing Strategy](#testing-strategy)

---

## Overview

### Current Architecture
- **Runtime**: CLI application (Node.js)
- **Database**: SQLite (28KB, 29 orders)
- **Storage**: Local filesystem
- **Execution**: Manual via npm scripts
- **Certificates**: Local filesystem (`./certificates/`)
- **Token Cache**: Local file (`.afip-tokens`)

### Target Architecture
- **Runtime**: Azure Functions (Serverless)
- **Database**: Azure Table Storage (NoSQL)
- **Storage**: Azure Blob Storage (token cache)
- **Execution**: Timer-triggered (automated) + HTTP-triggered (on-demand)
- **Certificates**: Azure Key Vault
- **Token Cache**: Azure Blob Storage (or re-authenticate each time)

---

## Architecture Comparison

### Before (Local CLI)
```
┌─────────────────────────────────────┐
│   Local Machine                     │
│  ┌──────────────────────────────┐   │
│  │ Node.js CLI App              │   │
│  │  - npm run binance:auto      │   │
│  │  - npm run report            │   │
│  └──────────────┬───────────────┘   │
│                 │                    │
│  ┌──────────────▼───────────────┐   │
│  │ SQLite Database              │   │
│  │ (data/afip-orders.db)        │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ Certificates (filesystem)    │   │
│  │ AFIP Token Cache (file)      │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

### After (Azure Functions)
```
┌──────────────────────────────────────────────────────┐
│   Azure Cloud                                        │
│                                                      │
│  ┌────────────────────────────────────────────┐     │
│  │ Azure Functions App                        │     │
│  │  ┌──────────────────────────────────────┐  │     │
│  │  │ Timer Function: binance-auto         │  │     │
│  │  │ Schedule: 0 0 9 * * * (daily 9 AM)   │  │     │
│  │  └──────────────────────────────────────┘  │     │
│  │  ┌──────────────────────────────────────┐  │     │
│  │  │ HTTP Function: report                │  │     │
│  │  │ Trigger: GET /api/report             │  │     │
│  │  └──────────────────────────────────────┘  │     │
│  └─────────────┬────────────────────────────┬─┘     │
│                │                            │       │
│  ┌─────────────▼────────────┐   ┌───────────▼────┐  │
│  │ Azure Table Storage      │   │ Azure Key Vault│  │
│  │  - OrdersTable           │   │  - Certificates│  │
│  │  - InvoicesTable         │   │  - API Keys    │  │
│  └──────────────────────────┘   └────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ Application Insights (Monitoring/Logging)    │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

---

## Azure Resources Required

### 1. Azure Functions App
- **Plan**: Consumption (Pay-per-execution)
- **Runtime**: Node.js 18 LTS
- **Region**: East US (or closest to Argentina for AFIP latency)
- **OS**: Linux
- **Purpose**: Run automated invoice processing

### 2. Azure Storage Account
- **SKU**: Standard_LRS (Locally Redundant Storage)
- **Services Needed**:
  - Table Storage (for database)
  - Blob Storage (optional: for token cache)
- **Purpose**: Store order/invoice data

### 3. Azure Key Vault
- **SKU**: Standard
- **Secrets to Store**:
  - AFIP Certificate (cert.crt)
  - AFIP Private Key (private.key)
  - Binance API Key
  - Binance Secret Key
  - Azure Storage Connection String
- **Purpose**: Secure credential management

### 4. Application Insights
- **Type**: Workspace-based (free tier)
- **Purpose**: Monitoring, logging, alerting

---

## Local Development Setup

### Prerequisites
```bash
# Install Azure Functions Core Tools
npm install -g azure-functions-core-tools@4

# Install Azurite (local Azure Storage emulator)
npm install -g azurite

# Or use Docker
docker run -p 10000:10000 -p 10001:10001 -p 10002:10002 \
  mcr.microsoft.com/azure-storage/azurite
```

### Project Dependencies
```bash
# Remove SQLite
npm uninstall sqlite3

# Add Azure SDKs
npm install @azure/data-tables @azure/storage-blob @azure/identity @azure/keyvault-secrets

# Add Azure Functions support
npm install @azure/functions
```

### Updated package.json
```json
{
  "dependencies": {
    "@azure/data-tables": "^13.2.2",
    "@azure/identity": "^4.0.1",
    "@azure/keyvault-secrets": "^4.8.0",
    "@azure/storage-blob": "^12.17.0",
    "axios": "^1.12.2",
    "csv-parser": "^3.2.0",
    "dotenv": "^17.2.2",
    "facturajs": "^0.3.2"
  },
  "devDependencies": {
    "@azure/functions": "^4.0.0",
    "azurite": "^3.28.0",
    "jest": "^30.1.3",
    "nock": "^14.0.10"
  },
  "scripts": {
    "start": "func start",
    "azurite": "azurite --silent --location ./azurite --debug ./azurite/debug.log",
    "dev": "concurrently \"npm run azurite\" \"func start\"",
    "test": "jest",
    "deploy": "func azure functionapp publish <YOUR_FUNCTION_APP_NAME>"
  }
}
```

### Local Environment Setup

**.env (local development)**
```bash
# Azure Storage (Azurite local emulator)
AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true

# AFIP Configuration (same as before)
AFIP_CUIT=20283536638
AFIP_CERT_PATH=./certificates/cert.crt
AFIP_KEY_PATH=./certificates/private.key
AFIP_ENVIRONMENT=production
AFIP_PTOVTA=3

# Binance API Configuration
BINANCE_API_KEY=your_binance_api_key_here
BINANCE_SECRET_KEY=your_binance_secret_key_here

# Application Settings
LOG_LEVEL=info
```

**local.settings.json (Azure Functions local config)**
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AZURE_STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "AFIP_CUIT": "20283536638",
    "AFIP_ENVIRONMENT": "production",
    "AFIP_PTOVTA": "3",
    "BINANCE_API_KEY": "your_key_here",
    "BINANCE_SECRET_KEY": "your_secret_here"
  }
}
```

### Running Locally
```bash
# Terminal 1: Start Azurite
npm run azurite

# Terminal 2: Start Azure Functions
func start

# Functions will be available at:
# - http://localhost:7071/api/report
# - Timer function runs on schedule (or manually trigger)
```

---

## Database Migration

### SQLite Schema (Current)

**orders table**:
```sql
CREATE TABLE orders (
  order_number TEXT PRIMARY KEY,
  total_amount REAL NOT NULL,
  order_date TEXT NOT NULL,
  asset TEXT,
  fiat_type TEXT,
  price REAL,
  quantity REAL,
  counter_party_nick TEXT,
  advertiser_no TEXT,
  order_type TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**invoices table**:
```sql
CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL,
  cae TEXT,
  cae_expiration TEXT,
  voucher_number INTEGER,
  invoice_date TEXT,
  processed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'pending',
  processing_method TEXT,
  error_message TEXT,
  FOREIGN KEY (order_number) REFERENCES orders(order_number)
);
```

### Azure Table Storage Schema (New)

**OrdersTable**:
```javascript
{
  partitionKey: "ORDERS",              // All orders in one partition (ok for <1000/year)
  rowKey: "22820145394015559680",      // Unique order number

  // Order data
  totalAmount: 199100,
  orderDate: "2025-01-15T00:00:00Z",
  asset: "USDT",
  fiatType: "ARS",
  price: 1054.74,
  quantity: 188.71,
  counterPartyNick: "user123",
  advertiserNo: "12345",
  orderType: "SELL",

  // Invoice data (denormalized from invoices table)
  cae: "75458956166021",
  caeExpiration: "2025-01-25",
  voucherNumber: 123,
  invoiceDate: "2025-01-15",

  // Processing metadata
  status: "processed",                  // pending, processed, failed
  processingMethod: "automatic",        // automatic, manual
  processedAt: "2025-01-15T10:30:00Z",
  errorMessage: null,

  // Timestamps
  createdAt: "2025-01-15T08:00:00Z",
  timestamp: "2025-01-15T10:30:00Z"    // Azure auto-managed
}
```

**Key Design Decisions**:
1. **Single Partition Key**: All orders use `partitionKey: "ORDERS"`
   - Simple queries
   - Good for < 1000 entities/year
   - All data in one partition = fast queries

2. **Denormalized Data**: Invoice data stored directly in order entity
   - No JOINs needed (Table Storage doesn't support JOINs)
   - Slight data duplication, but simpler queries
   - Acceptable for low volume

3. **RowKey = Order Number**: Natural unique identifier
   - Direct lookups by order number
   - No AUTOINCREMENT needed

### Data Migration Script

**migrate-to-tables.js**:
```javascript
const Database = require('./src/database/Database');
const { TableClient } = require('@azure/data-tables');

async function migrateSQLiteToTables() {
  // Connect to SQLite
  const db = new Database();
  await db.initialize();

  // Connect to Azure Table Storage
  const tableClient = TableClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING,
    'OrdersTable'
  );

  await tableClient.createTable();

  // Get all orders with invoice data
  const orders = await db.getAllOrdersWithInvoices();

  console.log(`Migrating ${orders.length} orders...`);

  for (const order of orders) {
    const entity = {
      partitionKey: 'ORDERS',
      rowKey: order.order_number,

      // Order fields
      totalAmount: order.total_amount,
      orderDate: new Date(order.order_date).toISOString(),
      asset: order.asset || '',
      fiatType: order.fiat_type || '',
      price: order.price || 0,
      quantity: order.quantity || 0,
      counterPartyNick: order.counter_party_nick || '',
      advertiserNo: order.advertiser_no || '',
      orderType: order.order_type || '',

      // Invoice fields (denormalized)
      cae: order.cae || '',
      caeExpiration: order.cae_expiration || '',
      voucherNumber: order.voucher_number || 0,
      invoiceDate: order.invoice_date ? new Date(order.invoice_date).toISOString() : '',

      // Metadata
      status: order.status || 'pending',
      processingMethod: order.processing_method || 'automatic',
      processedAt: order.processed_at ? new Date(order.processed_at).toISOString() : '',
      errorMessage: order.error_message || '',
      createdAt: order.created_at ? new Date(order.created_at).toISOString() : new Date().toISOString()
    };

    await tableClient.createEntity(entity);
    console.log(`✓ Migrated order: ${order.order_number}`);
  }

  await db.close();
  console.log('Migration complete!');
}

migrateSQLiteToTables().catch(console.error);
```

---

## Code Changes

### 1. New Database Class: `src/database/TableStorageDatabase.js`

```javascript
const { TableClient } = require('@azure/data-tables');
const config = require('../config');

class TableStorageDatabase {
  constructor() {
    this.tableClient = null;
    this.tableName = 'OrdersTable';
  }

  async initialize() {
    const connectionString = config.azure.storageConnectionString;

    this.tableClient = TableClient.fromConnectionString(
      connectionString,
      this.tableName
    );

    // Create table if not exists
    await this.tableClient.createTable();
    console.log('📁 Connected to Azure Table Storage');
  }

  async close() {
    // No persistent connection to close
    console.log('✓ Azure Table Storage connection closed');
  }

  // Insert or update order
  async upsertOrder(order) {
    const entity = {
      partitionKey: 'ORDERS',
      rowKey: order.orderNumber,
      totalAmount: parseFloat(order.totalAmount),
      orderDate: new Date(order.orderDate).toISOString(),
      asset: order.asset || '',
      fiatType: order.fiatType || '',
      price: parseFloat(order.price) || 0,
      quantity: parseFloat(order.quantity) || 0,
      counterPartyNick: order.counterPartyNick || '',
      advertiserNo: order.advertiserNo || '',
      orderType: order.orderType || '',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await this.tableClient.upsertEntity(entity, 'Merge');
    return 1;
  }

  // Get order by order number
  async getOrder(orderNumber) {
    try {
      const entity = await this.tableClient.getEntity('ORDERS', orderNumber);
      return this.mapEntityToOrder(entity);
    } catch (error) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  // Check if order is already processed successfully
  async isOrderProcessed(orderNumber) {
    const order = await this.getOrder(orderNumber);
    return order && order.status === 'processed' && order.cae;
  }

  // Get all unprocessed orders
  async getUnprocessedOrders() {
    const query = `PartitionKey eq 'ORDERS' and (status eq 'pending' or status eq 'failed')`;
    const entities = [];

    for await (const entity of this.tableClient.listEntities({ queryOptions: { filter: query } })) {
      entities.push(this.mapEntityToOrder(entity));
    }

    return entities;
  }

  // Mark order as processed with invoice data
  async markOrderProcessed(orderNumber, invoiceResult, processingMethod, invoiceDate) {
    const entity = await this.tableClient.getEntity('ORDERS', orderNumber);

    entity.status = invoiceResult.success ? 'processed' : 'failed';
    entity.cae = invoiceResult.cae || '';
    entity.caeExpiration = invoiceResult.caeExpiration || '';
    entity.voucherNumber = invoiceResult.voucherNumber || 0;
    entity.invoiceDate = invoiceDate ? new Date(invoiceDate).toISOString() : '';
    entity.processingMethod = processingMethod || 'automatic';
    entity.processedAt = new Date().toISOString();
    entity.errorMessage = invoiceResult.error || '';

    await this.tableClient.updateEntity(entity, 'Merge');
  }

  // Get statistics
  async getStatistics() {
    const allOrders = [];

    for await (const entity of this.tableClient.listEntities({
      queryOptions: { filter: `PartitionKey eq 'ORDERS'` }
    })) {
      allOrders.push(this.mapEntityToOrder(entity));
    }

    const total = allOrders.length;
    const processed = allOrders.filter(o => o.status === 'processed').length;
    const failed = allOrders.filter(o => o.status === 'failed').length;
    const pending = total - processed - failed;

    const totalAmount = allOrders
      .filter(o => o.status === 'processed')
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    return {
      total,
      processed,
      pending,
      failed,
      totalAmount,
      successful: processed,
      manual: allOrders.filter(o => o.processingMethod === 'manual').length,
      automatic: allOrders.filter(o => o.processingMethod === 'automatic').length
    };
  }

  // Get orders for current month
  async getCurrentMonthOrders() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startISO = startOfMonth.toISOString();

    const query = `PartitionKey eq 'ORDERS' and orderDate ge datetime'${startISO}'`;
    const entities = [];

    for await (const entity of this.tableClient.listEntities({ queryOptions: { filter: query } })) {
      entities.push(this.mapEntityToOrder(entity));
    }

    return entities;
  }

  // Get recent processed orders
  async getRecentProcessedOrders(limit = 10) {
    const entities = [];

    for await (const entity of this.tableClient.listEntities({
      queryOptions: { filter: `PartitionKey eq 'ORDERS' and status eq 'processed'` }
    })) {
      entities.push(this.mapEntityToOrder(entity));
    }

    // Sort by processedAt descending and limit
    return entities
      .sort((a, b) => new Date(b.processedAt) - new Date(a.processedAt))
      .slice(0, limit);
  }

  // Helper: Map Azure Table entity to order object
  mapEntityToOrder(entity) {
    return {
      order_number: entity.rowKey,
      total_amount: entity.totalAmount || 0,
      order_date: entity.orderDate,
      asset: entity.asset || '',
      fiat_type: entity.fiatType || '',
      price: entity.price || 0,
      quantity: entity.quantity || 0,
      counter_party_nick: entity.counterPartyNick || '',
      advertiser_no: entity.advertiserNo || '',
      order_type: entity.orderType || '',
      cae: entity.cae || '',
      cae_expiration: entity.caeExpiration || '',
      voucher_number: entity.voucherNumber || 0,
      invoice_date: entity.invoiceDate || '',
      status: entity.status || 'pending',
      processing_method: entity.processingMethod || '',
      processed_at: entity.processedAt || '',
      error_message: entity.errorMessage || '',
      created_at: entity.createdAt || ''
    };
  }
}

module.exports = TableStorageDatabase;
```

### 2. Update `src/config/index.js`

```javascript
require('dotenv').config();

function getInt(key, defaultValue) {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getRequired(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

function get(key, defaultValue = '') {
  return process.env[key] || defaultValue;
}

module.exports = {
  // AFIP Configuration
  afip: {
    cuit: getRequired('AFIP_CUIT'),
    certPath: get('AFIP_CERT_PATH', './certificates/cert.crt'),
    keyPath: get('AFIP_KEY_PATH', './certificates/private.key'),
    environment: get('AFIP_ENVIRONMENT', 'production'),
    ptoVta: getInt('AFIP_PTOVTA', 3),
    cacheTokensPath: get('AFIP_CACHE_TOKENS_PATH', './.afip-tokens')
  },

  // Binance API Configuration
  binance: {
    apiKey: getRequired('BINANCE_API_KEY'),
    secretKey: getRequired('BINANCE_SECRET_KEY'),
    apiUrl: get('BINANCE_API_URL', 'https://api.binance.com')
  },

  // Azure Configuration
  azure: {
    storageConnectionString: getRequired('AZURE_STORAGE_CONNECTION_STRING'),
    keyVaultUrl: get('AZURE_KEYVAULT_URL', ''),
    useManagedIdentity: get('AZURE_USE_MANAGED_IDENTITY', 'false') === 'true'
  },

  // Application Settings
  app: {
    logLevel: get('LOG_LEVEL', 'info'),
    environment: get('NODE_ENV', 'development')
  },

  // Helper methods
  isProduction() {
    return this.afip.environment === 'production';
  },

  isAzure() {
    return process.env.AZURE_FUNCTIONS_ENVIRONMENT !== undefined;
  },

  isTest() {
    return process.env.NODE_ENV === 'test';
  }
};
```

### 3. Update `src/utils/DatabaseOrderTracker.js`

Replace the require statement:
```javascript
// Old
const Database = require('../database/Database');

// New
const TableStorageDatabase = require('../database/TableStorageDatabase');

class DatabaseOrderTracker {
  constructor() {
    this.db = new TableStorageDatabase();
  }

  // Rest of the code stays the same, methods are compatible
}
```

---

## Azure Functions Structure

### Project Structure
```
my-afip/
├── src/
│   ├── functions/
│   │   ├── binance-auto/
│   │   │   ├── function.json
│   │   │   └── index.js
│   │   └── report/
│   │       ├── function.json
│   │       └── index.js
│   ├── config/
│   ├── services/
│   ├── database/
│   │   └── TableStorageDatabase.js  # NEW
│   ├── models/
│   ├── commands/
│   └── utils/
├── host.json
├── local.settings.json
├── package.json
└── .funcignore
```

### Function 1: Binance Auto Processor (Timer-triggered)

**src/functions/binance-auto/function.json**:
```json
{
  "bindings": [
    {
      "name": "myTimer",
      "type": "timerTrigger",
      "direction": "in",
      "schedule": "0 0 9 * * *"
    }
  ]
}
```

**Schedule Examples**:
- `"0 0 9 * * *"` - Daily at 9:00 AM
- `"0 0 */6 * * *"` - Every 6 hours
- `"0 30 8 * * 1-5"` - Weekdays at 8:30 AM

**src/functions/binance-auto/index.js**:
```javascript
const { app } = require('@azure/functions');
const AfipInvoiceApp = require('../../AfipInvoiceApp');

app.timer('binance-auto', {
  schedule: '0 0 9 * * *',
  handler: async (myTimer, context) => {
    context.log('🤖 Binance Auto Processor started');

    try {
      const afipApp = new AfipInvoiceApp();
      await afipApp.initialize();

      // Fetch from Binance and process automatically
      const days = 7; // Last 7 days
      const tradeType = 'SELL';
      const autoProcess = true;

      context.log('📥 Fetching Binance orders...');
      await afipApp.fetchBinanceOrders(days, tradeType, autoProcess);

      context.log('✅ Binance Auto Processor completed successfully');
    } catch (error) {
      context.log.error('❌ Binance Auto Processor failed:', error);
      throw error; // This will mark the function execution as failed
    }
  }
});
```

### Function 2: Report Generator (HTTP-triggered)

**src/functions/report/function.json**:
```json
{
  "bindings": [
    {
      "authLevel": "function",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["get", "post"],
      "route": "report"
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

**src/functions/report/index.js**:
```javascript
const { app } = require('@azure/functions');
const AfipInvoiceApp = require('../../AfipInvoiceApp');

app.http('report', {
  methods: ['GET', 'POST'],
  authLevel: 'function',
  route: 'report',
  handler: async (request, context) => {
    context.log('📊 Report Generator started');

    try {
      const afipApp = new AfipInvoiceApp();
      await afipApp.initialize();

      // Capture console output to return in HTTP response
      const logs = [];
      const originalLog = console.log;
      console.log = (...args) => {
        const message = args.join(' ');
        logs.push(message);
        originalLog(...args);
      };

      await afipApp.showCurrentMonthReport();

      // Restore console.log
      console.log = originalLog;

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          report: logs.join('\n'),
          timestamp: new Date().toISOString()
        })
      };
    } catch (error) {
      context.log.error('❌ Report Generator failed:', error);

      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        })
      };
    }
  }
});
```

### Optional Function 3: Manual Process Orders (HTTP-triggered)

**src/functions/process-orders/index.js**:
```javascript
const { app } = require('@azure/functions');
const AfipInvoiceApp = require('../../AfipInvoiceApp');

app.http('process-orders', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'process-orders',
  handler: async (request, context) => {
    context.log('🔄 Manual Order Processor started');

    try {
      const afipApp = new AfipInvoiceApp();
      await afipApp.initialize();

      const result = await afipApp.processOrders();

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          result: result,
          timestamp: new Date().toISOString()
        })
      };
    } catch (error) {
      context.log.error('❌ Manual Order Processor failed:', error);

      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        })
      };
    }
  }
});
```

### host.json (Function App Configuration)
```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "excludedTypes": "Request"
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  },
  "functionTimeout": "00:05:00"
}
```

### .funcignore
```
.git*
.vscode
local.settings.json
test
.env
azurite
node_modules/@azure/functions
```

---

## Deployment Steps

### Phase 1: Azure Resource Creation

#### 1. Create Resource Group
```bash
az login
az group create --name rg-afip-invoices --location eastus
```

#### 2. Create Storage Account
```bash
az storage account create \
  --name stafipinvoices \
  --resource-group rg-afip-invoices \
  --location eastus \
  --sku Standard_LRS \
  --kind StorageV2

# Get connection string
az storage account show-connection-string \
  --name stafipinvoices \
  --resource-group rg-afip-invoices \
  --query connectionString \
  --output tsv
```

#### 3. Create Table in Storage Account
```bash
# Using Azure Storage Explorer GUI, or:
az storage table create \
  --name OrdersTable \
  --account-name stafipinvoices
```

#### 4. Create Key Vault
```bash
az keyvault create \
  --name kv-afip-invoices \
  --resource-group rg-afip-invoices \
  --location eastus \
  --sku standard

# Upload certificates and secrets
az keyvault secret set \
  --vault-name kv-afip-invoices \
  --name AFIP-Certificate \
  --file ./certificates/cert.crt

az keyvault secret set \
  --vault-name kv-afip-invoices \
  --name AFIP-PrivateKey \
  --file ./certificates/private.key

az keyvault secret set \
  --vault-name kv-afip-invoices \
  --name Binance-ApiKey \
  --value "your_binance_api_key"

az keyvault secret set \
  --vault-name kv-afip-invoices \
  --name Binance-SecretKey \
  --value "your_binance_secret_key"
```

#### 5. Create Functions App
```bash
az functionapp create \
  --resource-group rg-afip-invoices \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name func-afip-invoices \
  --storage-account stafipinvoices \
  --os-type Linux

# Enable Application Insights
az monitor app-insights component create \
  --app func-afip-invoices-insights \
  --location eastus \
  --resource-group rg-afip-invoices \
  --application-type web

INSIGHTS_KEY=$(az monitor app-insights component show \
  --app func-afip-invoices-insights \
  --resource-group rg-afip-invoices \
  --query instrumentationKey \
  --output tsv)

az functionapp config appsettings set \
  --name func-afip-invoices \
  --resource-group rg-afip-invoices \
  --settings "APPINSIGHTS_INSTRUMENTATIONKEY=$INSIGHTS_KEY"
```

#### 6. Enable Managed Identity
```bash
az functionapp identity assign \
  --name func-afip-invoices \
  --resource-group rg-afip-invoices

# Get the principal ID
PRINCIPAL_ID=$(az functionapp identity show \
  --name func-afip-invoices \
  --resource-group rg-afip-invoices \
  --query principalId \
  --output tsv)

# Grant Key Vault access
az keyvault set-policy \
  --name kv-afip-invoices \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list
```

### Phase 2: Configure Application Settings

```bash
STORAGE_CONN=$(az storage account show-connection-string \
  --name stafipinvoices \
  --resource-group rg-afip-invoices \
  --query connectionString \
  --output tsv)

az functionapp config appsettings set \
  --name func-afip-invoices \
  --resource-group rg-afip-invoices \
  --settings \
    "AZURE_STORAGE_CONNECTION_STRING=$STORAGE_CONN" \
    "AZURE_KEYVAULT_URL=https://kv-afip-invoices.vault.azure.net/" \
    "AZURE_USE_MANAGED_IDENTITY=true" \
    "AFIP_CUIT=20283536638" \
    "AFIP_ENVIRONMENT=production" \
    "AFIP_PTOVTA=3" \
    "LOG_LEVEL=info" \
    "NODE_ENV=production"
```

### Phase 3: Data Migration

```bash
# 1. Run migration script locally (connects to Azure Table Storage)
AZURE_STORAGE_CONNECTION_STRING="<connection_string>" \
  node scripts/migrate-to-tables.js

# 2. Verify data migrated
az storage entity query \
  --table-name OrdersTable \
  --account-name stafipinvoices \
  --filter "PartitionKey eq 'ORDERS'" \
  --select RowKey,totalAmount,status
```

### Phase 4: Deploy Functions

```bash
# Build and deploy
npm install --production
func azure functionapp publish func-afip-invoices

# Verify deployment
az functionapp function show \
  --name func-afip-invoices \
  --resource-group rg-afip-invoices \
  --function-name binance-auto

# Get function URLs
az functionapp function show \
  --name func-afip-invoices \
  --resource-group rg-afip-invoices \
  --function-name report \
  --query invokeUrlTemplate
```

### Phase 5: Test Functions

```bash
# Test report function (HTTP)
FUNCTION_KEY=$(az functionapp keys list \
  --name func-afip-invoices \
  --resource-group rg-afip-invoices \
  --query functionKeys.default \
  --output tsv)

curl "https://func-afip-invoices.azurewebsites.net/api/report?code=$FUNCTION_KEY"

# Manually trigger timer function
az functionapp function invoke \
  --name func-afip-invoices \
  --resource-group rg-afip-invoices \
  --function-name binance-auto

# Check logs
az functionapp log tail \
  --name func-afip-invoices \
  --resource-group rg-afip-invoices
```

---

## Cost Breakdown

### Monthly Costs (Estimated)

#### Azure Functions (Consumption Plan)
- **Free Tier**: 1M executions/month + 400,000 GB-s
- **Your Usage**:
  - Timer function: 30 executions/month (daily) × 3 sec = 90 sec
  - HTTP function: 4 executions/month × 2 sec = 8 sec
  - Total: ~100 sec/month × 128MB = 12.8 GB-s
- **Cost**: **$0.00/month** (within free tier)

#### Azure Table Storage
- **Storage**: 2 MB (1000 records × 2KB) = $0.0004/month
- **Transactions**:
  - Read: ~500/month × $0.0001/10k = $0.005
  - Write: ~100/month × $0.0001/10k = $0.001
- **Cost**: **~$0.01/month**

#### Azure Key Vault
- **Secrets**: 4 secrets × $0.03/10k operations = $0.0001/month
- **Operations**: ~100/month = $0.0003/month
- **Cost**: **~$0.03/month**

#### Application Insights
- **Data Ingestion**: < 100MB/month
- **Free Tier**: 5GB/month
- **Cost**: **$0.00/month**

### Total Monthly Cost: **~$0.04/month** (~$0.48/year)

### Annual Cost Comparison:
- **Current (Local)**: $0/year (manual execution)
- **Azure (Automated)**: **~$0.50/year**
- **Benefit**: Fully automated, cloud-based, no manual intervention

---

## Testing Strategy

### Local Testing with Azurite

#### 1. Start Azurite
```bash
npm run azurite
```

#### 2. Test Table Storage Connection
```javascript
// test-table-storage.js
const { TableClient } = require('@azure/data-tables');

async function test() {
  const client = TableClient.fromConnectionString(
    'UseDevelopmentStorage=true',
    'OrdersTable'
  );

  await client.createTable();

  await client.createEntity({
    partitionKey: 'TEST',
    rowKey: '1',
    message: 'Hello Azure Tables!'
  });

  const entity = await client.getEntity('TEST', '1');
  console.log('✓ Table Storage works:', entity.message);
}

test();
```

#### 3. Test Function Locally
```bash
func start

# In another terminal, trigger timer manually
curl -X POST http://localhost:7071/admin/functions/binance-auto

# Test HTTP function
curl http://localhost:7071/api/report
```

### Integration Testing

#### Create Test Script: `test-azure-functions.js`
```javascript
const axios = require('axios');

async function testFunctions() {
  const baseUrl = process.env.FUNCTION_APP_URL || 'http://localhost:7071';
  const code = process.env.FUNCTION_KEY || '';

  console.log('Testing Azure Functions...\n');

  // Test 1: Report function
  try {
    console.log('1. Testing report function...');
    const reportResponse = await axios.get(`${baseUrl}/api/report?code=${code}`);
    console.log('✓ Report function works');
    console.log('  Response:', reportResponse.data.success ? 'Success' : 'Failed');
  } catch (error) {
    console.error('✗ Report function failed:', error.message);
  }

  // Test 2: Manual process (if implemented)
  try {
    console.log('\n2. Testing process-orders function...');
    const processResponse = await axios.post(`${baseUrl}/api/process-orders?code=${code}`);
    console.log('✓ Process function works');
    console.log('  Response:', processResponse.data.success ? 'Success' : 'Failed');
  } catch (error) {
    console.error('✗ Process function failed:', error.message);
  }
}

testFunctions();
```

### Monitoring & Alerts

#### Set Up Application Insights Alerts
```bash
# Alert on function failures
az monitor metrics alert create \
  --name "Function Failures" \
  --resource-group rg-afip-invoices \
  --scopes "/subscriptions/<subscription-id>/resourceGroups/rg-afip-invoices/providers/Microsoft.Web/sites/func-afip-invoices" \
  --condition "count FunctionExecutionCount where Success == false > 0" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action <action-group-id>
```

---

## Troubleshooting

### Common Issues

#### 1. "Unable to connect to Azure Table Storage"
**Solution**: Check connection string in Application Settings
```bash
az functionapp config appsettings list \
  --name func-afip-invoices \
  --resource-group rg-afip-invoices \
  | grep AZURE_STORAGE_CONNECTION_STRING
```

#### 2. "Certificate not found in Key Vault"
**Solution**: Verify managed identity has access
```bash
az keyvault secret show \
  --vault-name kv-afip-invoices \
  --name AFIP-Certificate
```

#### 3. Timer function not triggering
**Solution**: Check timer schedule in function.json
```bash
# View logs
az functionapp log tail \
  --name func-afip-invoices \
  --resource-group rg-afip-invoices
```

#### 4. Function timeout (> 5 minutes on Consumption plan)
**Solution**: Upgrade to Premium plan or optimize code
```bash
# Upgrade to Premium (if needed)
az functionapp plan create \
  --resource-group rg-afip-invoices \
  --name plan-afip-premium \
  --sku EP1 \
  --is-linux

az functionapp update \
  --name func-afip-invoices \
  --resource-group rg-afip-invoices \
  --plan plan-afip-premium
```

---

## Rollback Plan

If migration fails or issues arise:

### 1. Keep SQLite Backup
```bash
# Backup current database before migration
cp data/afip-orders.db data/afip-orders.db.backup
```

### 2. Dual-Run Period
Run both local CLI and Azure Functions in parallel for 1-2 weeks to verify data consistency.

### 3. Easy Rollback
- Local CLI code remains unchanged
- Can switch back by simply stopping Azure Functions
- Data can be exported from Table Storage back to SQLite if needed

---

## Security Checklist

- [ ] All secrets stored in Azure Key Vault
- [ ] Managed Identity enabled for Functions App
- [ ] Function authentication level set to "function" (requires API key)
- [ ] CORS configured if web access needed
- [ ] Application Insights logging enabled (no sensitive data logged)
- [ ] Certificate rotation process documented
- [ ] Network restrictions configured (if needed)
- [ ] Binance API keys rotated after migration
- [ ] Local `.env` file excluded from git (in `.gitignore`)
- [ ] `local.settings.json` excluded from git (in `.gitignore`)

---

## Post-Migration Checklist

- [ ] All 29 orders migrated to Azure Table Storage
- [ ] Timer function running daily (verify in Application Insights)
- [ ] HTTP report function accessible and returning data
- [ ] Monitoring alerts configured
- [ ] Documentation updated
- [ ] Local development environment tested with Azurite
- [ ] Cost alerts configured (budget alerts)
- [ ] Backup strategy defined
- [ ] Certificate expiration monitoring set up
- [ ] Old SQLite database backed up and archived

---

## Next Steps After Migration

1. **Week 1**: Monitor function executions daily
2. **Week 2**: Verify invoice generation accuracy
3. **Month 1**: Review costs and optimize if needed
4. **Month 3**: Set up automated backups of Table Storage
5. **Month 6**: Review certificate expiration dates

---

## Support & Resources

### Azure Documentation
- [Azure Functions Node.js Guide](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node)
- [Azure Table Storage SDK](https://learn.microsoft.com/en-us/azure/storage/tables/table-storage-overview)
- [Azure Key Vault Secrets](https://learn.microsoft.com/en-us/azure/key-vault/secrets/quick-create-node)

### Tools
- [Azure Storage Explorer](https://azure.microsoft.com/en-us/products/storage/storage-explorer/)
- [Azurite Storage Emulator](https://github.com/Azure/Azurite)
- [Azure Functions Core Tools](https://github.com/Azure/azure-functions-core-tools)

### Cost Management
- [Azure Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/)
- [Azure Cost Management](https://portal.azure.com/#blade/Microsoft_Azure_CostManagement/Menu/overview)

---

**Migration Prepared By**: Claude Code Assistant
**Last Updated**: 2025-11-08
**Version**: 1.0
