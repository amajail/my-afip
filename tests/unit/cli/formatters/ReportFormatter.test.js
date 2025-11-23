/**
 * ReportFormatter Tests
 *
 * Tests for the ReportFormatter that formats invoice and order reports
 */

const ReportFormatter = require('../../../../src/cli/formatters/ReportFormatter');
const ConsoleFormatter = require('../../../../src/cli/formatters/ConsoleFormatter');
const TableFormatter = require('../../../../src/cli/formatters/TableFormatter');

// Mock the dependencies
jest.mock('../../../../src/cli/formatters/ConsoleFormatter');
jest.mock('../../../../src/cli/formatters/TableFormatter');

describe('ReportFormatter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatMonthlyReport', () => {
    it('should format report with orders and stats', () => {
      const reportData = {
        orders: [
          {
            orderNumber: '12345',
            orderDate: '2025-01-15',
            totalPrice: 100,
            processing_status: 'success',
            voucherNumber: 123,
            cae: 'CAE123'
          }
        ],
        stats: {
          totalOrders: 10,
          successfulOrders: 8,
          failedOrders: 1,
          pendingOrders: 1,
          totalAmount: 1000
        }
      };

      ReportFormatter.formatMonthlyReport(reportData);

      // Verify header was called
      expect(ConsoleFormatter.header).toHaveBeenCalled();

      // Verify TableFormatter was called with correct columns including voucherNumber
      expect(TableFormatter.format).toHaveBeenCalledWith(
        reportData.orders,
        expect.arrayContaining(['orderNumber', 'orderDate', 'totalPrice', 'processing_status', 'voucherNumber', 'cae']),
        expect.objectContaining({
          headers: expect.objectContaining({
            voucherNumber: 'Voucher'
          }),
          formatters: expect.any(Object)
        })
      );
    });

    it('should handle empty orders array', () => {
      const reportData = {
        orders: [],
        stats: {
          totalOrders: 0,
          successfulOrders: 0,
          failedOrders: 0,
          pendingOrders: 0
        }
      };

      ReportFormatter.formatMonthlyReport(reportData);

      expect(ConsoleFormatter.warning).toHaveBeenCalledWith('No orders found for this month');
      expect(TableFormatter.format).not.toHaveBeenCalled();
    });

    it('should handle null orders', () => {
      const reportData = {
        orders: null,
        stats: { totalOrders: 0 }
      };

      ReportFormatter.formatMonthlyReport(reportData);

      expect(ConsoleFormatter.warning).toHaveBeenCalledWith('No orders found for this month');
    });

    it('should format voucher number correctly', () => {
      const reportData = {
        orders: [
          { orderNumber: '1', orderDate: '2025-01-01', totalPrice: 100, processing_status: 'success', voucherNumber: 456, cae: 'CAE1' },
          { orderNumber: '2', orderDate: '2025-01-02', totalPrice: 200, processing_status: 'success', voucherNumber: null, cae: 'CAE2' }
        ],
        stats: { totalOrders: 2, successfulOrders: 2, failedOrders: 0, pendingOrders: 0 }
      };

      ReportFormatter.formatMonthlyReport(reportData);

      // Verify TableFormatter was called
      expect(TableFormatter.format).toHaveBeenCalled();

      // Get the formatters object
      const call = TableFormatter.format.mock.calls[0];
      const options = call[2];
      const formatters = options.formatters;

      // Test voucher number formatter
      expect(formatters.voucherNumber(456)).toBe('456');
      expect(formatters.voucherNumber(null)).toBe('N/A');
      expect(formatters.voucherNumber(undefined)).toBe('N/A');
    });
  });

  describe('helper methods', () => {
    describe('_formatCurrency', () => {
      it('should format currency correctly', () => {
        const result = ReportFormatter._formatCurrency(1000, 'ARS');
        expect(result).toContain('1.000');
      });

      it('should handle null amount', () => {
        const result = ReportFormatter._formatCurrency(null);
        expect(result).toBe('N/A');
      });

      it('should handle undefined amount', () => {
        const result = ReportFormatter._formatCurrency(undefined);
        expect(result).toBe('N/A');
      });

      it('should handle zero amount', () => {
        const result = ReportFormatter._formatCurrency(0);
        expect(result).toContain('0');
      });
    });

    describe('_formatStatus', () => {
      it('should format success status', () => {
        const result = ReportFormatter._formatStatus('success');
        expect(result).toBe('✓ Success');
      });

      it('should format failed status', () => {
        const result = ReportFormatter._formatStatus('failed');
        expect(result).toBe('✗ Failed');
      });

      it('should format pending status', () => {
        const result = ReportFormatter._formatStatus('pending');
        expect(result).toBe('○ Pending');
      });

      it('should handle unknown status', () => {
        const result = ReportFormatter._formatStatus('unknown');
        expect(result).toBe('unknown');
      });
    });

    describe('_percentage', () => {
      it('should calculate percentage correctly', () => {
        const result = ReportFormatter._percentage(5, 10);
        expect(result).toBe('50%');
      });

      it('should handle zero total', () => {
        const result = ReportFormatter._percentage(5, 0);
        expect(result).toBe('0%');
      });

      it('should handle null total', () => {
        const result = ReportFormatter._percentage(5, null);
        expect(result).toBe('0%');
      });

      it('should round percentage', () => {
        const result = ReportFormatter._percentage(1, 3);
        expect(result).toBe('33%');
      });
    });

    describe('_truncate', () => {
      it('should truncate long strings', () => {
        const result = ReportFormatter._truncate('This is a very long string', 10);
        expect(result).toBe('This is...');
      });

      it('should not truncate short strings', () => {
        const result = ReportFormatter._truncate('Short', 10);
        expect(result).toBe('Short');
      });

      it('should handle null string', () => {
        const result = ReportFormatter._truncate(null, 10);
        expect(result).toBe('');
      });

      it('should handle undefined string', () => {
        const result = ReportFormatter._truncate(undefined, 10);
        expect(result).toBe('');
      });
    });
  });
});
