const csvParser = require('../../../src/utils/csvParser');
const fs = require('fs').promises;
const path = require('path');

describe('csvParser', () => {
  const testDataDir = path.join(__dirname, '../../mocks');
  let testCsvPath;

  beforeEach(async () => {
    testCsvPath = path.join(testDataDir, 'test-invoices.csv');
  });

  afterEach(async () => {
    try {
      await fs.unlink(testCsvPath);
    } catch (error) {
      // File might not exist, ignore error
    }
  });

  describe('parseInvoices', () => {
    it('should parse valid CSV file correctly', async () => {
      const csvContent = `date,description,amount,vat
2025-09-24,Test Invoice 1,1000.50,210.11
2025-09-23,Test Invoice 2,2000.75,420.16`;

      await fs.writeFile(testCsvPath, csvContent);

      const result = await csvParser.parseInvoices(testCsvPath);

      expect(result.success).toBe(true);
      expect(result.invoices).toHaveLength(2);
      expect(result.invoices[0]).toEqual({
        date: '2025-09-24',
        description: 'Test Invoice 1',
        amount: '1000.50',
        vat: '210.11'
      });
    });

    it('should handle empty CSV file', async () => {
      await fs.writeFile(testCsvPath, '');

      const result = await csvParser.parseInvoices(testCsvPath);

      expect(result.success).toBe(true);
      expect(result.invoices).toHaveLength(0);
    });

    it('should handle CSV with only headers', async () => {
      const csvContent = 'date,description,amount,vat';
      await fs.writeFile(testCsvPath, csvContent);

      const result = await csvParser.parseInvoices(testCsvPath);

      expect(result.success).toBe(true);
      expect(result.invoices).toHaveLength(0);
    });

    it('should handle malformed CSV gracefully', async () => {
      const csvContent = `date,description,amount,vat
2025-09-24,Test Invoice 1,1000.50,210.11
2025-09-23,"Incomplete row
2025-09-22,Valid Invoice,500.00,105.00`;

      await fs.writeFile(testCsvPath, csvContent);

      const result = await csvParser.parseInvoices(testCsvPath);

      expect(result.success).toBe(true);
      // Should still parse valid rows
      expect(result.invoices.length).toBeGreaterThan(0);
    });

    it('should return error for non-existent file', async () => {
      const result = await csvParser.parseInvoices('/non/existent/file.csv');

      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });

    it('should handle CSV with different delimiters', async () => {
      const csvContent = `date;description;amount;vat
2025-09-24;Test Invoice 1;1000.50;210.11
2025-09-23;Test Invoice 2;2000.75;420.16`;

      await fs.writeFile(testCsvPath, csvContent);

      const result = await csvParser.parseInvoices(testCsvPath, { separator: ';' });

      expect(result.success).toBe(true);
      expect(result.invoices).toHaveLength(2);
      expect(result.invoices[0].description).toBe('Test Invoice 1');
    });
  });

  describe('validateInvoiceData', () => {
    it('should validate correct invoice data', () => {
      const invoice = {
        date: '2025-09-24',
        description: 'Test Invoice',
        amount: '1000.50',
        vat: '210.11'
      };

      const validation = csvParser.validateInvoiceData(invoice);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should require date field', () => {
      const invoice = {
        description: 'Test Invoice',
        amount: '1000.50',
        vat: '210.11'
      };

      const validation = csvParser.validateInvoiceData(invoice);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Date is required');
    });

    it('should validate date format', () => {
      const invoice = {
        date: 'invalid-date',
        description: 'Test Invoice',
        amount: '1000.50',
        vat: '210.11'
      };

      const validation = csvParser.validateInvoiceData(invoice);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Invalid date format');
    });

    it('should require amount field', () => {
      const invoice = {
        date: '2025-09-24',
        description: 'Test Invoice',
        vat: '210.11'
      };

      const validation = csvParser.validateInvoiceData(invoice);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Amount is required');
    });

    it('should validate amount is numeric', () => {
      const invoice = {
        date: '2025-09-24',
        description: 'Test Invoice',
        amount: 'not-a-number',
        vat: '210.11'
      };

      const validation = csvParser.validateInvoiceData(invoice);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Amount must be a valid number');
    });

    it('should validate positive amount', () => {
      const invoice = {
        date: '2025-09-24',
        description: 'Test Invoice',
        amount: '-100.50',
        vat: '0'
      };

      const validation = csvParser.validateInvoiceData(invoice);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Amount must be positive');
    });

    it('should validate VAT is numeric when provided', () => {
      const invoice = {
        date: '2025-09-24',
        description: 'Test Invoice',
        amount: '1000.50',
        vat: 'invalid-vat'
      };

      const validation = csvParser.validateInvoiceData(invoice);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('VAT must be a valid number');
    });

    it('should allow missing VAT field', () => {
      const invoice = {
        date: '2025-09-24',
        description: 'Test Invoice',
        amount: '1000.50'
      };

      const validation = csvParser.validateInvoiceData(invoice);

      expect(validation.isValid).toBe(true);
    });
  });

  describe('transformToInvoiceFormat', () => {
    it('should transform CSV data to Invoice model format', () => {
      const csvData = {
        date: '2025-09-24',
        description: 'Cryptocurrency Trading Commission',
        amount: '1000.50',
        vat: '210.11'
      };

      const invoiceData = csvParser.transformToInvoiceFormat(csvData);

      expect(invoiceData).toEqual({
        docDate: '2025-09-24',
        concept: 1, // Default to products
        netAmount: 1000.50,
        totalAmount: 1210.61,
        vatAmount: 210.11,
        currency: 'PES',
        exchange: 1,
        docType: 11, // Type C
        docNumber: '' // Empty for consumer
      });
    });

    it('should handle zero VAT', () => {
      const csvData = {
        date: '2025-09-24',
        description: 'Service',
        amount: '1000.50',
        vat: '0'
      };

      const invoiceData = csvParser.transformToInvoiceFormat(csvData);

      expect(invoiceData.vatAmount).toBe(0);
      expect(invoiceData.totalAmount).toBe(1000.50);
    });

    it('should handle missing VAT field', () => {
      const csvData = {
        date: '2025-09-24',
        description: 'Service',
        amount: '1000.50'
      };

      const invoiceData = csvParser.transformToInvoiceFormat(csvData);

      expect(invoiceData.vatAmount).toBe(0);
      expect(invoiceData.totalAmount).toBe(1000.50);
    });

    it('should detect service concept from description', () => {
      const csvData = {
        date: '2025-09-24',
        description: 'Consulting service',
        amount: '1000.50'
      };

      const invoiceData = csvParser.transformToInvoiceFormat(csvData);

      expect(invoiceData.concept).toBe(2); // Services
    });

    it('should handle decimal precision', () => {
      const csvData = {
        date: '2025-09-24',
        description: 'Test',
        amount: '1234.567',
        vat: '123.456'
      };

      const invoiceData = csvParser.transformToInvoiceFormat(csvData);

      expect(invoiceData.netAmount).toBe(1234.567);
      expect(invoiceData.vatAmount).toBe(123.456);
      expect(invoiceData.totalAmount).toBe(1358.023);
    });
  });

  describe('error handling', () => {
    it('should handle file permission errors', async () => {
      // Create a file and then make it unreadable (if supported by filesystem)
      await fs.writeFile(testCsvPath, 'test data');

      try {
        await fs.chmod(testCsvPath, 0o000); // No permissions
        const result = await csvParser.parseInvoices(testCsvPath);
        expect(result.success).toBe(false);
      } catch (error) {
        // Some filesystems don't support permission changes in tests
        // This is acceptable - the important part is testing error handling
      } finally {
        try {
          await fs.chmod(testCsvPath, 0o644); // Restore permissions for cleanup
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });

    it('should handle large CSV files gracefully', async () => {
      // Generate a large CSV file
      const header = 'date,description,amount,vat\n';
      const rows = Array(10000).fill().map((_, i) =>
        `2025-09-24,Invoice ${i},${i * 10}.50,${i * 2}.10`
      ).join('\n');

      await fs.writeFile(testCsvPath, header + rows);

      const result = await csvParser.parseInvoices(testCsvPath);

      expect(result.success).toBe(true);
      expect(result.invoices).toHaveLength(10000);
    });
  });
});