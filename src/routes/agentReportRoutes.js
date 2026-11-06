import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getAgentReports,
  getAgentReportById,
  getAgentReportsSummary,
  exportAgentReports,
  resendAgentReportMessage
} from '../controllers/agentReportController.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getAgentReports);
router.get('/filter', getAgentReports);
router.get('/summary', getAgentReportsSummary);
router.get('/export', exportAgentReports);
router.post('/resend', resendAgentReportMessage);
router.get('/:id', getAgentReportById);

export default router;
