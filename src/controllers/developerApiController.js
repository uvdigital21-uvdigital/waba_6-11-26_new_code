import * as developerApiService from '../services/developerApiService.js'
import { validatePhoneNumber, validateRequired } from '../utils/developerApiValidation.js'

async function handleApiCall(req, res, handler, requiredFields = []) {
  try {
    if (requiredFields.length > 0) {
      const missing = validateRequired({ ...req.query, ...req.body }, requiredFields)
      if (missing.length > 0) {
        const errResp = {
          status: 'error',
          code: 400,
          message: `Missing required parameter(s): ${missing.join(', ')}`
        }
        if (req.logApiCall) await req.logApiCall(errResp, 400)
        return res.status(400).json(errResp)
      }
    }

    const result = await handler(req.user.id, { ...req.query, ...req.body }, req)
    const statusCode = result.code || 200
    if (req.logApiCall) await req.logApiCall(result, statusCode)
    return res.status(statusCode).json(result)
  } catch (err) {
    console.error(`[DeveloperApiController] Handler error:`, err)
    const errResp = {
      status: 'error',
      code: 500,
      message: err.message || 'Internal server error processing API request'
    }
    if (req.logApiCall) await req.logApiCall(errResp, 500)
    return res.status(500).json(errResp)
  }
}

// 1. Send Official WA API
export function sendOfficialWa(req, res) {
  return handleApiCall(req, res, developerApiService.sendOfficialWa, ['number'])
}

// 2. Send Official WA JSON API
export function sendOfficialWaJson(req, res) {
  return handleApiCall(req, res, developerApiService.sendOfficialWaJson)
}

// 3. Send Official WA OTP Template API
export function sendOtpTemplate(req, res) {
  return handleApiCall(req, res, developerApiService.sendOtpTemplate, ['number', 'otp'])
}

// 4. OfficialWA OTP Template JSON API
export function sendOtpTemplateJson(req, res) {
  return handleApiCall(req, res, developerApiService.sendOtpTemplateJson)
}

// 5. Send Official WA Group API
export function sendGroupWa(req, res) {
  return handleApiCall(req, res, developerApiService.sendGroupWa)
}

// 6. Official WA Group JSON API
export function sendGroupWaJson(req, res) {
  return handleApiCall(req, res, developerApiService.sendGroupWaJson)
}

// 7. Official WA Tag API
export function sendTagWa(req, res) {
  return handleApiCall(req, res, developerApiService.sendTagWa)
}

// 8. Send Official WA JSON API (Clevertap)
export function sendClevertapWa(req, res) {
  return handleApiCall(req, res, developerApiService.sendClevertapWa)
}

// 9. Generate OTP API
export function generateOtp(req, res) {
  return handleApiCall(req, res, developerApiService.generateOtp, ['number'])
}

// 10. Validate OTP API
export function validateOtp(req, res) {
  return handleApiCall(req, res, developerApiService.validateOtp, ['number', 'otp'])
}

// 11. Add WAAPI Number
export function addWaNumber(req, res) {
  return handleApiCall(req, res, developerApiService.addWaNumber, ['phone'])
}

// 12. Add WAAPI Number JSON API
export function addWaNumberJson(req, res) {
  return handleApiCall(req, res, developerApiService.addWaNumberJson)
}

// 13. Save WAFilter Number
export function saveWaFilter(req, res) {
  return handleApiCall(req, res, developerApiService.saveWaFilter)
}

// 14. Save WAFilter Number JSON API
export function saveWaFilterJson(req, res) {
  return handleApiCall(req, res, developerApiService.saveWaFilterJson)
}

// 15. Check WAFilter Numbers
export function checkWaFilter(req, res) {
  return handleApiCall(req, res, developerApiService.checkWaFilter)
}

// 16. WAPP API Cancel Scheduled Campaign
export function cancelCampaign(req, res) {
  return handleApiCall(req, res, developerApiService.cancelCampaign, ['campaign_id'])
}

// 17. WAPP API Report (By Campaign)
export function reportByCampaign(req, res) {
  return handleApiCall(req, res, developerApiService.reportByCampaign)
}

// 18. WAPP API Report (By Template)
export function reportByTemplate(req, res) {
  return handleApiCall(req, res, developerApiService.reportByTemplate)
}

// 19. WAPP API Report (By Mobile)
export function reportByMobile(req, res) {
  return handleApiCall(req, res, developerApiService.reportByMobile)
}

// 20. WAPP API Summary Report
export function reportSummary(req, res) {
  return handleApiCall(req, res, developerApiService.reportSummary)
}

// 21. WAPP API Incoming Report (By Date)
export function reportIncomingByDate(req, res) {
  return handleApiCall(req, res, developerApiService.reportIncomingByDate)
}
