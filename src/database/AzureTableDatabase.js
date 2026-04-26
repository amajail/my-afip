const { TableClient } = require('@azure/data-tables');

class AzureTableDatabase {
  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is required');
    }
    this.ordersClient = TableClient.fromConnectionString(connectionString, 'orders');
    this.invoicesClient = TableClient.fromConnectionString(connectionString, 'invoices');
  }

  async connect() {
    // No explicit connection needed for Azure Table Storage
  }

  async initialize() {
    await this.createTables();
  }

  async createTables() {
    for (const client of [this.ordersClient, this.invoicesClient]) {
      try {
        await client.createTable();
      } catch (error) {
        if (error.statusCode !== 409) throw error;
      }
    }
    console.log('✅ Azure Table Storage tables initialized');
  }

  async insertOrder(orderData) {
    const entity = this._orderToEntity(orderData);
    try {
      await this.ordersClient.createEntity(entity);
      return entity.rowKey;
    } catch (error) {
      if (error.statusCode === 409) return null; // INSERT OR IGNORE
      throw error;
    }
  }

  async markOrderProcessed(orderNumber, result, method = 'automatic', invoiceDate = null) {
    const entity = {
      partitionKey: 'orders',
      rowKey: String(orderNumber),
      processedAt: new Date().toISOString(),
      processingMethod: method,
      success: result.success,
    };
    if (result.cae) entity.cae = result.cae;
    if (result.voucherNumber) entity.voucherNumber = Number(result.voucherNumber);
    if (invoiceDate) entity.invoiceDate = invoiceDate;
    if (result.error) entity.errorMessage = result.error;

    await this.ordersClient.upsertEntity(entity, 'Merge');
    return 1;
  }

  async markOrderManual(orderNumber, cae, voucherNumber, notes = null) {
    const entity = {
      partitionKey: 'orders',
      rowKey: String(orderNumber),
      processedAt: new Date().toISOString(),
      processingMethod: 'manual',
      success: true,
      cae: cae,
    };
    if (voucherNumber) entity.voucherNumber = Number(voucherNumber);
    if (notes) entity.notes = notes;

    await this.ordersClient.upsertEntity(entity, 'Merge');
    return 1;
  }

  async updateOrder(orderNumber, orderData) {
    const entity = this._orderToEntity({ ...orderData, orderNumber });
    await this.ordersClient.upsertEntity(entity, 'Replace');
    return 1;
  }

  async getOrderByNumber(orderNumber) {
    try {
      const entity = await this.ordersClient.getEntity('orders', String(orderNumber));
      return this._entityToRow(entity);
    } catch (error) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  async getProcessedOrders() {
    const rows = [];
    for await (const entity of this.ordersClient.listEntities()) {
      if (entity.processedAt) rows.push(this._entityToRow(entity));
    }
    return rows.sort((a, b) => new Date(b.processed_at) - new Date(a.processed_at));
  }

  async getSuccessfullyProcessedOrders() {
    const rows = [];
    for await (const entity of this.ordersClient.listEntities()) {
      if (entity.processedAt && entity.success === true) rows.push(this._entityToRow(entity));
    }
    return rows;
  }

  async getOrdersByStatus(success = null) {
    const rows = [];
    for await (const entity of this.ordersClient.listEntities()) {
      if (!entity.processedAt) continue;
      if (success !== null) {
        const entitySuccess = entity.success === true;
        if (entitySuccess !== success) continue;
      }
      rows.push(this._entityToRow(entity));
    }
    return rows.sort((a, b) => new Date(b.processed_at) - new Date(a.processed_at));
  }

  async getUnprocessedOrders() {
    const rows = [];
    for await (const entity of this.ordersClient.listEntities()) {
      if (!entity.processedAt || entity.success === undefined || entity.success === false) {
        rows.push(this._entityToRow(entity));
      }
    }
    return rows.sort((a, b) => Number(a.create_time) - Number(b.create_time));
  }

  async getCurrentMonthOrders() {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const rows = [];
    for await (const entity of this.ordersClient.listEntities()) {
      if (entity.orderDate && entity.orderDate.startsWith(yearMonth)) {
        const row = this._entityToRow(entity);
        if (row.processed_at && row.success === 1) row.status = 'Success';
        else if (row.processed_at && row.success === 0) row.status = 'Failed';
        else row.status = 'Pending';
        rows.push(row);
      }
    }
    return rows.sort((a, b) => {
      const d = new Date(b.order_date) - new Date(a.order_date);
      return d !== 0 ? d : Number(b.create_time) - Number(a.create_time);
    });
  }

  async getCurrentMonthStats() {
    const orders = await this.getCurrentMonthOrders();
    return {
      total_orders: orders.length,
      processed_orders: orders.filter(o => o.processed_at).length,
      pending_orders: orders.filter(o => !o.processed_at).length,
      successful_orders: orders.filter(o => o.success === 1).length,
      failed_orders: orders.filter(o => o.processed_at && o.success === 0).length,
      total_amount: orders.reduce((sum, o) => sum + (o.total_price || 0), 0),
      invoiced_amount: orders.filter(o => o.success === 1).reduce((sum, o) => sum + (o.total_price || 0), 0),
      earliest_date: orders.length ? orders.map(o => o.order_date).sort()[0] : null,
      latest_date: orders.length ? orders.map(o => o.order_date).sort().pop() : null,
    };
  }

  async getOrderStats() {
    const entities = [];
    for await (const entity of this.ordersClient.listEntities()) {
      entities.push(entity);
    }
    return {
      total_orders: entities.length,
      processed_orders: entities.filter(e => e.processedAt).length,
      successful_orders: entities.filter(e => e.success === true).length,
      failed_orders: entities.filter(e => e.processedAt && e.success === false).length,
      manual_orders: entities.filter(e => e.processingMethod === 'manual').length,
      automatic_orders: entities.filter(e => e.processingMethod === 'automatic').length,
      total_invoiced_amount: entities
        .filter(e => e.success === true)
        .reduce((sum, e) => sum + (e.totalPrice || 0), 0),
    };
  }

  async getOrdersByDateRange(startDate, endDate) {
    const rows = [];
    for await (const entity of this.ordersClient.listEntities()) {
      if (entity.orderDate && entity.orderDate >= startDate && entity.orderDate <= endDate) {
        rows.push(this._entityToRow(entity));
      }
    }
    return rows.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));
  }

  async getFailedOrders() {
    return this.getOrdersByStatus(false);
  }

  async getStats() {
    return this.getOrderStats();
  }

  async saveInvoiceResult(recordData) {
    const entity = {
      partitionKey: 'invoices',
      rowKey: String(recordData.order_number),
      orderNumber: String(recordData.order_number),
      status: recordData.status || '',
      processingMethod: recordData.processing_method || 'automatic',
    };
    if (recordData.cae) entity.cae = recordData.cae;
    if (recordData.invoice_date) entity.invoiceDate = recordData.invoice_date;
    if (recordData.error_message) entity.errorMessage = recordData.error_message;
    if (recordData.afip_response) entity.afipResponse = recordData.afip_response;

    await this.invoicesClient.upsertEntity(entity, 'Replace');
    return { rowKey: entity.rowKey };
  }

  async getInvoiceByOrderNumber(orderNumber) {
    try {
      const entity = await this.invoicesClient.getEntity('invoices', String(orderNumber));
      return [this._invoiceEntityToRow(entity)];
    } catch (error) {
      if (error.statusCode === 404) return [];
      throw error;
    }
  }

  async getInvoiceByCAE(cae) {
    const rows = [];
    for await (const entity of this.invoicesClient.listEntities()) {
      if (entity.cae === cae) rows.push(this._invoiceEntityToRow(entity));
    }
    return rows;
  }

  async getInvoicesByDateRange(startDate, endDate) {
    const rows = [];
    for await (const entity of this.invoicesClient.listEntities()) {
      if (entity.invoiceDate && entity.invoiceDate >= startDate && entity.invoiceDate <= endDate) {
        rows.push(this._invoiceEntityToRow(entity));
      }
    }
    return rows;
  }

  async close() {
    // No-op for Azure Table Storage
  }

  _orderToEntity(orderData) {
    const orderDate = orderData.orderDate ||
      (orderData.createTime ? new Date(orderData.createTime).toISOString().split('T')[0] : '');

    const entity = {
      partitionKey: 'orders',
      rowKey: String(orderData.orderNumber),
      amount: parseFloat(orderData.amount) || 0,
      price: parseFloat(orderData.price) || 0,
      totalPrice: parseFloat(orderData.totalPrice) || 0,
      asset: orderData.asset || '',
      fiat: orderData.fiat || '',
      tradeType: orderData.tradeType || '',
      createTime: Number(orderData.createTime) || 0,
      orderDate: orderDate,
    };

    if (orderData.buyerNickname) entity.buyerNickname = orderData.buyerNickname;
    if (orderData.sellerNickname) entity.sellerNickname = orderData.sellerNickname;
    if (orderData.processedAt) entity.processedAt = orderData.processedAt;
    if (orderData.processingMethod) entity.processingMethod = orderData.processingMethod;
    if (orderData.success !== null && orderData.success !== undefined) entity.success = Boolean(orderData.success);
    if (orderData.cae) entity.cae = orderData.cae;
    if (orderData.voucherNumber) entity.voucherNumber = Number(orderData.voucherNumber);
    if (orderData.invoiceDate) entity.invoiceDate = orderData.invoiceDate;
    if (orderData.errorMessage) entity.errorMessage = orderData.errorMessage;
    if (orderData.notes) entity.notes = orderData.notes;

    return entity;
  }

  _entityToRow(entity) {
    return {
      order_number: entity.rowKey,
      amount: entity.amount || 0,
      price: entity.price || 0,
      total_price: entity.totalPrice || 0,
      asset: entity.asset || '',
      fiat: entity.fiat || '',
      buyer_nickname: entity.buyerNickname || null,
      seller_nickname: entity.sellerNickname || null,
      trade_type: entity.tradeType || '',
      create_time: entity.createTime || 0,
      order_date: entity.orderDate || '',
      processed_at: entity.processedAt || null,
      processing_method: entity.processingMethod || null,
      success: entity.success === true ? 1 : (entity.success === false ? 0 : null),
      cae: entity.cae || null,
      voucher_number: entity.voucherNumber || null,
      invoice_date: entity.invoiceDate || null,
      error_message: entity.errorMessage || null,
      notes: entity.notes || null,
    };
  }

  _invoiceEntityToRow(entity) {
    return {
      order_number: entity.rowKey,
      cae: entity.cae || null,
      status: entity.status || null,
      processing_method: entity.processingMethod || null,
      invoice_date: entity.invoiceDate || null,
      error_message: entity.errorMessage || null,
      afip_response: entity.afipResponse || null,
      created_at: entity.timestamp ? entity.timestamp.toISOString() : null,
    };
  }
}

module.exports = AzureTableDatabase;
