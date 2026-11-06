import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getTeamMembers,
  createTeamMember,
  getTeamMemberDetails,
  updateTeamMember,
  toggleTeamMemberStatus,
  resetTeamMemberPassword,
  deleteTeamMember,
  getTeamMemberAuditLogs
} from '../controllers/teamMemberController.js';

const router = express.Router();

router.use(requireAuth);

// Team members CRUD
router.get('/', getTeamMembers);
router.post('/', createTeamMember);
router.get('/activity/all', getTeamMemberAuditLogs);
router.get('/:id', getTeamMemberDetails);
router.put('/:id', updateTeamMember);
router.patch('/:id/status', toggleTeamMemberStatus);
router.post('/:id/reset-password', resetTeamMemberPassword);
router.delete('/:id', deleteTeamMember);

export default router;
