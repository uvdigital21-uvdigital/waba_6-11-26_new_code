import express from 'express';
import { login, getMessages, getConversationThread, sendMessage, registerFcm, logout, getApkDownloadLink, downloadApk } from '../controllers/mobileAppController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// ── In-Memory Rate Limiter for Login (5 attempts per 15 minutes per IP) ──────
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 5;

const loginRateLimiter = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown_ip';
  const now = Date.now();
  
  let record = loginAttempts.get(ip);
  if (!record || now - record.startTime > RATE_LIMIT_WINDOW_MS) {
    record = { count: 0, startTime: now };
    loginAttempts.set(ip, record);
  }

  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    const remainingSec = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - record.startTime)) / 1000);
    return res.status(429).json({
      success: false,
      message: `Too many login attempts. Please try again in ${Math.ceil(remainingSec / 60)} minutes.`
    });
  }

  // Hook into response to increment on failure only
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    if (res.statusCode === 401 || res.statusCode === 400) {
      record.count += 1;
    } else if (res.statusCode === 200) {
      loginAttempts.delete(ip); // Reset on successful login
    }
    return originalJson(data);
  };

  next();
};

// ── Public Auth Route ────────────────────────────────────────────────────────
router.post('/login', loginRateLimiter, login);

// ── Protected Mobile Routes (Requires Bearer JWT) ────────────────────────────
router.get('/messages', requireAuth, getMessages);
router.get('/messages/:conversationId', requireAuth, getConversationThread);
router.post('/send-message', requireAuth, sendMessage);
router.post('/fcm-token', requireAuth, registerFcm);
router.post('/logout', requireAuth, logout);

// ── Secure APK Delivery Endpoints (Prompt 3) ─────────────────────────────────
router.get('/download-link', requireAuth, getApkDownloadLink);
router.get('/secure-download/apk', downloadApk);

export default router;

