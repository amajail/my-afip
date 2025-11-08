const DatabaseOrderTracker = require('../utils/DatabaseOrderTracker');
const logger = require('../utils/logger');

async function markManualInvoice(orderNumber, cae, voucherNumber, notes) {
  const dbTracker = new DatabaseOrderTracker();
  try {
    logger.debug('Marking order as manually processed', {
      orderNumber,
      event: 'manual_invoice_mark_start'
    });
    const success = await dbTracker.markManualInvoice(orderNumber, cae, voucherNumber, notes);
    if (success) {
      logger.info('Successfully marked as manual invoice', {
        orderNumber,
        cae,
        voucherNumber,
        notes,
        event: 'manual_invoice_marked_success'
      });
    } else {
      logger.warn('Failed to mark order as manual invoice', {
        orderNumber,
        event: 'manual_invoice_mark_failed'
      });
    }
  } finally {
    await dbTracker.close();
  }
}

module.exports = { markManualInvoice };
