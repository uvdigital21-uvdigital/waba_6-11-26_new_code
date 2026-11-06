import * as apiKeyService from '../services/apiKeyService.js'

export async function listKeys(req, res) {
  try {
    const keys = await apiKeyService.getUserApiKeys(req.user.id)
    return res.json({
      success: true,
      data: keys
    })
  } catch (err) {
    console.error('[ApiKeyController] listKeys error:', err)
    return res.status(500).json({ success: false, message: 'Failed to fetch API keys' })
  }
}

export async function createKey(req, res) {
  try {
    const newKey = await apiKeyService.generateApiKey(req.user.id)
    return res.status(201).json({
      success: true,
      message: 'API Key generated successfully',
      data: newKey
    })
  } catch (err) {
    console.error('[ApiKeyController] createKey error:', err)
    return res.status(500).json({ success: false, message: 'Failed to generate API key' })
  }
}

export async function removeKey(req, res) {
  try {
    const keyId = req.params.id
    const success = await apiKeyService.deleteApiKey(req.user.id, keyId)
    if (!success) {
      return res.status(404).json({ success: false, message: 'API key not found or already deleted' })
    }
    return res.json({
      success: true,
      message: 'API Key deleted successfully'
    })
  } catch (err) {
    console.error('[ApiKeyController] removeKey error:', err)
    return res.status(500).json({ success: false, message: 'Failed to delete API key' })
  }
}
