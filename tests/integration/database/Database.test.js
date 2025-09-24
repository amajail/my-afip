const Database = require('../../../src/database/Database');
const MockFactory = require('../../helpers/mock-factory');
const path = require('path');
const fs = require('fs').promises;

describe('Database Integration', () => {
  let db;
  let testDbPath;

  beforeEach(async () => {
    // Use a unique test database file for each test
    testDbPath = path.join(__dirname, `test-${Date.now()}.db`);
    db = new Database(testDbPath);
    await db.initialize();
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }

    // Clean up test database file
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // File might not exist, ignore error
    }
  });

  describe('initialization', () => {
    it('should create database file and tables', async () => {
      // Check if database file was created
      const stats = await fs.stat(testDbPath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should create orders table with correct schema', async () => {
      return new Promise((resolve, reject) => {
        db.db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'", (err, row) => {
          if (err) reject(err);

          expect(row).toBeDefined();
          expect(row.sql).toContain('order_number TEXT PRIMARY KEY');
          expect(row.sql).toContain('amount REAL');
          expect(row.sql).toContain('create_time TEXT');
          expect(row.sql).toContain('success INTEGER');
          expect(row.sql).toContain('cae TEXT');
          expect(row.sql).toContain('voucher_number INTEGER');
          resolve();
        });
      });
    });
  });

  describe('order operations', () => {
    it('should insert and retrieve order', async () => {
      const order = MockFactory.createBinanceOrder({
        order_number: 'test_order_insert',
        amount: '100.50',
        total_price: '120675.38'
      });

      // Insert order
      await new Promise((resolve, reject) => {
        const sql = `INSERT INTO orders (
          order_number, amount, price, total_price, asset, fiat, trade_type,
          create_time, buyer_nickname, seller_nickname
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        db.db.run(sql, [
          order.order_number, order.amount, order.price, order.total_price,
          order.asset, order.fiat, order.trade_type, order.create_time,
          order.buyer_nickname, order.seller_nickname
        ], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Retrieve order
      const retrievedOrder = await new Promise((resolve, reject) => {
        db.db.get('SELECT * FROM orders WHERE order_number = ?', [order.order_number], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(retrievedOrder).toBeDefined();
      expect(retrievedOrder.order_number).toBe(order.order_number);
      expect(retrievedOrder.amount).toBe(parseFloat(order.amount));
      expect(retrievedOrder.total_price).toBe(parseFloat(order.total_price));
      expect(retrievedOrder.asset).toBe(order.asset);
      expect(retrievedOrder.fiat).toBe(order.fiat);
    });

    it('should enforce unique constraint on order_number', async () => {
      const order = MockFactory.createBinanceOrder({
        order_number: 'duplicate_test'
      });

      const sql = `INSERT INTO orders (
        order_number, amount, price, total_price, asset, fiat, trade_type,
        create_time, buyer_nickname, seller_nickname
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const params = [
        order.order_number, order.amount, order.price, order.total_price,
        order.asset, order.fiat, order.trade_type, order.create_time,
        order.buyer_nickname, order.seller_nickname
      ];

      // First insertion should succeed
      await new Promise((resolve, reject) => {
        db.db.run(sql, params, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Second insertion should fail with constraint error
      await expect(new Promise((resolve, reject) => {
        db.db.run(sql, params, (err) => {
          if (err) reject(err);
          else resolve();
        });
      })).rejects.toThrow();
    });

    it('should update order processing status', async () => {
      const order = MockFactory.createBinanceOrder({
        order_number: 'test_update_status'
      });

      // Insert order
      await new Promise((resolve, reject) => {
        const sql = `INSERT INTO orders (
          order_number, amount, price, total_price, asset, fiat, trade_type,
          create_time, buyer_nickname, seller_nickname
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        db.db.run(sql, [
          order.order_number, order.amount, order.price, order.total_price,
          order.asset, order.fiat, order.trade_type, order.create_time,
          order.buyer_nickname, order.seller_nickname
        ], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Update processing status
      const cae = '75398279001644';
      const voucherNumber = 21;
      const processingMethod = 'automatic';

      await new Promise((resolve, reject) => {
        const sql = `UPDATE orders SET
          success = ?, cae = ?, voucher_number = ?, processing_method = ?,
          processed_at = datetime('now')
          WHERE order_number = ?`;

        db.db.run(sql, [1, cae, voucherNumber, processingMethod, order.order_number], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Verify update
      const updatedOrder = await new Promise((resolve, reject) => {
        db.db.get('SELECT * FROM orders WHERE order_number = ?', [order.order_number], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(updatedOrder.success).toBe(1);
      expect(updatedOrder.cae).toBe(cae);
      expect(updatedOrder.voucher_number).toBe(voucherNumber);
      expect(updatedOrder.processing_method).toBe(processingMethod);
      expect(updatedOrder.processed_at).toBeDefined();
    });
  });

  describe('queries', () => {
    beforeEach(async () => {
      // Insert test data for queries
      const orders = [
        MockFactory.createBinanceOrder({ order_number: 'processed_1', success: 1, cae: 'CAE1' }),
        MockFactory.createBinanceOrder({ order_number: 'processed_2', success: 1, cae: 'CAE2' }),
        MockFactory.createBinanceOrder({ order_number: 'failed_1', success: 0 }),
        MockFactory.createBinanceOrder({ order_number: 'pending_1' }),
        MockFactory.createBinanceOrder({ order_number: 'pending_2' })
      ];

      for (const order of orders) {
        await new Promise((resolve, reject) => {
          let sql, params;

          if (order.success !== undefined) {
            sql = `INSERT INTO orders (
              order_number, amount, price, total_price, asset, fiat, trade_type,
              create_time, buyer_nickname, seller_nickname, success, cae
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            params = [
              order.order_number, order.amount, order.price, order.total_price,
              order.asset, order.fiat, order.trade_type, order.create_time,
              order.buyer_nickname, order.seller_nickname, order.success, order.cae
            ];
          } else {
            sql = `INSERT INTO orders (
              order_number, amount, price, total_price, asset, fiat, trade_type,
              create_time, buyer_nickname, seller_nickname
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            params = [
              order.order_number, order.amount, order.price, order.total_price,
              order.asset, order.fiat, order.trade_type, order.create_time,
              order.buyer_nickname, order.seller_nickname
            ];
          }

          db.db.run(sql, params, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    });

    it('should get unprocessed orders', async () => {
      const unprocessed = await new Promise((resolve, reject) => {
        db.db.all('SELECT * FROM orders WHERE success IS NULL OR success = 0', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(unprocessed).toHaveLength(3); // 2 pending + 1 failed
      expect(unprocessed.some(o => o.order_number === 'pending_1')).toBe(true);
      expect(unprocessed.some(o => o.order_number === 'pending_2')).toBe(true);
      expect(unprocessed.some(o => o.order_number === 'failed_1')).toBe(true);
    });

    it('should get processed orders only', async () => {
      const processed = await new Promise((resolve, reject) => {
        db.db.all('SELECT * FROM orders WHERE success = 1', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(processed).toHaveLength(2);
      expect(processed.some(o => o.order_number === 'processed_1')).toBe(true);
      expect(processed.some(o => o.order_number === 'processed_2')).toBe(true);
    });

    it('should search by CAE number', async () => {
      const caeOrder = await new Promise((resolve, reject) => {
        db.db.get('SELECT * FROM orders WHERE cae = ?', ['CAE1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(caeOrder).toBeDefined();
      expect(caeOrder.order_number).toBe('processed_1');
      expect(caeOrder.cae).toBe('CAE1');
    });

    it('should get processing statistics', async () => {
      const stats = await new Promise((resolve, reject) => {
        db.db.all(`
          SELECT
            success,
            COUNT(*) as count
          FROM orders
          GROUP BY success
        `, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(stats).toHaveLength(3); // null, 0, 1

      const successfulCount = stats.find(s => s.success === 1)?.count || 0;
      const failedCount = stats.find(s => s.success === 0)?.count || 0;
      const pendingCount = stats.find(s => s.success === null)?.count || 0;

      expect(successfulCount).toBe(2);
      expect(failedCount).toBe(1);
      expect(pendingCount).toBe(2);
    });
  });

  describe('transaction handling', () => {
    it('should handle successful transactions', async () => {
      await new Promise((resolve, reject) => {
        db.db.serialize(() => {
          db.db.run('BEGIN TRANSACTION');

          db.db.run(`INSERT INTO orders (order_number, amount, price, total_price, asset, fiat, trade_type, create_time)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    ['trans_test_1', 100, 1000, 100000, 'USDT', 'ARS', 'SELL', Date.now().toString()]);

          db.db.run(`INSERT INTO orders (order_number, amount, price, total_price, asset, fiat, trade_type, create_time)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    ['trans_test_2', 200, 1000, 200000, 'USDT', 'ARS', 'SELL', Date.now().toString()]);

          db.db.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });

      // Verify both records were inserted
      const count = await new Promise((resolve, reject) => {
        db.db.get("SELECT COUNT(*) as count FROM orders WHERE order_number LIKE 'trans_test_%'", [], (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });

      expect(count).toBe(2);
    });

    it('should handle failed transactions with rollback', async () => {
      await expect(new Promise((resolve, reject) => {
        db.db.serialize(() => {
          db.db.run('BEGIN TRANSACTION');

          // Insert valid record
          db.db.run(`INSERT INTO orders (order_number, amount, price, total_price, asset, fiat, trade_type, create_time)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    ['rollback_test_1', 100, 1000, 100000, 'USDT', 'ARS', 'SELL', Date.now().toString()]);

          // Try to insert duplicate (should fail)
          db.db.run(`INSERT INTO orders (order_number, amount, price, total_price, asset, fiat, trade_type, create_time)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    ['rollback_test_1', 200, 1000, 200000, 'USDT', 'ARS', 'SELL', Date.now().toString()],
                    (err) => {
                      if (err) {
                        db.db.run('ROLLBACK', () => {
                          reject(err);
                        });
                      }
                    });
        });
      })).rejects.toThrow();

      // Verify no records were inserted due to rollback
      const count = await new Promise((resolve, reject) => {
        db.db.get("SELECT COUNT(*) as count FROM orders WHERE order_number = 'rollback_test_1'", [], (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });

      expect(count).toBe(0);
    });
  });

  describe('performance', () => {
    it('should handle bulk insertions efficiently', async () => {
      const startTime = Date.now();
      const orderCount = 1000;

      // Prepare bulk insert
      const stmt = await new Promise((resolve, reject) => {
        const statement = db.db.prepare(`INSERT INTO orders (
          order_number, amount, price, total_price, asset, fiat, trade_type, create_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        resolve(statement);
      });

      // Bulk insert
      await new Promise((resolve, reject) => {
        db.db.serialize(() => {
          db.db.run('BEGIN TRANSACTION');

          for (let i = 0; i < orderCount; i++) {
            const order = MockFactory.createBinanceOrder({
              order_number: `bulk_test_${i}`
            });

            stmt.run([
              order.order_number, order.amount, order.price, order.total_price,
              order.asset, order.fiat, order.trade_type, order.create_time
            ]);
          }

          db.db.run('COMMIT', (err) => {
            stmt.finalize();
            if (err) reject(err);
            else resolve();
          });
        });
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all records were inserted
      const count = await new Promise((resolve, reject) => {
        db.db.get("SELECT COUNT(*) as count FROM orders WHERE order_number LIKE 'bulk_test_%'", [], (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });

      expect(count).toBe(orderCount);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});