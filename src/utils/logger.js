// ─────────────────────────────────────────────────────────────────────────────
// src/utils/logger.js
// Lightweight console logger with timestamps and colour-coded log levels.
// Use this everywhere instead of raw console.log so output is consistent.
// ─────────────────────────────────────────────────────────────────────────────

const LEVELS = {
  info:  '\x1b[36m[INFO] \x1b[0m',   // cyan
  warn:  '\x1b[33m[WARN] \x1b[0m',   // yellow
  error: '\x1b[31m[ERROR]\x1b[0m',   // red
  debug: '\x1b[35m[DEBUG]\x1b[0m',   // magenta
  success: '\x1b[32m[OK]   \x1b[0m', // green
};

/**
 * Returns an ISO timestamp string suitable for log prefixes.
 */
const timestamp = () => new Date().toISOString();

/**
 * Core log function.
 * @param {'info'|'warn'|'error'|'debug'|'success'} level
 * @param  {...any} args - anything you want printed
 */
const log = (level, ...args) => {
  const prefix = `${LEVELS[level] ?? LEVELS.info} ${timestamp()} |`;
  if (level === 'error') {
    console.error(prefix, ...args);
  } else if (level === 'warn') {
    console.warn(prefix, ...args);
  } else {
    console.log(prefix, ...args);
  }
};

const logger = {
  info:    (...args) => log('info',    ...args),
  warn:    (...args) => log('warn',    ...args),
  error:   (...args) => log('error',   ...args),
  debug:   (...args) => log('debug',   ...args),
  success: (...args) => log('success', ...args),
};

export default logger;
