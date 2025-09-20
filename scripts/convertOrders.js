const fs = require('fs');
const path = require('path');
const OrderTracker = require('../src/utils/orderTracker');
const DatabaseOrderTracker = require('../src/utils/DatabaseOrderTracker');

function convertTimestamp(timestamp) {
  return new Date(timestamp).toISOString().split('T')[0];
}

function convertOrdersToCSV(ordersData) {
  const orders = Array.isArray(ordersData) ? ordersData : ordersData.data || [];

  const csvRows = ['docNumber,docDate,netAmount,totalAmount,vatAmount,concept,currency'];

  orders.forEach(order => {
    const docNumber = '';
    const docDate = convertTimestamp(order.createTime);
    const amount = Math.round(parseFloat(order.totalPrice)).toString();

    const csvRow = [
      docNumber,
      docDate,
      amount,
      amount,
      '0.00',
      '2',
      'PES'
    ].join(',');

    csvRows.push(csvRow);
  });

  return csvRows.join('\n');
}

async function processOrderFiles() {
  const ordersDir = path.join(__dirname, '..', 'orders');
  const outputDir = path.join(__dirname, '..', 'data');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const orderFiles = fs.readdirSync(ordersDir).filter(file => file.endsWith('.json'));
  const dbTracker = new DatabaseOrderTracker();

  let allOrders = [];
  let processedCount = 0;

  orderFiles.forEach(file => {
    try {
      const filePath = path.join(ordersDir, file);
      const orderData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      const orders = Array.isArray(orderData) ? orderData : orderData.data || [];
      allOrders = allOrders.concat(orders);
      processedCount += orders.length;

      console.log(`✓ Processed ${file}: ${orders.length} orders`);
    } catch (error) {
      console.error(`✗ Error processing ${file}:`, error.message);
    }
  });

  if (allOrders.length > 0) {
    console.log(`\n🔍 Checking for duplicates (Database)...`);

    try {
      const { newOrders, duplicates } = await dbTracker.filterNewOrders(allOrders);

      console.log(`📊 Duplicate Analysis:`);
      console.log(`  - Total orders found: ${allOrders.length}`);
      console.log(`  - New orders: ${newOrders.length}`);
      console.log(`  - Duplicates skipped: ${duplicates.length}`);

      if (duplicates.length > 0) {
        console.log(`\n⚠️  Skipped duplicate orders:`);
        duplicates.forEach(dup => {
          const method = dup.processingMethod === 'manual' ? '🔧' : '🤖';
          const status = dup.success ? `✅ CAE: ${dup.cae}` : '❌ Failed';
          console.log(`  - ${method} Order ${dup.orderNumber}: $${dup.totalPrice} (${status})`);
        });
      }

      if (newOrders.length > 0) {
        const csvContent = convertOrdersToCSV(newOrders);
        const outputPath = path.join(outputDir, 'orders-invoices.csv');
        fs.writeFileSync(outputPath, csvContent);

        console.log(`\n✓ Conversion completed!`);
        console.log(`New orders to process: ${newOrders.length}`);
        console.log(`Output file: ${outputPath}`);
        console.log(`\nPreview of first 3 new invoices:`);

        const lines = csvContent.split('\n');
        lines.slice(0, 4).forEach(line => console.log(line));

        if (lines.length > 4) {
          console.log(`... and ${lines.length - 4} more invoices`);
        }

        return { newOrders, duplicates, totalOrders: allOrders.length };
      } else {
        console.log('\n✅ All orders have already been processed. No new invoices to create.');
        return { newOrders: [], duplicates, totalOrders: allOrders.length };
      }
    } finally {
      await dbTracker.close();
    }
  } else {
    console.log('No orders found to process');
    await dbTracker.close();
    return { newOrders: [], duplicates: [], totalOrders: 0 };
  }
}

if (require.main === module) {
  processOrderFiles();
}

module.exports = { convertOrdersToCSV, processOrderFiles };