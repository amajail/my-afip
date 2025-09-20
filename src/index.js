require('dotenv').config();
const fs = require('fs');
const path = require('path');
const AfipService = require('./services/AfipService');
const CSVParser = require('./utils/csvParser');
const OrderTracker = require('./utils/orderTracker');
const DatabaseOrderTracker = require('./utils/DatabaseOrderTracker');
const { processOrderFiles } = require('../scripts/convertOrders');

class AfipInvoiceApp {
  constructor() {
    this.config = {
      cuit: process.env.AFIP_CUIT,
      certPath: process.env.AFIP_CERT_PATH,
      keyPath: process.env.AFIP_KEY_PATH,
      environment: process.env.AFIP_ENVIRONMENT || 'testing',
      inputPath: process.env.INVOICE_INPUT_PATH || './data/invoices.csv',
      outputPath: process.env.INVOICE_OUTPUT_PATH || './data/processed'
    };

    this.afipService = new AfipService(this.config);
  }

  async initialize() {
    console.log('🚀 Starting AFIP Invoice Application...');
    
    if (!this.config.cuit) {
      throw new Error('AFIP_CUIT environment variable is required');
    }

    await this.afipService.initialize();
    
    if (!fs.existsSync(path.dirname(this.config.outputPath))) {
      fs.mkdirSync(path.dirname(this.config.outputPath), { recursive: true });
    }

    console.log('✅ Application initialized successfully');
  }

  async processInvoices(inputFile) {
    console.log(`📄 Processing invoices from: ${inputFile}`);

    if (!fs.existsSync(inputFile)) {
      throw new Error(`Input file not found: ${inputFile}`);
    }

    const parseResult = await CSVParser.parseInvoices(inputFile);
    
    console.log(`📊 Parsing results:`);
    console.log(`  - Total rows: ${parseResult.totalRows}`);
    console.log(`  - Valid invoices: ${parseResult.invoices.length}`);
    console.log(`  - Errors: ${parseResult.errors.length}`);

    if (parseResult.errors.length > 0) {
      console.log('\n❌ Parsing errors:');
      parseResult.errors.forEach(error => {
        console.log(`  Row ${error.row}: ${error.errors.join(', ')}`);
      });
    }

    if (parseResult.invoices.length === 0) {
      console.log('No valid invoices to process');
      return;
    }

    console.log('\n💼 Creating invoices in AFIP...');
    const results = await this.afipService.createMultipleInvoices(parseResult.invoices);
    
    await this.saveResults(results);
    this.printSummary(results);
  }

  async saveResults(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = `${this.config.outputPath}/results-${timestamp}.json`;
    
    const summary = {
      timestamp: new Date().toISOString(),
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results: results
    };

    fs.writeFileSync(outputFile, JSON.stringify(summary, null, 2));
    console.log(`💾 Results saved to: ${outputFile}`);
  }

  printSummary(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log('\n📈 Summary:');
    console.log(`  ✅ Successful: ${successful.length}`);
    console.log(`  ❌ Failed: ${failed.length}`);
    console.log(`  📊 Total: ${results.length}`);

    if (successful.length > 0) {
      console.log('\n🎉 Successfully created invoices:');
      successful.forEach(result => {
        console.log(`  - CAE: ${result.cae} | Voucher: ${result.voucherNumber}`);
      });
    }

    if (failed.length > 0) {
      console.log('\n💥 Failed invoices:');
      failed.forEach(result => {
        console.log(`  - Error: ${result.error}`);
      });
    }
  }

  async generateSampleData() {
    const samplePath = './data/sample-invoices.csv';
    if (!fs.existsSync('./data')) {
      fs.mkdirSync('./data', { recursive: true });
    }
    CSVParser.generateSampleCSV(samplePath);
    console.log(`📝 Sample CSV generated at: ${samplePath}`);
  }

  async checkOrderStatus() {
    const dbTracker = new DatabaseOrderTracker();

    try {
      const stats = await dbTracker.getStats();

      console.log(`📊 Order Processing Status (Database):`);
      console.log(`  - Total orders: ${stats.total_orders}`);
      console.log(`  - Processed: ${stats.processed_orders}`);
      console.log(`  - Unprocessed: ${stats.total_orders - stats.processed_orders}`);
      console.log(`  ✅ Successful: ${stats.successful_orders}`);
      console.log(`  ❌ Failed: ${stats.failed_orders}`);
      console.log(`  🔧 Manual: ${stats.manual_orders}`);
      console.log(`  🤖 Automatic: ${stats.automatic_orders}`);

      if (stats.total_invoiced_amount) {
        console.log(`  💰 Total invoiced: $${stats.total_invoiced_amount.toLocaleString()}`);
      }

      if (stats.processed_orders > 0) {
        console.log(`\n📋 Recent processed orders:`);
        const recentOrders = await dbTracker.getProcessedOrders();

        recentOrders.slice(0, 5).forEach(order => {
          const method = order.processing_method === 'manual' ? '🔧' : '🤖';
          const status = order.success ? '✅' : '❌';
          const cae = order.cae ? ` CAE: ${order.cae}` : '';
          console.log(`  ${method} ${status} ${order.order_number}${cae}`);
        });

        if (recentOrders.length > 5) {
          console.log(`  ... and ${recentOrders.length - 5} more`);
        }
      }

      // Show legacy file tracker too
      console.log(`\n📁 Legacy file tracker:`);
      const fileTracker = new OrderTracker();
      const fileCount = fileTracker.getProcessedOrdersCount();
      console.log(`  - File-tracked orders: ${fileCount}`);

    } finally {
      await dbTracker.close();
    }
  }

  async markManualInvoice(orderNumber, cae, voucherNumber, notes) {
    const dbTracker = new DatabaseOrderTracker();

    try {
      console.log(`🔧 Marking order ${orderNumber} as manually processed...`);

      const success = await dbTracker.markManualInvoice(orderNumber, cae, voucherNumber, notes);

      if (success) {
        console.log(`✅ Successfully marked as manual invoice`);
        console.log(`  - Order: ${orderNumber}`);
        console.log(`  - CAE: ${cae}`);
        console.log(`  - Voucher: ${voucherNumber}`);
        if (notes) console.log(`  - Notes: ${notes}`);
      } else {
        console.log(`❌ Failed to mark order as manual invoice`);
      }

    } finally {
      await dbTracker.close();
    }
  }

  async processOrders() {
    console.log('🔄 Converting cryptocurrency orders to invoices...');

    const ordersDir = './orders';
    if (!fs.existsSync(ordersDir)) {
      throw new Error('Orders folder not found. Please create ./orders folder and add JSON order files.');
    }

    const orderFiles = fs.readdirSync(ordersDir).filter(file => file.endsWith('.json'));
    if (orderFiles.length === 0) {
      throw new Error('No JSON order files found in ./orders folder.');
    }

    console.log(`📦 Found ${orderFiles.length} order file(s)`);
    const conversionResult = await processOrderFiles();

    if (!conversionResult || conversionResult.newOrders.length === 0) {
      console.log('✅ No new orders to process');
      return;
    }

    const csvFile = './data/orders-invoices.csv';
    if (fs.existsSync(csvFile)) {
      console.log('\n🚀 Processing converted invoices...');

      const parseResult = await CSVParser.parseInvoices(csvFile);

      if (parseResult.invoices.length > 0) {
        console.log('\n💼 Creating invoices in AFIP...');
        const results = await this.afipService.createMultipleInvoices(parseResult.invoices);

        // Track processed orders in database
        const dbTracker = new DatabaseOrderTracker();

        try {
          // Extract order numbers for tracking
          const orderNumbers = conversionResult.newOrders.map(order => order.orderNumber);

          // Save to database
          await dbTracker.saveResults(results, orderNumbers);

          // Also save to legacy file tracker for backward compatibility
          const fileTracker = new OrderTracker();
          results.forEach((result, index) => {
            if (orderNumbers[index]) {
              result.invoice = {
                ...result.invoice,
                orderNumber: orderNumbers[index]
              };
            }
          });
          fileTracker.saveResults(results);

          await this.saveResults(results);
          this.printSummary(results);

        } finally {
          await dbTracker.close();
        }
      }
    } else {
      throw new Error('Failed to generate orders CSV file');
    }
  }
}

async function main() {
  const app = new AfipInvoiceApp();
  
  try {
    await app.initialize();
    
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
      case 'process':
        const inputFile = args[1] || app.config.inputPath;
        await app.processInvoices(inputFile);
        break;

      case 'orders':
        await app.processOrders();
        break;

      case 'status':
        await app.checkOrderStatus();
        break;

      case 'manual':
        const orderNumber = args[1];
        const cae = args[2];
        const voucherNumber = args[3];
        const notes = args[4] || null;

        if (!orderNumber || !cae || !voucherNumber) {
          console.log('Usage: node src/index.js manual <orderNumber> <CAE> <voucherNumber> [notes]');
          console.log('Example: node src/index.js manual 22798407061264470016 12345678901234 123 "Manual invoice via AFIP portal"');
          process.exit(1);
        }

        await app.markManualInvoice(orderNumber, cae, parseInt(voucherNumber), notes);
        break;

      case 'sample':
        await app.generateSampleData();
        break;

      default:
        console.log('Usage:');
        console.log('  node src/index.js process [input-file]           - Process invoices from CSV');
        console.log('  node src/index.js orders                         - Convert orders JSON to invoices and process');
        console.log('  node src/index.js status                         - Check processed orders status');
        console.log('  node src/index.js manual <order> <cae> <voucher> - Mark order as manually processed');
        console.log('  node src/index.js sample                         - Generate sample CSV');
        break;
    }
  } catch (error) {
    console.error('💥 Application error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = AfipInvoiceApp;