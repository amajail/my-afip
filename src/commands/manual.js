const DatabaseOrderTracker = require('../utils/DatabaseOrderTracker');

async function markManualInvoice(orderNumber, cae, voucherNumber, notes) {
  const dbTracker = new DatabaseOrderTracker();
  try {
    console.log(`🔧 Marking order ${orderNumber} as manually processed...`);
    const success = await dbTracker.markManualInvoice(orderNumber, cae, voucherNumber, notes);
    if (success) {
      console.log(`✅ Successfully marked as manual invoice`);
      console.log(`  - Order: ${orderNumber}`);
      console.log(`  - CAE: ${cae}`);
      console.log(`  - Voucher: ${voucherNumber}`);
      if (notes) console.log(`  - Notes: ${notes}`);
    } else {
      console.log(`❌ Failed to mark order as manual invoice`);
    }
  } finally {
    await dbTracker.close();
  }
}

module.exports = { markManualInvoice };
