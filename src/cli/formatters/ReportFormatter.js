/**
 * ReportFormatter
 *
 * Formats invoice and order reports for CLI output
 * Part of Presentation Layer (CLI)
 */

const ConsoleFormatter = require('./ConsoleFormatter');
const TableFormatter = require('./TableFormatter');

class ReportFormatter {
  /**
   * Format monthly invoice report
   * @param {Object} reportData - Report data
   * @param {Array} reportData.orders - Orders array
   * @param {Object} reportData.stats - Statistics object
   */
  static formatMonthlyReport(reportData) {
    const { orders, stats } = reportData;

    // Header
    const currentDate = new Date();
    const monthYear = currentDate.toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric'
    });
    ConsoleFormatter.header(`Monthly Invoice Report - ${monthYear}`);

    if (!orders || orders.length === 0) {
      ConsoleFormatter.warning('No orders found for this month');
      return;
    }

    // Summary Statistics
    this._formatStatistics(stats);

    // Orders by Status
    this._formatOrdersByStatus(orders);

    // Processing Method Breakdown
    if (stats.successfulOrders > 0) {
      this._formatProcessingMethods(orders);
    }

    // Failed Orders Details
    const failedOrders = orders.filter(o => o.processing_status === 'failed');
    if (failedOrders.length > 0) {
      this._formatFailedOrders(failedOrders);
    }

    ConsoleFormatter.newLine();
  }

  /**
   * Format statistics section
   * @private
   */
  static _formatStatistics(stats) {
    ConsoleFormatter.subheader('Summary');

    const statsData = {
      'Total Orders': stats.totalOrders || 0,
      'Successful': `${stats.successfulOrders || 0} (${this._percentage(stats.successfulOrders, stats.totalOrders)})`,
      'Failed': `${stats.failedOrders || 0} (${this._percentage(stats.failedOrders, stats.totalOrders)})`,
      'Pending': `${stats.pendingOrders || 0} (${this._percentage(stats.pendingOrders, stats.totalOrders)})`,
    };

    if (stats.totalAmount) {
      statsData['Total Amount'] = this._formatCurrency(stats.totalAmount);
    }

    Object.entries(statsData).forEach(([key, value]) => {
      ConsoleFormatter.keyValue(key, value, 1);
    });

    ConsoleFormatter.newLine();
  }

  /**
   * Format orders by status table
   * @private
   */
  static _formatOrdersByStatus(orders) {
    ConsoleFormatter.subheader('Orders by Status');

    const columns = ['orderNumber', 'orderDate', 'totalPrice', 'processing_status', 'voucherNumber', 'cae'];
    const formatters = {
      orderNumber: (val) => val || '',
      orderDate: (val) => val ? new Date(val).toLocaleDateString('es-AR') : 'N/A',
      totalPrice: (val) => this._formatCurrency(val),
      processing_status: (val) => this._formatStatus(val),
      voucherNumber: (val) => val ? String(val) : 'N/A',
      cae: (val) => val || 'N/A'
    };

    const headers = {
      orderNumber: 'Order Number',
      orderDate: 'Date',
      totalPrice: 'Amount',
      processing_status: 'Status',
      voucherNumber: 'Voucher',
      cae: 'CAE'
    };

    TableFormatter.format(orders, columns, { headers, formatters, maxWidth: 30 });
    ConsoleFormatter.newLine();
  }

  /**
   * Format processing methods breakdown
   * @private
   */
  static _formatProcessingMethods(orders) {
    ConsoleFormatter.subheader('Processing Methods');

    const methods = {};
    orders.forEach(order => {
      if (order.processing_status === 'success' && order.processing_method) {
        methods[order.processing_method] = (methods[order.processing_method] || 0) + 1;
      }
    });

    Object.entries(methods).forEach(([method, count]) => {
      const percentage = this._percentage(count, orders.filter(o => o.processing_status === 'success').length);
      ConsoleFormatter.listItem(`${method}: ${count} (${percentage})`, 1);
    });

    ConsoleFormatter.newLine();
  }

  /**
   * Format failed orders details
   * @private
   */
  static _formatFailedOrders(failedOrders) {
    ConsoleFormatter.subheader('Failed Orders Details');

    failedOrders.forEach(order => {
      ConsoleFormatter.listItem(`Order ${this._truncate(order.orderNumber, 20)}`, 1);
      ConsoleFormatter.keyValue('Date', new Date(order.orderDate).toLocaleDateString('es-AR'), 2);
      ConsoleFormatter.keyValue('Amount', this._formatCurrency(order.totalPrice), 2);
      if (order.error_message) {
        ConsoleFormatter.keyValue('Error', this._truncate(order.error_message, 60), 2);
      }
      ConsoleFormatter.newLine();
    });
  }

  /**
   * Format order processing summary
   * @param {Object} result - Processing result
   */
  static formatProcessingSummary(result) {
    ConsoleFormatter.header('Order Processing Summary');

    ConsoleFormatter.keyValue('Orders Processed', result.processed || 0);
    ConsoleFormatter.keyValue('Successful', result.successful || 0);
    ConsoleFormatter.keyValue('Failed', result.failed || 0);

    if (result.errors && result.errors.length > 0) {
      ConsoleFormatter.newLine();
      ConsoleFormatter.subheader('Errors');
      result.errors.forEach(err => {
        ConsoleFormatter.error(err);
      });
    }

    ConsoleFormatter.newLine();
  }

  /**
   * Format Binance orders fetch summary
   * @param {Object} result - Fetch result
   */
  static formatBinanceFetchSummary(result) {
    ConsoleFormatter.success(`Fetched ${result.total || 0} orders from Binance`);
    ConsoleFormatter.keyValue('New Orders', result.newOrders || 0, 1);
    ConsoleFormatter.keyValue('Already Processed', result.existingOrders || 0, 1);
    ConsoleFormatter.newLine();
  }

  // Helper methods

  static _formatCurrency(amount, currency = 'ARS') {
    if (!amount && amount !== 0) return 'N/A';
    const formatter = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    });
    return formatter.format(amount);
  }

  static _formatStatus(status) {
    const statusMap = {
      'success': '✓ Success',
      'failed': '✗ Failed',
      'pending': '○ Pending'
    };
    return statusMap[status] || status;
  }

  static _percentage(value, total) {
    if (!total || total === 0) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  }

  static _truncate(str, maxLength) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }
}

module.exports = ReportFormatter;
