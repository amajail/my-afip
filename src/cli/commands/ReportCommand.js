/**
 * ReportCommand
 *
 * CLI command handler for report generation
 * Part of Presentation Layer (CLI)
 *
 * Updated to use Application Layer use cases following Clean Architecture
 */

const container = require('../../application/di/container');
const DatabaseOrderTracker = require('../../utils/DatabaseOrderTracker');
const ConsoleFormatter = require('../formatters/ConsoleFormatter');
const ReportFormatter = require('../formatters/ReportFormatter');
const logger = require('../../utils/logger');

class ReportCommand {
  /**
   * Show current month invoice report
   */
  static async showMonthlyReport() {
    try {
      // Initialize container
      await container.initialize();

      // Get use case from DI container
      const generateMonthlyReportUseCase = container.getGenerateMonthlyReportUseCase();

      // Execute use case
      const report = await generateMonthlyReportUseCase.execute();

      // Transform to format expected by ReportFormatter
      const reportData = {
        stats: {
          totalOrders: report.stats.totalOrders,
          successfulOrders: report.stats.successfulInvoices,
          failedOrders: report.stats.failedInvoices,
          pendingOrders: report.stats.pendingOrders,
          totalAmount: report.stats.totalAmount,
          averageAmount: report.stats.averageAmount,
          byProcessingMethod: {
            automatic: report.stats.successfulInvoices, // All from use case are automatic
            manual: 0
          }
        },
        orders: report.orders
      };

      // Format and display report
      ReportFormatter.formatMonthlyReport(reportData);

      // Log for debugging/tracking
      logger.info('Monthly report generated', {
        totalOrders: report.stats.totalOrders,
        successfulOrders: report.stats.successfulInvoices,
        event: 'monthly_report_generated'
      });
    } catch (error) {
      ConsoleFormatter.error('Error generating current month report', error);
      logger.error('Report generation failed', {
        error: error.message,
        event: 'report_generation_failed'
      });
    } finally {
      await container.cleanup();
    }
  }

  /**
   * Show orders by status
   * @param {string} status - Status filter (success, failed, pending)
   */
  static async showOrdersByStatus(status) {
    const dbTracker = new DatabaseOrderTracker();

    try {
      await dbTracker.initialize();

      const orders = await dbTracker.getOrdersByStatus(
        status === 'success' ? 'Success' : status === 'failed' ? 'Failed' : 'Pending'
      );

      ConsoleFormatter.header(`Orders with status: ${status.toUpperCase()}`);

      if (orders.length === 0) {
        ConsoleFormatter.info(`No ${status} orders found`);
        return;
      }

      const reportData = {
        orders: this._transformOrders(orders),
        stats: {
          totalOrders: orders.length
        }
      };

      ReportFormatter.formatMonthlyReport(reportData);

      logger.info('Status report generated', {
        status,
        count: orders.length,
        event: 'status_report_generated'
      });
    } catch (error) {
      ConsoleFormatter.error('Error generating status report', error);
      logger.error('Status report generation failed', {
        error: error.message,
        status,
        event: 'status_report_failed'
      });
    } finally {
      await dbTracker.close();
    }
  }

  /**
   * Show statistics summary
   */
  static async showStatistics() {
    const dbTracker = new DatabaseOrderTracker();

    try {
      await dbTracker.initialize();
      const stats = await dbTracker.getCurrentMonthStats();

      ConsoleFormatter.header('Invoice Statistics');

      const statsData = {
        totalOrders: stats.total_orders || 0,
        successfulOrders: stats.successful_orders || 0,
        failedOrders: stats.failed_orders || 0,
        pendingOrders: stats.pending_orders || 0,
        totalAmount: this._formatCurrency(stats.total_amount || 0),
        invoicedAmount: this._formatCurrency(stats.invoiced_amount || 0),
        earliestDate: stats.earliest_date || 'N/A',
        latestDate: stats.latest_date || 'N/A'
      };

      ConsoleFormatter.stats(statsData);

      // Calculate rates
      const totalAttempted = statsData.successfulOrders + statsData.failedOrders;
      const successRate = totalAttempted > 0
        ? ((statsData.successfulOrders / totalAttempted) * 100).toFixed(1)
        : '0';

      ConsoleFormatter.subheader('Success Rates');
      ConsoleFormatter.keyValue('Invoice Success Rate', `${successRate}%`, 1);
      ConsoleFormatter.keyValue('Successful', statsData.successfulOrders, 1);
      ConsoleFormatter.keyValue('Total Attempted', totalAttempted, 1);
      ConsoleFormatter.newLine();

      logger.info('Statistics displayed', { event: 'statistics_displayed' });
    } catch (error) {
      ConsoleFormatter.error('Error fetching statistics', error);
      logger.error('Statistics fetch failed', {
        error: error.message,
        event: 'statistics_fetch_failed'
      });
    } finally {
      await dbTracker.close();
    }
  }

  /**
   * Transform database data to report format
   * @private
   */
  static _transformReportData(stats, orders) {
    return {
      orders: this._transformOrders(orders),
      stats: {
        totalOrders: stats.total_orders || 0,
        successfulOrders: stats.successful_orders || 0,
        failedOrders: stats.failed_orders || 0,
        pendingOrders: stats.pending_orders || 0,
        totalAmount: stats.total_amount || 0,
        invoicedAmount: stats.invoiced_amount || 0
      }
    };
  }

  /**
   * Transform database orders to display format
   * @private
   */
  static _transformOrders(orders) {
    return orders.map(order => ({
      orderNumber: order.order_number,
      orderDate: order.order_date,
      invoiceDate: order.invoice_date,
      totalPrice: order.total_price,
      processing_status: order.status?.toLowerCase() || 'pending',
      processing_method: order.processing_method,
      cae: order.cae,
      voucherNumber: order.voucher_number,
      error_message: order.error_message
    }));
  }

  /**
   * Format currency amount
   * @private
   */
  static _formatCurrency(amount, currency = 'ARS') {
    if (!amount && amount !== 0) return 'N/A';
    const formatter = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    });
    return formatter.format(amount);
  }
}

module.exports = ReportCommand;
