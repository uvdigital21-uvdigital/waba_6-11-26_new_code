// Rate limiter for Developer API calls based on API Key / User ID
const rateLimitMap = new Map()

export function developerRateLimiter(options = { windowMs: 60000, max: 120 }) {
  return (req, res, next) => {
    const key = req.apiKey || req.ip || 'anonymous'
    const now = Date.now()

    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, { count: 1, resetTime: now + options.windowMs })
      return next()
    }

    const clientRecord = rateLimitMap.get(key)

    if (now > clientRecord.resetTime) {
      clientRecord.count = 1
      clientRecord.resetTime = now + options.windowMs
      return next()
    }

    clientRecord.count += 1

    if (clientRecord.count > options.max) {
      const retryAfter = Math.ceil((clientRecord.resetTime - now) / 1000)
      res.setHeader('Retry-After', retryAfter)
      return res.status(429).json({
        status: 'error',
        code: 429,
        message: `Rate limit exceeded. Too many requests. Please try again in ${retryAfter} seconds.`
      })
    }

    next()
  }
}
