import express from 'express';
import {
  connectWhatsAppAccount,
  listWhatsAppAccounts,
  deleteWhatsAppAccount,
  updateAssignedModules,
  updateAccountToken,
  updateAccountStatus,
  fetchMetaAccountInfo,
  getAccountNotifications,
  markNotificationsRead
} from '../controllers/whatsappAccountController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.post('/connect', connectWhatsAppAccount);
router.post('/', connectWhatsAppAccount);
router.get('/list', listWhatsAppAccounts);
router.get('/', listWhatsAppAccounts);
router.put('/:id/token', updateAccountToken);
router.put('/:id/assigned-modules', updateAssignedModules);
router.patch('/:id/status', updateAccountStatus);
router.post('/:id/fetch', fetchMetaAccountInfo);
router.get('/:id/notifications', getAccountNotifications);
router.post('/:id/notifications/read-all', markNotificationsRead);
router.delete('/:id', deleteWhatsAppAccount);

export default router;
