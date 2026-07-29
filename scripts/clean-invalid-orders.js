/**
 * clean-invalid-orders.js
 *
 * Identifies and (optionally) deletes invalid / leftover test rows from the
 * `orders` table in Azure Table Storage.
 *
 * A row is considered junk when:
 *   - it cannot be deserialized into a valid domain Order (fails validation), or
 *   - its order number (rowKey) is empty, null, or the literal string "undefined".
 *
 * This is the recovery tool for production pollution such as the test fixtures
 * (`new_order_1`, `new_order_2`, `processed_order`, `undefined`) that caused the
 * weekly processing job to skip every row.
 *
 * Usage:
 *   node scripts/clean-invalid-orders.js            # dry run — lists candidates only
 *   node scripts/clean-invalid-orders.js --apply    # actually delete the candidates
 *
 * Requires AZURE_STORAGE_CONNECTION_STRING in the environment (or .env).
 */

require('dotenv').config();

const AzureTableDatabase = require('../src/database/AzureTableDatabase');
const AzureOrderRepository = require('../src/infrastructure/repositories/AzureOrderRepository');

const INVALID_ORDER_NUMBERS = new Set(['', 'undefined', 'null']);

function isJunk(row, repo) {
  const orderNumber = row.order_number;

  if (orderNumber === null || orderNumber === undefined ||
      INVALID_ORDER_NUMBERS.has(String(orderNumber).trim())) {
    return 'invalid order number';
  }

  try {
    // Reuse the exact mapping the app uses, so "junk" means "the app cannot
    // process this row" — never a valid order that simply looks unusual.
    repo._fromDatabase(row);
    return null;
  } catch (error) {
    return `deserialization failed: ${error.message}`;
  }
}

async function main() {
  const apply = process.argv.includes('--apply');

  const db = new AzureTableDatabase();
  const repo = new AzureOrderRepository(db);
  await db.initialize();

  const rows = await db.getAllOrders();
  const candidates = [];

  for (const row of rows) {
    const reason = isJunk(row, repo);
    if (reason) {
      candidates.push({ orderNumber: row.order_number, reason });
    }
  }

  console.log(`\nScanned ${rows.length} order row(s); found ${candidates.length} invalid row(s).\n`);

  if (candidates.length === 0) {
    console.log('✅ Nothing to clean.');
    await db.close();
    return;
  }

  for (const c of candidates) {
    console.log(`  • ${JSON.stringify(c.orderNumber)} — ${c.reason}`);
  }

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to delete the rows above.');
    await db.close();
    return;
  }

  console.log('\nDeleting...');
  let deleted = 0;
  for (const c of candidates) {
    const removed = await db.deleteOrder(c.orderNumber);
    if (removed) {
      deleted += 1;
      console.log(`  ✓ deleted ${JSON.stringify(c.orderNumber)}`);
    } else {
      console.log(`  - already gone ${JSON.stringify(c.orderNumber)}`);
    }
  }

  console.log(`\n✅ Deleted ${deleted} of ${candidates.length} invalid row(s).`);
  await db.close();
}

main().catch((error) => {
  console.error('❌ Cleanup failed:', error.message);
  process.exitCode = 1;
});
