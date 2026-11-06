import express from 'express';
import * as ctrl from '../controllers/followupController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireFollowupPermission } from '../middleware/followupPermission.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', requireFollowupPermission('can_view'), ctrl.listFollowups);
router.post('/', requireFollowupPermission('can_create'), ctrl.createFollowup);
router.get('/permissions/me', requireFollowupPermission('can_view'), (req, res) => res.json({ success: true, data: req.followupPermissions }));
router.get('/history', requireFollowupPermission('can_view'), ctrl.getAllLogs);
router.get('/:id/export', requireFollowupPermission('can_export'), ctrl.exportCsv);
router.get('/:id/logs', requireFollowupPermission('can_view'), ctrl.getLogs);
router.get('/:id', requireFollowupPermission('can_view'), ctrl.getById);
router.put('/:id', requireFollowupPermission('can_edit'), ctrl.update);
router.patch('/:id/status', requireFollowupPermission('can_pause_resume'), ctrl.changeStatus);
router.delete('/:id', requireFollowupPermission('can_delete'), ctrl.softDelete);
router.post('/:id/recipients', requireFollowupPermission('can_edit'), ctrl.addRecipients);
router.delete('/:id/recipients/:recipientId', requireFollowupPermission('can_edit'), ctrl.removeRecipient);

export default router;
