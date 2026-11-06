export function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return false
  const cleaned = phone.replace(/[^0-9]/g, '')
  return cleaned.length >= 8 && cleaned.length <= 15
}

export function cleanPhoneNumber(phone) {
  if (!phone) return ''
  return String(phone).replace(/[^0-9]/g, '')
}

export function validateRequired(payload, requiredFields) {
  const missing = []
  for (const field of requiredFields) {
    if (payload[field] === undefined || payload[field] === null || String(payload[field]).trim() === '') {
      missing.push(field)
    }
  }
  return missing
}
