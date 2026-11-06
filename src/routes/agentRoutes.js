import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbacMiddleware.js';
import {
  getAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  updateAgentStatus
} from '../controllers/agentController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads/agents directory exists
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'agents');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage setup for profile images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid image format. Allowed formats: jpg, jpeg, png, webp'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // Max 2MB
  fileFilter
});

const router = express.Router();

router.use(requireAuth);

// Routes
router.get('/', getAgents);
router.get('/:id', getAgentById);
router.post('/', requireRole('Admin'), upload.single('profileImage'), createAgent);
router.put('/:id', requireRole('Admin'), upload.single('profileImage'), updateAgent);
router.delete('/:id', requireRole('Admin'), deleteAgent);
router.patch('/:id/status', requireRole('Admin'), updateAgentStatus);

export default router;
