/**
 * AI Novel Studio - Centralized Error & Diagnostic Logger
 * Captures network errors, API logs, and runtime unhandled exceptions
 */

class Logger {
  constructor() {
    this.logs = [];
    this.maxLogs = 100;
    this.listeners = [];
    this.initGlobalHandlers();
  }

  initGlobalHandlers() {
    // Intercept window uncaught errors
    window.addEventListener('error', (event) => {
      this.log('ERROR', `Lỗi giao diện: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Intercept Promise rejections (Fetch errors, async calls)
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const message = reason?.message || String(reason || 'Promise bị từ chối không rõ nguyên nhân');
      this.log('ERROR', `Lỗi bất đồng bộ: ${message}`, {
        stack: reason?.stack || null
      });
    });

    // Hook console.error
    const originalError = console.error.bind(console);
    console.error = (...args) => {
      originalError(...args);
      try {
        const text = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        this.log('ERROR', text);
      } catch (_) {}
    };

    // Hook console.warn
    const originalWarn = console.warn.bind(console);
    console.warn = (...args) => {
      originalWarn(...args);
      try {
        const text = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        this.log('WARN', text);
      } catch (_) {}
    };
  }

  log(type, message, details = null) {
    const entry = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      time: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
      type: type.toUpperCase(), // 'ERROR', 'WARN', 'INFO', 'API'
      message,
      details
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    this.listeners.forEach(fn => fn(entry, this.logs));
  }

  getLogs() {
    return this.logs;
  }

  clear() {
    this.logs = [];
    this.listeners.forEach(fn => fn(null, this.logs));
  }

  onLog(callback) {
    this.listeners.push(callback);
  }

  exportAsText() {
    if (this.logs.length === 0) return 'Chưa có nhật ký lỗi nào được ghi nhận.';
    return this.logs.map(l => {
      let str = `[${l.time}] [${l.type}] ${l.message}`;
      if (l.details) {
        str += `\nChi tiết: ${typeof l.details === 'object' ? JSON.stringify(l.details, null, 2) : l.details}`;
      }
      return str;
    }).join('\n\n------------------------\n\n');
  }
}

export const appLogger = new Logger();
window.AppLogger = appLogger;
