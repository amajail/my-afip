const { app } = require('@azure/functions');
const AzureTableDatabase = require('../database/AzureTableDatabase');

app.http('orders', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'orders',
  handler: async (request, context) => {
    try {
      const db = new AzureTableDatabase();
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const [orders, stats] = await Promise.all([
        db.getCurrentMonthOrders(),
        db.getCurrentMonthStats(),
      ]);

      return {
        jsonBody: { generated_at: now.toISOString(), month, stats, orders },
        headers: {
          'Access-Control-Allow-Origin': 'https://amajail.github.io',
          'Cache-Control': 'max-age=60',
        },
      };
    } catch (error) {
      context.log.error('Failed to fetch orders', error.message);
      return {
        status: 500,
        jsonBody: { error: 'Failed to fetch orders' },
        headers: { 'Access-Control-Allow-Origin': 'https://amajail.github.io' },
      };
    }
  },
});
