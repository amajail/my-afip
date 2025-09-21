const fs = require('fs');
const CSVParser = require('../utils/csvParser');

async function generateSampleData() {
  const samplePath = './data/sample-invoices.csv';
  if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data', { recursive: true });
  }
  CSVParser.generateSampleCSV(samplePath);
  console.log(`📝 Sample CSV generated at: ${samplePath}`);
}

module.exports = { generateSampleData };
