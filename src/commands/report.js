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
    console.log(`  ✅ Successful Invoices: ${stats.successful_orders || 0}`);
    console.log(`  ❌ Failed Attempts: ${stats.failed_orders || 0}`);
    console.log(`  ⏳ Pending Processing: ${stats.pending_orders || 0}`);
    console.log(`  💰 Total Amount: $${(stats.total_amount || 0).toLocaleString()}`);
    console.log(`  💵 Successfully Invoiced: $${(stats.invoiced_amount || 0).toLocaleString()}`);
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

      // Better status display with emojis
      let statusDisplay = '';
      let result = '';

      if (order.status === 'Success') {
        statusDisplay = '✅ Success'.padEnd(9);
        result = `CAE: ${order.cae || 'N/A'}`;
      } else if (order.status === 'Failed') {
        statusDisplay = '❌ Failed'.padEnd(9);
        result = `${(order.error_message || 'Processing failed').substring(0, 50)}`;
      } else {
        statusDisplay = '⏳ Pending'.padEnd(9);
        result = 'Awaiting processing';
      }

      console.log(`${date} | ${orderNum} | ${amount} | ${statusDisplay} | ${result}`);
    });
    console.log('-'.repeat(140));
    const totalAttempted = (stats.successful_orders || 0) + (stats.failed_orders || 0);
    const successRate = totalAttempted > 0
      ? ((stats.successful_orders / totalAttempted) * 100).toFixed(1)
      : '0';
    const invoiceRate = stats.total_orders > 0
      ? ((stats.successful_orders / stats.total_orders) * 100).toFixed(1)
      : '0';

    console.log(`\n📈 Invoice Success Rate: ${successRate}% (${stats.successful_orders || 0}/${totalAttempted})`);
    console.log(`🎯 Overall Completion: ${invoiceRate}% (${stats.successful_orders || 0}/${stats.total_orders || 0} orders invoiced)`);
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
