// ─────────────────────────────────────────────────────────────────────────────
// src/utils/saveWebhook.js
// Persists every incoming Meta webhook payload to disk as a JSON file.
// Files are saved under:  <project-root>/logs/webhook_<timestamp>_<id>.json
// ─────────────────────────────────────────────────────────────────────────────

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

// ── Resolve the absolute path to the /logs directory ─────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
// Go up two levels:  utils → src → backend root, then into logs/
const LOGS_DIR = path.join(__dirname, '..', '..', 'logs');

/**
 * Ensures the logs directory exists (creates it if missing).
 */
const ensureLogsDir = () => {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    logger.info(`[saveWebhook] Created logs directory at: ${LOGS_DIR}`);
  }
};

/**
 * Saves a webhook payload to disk.
 *
 * @param {object} payload  - The full req.body from the webhook POST
 * @returns {string|null}   - The file path that was written, or null on error
 */
const saveWebhook = (payload) => {
  try {
    ensureLogsDir();

    // Build a unique filename:  webhook_2024-01-15T10-30-00-000Z_<randomId>.json
    const now      = new Date().toISOString().replace(/[:.]/g, '-');
    const randomId = Math.random().toString(36).substring(2, 8);
    const filename = `webhook_${now}_${randomId}.json`;
    const filePath = path.join(LOGS_DIR, filename);

    // Pretty-print JSON so it's human-readable
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');

    logger.success(`[saveWebhook] Payload saved → ${filename}`);
    return filePath;
  } catch (err) {
    logger.error('[saveWebhook] Failed to save webhook payload:', err.message);
    return null;
  }
};

export default saveWebhook;
