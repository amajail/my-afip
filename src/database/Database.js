const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
  constructor(dbPath = null) {
    if (dbPath) {
      // Use provided path (for testing)
      this.dbPath = dbPath;
    } else {
      // Use default production path
      const dbDir = path.join(__dirname, '..', '..', 'data');
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      this.dbPath = path.join(dbDir, 'afip-orders.db');
    }
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('📁 Connected to SQLite database');
          resolve();
        }
      });
    });
  }

  async initialize() {
    await this.connect();
    await this.createTables();
  }

  async createTables() {
    const createOrdersTable = `
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        amount REAL NOT NULL,
        price REAL NOT NULL,
        total_price REAL NOT NULL,
        asset TEXT NOT NULL,
        fiat TEXT NOT NULL,
        buyer_nickname TEXT,
        seller_nickname TEXT,
        trade_type TEXT NOT NULL,
        create_time INTEGER NOT NULL,
        order_date TEXT NOT NULL,
        processed_at DATETIME,
        processing_method TEXT CHECK(processing_method IN ('automatic', 'manual')),
        success BOOLEAN,
        cae TEXT,
        voucher_number INTEGER,
        invoice_date TEXT,
        error_message TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add invoice_date column if it doesn't exist (for existing databases)
    const addInvoiceDateColumn = `
      ALTER TABLE orders ADD COLUMN invoice_date TEXT;
    `;

    const createInvoicesTable = `
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT NOT NULL,
        cae TEXT,
        voucher_number INTEGER,
        invoice_date TEXT NOT NULL,
        net_amount REAL NOT NULL,
        total_amount REAL NOT NULL,
        vat_amount REAL DEFAULT 0,
        currency TEXT DEFAULT 'PES',
        concept INTEGER DEFAULT 2,
        doc_type INTEGER,
        doc_number TEXT,
        success BOOLEAN NOT NULL,
        error_message TEXT,
        processing_method TEXT CHECK(processing_method IN ('automatic', 'manual')) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_number) REFERENCES orders (order_number)
      )
    `;

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(createOrdersTable, (err) => {
          if (err) reject(err);
        });

        // Try to add invoice_date column for existing databases (will fail silently if already exists)
        this.db.run(addInvoiceDateColumn, (err) => {
          // Ignore errors - column might already exist
        });

        this.db.run(createInvoicesTable, (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('✅ Database tables initialized');
            resolve();
          }
        });
      });
    });
  }

  async insertOrder(orderData) {
    const sql = `
      INSERT OR IGNORE INTO orders (
        order_number, amount, price, total_price, asset, fiat,
        buyer_nickname, seller_nickname, trade_type, create_time, order_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const orderDate = new Date(orderData.createTime).toISOString().split('T')[0];

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        orderData.orderNumber,
        parseFloat(orderData.amount),
        parseFloat(orderData.price),
        parseFloat(orderData.totalPrice),
        orderData.asset,
        orderData.fiat,
        orderData.buyerNickname,
        orderData.sellerNickname,
        orderData.tradeType,
        orderData.createTime,
        orderDate
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async markOrderProcessed(orderNumber, result, method = 'automatic', invoiceDate = null) {
    const sql = `
      UPDATE orders SET
        processed_at = CURRENT_TIMESTAMP,
        processing_method = ?,
        success = ?,
        cae = ?,
        voucher_number = ?,
        invoice_date = ?,
        error_message = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        method,
        result.success,
        result.cae || null,
        result.voucherNumber || null,
        invoiceDate,
        result.error || null,
        orderNumber
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async markOrderManual(orderNumber, cae, voucherNumber, notes = null) {
    const sql = `
      UPDATE orders SET
        processed_at = CURRENT_TIMESTAMP,
        processing_method = 'manual',
        success = true,
        cae = ?,
        voucher_number = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [cae, voucherNumber, notes, orderNumber], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async getProcessedOrders() {
    const sql = `
      SELECT order_number, processed_at, processing_method, success, cae, voucher_number, error_message
      FROM orders
      WHERE processed_at IS NOT NULL
      ORDER BY processed_at DESC
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getSuccessfullyProcessedOrders() {
    const sql = `
      SELECT order_number, processed_at, processing_method, success, cae, voucher_number, error_message
      FROM orders
      WHERE processed_at IS NOT NULL AND success = 1
      ORDER BY processed_at DESC
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getOrdersByStatus(success = null) {
    let sql = `
      SELECT * FROM orders
      WHERE processed_at IS NOT NULL
    `;

    const params = [];
    if (success !== null) {
      sql += ` AND success = ?`;
      params.push(success);
    }

    sql += ` ORDER BY processed_at DESC`;

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getUnprocessedOrders() {
    const sql = `
      SELECT * FROM orders
      WHERE processed_at IS NULL OR (processed_at IS NOT NULL AND success = 0)
      ORDER BY create_time ASC
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getCurrentMonthOrders() {
    const sql = `
      SELECT
        order_number,
        order_date,
        amount,
        price,
        total_price,
        asset,
        fiat,
        trade_type,
        create_time,
        CASE
          WHEN processed_at IS NOT NULL AND success = 1 THEN 'Success'
          WHEN processed_at IS NOT NULL AND success = 0 THEN 'Failed'
          ELSE 'Pending'
        END as status,
        processing_method,
        success,
        cae,
        voucher_number,
        invoice_date,
        error_message,
        processed_at
      FROM orders
      WHERE strftime('%Y-%m', order_date) = strftime('%Y-%m', 'now')
      ORDER BY order_date DESC, create_time DESC
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getCurrentMonthStats() {
    const sql = `
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN processed_at IS NOT NULL THEN 1 ELSE 0 END) as processed_orders,
        SUM(CASE WHEN processed_at IS NULL THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_orders,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_orders,
        SUM(total_price) as total_amount,
        SUM(CASE WHEN success = 1 THEN total_price ELSE 0 END) as invoiced_amount,
        MIN(order_date) as earliest_date,
        MAX(order_date) as latest_date
      FROM orders
      WHERE strftime('%Y-%m', order_date) = strftime('%Y-%m', 'now')
    `;

    return new Promise((resolve, reject) => {
      this.db.get(sql, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getOrderStats() {
    const sql = `
      SELECT
        COUNT(*) as total_orders,
        COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as processed_orders,
        COUNT(CASE WHEN success = 1 THEN 1 END) as successful_orders,
        COUNT(CASE WHEN success = 0 THEN 1 END) as failed_orders,
        COUNT(CASE WHEN processing_method = 'manual' THEN 1 END) as manual_orders,
        COUNT(CASE WHEN processing_method = 'automatic' THEN 1 END) as automatic_orders,
        SUM(CASE WHEN success = 1 THEN total_price END) as total_invoiced_amount
      FROM orders
    `;

    return new Promise((resolve, reject) => {
      this.db.get(sql, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          } else {
            console.log('📁 Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = Database;