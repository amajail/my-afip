// Factory functions for creating test data and mocks

class MockFactory {
  static createBinanceOrder(overrides = {}) {
    const timestamp = Date.now();
    return {
      order_number: `test_order_${timestamp}`,
      amount: '100.50',
      price: '1200.75',
      total_price: '120675.38',
      asset: 'USDT',
      fiat: 'ARS',
      trade_type: 'SELL',
      create_time: timestamp.toString(),
      buyer_nickname: 'test_buyer',
      seller_nickname: 'test_seller',
      ...overrides
    };
  }

  static createAfipInvoiceData(overrides = {}) {
    return {
      docType: 11,
      docNumber: '',
      docDate: new Date().toISOString().split('T')[0],
      concept: 1,
      currency: 'PES',
      exchange: 1,
      netAmount: 120675,
      totalAmount: 120675,
      vatAmount: 0,
      ...overrides
    };
  }

  static createAfipSuccessResponse(overrides = {}) {
    return {
      success: true,
      cae: '75398279001644',
      voucherNumber: 21,
      expirationDate: '20251004',
      observations: [],
      ...overrides
    };
  }

  static createAfipErrorResponse(message = 'Test error', overrides = {}) {
    return {
      success: false,
      error: message,
      errorCode: 'TEST_ERROR',
      ...overrides
    };
  }

  static createDatabaseOrder(overrides = {}) {
    const order = this.createBinanceOrder(overrides);
    return {
      ...order,
      id: 1,
      processed_at: null,
      success: null,
      cae: null,
      voucher_number: null,
      processing_method: null,
      error_message: null,
      ...overrides
    };
  }

  static mockAfipService() {
    return {
      initialize: jest.fn().mockResolvedValue(),
      createInvoice: jest.fn().mockResolvedValue(this.createAfipSuccessResponse()),
      createMultipleInvoices: jest.fn().mockResolvedValue([this.createAfipSuccessResponse()]),
      getLastVoucherNumber: jest.fn().mockResolvedValue(20),
      close: jest.fn().mockResolvedValue()
    };
  }

  static mockBinanceService() {
    return {
      initialize: jest.fn().mockResolvedValue(),
      fetchOrders: jest.fn().mockResolvedValue([this.createBinanceOrder()]),
      testConnection: jest.fn().mockResolvedValue({ success: true }),
      close: jest.fn().mockResolvedValue()
    };
  }

  static mockDatabase() {
    return {
      initialize: jest.fn().mockResolvedValue(),
      close: jest.fn().mockResolvedValue(),
      db: {
        run: jest.fn((sql, params, callback) => callback && callback(null)),
        get: jest.fn((sql, params, callback) => callback && callback(null, null)),
        all: jest.fn((sql, params, callback) => callback && callback(null, []))
      }
    };
  }

  static createDateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.getTime().toString();
  }

  static formatDateForAfip(date) {
    const d = new Date(date);
    return d.getFullYear().toString() +
           (d.getMonth() + 1).toString().padStart(2, '0') +
           d.getDate().toString().padStart(2, '0');
  }
}

module.exports = MockFactory;