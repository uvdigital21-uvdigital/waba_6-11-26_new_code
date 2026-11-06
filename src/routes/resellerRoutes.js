import express from 'express';
import { requireAuth, requireAdmin, requireAdminOrReseller } from '../middleware/auth.js';
import {
  getResellers,
  createReseller,
  getResellerDetails,
  getResellerUsers,
  updateReseller,
  toggleResellerStatus,
  resetResellerPassword,
  deleteReseller
} from '../controllers/resellerController.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// All reseller management routes require Admin or Super Admin
router.get('/', requireAdmin, getResellers);
router.post('/', requireAdmin, createReseller);
router.get('/:id', requireAdmin, getResellerDetails);
router.get('/:id/users', requireAdminOrReseller, getResellerUsers);
router.put('/:id', requireAdmin, updateReseller);
router.patch('/:id/status', requireAdmin, toggleResellerStatus);
router.post('/:id/reset-password', requireAdmin, resetResellerPassword);
router.delete('/:id', requireAdmin, deleteReseller);

export default router;

