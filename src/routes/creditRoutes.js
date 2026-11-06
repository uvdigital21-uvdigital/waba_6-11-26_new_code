import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getUserCreditsController,
  getUserHistoryController,
  getAdminUsersCreditsController,
  assignCreditsController,
  getAdminHistoryController
} from '../controllers/creditController.js';

const router = express.Router();

// Enforce authentication on all credit routes
router.use(requireAuth);

// User endpoints
router.get('/balance', getUserCreditsController);
router.get('/user/balance', getUserCreditsController);
router.get('/history', getUserHistoryController);

// Admin endpoints
router.get('/admin/users', getAdminUsersCreditsController);
router.post('/admin/assign', assignCreditsController);
router.get('/admin/history', getAdminHistoryController);

export default router;
