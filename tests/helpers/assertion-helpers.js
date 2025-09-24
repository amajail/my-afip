// Custom assertion helpers for AFIP-specific testing

const AssertionHelpers = {
  // Validate AFIP date format (YYYYMMDD)
  expectValidAfipDate(date) {
    // Accept both YYYY-MM-DD and YYYYMMDD formats
    const isYYYYMMDD = /^\d{8}$/.test(date);
    const isYYYYMMDDDashed = /^\d{4}-\d{2}-\d{2}$/.test(date);

    expect(isYYYYMMDD || isYYYYMMDDDashed).toBe(true);

    let year, month, day;
    if (isYYYYMMDD) {
      year = parseInt(date.substring(0, 4));
      month = parseInt(date.substring(4, 6));
      day = parseInt(date.substring(6, 8));
    } else {
      const parts = date.split('-');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
      day = parseInt(parts[2]);
    }

    expect(year).toBeGreaterThanOrEqual(2020);
    expect(year).toBeLessThanOrEqual(2030);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
  },

  // Validate CAE format (13-14 digits)
  expectValidCAE(cae) {
    expect(cae).toMatch(/^\d{13,14}$/);
    expect(cae).toMatch(/^753982/); // Known prefix for our CUIT
  },

  // Validate voucher number format
  expectValidVoucherNumber(voucher) {
    expect(voucher).toBeGreaterThan(0);
    expect(Number.isInteger(voucher)).toBe(true);
  },

  // Validate AFIP invoice format
  expectValidAfipInvoiceFormat(invoice) {
    expect(invoice).toHaveProperty('CantReg', 1);
    expect(invoice).toHaveProperty('PtoVta', 3);
    expect(invoice).toHaveProperty('CbteTipo');
    expect([6, 11]).toContain(invoice.CbteTipo); // Type B or C
    expect(invoice).toHaveProperty('Concepto');
    expect([1, 2, 3]).toContain(invoice.Concepto);
    expect(invoice).toHaveProperty('DocTipo');
    expect(invoice).toHaveProperty('DocNro');
    expect(invoice).toHaveProperty('CbteDesde', 1);
    expect(invoice).toHaveProperty('CbteHasta', 1);
    expect(invoice).toHaveProperty('CbteFch');
    this.expectValidAfipDate(invoice.CbteFch);
    expect(invoice).toHaveProperty('ImpTotal');
    expect(invoice.ImpTotal).toBeGreaterThan(0);
    expect(invoice).toHaveProperty('MonId', 'PES');
    expect(invoice).toHaveProperty('MonCotiz', 1);
  },

  // Validate date is within AFIP 10-day rule
  expectDateWithinAfipLimit(invoiceDate, orderDate) {
    const invoice = new Date(invoiceDate);
    const order = new Date(parseInt(orderDate));
    const today = new Date();
    const tenDaysAgo = new Date(today);
    tenDaysAgo.setDate(today.getDate() - 10);

    // Invoice date should be either the order date (if within 10 days) or exactly 10 days ago
    if (order >= tenDaysAgo) {
      expect(invoice.toDateString()).toBe(order.toDateString());
    } else {
      expect(invoice.toDateString()).toBe(tenDaysAgo.toDateString());
    }
  },

  // Validate monetary amounts
  expectValidMonetaryAmount(amount) {
    expect(typeof amount).toBe('number');
    expect(amount).toBeGreaterThan(0);
    expect(Number.isFinite(amount)).toBe(true);
  },

  // Validate database order structure
  expectValidDatabaseOrder(order) {
    expect(order).toHaveProperty('order_number');
    expect(order).toHaveProperty('amount');
    expect(order).toHaveProperty('price');
    expect(order).toHaveProperty('total_price');
    expect(order).toHaveProperty('asset');
    expect(order).toHaveProperty('fiat');
    expect(order).toHaveProperty('trade_type');
    expect(order).toHaveProperty('create_time');
  }
};

// Extend Jest matchers
expect.extend({
  toBeValidAfipDate(received) {
    try {
      AssertionHelpers.expectValidAfipDate(received);
      return { pass: true };
    } catch (error) {
      return {
        pass: false,
        message: () => `Expected ${received} to be a valid AFIP date (YYYYMMDD or YYYY-MM-DD): ${error.message}`
      };
    }
  },

  toBeValidCAE(received) {
    try {
      AssertionHelpers.expectValidCAE(received);
      return { pass: true };
    } catch (error) {
      return {
        pass: false,
        message: () => `Expected ${received} to be a valid CAE: ${error.message}`
      };
    }
  }
});

module.exports = AssertionHelpers;