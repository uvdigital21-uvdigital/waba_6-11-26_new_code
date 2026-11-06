import { pool } from '../config/db.js'
import jwt from 'jsonwebtoken'

export async function validateApiKey(req, res, next) {
  const startTime = Date.now()
  req.startTime = startTime

  // Extract API key from headers, query parameters, or body
  let apiKey = req.headers['x-api-key']
  
  if (!apiKey && req.headers.authorization) {
    const auth = req.headers.authorization.trim()
    if (auth.toLowerCase().startsWith('bearer ')) {
      apiKey = auth.slice(7).trim()
    } else {
      apiKey = auth
    }
  }

  if (!apiKey) {
    apiKey = req.query?.apikey || req.query?.api_key || req.query?.key || req.body?.api_key || req.body?.apikey
  }

  if (!apiKey) {
    return res.status(401).json({
      status: 'error',
      code: 401,
      message: 'Unauthorized. API Key is missing. Please provide x-api-key header or apikey query parameter.'
    })
  }

  try {
    // 1. Try matching against api_keys table
    const [rows] = await pool.query(
      `SELECT id, user_id, api_key, status FROM api_keys WHERE api_key = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
      [apiKey]
    )

    if (rows.length > 0) {
      const keyData = rows[0]

      // Update last_used_at timestamp
      pool.query(`UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?`, [keyData.id]).catch((err) => {
        console.error('[APIKeyAuth] Failed to update last_used_at:', err.message)
      })

      req.user = { id: keyData.user_id }
      req.apiKey = keyData.api_key
      req.apiKeyId = keyData.id
    } else {
      // 2. Try verifying as JWT session token (for Playground / Dashboard testing)
      try {
        const payload = jwt.verify(apiKey, process.env.JWT_SECRET || 'your-secret-key')
        req.user = { id: payload.id || payload.userId || 1 }
        req.apiKey = 'SESSION_JWT'
      } catch (jwtErr) {
        return res.status(401).json({
          status: 'error',
          code: 401,
          message: 'Unauthorized. Invalid or inactive API Key.'
        })
      }
    }

    // Attach logging helper
    req.logApiCall = async (responseBody, statusCode = 200) => {
      try {
        const executionTime = Date.now() - req.startTime
        const reqPayload = JSON.stringify({
          query: req.query,
          body: req.body
        })
        const resPayload = typeof responseBody === 'object' ? JSON.stringify(responseBody) : String(responseBody)

        await pool.query(
          `INSERT INTO api_logs (user_id, api_key, endpoint, request, response, status_code, execution_time) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [req.user.id, req.apiKey, req.originalUrl || req.url, reqPayload, resPayload, statusCode, executionTime]
        )
      } catch (logErr) {
        console.error('[APIKeyAuth] Failed to write api_log:', logErr.message)
      }
    }

    next()
  } catch (err) {
    console.error('[APIKeyAuth] DB validation error:', err)
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Internal server error validating API Key.'
    })
  }
}
