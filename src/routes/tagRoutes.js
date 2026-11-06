import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    assignTagsToChat,
    createTag,
    createTagAndAssign,
    deleteTag,
    getAllTags,
    getChatTags,
    getTagChats,
    getTagContacts,
    getTagsByPhone,
    removeTagFromChat,
    unassignTag,
    updateTag,
} from '../controllers/tagController.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', getAllTags);
router.post('/', createTag);
router.put('/:id', updateTag);
router.delete('/:id', deleteTag);
router.get('/contact/:phone', getTagsByPhone);
router.get('/:id/chats', getTagChats);
router.get('/:id/contacts', getTagContacts);
router.post('/assign', createTagAndAssign);
router.delete('/unassign', unassignTag);
router.get('/chats/:chatId/tags', getChatTags);
router.post('/chats/:chatId/tags', assignTagsToChat);
router.delete('/chats/:chatId/tags/:tagId', removeTagFromChat);

export default router;

