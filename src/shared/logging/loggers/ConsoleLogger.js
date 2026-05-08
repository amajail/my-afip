const Logger = require('../Logger');

const LEVELS = { error: 0, warn: 1, info: 2, http: 3, debug: 4 };

class ConsoleLogger extends Logger {
  constructor(options = {}) {
    super();
    this._level = options.level ?? 'info';
    this._silent = options.silent ?? false;
  }

  _format(level, message, metadata) {
    const ts = new Date().toISOString();
    const meta = Object.keys(metadata).length ? ' ' + JSON.stringify(metadata) : '';
    return `${ts} [${level.toUpperCase()}]: ${message}${meta}`;
  }

  _write(level, message, metadata) {
    if (this._silent) return;
    if (LEVELS[level] > LEVELS[this._level]) return;
    const line = this._format(level, message, metadata);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }

  error(message, metadata = {}) { this._write('error', message, metadata); }
  warn(message, metadata = {})  { this._write('warn',  message, metadata); }
  info(message, metadata = {})  { this._write('info',  message, metadata); }
  http(message, metadata = {})  { this._write('http',  message, metadata); }
  debug(message, metadata = {}) { this._write('debug', message, metadata); }

  log(level, message, metadata = {}) { this._write(level, message, metadata); }

  setLevel(level) { this._level = level; }
  getLevel()      { return this._level; }
  silence()       { this._silent = true; }
  unsilence()     { this._silent = false; }
}

module.exports = ConsoleLogger;
