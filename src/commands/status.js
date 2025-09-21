const DatabaseOrderTracker = require('../utils/DatabaseOrderTracker');
const OrderTracker = require('../utils/orderTracker');

async function checkOrderStatus() {
  const dbTracker = new DatabaseOrderTracker();
  try {
    const stats = await dbTracker.getStats();
    console.log(`📊 Order Processing Status (Database):`);
    console.log(`  - Total orders: ${stats.total_orders}`);
    console.log(`  - Processed: ${stats.processed_orders}`);
    console.log(`  - Unprocessed: ${stats.total_orders - stats.processed_orders}`);
    console.log(`  ✅ Successful: ${stats.successful_orders}`);
    console.log(`  ❌ Failed: ${stats.failed_orders}`);
    console.log(`  🔧 Manual: ${stats.manual_orders}`);
    console.log(`  🤖 Automatic: ${stats.automatic_orders}`);
    if (stats.total_invoiced_amount) {
      console.log(`  💰 Total invoiced: $${stats.total_invoiced_amount.toLocaleString()}`);
    }
    if (stats.processed_orders > 0) {
      console.log(`\n📋 Recent processed orders:`);
      const recentOrders = await dbTracker.getProcessedOrders();
      recentOrders.slice(0, 5).forEach(order => {
        const method = order.processing_method === 'manual' ? '🔧' : '🤖';
        const status = order.success ? '✅' : '❌';
        const cae = order.cae ? ` CAE: ${order.cae}` : '';
        console.log(`  ${method} ${status} ${order.order_number}${cae}`);
      });
      if (recentOrders.length > 5) {
        console.log(`  ... and ${recentOrders.length - 5} more`);
      }
    }
    // Show legacy file tracker too
    console.log(`\n📁 Legacy file tracker:`);
    const fileTracker = new OrderTracker();
    const fileCount = fileTracker.getProcessedOrdersCount();
    console.log(`  - File-tracked orders: ${fileCount}`);
  } finally {
    await dbTracker.close();
  }
}

module.exports = { checkOrderStatus };
