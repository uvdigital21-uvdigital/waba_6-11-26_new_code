import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  getFlows,
  getFlowById,
  createFlow,
  updateFlow,
  updateStatus,
  deleteFlow,
  uploadMedia,
  saveFlow,
  getHealthStatus
} from '../controllers/chatbotController.js';

const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'uploads', 'chatbot');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'media-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

// Protect API routes
router.use(requireAuth);

router.get('/health', asyncHandler(getHealthStatus));
router.get('/flows', asyncHandler(getFlows));
router.post('/flow', asyncHandler(createFlow));
router.post('/save', asyncHandler(saveFlow));
router.get('/flow/:id', asyncHandler(getFlowById));
router.get('/:id', asyncHandler(getFlowById));
router.put('/flow/:id', asyncHandler(updateFlow));
router.patch('/flow/:id/status', asyncHandler(updateStatus));
router.patch('/:id/status', asyncHandler(updateStatus));
router.delete('/flow/:id', asyncHandler(deleteFlow));
router.delete('/:id', asyncHandler(deleteFlow));
router.post('/upload', upload.single('file'), asyncHandler(uploadMedia));
router.post('/upload-media', upload.single('file'), asyncHandler(uploadMedia));

export default router;
