import { pool } from '../config/db.js';

const normalizeTagName = (value) => String(value || '').trim();
const normalizeTagColor = (value) => String(value || '').trim() || '#4d8ef0';

export const createTag = async (req, res) => {
    try {
        const name = normalizeTagName(req.body.name || req.body.tag_name);
        const color = normalizeTagColor(req.body.color);
        const orgId = req.organizationId || req.user?.organization_id || 1;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Tag name is required.' });
        }

        const [existingTags] = await pool.execute(
            'SELECT id, name, color FROM tags WHERE LOWER(name) = LOWER(?) AND (organization_id = ? OR organization_id IS NULL)',
            [name, orgId]
        );

        if (existingTags.length > 0) {
            return res.status(409).json({ success: false, message: 'A tag with this name already exists in your organization.' });
        }

        const [result] = await pool.execute(
            'INSERT INTO tags (organization_id, name, color, created_at) VALUES (?, ?, ?, NOW())',
            [orgId, name, color]
        );

        const [rows] = await pool.execute(
            'SELECT id, organization_id, name, color, created_at FROM tags WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json({ success: true, message: 'Tag created successfully.', tag: rows[0] });
    } catch (error) {
        console.error('Error in createTag:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const updateTag = async (req, res) => {
    try {
        const { id } = req.params;
        const name = normalizeTagName(req.body.name || req.body.tag_name);
        const color = normalizeTagColor(req.body.color);
        const orgId = req.organizationId || req.user?.organization_id || 1;

        if (!id || !name) {
            return res.status(400).json({ success: false, message: 'Tag ID and name are required.' });
        }

        const [existingTags] = await pool.execute(
            'SELECT id FROM tags WHERE LOWER(name) = LOWER(?) AND id != ? AND (organization_id = ? OR organization_id IS NULL)',
            [name, id, orgId]
        );

        if (existingTags.length > 0) {
            return res.status(409).json({ success: false, message: 'A tag with this name already exists in your organization.' });
        }

        await pool.execute(
            'UPDATE tags SET name = ?, color = ? WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)',
            [name, color, id, orgId]
        );

        const [rows] = await pool.execute(
            'SELECT id, organization_id, name, color, created_at FROM tags WHERE id = ?',
            [id]
        );

        res.json({ success: true, message: 'Tag updated successfully.', tag: rows[0] });
    } catch (error) {
        console.error('Error in updateTag:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const deleteTag = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.organizationId || req.user?.organization_id || 1;
        if (!id) {
            return res.status(400).json({ success: false, message: 'Tag ID is required.' });
        }

        await pool.execute('DELETE FROM chat_tags WHERE tag_id = ?', [id]);
        await pool.execute('DELETE FROM contact_tags WHERE tag_id = ?', [id]);
        await pool.execute('DELETE FROM tags WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)', [id, orgId]);
        res.json({ success: true, message: 'Tag deleted successfully.' });
    } catch (error) {
        console.error('Error in deleteTag:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const createTagAndAssign = async (req, res) => {
    try {
        const { name, color, phone, tagId: bodyTagId } = req.body;
        const orgId = req.organizationId || req.user?.organization_id || 1;

        if (!phone || (!name && !bodyTagId)) {
            return res.status(400).json({ success: false, message: 'Tag name (or tagId) and phone number are required.' });
        }

        let tagId = bodyTagId || null;
        let tagRow = null;

        if (tagId) {
            const [rows] = await pool.execute('SELECT id, organization_id, name, color FROM tags WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)', [tagId, orgId]);
            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Tag not found.' });
            }
            tagRow = rows[0];
            tagId = tagRow.id;
        } else {
            const [existingTags] = await pool.execute(
                'SELECT id, organization_id, name, color FROM tags WHERE LOWER(name) = LOWER(?) AND (organization_id = ? OR organization_id IS NULL)',
                [name, orgId]
            );

            if (existingTags.length > 0) {
                tagRow = existingTags[0];
                tagId = tagRow.id;
            } else {
                const [result] = await pool.execute(
                    'INSERT INTO tags (organization_id, name, color, created_at) VALUES (?, ?, ?, NOW())',
                    [orgId, name, color || '#4d8ef0']
                );
                tagId = result.insertId;
                tagRow = { id: tagId, organization_id: orgId, name, color: color || '#4d8ef0' };
            }
        }

        try {
            await pool.execute(
                'INSERT IGNORE INTO contact_tags (phone, tag_id) VALUES (?, ?)',
                [phone, tagId]
            );
        } catch (err) {
            console.error('Error assigning tag to contact:', err);
        }

        res.json({
            success: true,
            message: 'Tag assigned successfully.',
            tagId,
            tag: tagRow,
        });
    } catch (error) {
        console.error('Error in createTagAndAssign:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

/**
 * GET /api/tags/contact/:phone
 * Returns all tags assigned to a phone number for the active organization.
 */
export const getTagsByPhone = async (req, res) => {
    try {
        const { phone } = req.params;
        const orgId = req.organizationId || req.user?.organization_id || 1;
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Phone number is required.' });
        }

        const phoneDigits = String(phone).replace(/\D/g, '');
        const phone10 = phoneDigits.slice(-10);

        const [tags] = await pool.execute(
            `SELECT t.id, t.organization_id, t.name, t.color, t.created_at
             FROM tags t
             INNER JOIN contact_tags ct ON ct.tag_id = t.id
             WHERE (ct.phone = ? OR ct.phone = ? OR RIGHT(REPLACE(REPLACE(ct.phone, '+', ''), ' ', ''), 10) = ?)
               AND (t.organization_id = ? OR t.organization_id IS NULL)
             ORDER BY t.name ASC`,
            [phone, phoneDigits, phone10 || phoneDigits, orgId]
        );

        res.json({ success: true, tags });
    } catch (error) {
        console.error('Error in getTagsByPhone:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

/**
 * DELETE /api/tags/unassign
 * Removes a tag assignment from a contact.
 */
export const unassignTag = async (req, res) => {
    try {
        const { phone, tagId } = req.body;
        if (!phone || !tagId) {
            return res.status(400).json({ success: false, message: 'Phone and tagId are required.' });
        }

        const phoneDigits = String(phone).replace(/\D/g, '');
        const phone10 = phoneDigits.slice(-10);

        await pool.execute(
            `DELETE FROM contact_tags
             WHERE tag_id = ?
               AND (
                 phone = ?
                 OR phone = ?
                 OR RIGHT(REPLACE(REPLACE(phone, '+', ''), ' ', ''), 10) = ?
               )`,
            [tagId, phone, phoneDigits, phone10 || phoneDigits]
        );

        res.json({ success: true, message: 'Tag removed successfully.' });
    } catch (error) {
        console.error('Error in unassignTag:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const getAllTags = async (req, res) => {
    try {
        const orgId = req.organizationId || req.user?.organization_id || 1;

        const [tags] = await pool.execute(`
            SELECT t.id,
                   t.organization_id,
                   t.name,
                   t.color,
                   t.created_at,
                   t.updated_at,
                   COALESCE(counts.contact_count, 0) AS contactCount
            FROM tags t
            LEFT JOIN (
                SELECT tag_id, COUNT(DISTINCT entity_key) AS contact_count
                FROM (
                    SELECT ct.tag_id,
                           COALESCE(c.contact_phone, ct.chat_id) AS entity_key
                    FROM chat_tags ct
                    LEFT JOIN conversations c ON (c.id = ct.chat_id OR c.contact_phone = ct.chat_id)
                    UNION ALL
                    SELECT cnt.tag_id,
                           cnt.phone AS entity_key
                    FROM contact_tags cnt
                ) combined_tags
                WHERE TRIM(COALESCE(entity_key, '')) <> ''
                GROUP BY tag_id
            ) counts ON counts.tag_id = t.id
            WHERE t.organization_id = ?
            ORDER BY t.name ASC
        `, [orgId]);

        const normalizedTags = tags.map((tag) => ({
            ...tag,
            id: tag.id,
            name: tag.name,
            tagName: tag.name,
            tag_name: tag.name,
            color: tag.color,
            tagColor: tag.color,
            tag_color: tag.color,
            contactCount: Number(tag.contactCount || 0),
            contact_count: Number(tag.contactCount || 0),
            total_numbers: Number(tag.contactCount || 0),
            created_at: tag.created_at,
            updated_at: tag.updated_at,
        }));

        res.json({ success: true, tags: normalizedTags, total: normalizedTags.length, totalPages: 1 });
    } catch (error) {
        console.error('Error in getAllTags:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const getChatTags = async (req, res) => {
    try {
        const { chatId } = req.params;
        const orgId = req.organizationId || req.user?.organization_id || 1;

        if (!chatId) {
            return res.status(400).json({ success: false, message: 'Chat ID is required.' });
        }

        const [rows] = await pool.execute(
            `SELECT t.id, t.organization_id, t.name, t.color, t.created_at
             FROM tags t
             INNER JOIN chat_tags ct ON ct.tag_id = t.id
             WHERE ct.chat_id = ?
               AND (t.organization_id = ? OR t.organization_id IS NULL)
             ORDER BY t.name ASC`,
            [chatId, orgId]
        );

        res.json({ success: true, tags: rows });
    } catch (error) {
        console.error('Error in getChatTags:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const assignTagsToChat = async (req, res) => {
    try {
        const { chatId } = req.params;
        const tagIds = Array.isArray(req.body.tagIds)
            ? req.body.tagIds
            : Array.isArray(req.body.tags)
                ? req.body.tags
                : [];

        if (!chatId || tagIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Chat ID and at least one tag ID are required.' });
        }

        const values = tagIds.filter(Boolean).map((tagId) => [chatId, Number(tagId)]);
        if (values.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one valid tag ID is required.' });
        }

        const placeholders = values.map(() => '(?, ?)').join(', ');
        await pool.execute(`INSERT IGNORE INTO chat_tags (chat_id, tag_id) VALUES ${placeholders}`, values.flat());

        res.json({ success: true, message: 'Tags assigned to chat successfully.' });
    } catch (error) {
        console.error('Error in assignTagsToChat:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const removeTagFromChat = async (req, res) => {
    try {
        const { chatId, tagId } = req.params;
        if (!chatId || !tagId) {
            return res.status(400).json({ success: false, message: 'Chat ID and tag ID are required.' });
        }

        await pool.execute('DELETE FROM chat_tags WHERE chat_id = ? AND tag_id = ?', [chatId, tagId]);
        res.json({ success: true, message: 'Tag removed from chat successfully.' });
    } catch (error) {
        console.error('Error in removeTagFromChat:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

/**
 * GET /api/tags/:id/chats
 * Returns chats and contacts assigned to the selected tag for the current organization.
 */
export const getTagChats = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.organizationId || req.user?.organization_id || 1;

        if (!id) {
            return res.status(400).json({ success: false, message: 'Tag ID is required.' });
        }

        const [tagRows] = await pool.execute(
            'SELECT id, organization_id, name, color FROM tags WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)',
            [id, orgId]
        );

        if (tagRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Tag not found.' });
        }

        const [chatRows] = await pool.execute(
            `SELECT ct.chat_id AS id, COALESCE(c.contact_name, CONCAT('Chat ', ct.chat_id)) AS name, COALESCE(c.contact_phone, ct.chat_id) AS phone
             FROM chat_tags ct
             LEFT JOIN conversations c ON (c.id = ct.chat_id OR c.contact_phone = ct.chat_id)
             WHERE ct.tag_id = ?
             ORDER BY c.contact_name ASC, c.contact_phone ASC`,
            [id]
        );

        const normalizedChats = chatRows.map((row) => ({
            id: row.id,
            name: row.name || `Chat ${row.id}`,
            phone: row.phone || null,
            source: 'chat',
        }));

        const [contactRows] = await pool.execute(
            `SELECT ct.phone AS phone
             FROM contact_tags ct
             WHERE ct.tag_id = ?
             ORDER BY ct.phone ASC`,
            [id]
        );

        const normalizedContacts = contactRows.map((row) => ({
            id: null,
            name: row.phone || 'Contact',
            phone: row.phone || null,
            source: 'contact',
        }));

        const combined = [...normalizedChats, ...normalizedContacts];

        res.json({
            success: true,
            tag: tagRows[0],
            total: combined.length,
            chats: combined,
        });
    } catch (error) {
        console.error('Error in getTagChats:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

/**
 * GET /api/tags/:id/contacts
 * Returns total count and phone numbers for a selected tag for the current organization.
 */
export const getTagContacts = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.organizationId || req.user?.organization_id || 1;

        if (!id) {
            return res.status(400).json({ success: false, message: 'Tag ID is required.' });
        }

        const [tagRows] = await pool.execute(
            'SELECT id, organization_id, name, color FROM tags WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)',
            [id, orgId]
        );

        if (tagRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Tag not found.' });
        }

        const [chatRows] = await pool.execute(
            `SELECT ct.chat_id AS chatId, COALESCE(c.contact_name, CONCAT('Chat ', ct.chat_id)) AS contactName, COALESCE(c.contact_phone, ct.chat_id) AS phoneNumber
             FROM chat_tags ct
             LEFT JOIN conversations c ON (c.id = ct.chat_id OR c.contact_phone = ct.chat_id)
             WHERE ct.tag_id = ?
             ORDER BY c.contact_name ASC, c.contact_phone ASC`,
            [id]
        );

        const [contactRows] = await pool.execute(
            `SELECT ct.phone AS phoneNumber
             FROM contact_tags ct
             WHERE ct.tag_id = ?
             ORDER BY ct.phone ASC`,
            [id]
        );

        const contacts = [
            ...chatRows
                .filter((row) => row.phoneNumber || row.contactName)
                .map((row) => ({
                    chatId: row.chatId || null,
                    contactName: row.contactName || `Chat ${row.chatId}`,
                    phoneNumber: String(row.phoneNumber || '').trim(),
                    source: 'chat',
                })),
            ...contactRows
                .filter((row) => row.phoneNumber)
                .map((row) => ({
                    chatId: null,
                    contactName: String(row.phoneNumber || '').trim(),
                    phoneNumber: String(row.phoneNumber || '').trim(),
                    source: 'contact',
                })),
        ];

        const numbers = [...new Set(contacts.map((item) => item.phoneNumber).filter(Boolean))];

        res.json({
            success: true,
            tag: tagRows[0],
            total: contacts.length,
            contacts,
            numbers,
        });
    } catch (error) {
        console.error('Error in getTagContacts:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};
