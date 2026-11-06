import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
    getTemplates,
    getTemplateById,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    fetchFromFacebook,
    getTemplateStats
} from '../controllers/templateController.js'
import { createMetaTemplate, syncMetaTemplateStatuses } from '../controllers/whatsappTemplateController.js'

import multer from 'multer'

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }
})

const router = Router()

// All routes require authentication
router.use(requireAuth)

router.get('/', getTemplates)
router.get('/stats', getTemplateStats)
router.get('/sync', syncMetaTemplateStatuses)
router.post('/meta-create', upload.single('mediaFile'), createMetaTemplate)
router.get('/:id', getTemplateById)
router.post('/', upload.single('mediaFile'), createMetaTemplate) // Default POST submits directly to Meta API
router.put('/:id', updateTemplate)
router.delete('/:id', deleteTemplate)
router.post('/fetch-facebook', fetchFromFacebook)

export default router
