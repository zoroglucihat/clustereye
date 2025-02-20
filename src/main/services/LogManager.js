class LogManager {
  constructor() {
    this.DEBUG = true;
  }

  debug(...args) {
    if (this.DEBUG) {
      console.log('[DEBUG]', ...args);
    }
  }

  error(...args) {
    console.error('[ERROR]', ...args);
  }

  info(...args) {
    console.log('[INFO]', ...args);
  }
}

module.exports = new LogManager(); 