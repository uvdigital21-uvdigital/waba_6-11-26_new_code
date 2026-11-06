import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { login, logout, getMe, register, updateProfile, changePassword, listSessions, revokeSession, blockSessionDevice, unblockSessionDevice, renameSessionDevice, deleteSession } from '../controllers/authController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage for branding logo uploads
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'branding');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});

const upload = multer({ storage });

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, getMe);
router.put('/profile', requireAuth, upload.single('app_logo'), updateProfile);
router.post('/change-password', requireAuth, changePassword);
router.get('/sessions', requireAuth, listSessions);
router.post('/sessions/:sessionId/logout', requireAuth, revokeSession);
router.post('/sessions/:sessionId/block', requireAuth, blockSessionDevice);
router.post('/sessions/:sessionId/unblock', requireAuth, unblockSessionDevice);
router.patch('/sessions/:sessionId/name', requireAuth, renameSessionDevice);
router.delete('/sessions/:sessionId', requireAuth, deleteSession);

export default router;
