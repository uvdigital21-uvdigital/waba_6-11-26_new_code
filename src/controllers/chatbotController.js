import { pool } from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * Validate & Auto-Deduplicate Flow Name
 */
async function validateFlowName(name, excludeId = null, companyId = null) {
  if (!name || typeof name !== 'string') {
    return { valid: false, message: 'Flow name is required' };
  }
  let trimmed = name.trim();
  if (trimmed.length < 3) {
    return { valid: false, message: 'Flow name must be at least 3 characters long.' };
  }
  if (trimmed.length > 100) {
    return { valid: false, message: 'Flow name must not exceed 100 characters.' };
  }

  // If default system name "New Chatbot Flow" is submitted, auto-number it if a collision exists
  if (trimmed.toLowerCase().startsWith('new chatbot flow')) {
    let candidateName = trimmed;
    let counter = 1;
    while (true) {
      let sql = 'SELECT id FROM chatbot_flows WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))';
      const params = [candidateName];
      if (companyId) {
        sql += ' AND company_id = ?';
        params.push(companyId);
      }
      if (excludeId) {
        sql += ' AND id != ?';
        params.push(excludeId);
      }
      const [existing] = await pool.execute(sql, params);
      if (existing.length === 0) {
        trimmed = candidateName;
        break;
      }
      counter++;
      candidateName = `New Chatbot Flow ${counter}`;
    }
    return { valid: true, name: trimmed };
  }

  let sql = 'SELECT id FROM chatbot_flows WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))';
  const params = [trimmed];
  if (companyId) {
    sql += ' AND company_id = ?';
    params.push(companyId);
  }
  if (excludeId) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }

  const [existing] = await pool.execute(sql, params);
  if (existing.length > 0) {
    return { valid: false, message: `Flow name "${trimmed}" already exists.` };
  }

  return { valid: true, name: trimmed };
}

/**
 * GET /api/chatbot/flows
 * Fetch all chatbot flows sorted by newest updated_at DESC
 */
export const getFlows = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user?.role === 'Super Admin';
    const organizationId = req.organizationId || req.user?.organization_id;

    let sql = `
      SELECT 
        f.id,
        f.company_id,
        f.whatsapp_account_id,
        f.name,
        f.description,
        f.status,
        f.priority,
        f.execution_count,
        f.last_executed_at,
        f.created_at,
        f.updated_at,
        (SELECT COUNT(*) FROM chatbot_nodes n WHERE n.flow_id = f.id) AS nodeCount,
        (SELECT GROUP_CONCAT(DISTINCT k.keyword SEPARATOR ', ') FROM chatbot_keywords k WHERE k.flow_id = f.id) AS keywordsStr,
        o.organization_name,
        wa.display_phone_number AS wa_display_phone,
        wa.business_name AS wa_business_name,
        wa.verified_name AS wa_verified_name
      FROM chatbot_flows f
      LEFT JOIN organizations o ON o.id = f.company_id
      LEFT JOIN whatsapp_accounts wa ON wa.id = f.whatsapp_account_id
    `;
    const params = [];

    if (!isSuperAdmin && organizationId) {
      sql += ` WHERE f.company_id = ?`;
      params.push(organizationId);
    } else if (req.query.company_id || req.query.organization_id) {
      sql += ` WHERE f.company_id = ?`;
      params.push(req.query.company_id || req.query.organization_id);
    }

    sql += ` ORDER BY f.updated_at DESC`;

    const [rows] = await pool.execute(sql, params);

    res.json({
      success: true,
      isSuperAdmin,
      flows: rows.map(r => ({
        ...r,
        status: r.status || 'active',
        priority: Number(r.priority || 1),
        execution_count: Number(r.execution_count || 0),
        keywords: r.keywordsStr ? r.keywordsStr.split(', ').filter(Boolean) : [],
        organization_name: r.organization_name || null,
        wa_display_phone: r.wa_display_phone || null,
        wa_business_name: r.wa_business_name || r.wa_verified_name || null
      }))
    });
  } catch (err) {
    next(err);
  }
};


/**
 * GET /api/chatbot/flow/:id
 * Fetch complete flow with nodes, edges, keywords
 */
export const getFlowById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [flowRows] = await pool.execute(
      `SELECT * FROM chatbot_flows WHERE id = ?`,
      [id]
    );

    if (flowRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Chatbot Flow not found' });
    }

    const flow = flowRows[0];

    const [nodeRows] = await pool.execute(
      `SELECT node_id AS id, type, data, position_x AS positionX, position_y AS positionY 
       FROM chatbot_nodes WHERE flow_id = ?`,
      [id]
    );

    const [edgeRows] = await pool.execute(
      `SELECT id, source, target, source_handle AS sourceHandle, target_handle AS targetHandle 
       FROM chatbot_edges WHERE flow_id = ?`,
      [id]
    );

    const [keywordRows] = await pool.execute(
      `SELECT keyword FROM chatbot_keywords WHERE flow_id = ?`,
      [id]
    );

    const nodes = nodeRows.map(n => ({
      id: n.id,
      type: n.type,
      position: { x: Number(n.positionX || 0), y: Number(n.positionY || 0) },
      data: typeof n.data === 'string' ? JSON.parse(n.data) : (n.data || {})
    }));

    const edges = edgeRows.map(e => ({
      id: String(e.id),
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || null,
      targetHandle: e.targetHandle || null
    }));

    const keywords = keywordRows.map(k => k.keyword);

    res.json({
      success: true,
      flow: {
        ...flow,
        status: flow.status || 'active',
        priority: Number(flow.priority || 1),
        execution_count: Number(flow.execution_count || 0),
        nodes,
        edges,
        keywords
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/chatbot/flow
 * Create a new flow with unique name validation and default status = 'active'
 */
export const createFlow = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const orgId = req.organizationId || req.user?.organization_id;
    const { name, description, companyId = (orgId || 1), nodes = [], edges = [], keywords = [], priority = 1, status = 'active', whatsapp_account_id, whatsappAccountId } = req.body;
    const targetCompanyId = orgId || companyId || 1;

    let targetAccountId = whatsapp_account_id || whatsappAccountId || null;
    if (!targetAccountId && targetCompanyId) {
      const [accs] = await connection.query('SELECT id FROM whatsapp_accounts WHERE organization_id = ? ORDER BY id DESC LIMIT 1', [targetCompanyId]);
      if (accs.length > 0) targetAccountId = accs[0].id;
    }

    const validation = await validateFlowName(name || 'New Chatbot Flow', null, targetCompanyId);
    if (!validation.valid) {
      // connection is released in finally
      return res.status(400).json({ success: false, message: validation.message });
    }

    const flowName = validation.name;
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO chatbot_flows (company_id, whatsapp_account_id, name, description, status, priority, execution_count, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
      [targetCompanyId, targetAccountId, flowName, description || null, status === 'inactive' ? 'inactive' : 'active', Number(priority) || 1]
    );

    const flowId = result.insertId;

    // Process provided nodes or default starting keyword node
    const finalNodes = Array.isArray(nodes) && nodes.length > 0 ? nodes : [
      {
        id: 'node_start_1',
        type: 'starting_keyword',
        position: { x: 250, y: 100 },
        data: { keywords: Array.isArray(keywords) ? keywords : [], description: 'Trigger flow on matching keyword' }
      }
    ];

    for (const n of finalNodes) {
      const posX = n.position?.x ?? 250;
      const posY = n.position?.y ?? 100;
      const dataJson = JSON.stringify(n.data || {});

      await connection.execute(
        `INSERT INTO chatbot_nodes (flow_id, node_id, type, data, position_x, position_y) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [flowId, n.id, n.type || 'text_reply', dataJson, posX, posY]
      );
    }

    // Collect flow keywords exclusively from starting_keyword nodes (or fallback if empty)
    const flowKeywordsSet = new Set();
    for (const n of finalNodes) {
      if (n.type === 'starting_keyword' && Array.isArray(n.data?.keywords)) {
        for (const kw of n.data.keywords) {
          if (kw && typeof kw === 'string' && kw.trim()) {
            flowKeywordsSet.add(kw.trim().toLowerCase());
          }
        }
      }
    }

    if (flowKeywordsSet.size === 0 && Array.isArray(keywords)) {
      for (const kw of keywords) {
        if (kw && typeof kw === 'string' && kw.trim()) {
          flowKeywordsSet.add(kw.trim().toLowerCase());
        }
      }
    }

    for (const kw of flowKeywordsSet) {
      await connection.execute(
        `INSERT IGNORE INTO chatbot_keywords (flow_id, keyword) VALUES (?, ?)`,
        [flowId, kw]
      );
    }

    if (Array.isArray(edges)) {
      for (const e of edges) {
        await connection.execute(
          `INSERT INTO chatbot_edges (flow_id, source, target, source_handle, target_handle) 
           VALUES (?, ?, ?, ?, ?)`,
          [flowId, e.source, e.target, e.sourceHandle || null, e.targetHandle || null]
        );
      }
    }

    await connection.commit();
    logger.info(`[CHATBOT] Created flow ID ${flowId} ("${flowName}") with ${finalNodes.length} nodes for company ${targetCompanyId}, account ${targetAccountId}`);

    res.status(201).json({
      success: true,
      message: 'Chatbot Flow created successfully',
      flowId,
      flowName
    });
  } catch (err) {
    try { await connection.rollback(); } catch (_) { }
    next(err);
  } finally {
    connection.release();
  }
};

/**
 * PUT /api/chatbot/flow/:id
 * Save complete flow canvas (nodes, edges, keywords, name, priority, status)
 */
export const updateFlow = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const orgId = req.organizationId || req.user?.organization_id;
    const { name, description, status, priority, nodes = [], edges = [], keywords = [], viewport, whatsapp_account_id, whatsappAccountId } = req.body;

    // FIX 1: do NOT auto-pick the org's "latest" account on every save.
    // If no account is sent, COALESCE in the UPDATE keeps the existing one.
    const targetAccountId = whatsapp_account_id || whatsappAccountId || null;

    const [existingFlows] = await connection.query('SELECT company_id FROM chatbot_flows WHERE id = ?', [id]);
    if (existingFlows.length === 0) {
      return res.status(404).json({ success: false, message: 'Chatbot Flow not found' });
    }
    const flowCompanyId = existingFlows[0].company_id || orgId || 1;

    const validation = await validateFlowName(name || 'New Chatbot Flow', id, flowCompanyId);
    if (!validation.valid) {
      // FIX 3: connection is released in finally (no double release)
      return res.status(400).json({ success: false, message: validation.message });
    }

    const flowName = validation.name;
    const vX = viewport?.x ?? 0;
    const vY = viewport?.y ?? 0;
    const vZoom = viewport?.zoom ?? 1;

    await connection.beginTransaction();

    // FIX 2: keep the flow's own company_id (Super Admin saving a client's flow must not move it to admin's org)
    await connection.execute(
      `UPDATE chatbot_flows 
       SET name = ?, 
           description = COALESCE(?, description), 
           status = COALESCE(?, status), 
           priority = COALESCE(?, priority),
           company_id = COALESCE(company_id, ?),
           whatsapp_account_id = COALESCE(?, whatsapp_account_id),
           viewport_x = ?, 
           viewport_y = ?, 
           viewport_zoom = ?, 
           updated_at = NOW() 
       WHERE id = ?`,
      [flowName, description || null, status || null, priority !== undefined ? Number(priority) : null, flowCompanyId, targetAccountId, vX, vY, vZoom, id]
    );

    // Delete existing nodes, edges, keywords
    await connection.execute(`DELETE FROM chatbot_nodes WHERE flow_id = ?`, [id]);
    await connection.execute(`DELETE FROM chatbot_edges WHERE flow_id = ?`, [id]);
    await connection.execute(`DELETE FROM chatbot_keywords WHERE flow_id = ?`, [id]);

    // Re-insert nodes
    for (const n of nodes) {
      const posX = n.position?.x ?? 0;
      const posY = n.position?.y ?? 0;
      const dataJson = JSON.stringify(n.data || {});

      await connection.execute(
        `INSERT INTO chatbot_nodes (flow_id, node_id, type, data, position_x, position_y) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, n.id, n.type || 'text_reply', dataJson, posX, posY]
      );
    }

    // Collect flow keywords exclusively from starting_keyword nodes (or fallback if empty)
    const flowKeywordsSet = new Set();
    for (const n of nodes) {
      if (n.type === 'starting_keyword' && Array.isArray(n.data?.keywords)) {
        for (const kw of n.data.keywords) {
          if (kw && typeof kw === 'string' && kw.trim()) {
            flowKeywordsSet.add(kw.trim().toLowerCase());
          }
        }
      }
    }

    if (flowKeywordsSet.size === 0 && Array.isArray(keywords)) {
      for (const kw of keywords) {
        if (kw && typeof kw === 'string' && kw.trim()) {
          flowKeywordsSet.add(kw.trim().toLowerCase());
        }
      }
    }

    for (const kw of flowKeywordsSet) {
      await connection.execute(
        `INSERT IGNORE INTO chatbot_keywords (flow_id, keyword) VALUES (?, ?)`,
        [id, kw]
      );
    }

    // Re-insert edges
    for (const e of edges) {
      await connection.execute(
        `INSERT INTO chatbot_edges (flow_id, source, target, source_handle, target_handle) 
         VALUES (?, ?, ?, ?, ?)`,
        [id, e.source, e.target, e.sourceHandle || null, e.targetHandle || null]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Chatbot Flow saved successfully',
      flowName
    });
  } catch (err) {
    try { await connection.rollback(); } catch (_) { }
    next(err);
  } finally {
    connection.release();
  }
};

/**
 * PATCH /api/chatbot/flow/:id/status
 * Toggle flow status ('active' / 'inactive')
 */
export const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    let targetStatus = body.status;
    if (targetStatus === undefined) {
      const boolVal = body.isActive !== undefined ? body.isActive : (body.is_active !== undefined ? body.is_active : body.active);
      if (boolVal !== undefined) {
        targetStatus = (boolVal === true || boolVal === 'true' || boolVal === 1 || boolVal === '1') ? 'active' : 'inactive';
      }
    }

    if (targetStatus === true || targetStatus === 'true' || targetStatus === 1 || targetStatus === '1') {
      targetStatus = 'active';
    } else if (targetStatus === false || targetStatus === 'false' || targetStatus === 0 || targetStatus === '0') {
      targetStatus = 'inactive';
    }

    if (!['active', 'inactive'].includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'active', 'inactive', true, or false"
      });
    }

    const [result] = await pool.execute(
      `UPDATE chatbot_flows SET status = ?, updated_at = NOW() WHERE id = ?`,
      [targetStatus, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: `Chatbot Flow with ID ${id} not found`
      });
    }

    logger.info(`[CHATBOT] Status changed for Flow ID ${id} to "${targetStatus}" at ${new Date().toISOString()}`);

    return res.json({
      success: true,
      message: 'Flow status updated successfully',
      data: {
        id: Number(id),
        status: targetStatus,
        isActive: targetStatus === 'active'
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/chatbot/flow/:id
 */
export const deleteFlow = async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.execute(`DELETE FROM chatbot_flows WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Chatbot Flow deleted successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/chatbot/upload
 */
export const uploadMedia = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileUrl = `/uploads/chatbot/${req.file.filename}`;
    const mime = (req.file.mimetype || '').toLowerCase();
    let fileType = 'document';
    if (mime.startsWith('image/')) {
      fileType = 'image';
    } else if (mime.startsWith('video/')) {
      fileType = 'video';
    } else if (mime.startsWith('audio/')) {
      fileType = 'audio';
    } else {
      fileType = 'document';
    }

    await pool.execute(
      `INSERT INTO chatbot_media (file, original_name, mime_type, size, type) 
       VALUES (?, ?, ?, ?, ?)`,
      [fileUrl, req.file.originalname, req.file.mimetype, req.file.size, fileType]
    );

    res.json({
      success: true,
      message: 'File uploaded successfully',
      fileUrl,
      fileName: req.file.originalname,
      fileType,
      size: req.file.size
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Unified POST /api/chatbot/save handler
 */
export const saveFlow = async (req, res, next) => {
  const targetId = req.params.id || req.body.id || req.body.flowId;
  if (targetId && String(targetId) !== 'new') {
    req.params.id = targetId;
    return updateFlow(req, res, next);
  } else {
    return createFlow(req, res, next);
  }
};

/**
 * GET /api/chatbot/health
 * System Health Check
 */
export const getHealthStatus = async (req, res, next) => {
  try {
    const phoneNumberId = process.env.PHONE_NUMBER_ID || '1133105516561988';
    const token = process.env.ACCESS_TOKEN;
    const connectedPhone = process.env.WHATSAPP_PHONE_NUMBER || '917383737005';

    let dbStatus = 'healthy';
    let flowCount = 0;
    let activeFlowCount = 0;
    let lastIncoming = null;
    let lastOutgoing = null;

    try {
      const [fRows] = await pool.query('SELECT COUNT(*) as total, SUM(CASE WHEN status="active" THEN 1 ELSE 0 END) as active FROM chatbot_flows');
      if (fRows.length > 0) {
        flowCount = Number(fRows[0].total || 0);
        activeFlowCount = Number(fRows[0].active || 0);
      }

      const [inMsgs] = await pool.query('SELECT phone_number, message_text, timestamp FROM messages WHERE direction="incoming" ORDER BY timestamp DESC LIMIT 1');
      if (inMsgs.length > 0) lastIncoming = inMsgs[0];

      const [outMsgs] = await pool.query('SELECT phone_number, message_text, timestamp, status FROM messages WHERE direction="outgoing" ORDER BY timestamp DESC LIMIT 1');
      if (outMsgs.length > 0) lastOutgoing = outMsgs[0];

    } catch (dbErr) {
      dbStatus = `degraded: ${dbErr.message}`;
    }

    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      health: {
        webhookStatus: 'active',
        metaApiStatus: (phoneNumberId && token) ? 'configured' : 'missing_credentials',
        tokenStatus: token ? 'valid' : 'missing',
        databaseStatus: dbStatus,
        flowCount,
        activeFlowCount,
        connectedPhoneNumber: connectedPhone,
        lastIncomingMessage: lastIncoming,
        lastOutgoingMessage: lastOutgoing
      }
    });
  } catch (err) {
    next(err);
  }
};