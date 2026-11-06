import express from 'express';
import { 
  createUser, 
  getUsers, 
  getUserDetails, 
  updateUser, 
  deleteUser, 
  toggleUserStatus, 
  resetUserPassword, 
  logoutAllSessions, 
  getUserActivity, 
  getAllActivity,
  extendUserDays
} from '../controllers/userController.js';
import { requireAuth, requireSuperAdmin, requireAdmin, requireAdminOrReseller } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

// All-activity audit log endpoint (must be before /:id) — Admin only
router.get('/activity/all', requireAdmin, getAllActivity);

// Core CRUD & Management endpoints — Admin OR Reseller (Resellers are scoped by created_by_user_id)
router.post('/', requireAdminOrReseller, createUser);
router.get('/', requireAdminOrReseller, getUsers);
router.get('/:id', requireAdminOrReseller, getUserDetails);
router.put('/:id', requireAdminOrReseller, updateUser);
router.post('/:id/extend-days', requireAdminOrReseller, extendUserDays);
router.patch('/:id/status', requireAdminOrReseller, toggleUserStatus);
router.post('/:id/reset-password', requireAdminOrReseller, resetUserPassword);
router.post('/:id/logout-all', requireAdmin, logoutAllSessions);
router.get('/:id/activity', requireAdmin, getUserActivity);
router.delete('/:id', requireAdminOrReseller, deleteUser);

export default router;
