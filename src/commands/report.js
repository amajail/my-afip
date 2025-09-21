const DatabaseOrderTracker = require('../utils/DatabaseOrderTracker');

async function showCurrentMonthReport() {
  console.log('📅 Current Month Orders Report');
  console.log('='.repeat(50));
  const dbTracker = new DatabaseOrderTracker();
  try {
    await dbTracker.initialize();
    const stats = await dbTracker.getCurrentMonthStats();
    const orders = await dbTracker.getCurrentMonthOrders();
    console.log('\n📊 Summary Statistics:');
    console.log(`  📅 Period: ${stats.earliest_date || 'N/A'} to ${stats.latest_date || 'N/A'}`);
    console.log(`  📦 Total Orders: ${stats.total_orders || 0}`);
    console.log(`  ✅ Processed: ${stats.processed_orders || 0}`);
    console.log(`  ⏳ Pending: ${stats.pending_orders || 0}`);
    console.log(`  🎯 Successful: ${stats.successful_orders || 0}`);
    console.log(`  ❌ Failed: ${stats.failed_orders || 0}`);
    console.log(`  💰 Total Amount: $${(stats.total_amount || 0).toLocaleString()}`);
    console.log(`  💵 Invoiced Amount: $${(stats.invoiced_amount || 0).toLocaleString()}`);
    if (orders.length === 0) {
      console.log('\n📝 No orders found for current month');
      return;
    }
    console.log(`\n📋 Detailed Orders (${orders.length} orders):`);
    console.log('-'.repeat(140));
    console.log('Date       | Order Number                      | Amount    | Status    | CAE/Error');
    console.log('-'.repeat(140));
    orders.forEach(order => {
      const date = order.order_date;
      const orderNum = order.order_number.padEnd(30);
      const amount = `$${order.total_price.toLocaleString()}`.padEnd(9);
      const status = order.status.padEnd(9);
      let result = '';
      if (order.status === 'Processed') {
        if (order.success) {
          result = `✅ CAE: ${order.cae || 'N/A'}`;
        } else {
          result = `❌ ${(order.error_message || 'Failed').substring(0, 40)}`;
        }
      } else {
        result = '⏳ Pending processing';
      }
      console.log(`${date} | ${orderNum} | ${amount} | ${status} | ${result}`);
    });
    console.log('-'.repeat(140));
    const processingRate = stats.total_orders > 0
      ? ((stats.processed_orders / stats.total_orders) * 100).toFixed(1)
      : '0';
    const successRate = stats.processed_orders > 0
      ? ((stats.successful_orders / stats.processed_orders) * 100).toFixed(1)
      : '0';
    console.log(`\n📈 Processing Rate: ${processingRate}% (${stats.processed_orders}/${stats.total_orders})`);
    console.log(`🎯 Success Rate: ${successRate}% (${stats.processed_orders > 0 ? stats.successful_orders + '/' + stats.processed_orders : '0/0'})`);
    if (stats.pending_orders > 0) {
      console.log(`\n💡 Next Actions:`);
      console.log(`  - Run \"npm run orders\" to process ${stats.pending_orders} pending orders`);
      console.log(`  - Or run \"npm run binance:auto\" to fetch new orders and process all`);
    }
  } catch (error) {
    console.error('❌ Error generating current month report:', error.message);
  } finally {
    await dbTracker.close();
  }
}

module.exports = { showCurrentMonthReport };
