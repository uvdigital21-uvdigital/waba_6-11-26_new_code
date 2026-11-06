import express from 'express';
import { createOrganization, getOrganizations } from '../controllers/organizationController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);
router.post('/', createOrganization);
router.get('/', getOrganizations);

export default router;
