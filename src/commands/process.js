const fs = require('fs');
const logger = require('../utils/logger');
const CSVParser = require('../utils/csvParser');

async function processInvoices(app, inputFile) {
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
  const results = await app.afipService.createMultipleInvoices(parseResult.invoices);
  await saveResults(app, results);
  printSummary(results);
}

async function saveResults(app, results) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = `${app.config.outputPath}/results-${timestamp}.json`;
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

function printSummary(results) {
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

module.exports = { processInvoices };
