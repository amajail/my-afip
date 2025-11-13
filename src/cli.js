/**
 * CLI Entry Point (Refactored)
 *
 * Uses new CLI router for clean architecture
 */

const AfipInvoiceApp = require('./AfipInvoiceApp');
const CLI = require('./cli/index');

async function main() {
  const app = new AfipInvoiceApp();
  const cli = new CLI(app);

  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const commandArgs = args.slice(1);

  try {
    await cli.route(command, commandArgs);
  } catch (error) {
    console.error('Application error:', error.message);
    process.exit(1);
  }
}

main();
