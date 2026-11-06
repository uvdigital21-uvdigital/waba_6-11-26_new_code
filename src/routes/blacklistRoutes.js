import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getBlacklist,
  addToBlacklist,
  removeFromBlacklist,
  checkBlacklistEndpoint
} from '../controllers/blacklistController.js';

const router = express.Router();

// Public / Internal check endpoint
router.get('/check', checkBlacklistEndpoint);

// Authenticated management endpoints
router.get('/', requireAuth, getBlacklist);
router.post('/', requireAuth, addToBlacklist);
router.delete('/:id', requireAuth, removeFromBlacklist);

export default router;