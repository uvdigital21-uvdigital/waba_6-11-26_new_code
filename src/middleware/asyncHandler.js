// ─────────────────────────────────────────────────────────────────────────────
// src/middleware/asyncHandler.js
// Wraps any async Express route handler so that rejected promises are
// automatically forwarded to the next(err) error handler.
// Usage:  router.post('/route', asyncHandler(myAsyncController))
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Function} fn - An async Express route handler
 * @returns {Function}   A new handler that catches all promise rejections
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
