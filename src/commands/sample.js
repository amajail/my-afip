const fs = require('fs');
const CSVParser = require('../utils/csvParser');
const logger = require('../utils/logger');

async function generateSampleData() {
  const samplePath = './data/sample-invoices.csv';
  if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data', { recursive: true });
  }
  CSVParser.generateSampleCSV(samplePath);
  logger.info('Sample CSV generated', {
    samplePath,
    event: 'sample_data_generated'
  });
}

module.exports = { generateSampleData };
