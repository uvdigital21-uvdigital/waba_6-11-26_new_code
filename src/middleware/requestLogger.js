// ─────────────────────────────────────────────────────────────────────────────
// src/middleware/requestLogger.js
// Logs every incoming request with method, URL, status, and response time.
// Mount this early in server.js so it captures all routes.
// ─────────────────────────────────────────────────────────────────────────────

import logger from '../utils/logger.js';

/**
 * Express middleware that times each request and logs the result after
 * the response is sent.
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Intercept the end of the response lifecycle
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status   = res.statusCode;

    // Colour-code based on HTTP status range
    if (status >= 500) {
      logger.error(`${req.method} ${req.originalUrl} → ${status} (${duration}ms)`);
    } else if (status >= 400) {
      logger.warn(`${req.method} ${req.originalUrl} → ${status} (${duration}ms)`);
    } else {
      logger.info(`${req.method} ${req.originalUrl} → ${status} (${duration}ms)`);
    }
  });

  next();
};

export default requestLogger;
