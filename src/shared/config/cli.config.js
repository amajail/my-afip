/**
 * CLI Configuration
 *
 * Configuration specific to CLI execution
 * and command-line specific settings
 */

const { get, getInt, getBoolean } = require('./helpers');

module.exports = {
  // CLI display settings
  cli: {
    // Output format
    outputFormat: get('CLI_OUTPUT_FORMAT', 'pretty'), // 'pretty', 'json', 'table'
    colorEnabled: getBoolean('CLI_COLOR_ENABLED', true),

    // Interactive mode
    interactiveMode: getBoolean('CLI_INTERACTIVE', true),
    confirmActions: getBoolean('CLI_CONFIRM_ACTIONS', true),

    // Progress indicators
    showProgress: getBoolean('CLI_SHOW_PROGRESS', true),
    showSpinners: getBoolean('CLI_SHOW_SPINNERS', true),

    // Table display settings
    maxTableRows: getInt('CLI_MAX_TABLE_ROWS', 50),
    truncateColumns: getBoolean('CLI_TRUNCATE_COLUMNS', true),
    columnMaxWidth: getInt('CLI_COLUMN_MAX_WIDTH', 50)
  },

  // Command defaults
  commands: {
    // Binance fetch defaults
    defaultDays: getInt('CLI_DEFAULT_DAYS', 7),
    defaultTradeType: get('CLI_DEFAULT_TRADE_TYPE', 'SELL'),

    // Processing defaults
    autoProcessOnFetch: getBoolean('CLI_AUTO_PROCESS', false),
    batchSize: getInt('CLI_BATCH_SIZE', 10)
  },

  // Logging for CLI
  logging: {
    logLevel: get('CLI_LOG_LEVEL', 'info'),
    logToFile: getBoolean('CLI_LOG_TO_FILE', false),
    logFilePath: get('CLI_LOG_FILE_PATH', './logs/cli.log'),
    verboseMode: getBoolean('CLI_VERBOSE', false)
  },

  // File paths for CLI operations
  paths: {
    tempDir: get('CLI_TEMP_DIR', './tmp'),
    outputDir: get('CLI_OUTPUT_DIR', './output'),
    reportsDir: get('CLI_REPORTS_DIR', './reports')
  }
};
