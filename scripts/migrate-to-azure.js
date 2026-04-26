/**
 * One-time migration: SQLite → Azure Table Storage
 *
 * Reads all rows from the local SQLite database and writes them to Azure Table Storage.
 * Safe to run multiple times (upsert semantics).
 *
 * Usage: node scripts/migrate-to-azure.js [path/to/afip-orders.db]
 */

require('dotenv').config();

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const AzureTableDatabase = require('../src/database/AzureTableDatabase');

const dbPath = process.argv[2] || path.join(__dirname, '..', 'data', 'afip-orders.db');

async function readSqlite(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
    });

    const result = { orders: [], invoices: [] };

    db.serialize(() => {
      db.all('SELECT * FROM orders', [], (err, rows) => {
        if (err) return reject(err);
        result.orders = rows;

        db.all('SELECT * FROM invoices', [], (err2, rows2) => {
          if (err2) {
            // invoices table might not exist in older DBs
            result.invoices = [];
          } else {
            result.invoices = rows2;
          }
          db.close();
          resolve(result);
        });
      });
    });
  });
}

async function main() {
  console.log(`Reading from SQLite: ${dbPath}`);

  const { orders, invoices } = await readSqlite(dbPath);
  console.log(`Found ${orders.length} orders and ${invoices.length} invoices`);

  const azure = new AzureTableDatabase();
  await azure.initialize();

  // Migrate orders
  let ordersMigrated = 0;
  let ordersSkipped = 0;

  for (const row of orders) {
    try {
      const result = await azure.insertOrder({
        orderNumber: row.order_number,
        amount: row.amount,
        price: row.price,
        totalPrice: row.total_price,
        asset: row.asset,
        fiat: row.fiat,
        buyerNickname: row.buyer_nickname,
        sellerNickname: row.seller_nickname,
        tradeType: row.trade_type,
        createTime: row.create_time,
        orderDate: row.order_date,
      });

      if (result !== null) {
        // Merge any processing fields if the order was already processed
        if (row.processed_at) {
          await azure.ordersClient.upsertEntity({
            partitionKey: 'orders',
            rowKey: String(row.order_number),
            processedAt: row.processed_at,
            processingMethod: row.processing_method || '',
            success: row.success === 1 ? true : (row.success === 0 ? false : undefined),
            ...(row.cae && { cae: row.cae }),
            ...(row.voucher_number && { voucherNumber: Number(row.voucher_number) }),
            ...(row.invoice_date && { invoiceDate: row.invoice_date }),
            ...(row.error_message && { errorMessage: row.error_message }),
            ...(row.notes && { notes: row.notes }),
          }, 'Merge');
        }
        ordersMigrated++;
      } else {
        ordersSkipped++;
      }
    } catch (error) {
      console.error(`  Error migrating order ${row.order_number}: ${error.message}`);
    }
  }

  // Migrate invoices
  let invoicesMigrated = 0;

  for (const row of invoices) {
    try {
      await azure.saveInvoiceResult({
        order_number: row.order_number,
        cae: row.cae,
        status: row.success ? 'Success' : 'Failed',
        processing_method: row.processing_method,
        invoice_date: row.invoice_date,
        error_message: row.error_message,
      });
      invoicesMigrated++;
    } catch (error) {
      console.error(`  Error migrating invoice ${row.order_number}: ${error.message}`);
    }
  }

  console.log(`\nMigration complete:`);
  console.log(`  Orders migrated: ${ordersMigrated}`);
  console.log(`  Orders skipped (already in Azure): ${ordersSkipped}`);
  console.log(`  Invoices migrated: ${invoicesMigrated}`);
}

main().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
