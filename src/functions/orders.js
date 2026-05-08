const { app } = require('@azure/functions');
const AzureTableDatabase = require('../database/AzureTableDatabase');

const MONTH_RE = /^\d{4}-(?:0[1-9]|1[0-2])$/;

app.http('orders', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'orders',
  handler: async (request, context) => {
    try {
      const db = new AzureTableDatabase();
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const requested = request.query.get('month');
      const month = requested && MONTH_RE.test(requested) ? requested : currentMonth;

      const [orders, stats] = await Promise.all([
        db.getOrdersByMonth(month),
        db.getStatsByMonth(month),
      ]);

      return {
        jsonBody: { generated_at: now.toISOString(), month, stats, orders },
        headers: { 'Cache-Control': 'max-age=60' },
      };
    } catch (error) {
      context.error('Failed to fetch orders:', error.message);
      return { status: 500, jsonBody: { error: 'Failed to fetch orders' } };
    }
  },
});
