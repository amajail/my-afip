/**
 * Dependency Injection Container
 *
 * Centralizes the creation and wiring of dependencies for the application.
 * Follows Dependency Inversion Principle and enables easy testing.
 */

// Infrastructure
const SQLiteOrderRepository = require('../../infrastructure/repositories/SQLiteOrderRepository');
const SQLiteInvoiceRepository = require('../../infrastructure/repositories/SQLiteInvoiceRepository');
const AfipGatewayAdapter = require('../../infrastructure/gateways/AfipGatewayAdapter');
const BinanceGatewayAdapter = require('../../infrastructure/gateways/BinanceGatewayAdapter');

// Use Cases
const FetchBinanceOrders = require('../use-cases/binance/FetchBinanceOrders');
const CreateInvoice = require('../use-cases/invoices/CreateInvoice');
const ProcessUnprocessedOrders = require('../use-cases/invoices/ProcessUnprocessedOrders');
const GenerateMonthlyReport = require('../use-cases/reports/GenerateMonthlyReport');

/**
 * Dependency Injection Container
 *
 * Manages dependency creation and lifecycle.
 */
class Container {
  constructor() {
    this._instances = new Map();
    this._singletons = new Map();
  }

  // ==================== Repositories ====================

  /**
   * Get OrderRepository instance
   * @returns {IOrderRepository}
   */
  getOrderRepository() {
    if (!this._singletons.has('orderRepository')) {
      const repository = new SQLiteOrderRepository();
      this._singletons.set('orderRepository', repository);
    }
    return this._singletons.get('orderRepository');
  }

  /**
   * Get InvoiceRepository instance
   * @returns {IInvoiceRepository}
   */
  getInvoiceRepository() {
    if (!this._singletons.has('invoiceRepository')) {
      const repository = new SQLiteInvoiceRepository();
      this._singletons.set('invoiceRepository', repository);
    }
    return this._singletons.get('invoiceRepository');
  }

  // ==================== Gateways ====================

  /**
   * Get AfipGateway instance
   * @param {Object} [afipService] - Optional AfipService for testing
   * @returns {IAfipGateway}
   */
  getAfipGateway(afipService = null) {
    if (!afipService && !this._singletons.has('afipGateway')) {
      const gateway = new AfipGatewayAdapter();
      this._singletons.set('afipGateway', gateway);
    }
    return afipService
      ? new AfipGatewayAdapter(afipService)
      : this._singletons.get('afipGateway');
  }

  /**
   * Get BinanceGateway instance
   * @param {Object} [binanceService] - Optional BinanceService for testing
   * @returns {IBinanceGateway}
   */
  getBinanceGateway(binanceService = null) {
    if (!binanceService && !this._singletons.has('binanceGateway')) {
      const gateway = new BinanceGatewayAdapter();
      this._singletons.set('binanceGateway', gateway);
    }
    return binanceService
      ? new BinanceGatewayAdapter(binanceService)
      : this._singletons.get('binanceGateway');
  }

  // ==================== Use Cases ====================

  /**
   * Get FetchBinanceOrders use case
   * @returns {FetchBinanceOrders}
   */
  getFetchBinanceOrdersUseCase() {
    return new FetchBinanceOrders(
      this.getBinanceGateway(),
      this.getOrderRepository()
    );
  }

  /**
   * Get CreateInvoice use case
   * @returns {CreateInvoice}
   */
  getCreateInvoiceUseCase() {
    return new CreateInvoice(
      this.getOrderRepository(),
      this.getAfipGateway()
    );
  }

  /**
   * Get ProcessUnprocessedOrders use case
   * @returns {ProcessUnprocessedOrders}
   */
  getProcessUnprocessedOrdersUseCase() {
    return new ProcessUnprocessedOrders(
      this.getOrderRepository(),
      this.getAfipGateway()
    );
  }

  /**
   * Get GenerateMonthlyReport use case
   * @returns {GenerateMonthlyReport}
   */
  getGenerateMonthlyReportUseCase() {
    return new GenerateMonthlyReport(
      this.getOrderRepository()
    );
  }

  // ==================== Lifecycle ====================

  /**
   * Initialize all repositories
   * Call this before using the container
   */
  async initialize() {
    const orderRepository = this.getOrderRepository();
    const invoiceRepository = this.getInvoiceRepository();

    await orderRepository.initialize();
    await invoiceRepository.initialize();
  }

  /**
   * Cleanup all resources
   * Call this when shutting down the application
   */
  async cleanup() {
    const orderRepository = this.getOrderRepository();
    const invoiceRepository = this.getInvoiceRepository();

    await orderRepository.cleanup();
    await invoiceRepository.cleanup();

    this._singletons.clear();
    this._instances.clear();
  }

  /**
   * Reset the container (useful for testing)
   */
  reset() {
    this._singletons.clear();
    this._instances.clear();
  }
}

// Export singleton instance
const container = new Container();

module.exports = container;
module.exports.Container = Container;
