import express from 'express';
import { getPermissions, updateRolePermissions } from '../controllers/permissionController.js';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);
router.get('/', getPermissions);
router.put('/', requireSuperAdmin, updateRolePermissions);

export default router;
