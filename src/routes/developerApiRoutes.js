import express from 'express'
import { requireAuth } from '../middleware/auth.js'
import { validateApiKey } from '../middleware/apiKeyAuth.js'
import { developerRateLimiter } from '../middleware/developerRateLimiter.js'
import * as apiKeyController from '../controllers/apiKeyController.js'
import * as developerApiController from '../controllers/developerApiController.js'

const router = express.Router()

// ── API Key Management Routes (Protected by UI User Session Auth) ────────────
router.get('/developer/keys', requireAuth, apiKeyController.listKeys)
router.post('/developer/keys', requireAuth, apiKeyController.createKey)
router.delete('/developer/keys/:id', requireAuth, apiKeyController.removeKey)

// ── 21 Developer REST API Endpoints (Protected by API Key Validation & Rate Limiter) ──
const apiAuth = [validateApiKey, developerRateLimiter()]

// 1. Send Official WA API
router.post('/v1/developer/send-official-wa', ...apiAuth, developerApiController.sendOfficialWa)

// 2. Send Official WA JSON API
router.post('/v1/developer/send-official-wa-json', ...apiAuth, developerApiController.sendOfficialWaJson)

// 3. Send Official WA OTP Template API
router.post('/v1/developer/send-otp-template', ...apiAuth, developerApiController.sendOtpTemplate)

// 4. OfficialWA OTP Template JSON API
router.post('/v1/developer/send-otp-template-json', ...apiAuth, developerApiController.sendOtpTemplateJson)

// 5. Send Official WA Group API
router.post('/v1/developer/send-group-wa', ...apiAuth, developerApiController.sendGroupWa)

// 6. Official WA Group JSON API
router.post('/v1/developer/send-group-wa-json', ...apiAuth, developerApiController.sendGroupWaJson)

// 7. Official WA Tag API
router.post('/v1/developer/send-tag-wa', ...apiAuth, developerApiController.sendTagWa)

// 8. Send Official WA JSON API (Clevertap)
router.post('/v1/developer/clevertap/send-wa', ...apiAuth, developerApiController.sendClevertapWa)

// 9. Generate OTP API
router.post('/v1/developer/otp/generate', ...apiAuth, developerApiController.generateOtp)

// 10. Validate OTP API
router.post('/v1/developer/otp/validate', ...apiAuth, developerApiController.validateOtp)

// 11. Add WAAPI Number
router.post('/v1/developer/wa-number/add', ...apiAuth, developerApiController.addWaNumber)

// 12. Add WAAPI Number JSON API
router.post('/v1/developer/wa-number/add-json', ...apiAuth, developerApiController.addWaNumberJson)

// 13. Save WAFilter Number
router.post('/v1/developer/wafilter/save', ...apiAuth, developerApiController.saveWaFilter)

// 14. Save WAFilter Number JSON API
router.post('/v1/developer/wafilter/save-json', ...apiAuth, developerApiController.saveWaFilterJson)

// 15. Check WAFilter Numbers
router.post('/v1/developer/wafilter/check', ...apiAuth, developerApiController.checkWaFilter)

// 16. WAPP API Cancel Scheduled Campaign
router.post('/v1/developer/campaign/cancel', ...apiAuth, developerApiController.cancelCampaign)

// 17. WAPP API Report (By Campaign)
router.get('/v1/developer/reports/by-campaign', ...apiAuth, developerApiController.reportByCampaign)

// 18. WAPP API Report (By Template)
router.get('/v1/developer/reports/by-template', ...apiAuth, developerApiController.reportByTemplate)

// 19. WAPP API Report (By Mobile)
router.get('/v1/developer/reports/by-mobile', ...apiAuth, developerApiController.reportByMobile)

// 20. WAPP API Summary Report
router.get('/v1/developer/reports/summary', ...apiAuth, developerApiController.reportSummary)

// 21. WAPP API Incoming Report (By Date)
router.get('/v1/developer/reports/incoming-by-date', ...apiAuth, developerApiController.reportIncomingByDate)

export default router
