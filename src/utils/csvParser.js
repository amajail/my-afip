const csv = require('csv-parser');
const fs = require('fs');
const Invoice = require('../models/Invoice');
const logger = require('./logger');

class CSVParser {
  static async parseInvoices(filePath) {
    return new Promise((resolve, reject) => {
      const invoices = [];
      const errors = [];

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row, index) => {
          try {
            const invoice = new Invoice(row);
            const validation = invoice.validate();
            
            if (validation.isValid) {
              invoices.push(invoice);
            } else {
              errors.push({
                row: index + 1,
                errors: validation.errors,
                data: row
              });
            }
          } catch (error) {
            errors.push({
              row: index + 1,
              errors: [error.message],
              data: row
            });
          }
        })
        .on('end', () => {
          resolve({
            invoices,
            errors,
            totalRows: invoices.length + errors.length
          });
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  static generateSampleCSV(outputPath) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const sampleData = [
      'docNumber,docDate,netAmount,totalAmount,vatAmount,concept,currency',
      `12345678,${todayStr},1000.00,1000.00,0.00,2,PES`,
      `87654321,${tomorrowStr},500.00,500.00,0.00,2,PES`
    ].join('\n');

    fs.writeFileSync(outputPath, sampleData);
    logger.info('Sample CSV created', {
      outputPath,
      event: 'sample_csv_created'
    });
  }
}

module.exports = CSVParser;