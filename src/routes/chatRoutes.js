import express from 'express'
import { getConversations, getMessages, getMessageMedia, sendMessage, startConversation, markAsRead, deleteConversation } from '../controllers/chatController.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// All chat routes require authentication
router.use(requireAuth)

// Get all conversations for authenticated organization
router.get('/conversations', getConversations)

// Start a new conversation
router.post('/start', startConversation)

// Get messages for a specific conversation (IDOR Protected)
router.get('/messages/:conversationId', getMessages)

// Authenticated, account-scoped proxy for expiring Meta media URLs
router.get('/media/:messageId', getMessageMedia)

// Mark conversation as read
router.post('/conversations/:id/read', markAsRead)

// Delete an entire conversation
router.delete('/conversations/:id', deleteConversation)

// Send an outbound reply message
router.post('/send', sendMessage)

export default router
