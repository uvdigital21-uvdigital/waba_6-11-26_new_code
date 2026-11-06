import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getDashboard, getMessageStats } from '../controllers/dashboardController.js'

const router = Router()

router.get('/', requireAuth, getDashboard)
router.get('/message-stats', requireAuth, getMessageStats)

export default router