import express from 'express';
import {
  getTeamMembers,
  getTeamMemberDetails,
  createTeamMember,
  updateTeamMember,
  toggleTeamMemberStatus,
  resetTeamMemberPassword,
  deleteTeamMember,
  getTeamMemberActivity,
  getAllTeamActivity
} from '../controllers/teamController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbacMiddleware.js';

const router = express.Router();

// Require authentication for all team routes
router.use(requireAuth);

// All-activity audit log route (must be defined before /:id parameter)
router.get('/activity/all', requirePermission('audit_logs.view'), getAllTeamActivity);

// Team member CRUD & management
router.get('/', requirePermission('team_members.view'), getTeamMembers);
router.post('/', requirePermission('team_members.create'), createTeamMember);
router.get('/:id', requirePermission('team_members.view'), getTeamMemberDetails);
router.put('/:id', requirePermission('team_members.edit'), updateTeamMember);
router.patch('/:id/status', requirePermission('team_members.disable'), toggleTeamMemberStatus);
router.post('/:id/reset-password', requirePermission('team_members.edit'), resetTeamMemberPassword);
router.get('/:id/activity', requirePermission('audit_logs.view'), getTeamMemberActivity);
router.delete('/:id', requirePermission('team_members.delete'), deleteTeamMember);

export default router;
