#!/usr/bin/env node
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const AzureTableDatabase = require('../src/database/AzureTableDatabase');

async function main() {
  const db = new AzureTableDatabase();
  await db.connect();

  const [orders, stats] = await Promise.all([
    db.getCurrentMonthOrders(),
    db.getCurrentMonthStats(),
  ]);

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const payload = {
    generated_at: now.toISOString(),
    month,
    stats,
    orders,
  };

  const outDir = path.join(__dirname, '..', 'docs', 'data');
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'orders.json');
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

  console.log(`Exported ${orders.length} orders for ${month} → ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
