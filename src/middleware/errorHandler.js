// ─────────────────────────────────────────────────────────────────────────────
// src/middleware/errorHandler.js
// Global Express error-handling middleware.
// Must be mounted LAST in server.js (after all routes).
// Signature must have 4 parameters for Express to recognise it as an error handler.
// ─────────────────────────────────────────────────────────────────────────────

import logger from '../utils/logger.js';

/**
 * Normalises any thrown error into a clean JSON response.
 *
 * @param {Error}    err
 * @param {Request}  req
 * @param {Response} res
 * @param {Function} next  - Must be declared even if unused (Express requirement)
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Determine HTTP status – use err.statusCode if set, else 500
  const statusCode = err.statusCode || err.status || 500;

  // Log the full error internally
  logger.error(
    `[ErrorHandler] ${req.method} ${req.originalUrl} → ${statusCode}`,
    err.message
  );

  // In development expose the stack trace; in production keep it clean
  const isDev = process.env.NODE_ENV !== 'production';

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(isDev && { stack: err.stack }),
  });
};

export default errorHandler;
