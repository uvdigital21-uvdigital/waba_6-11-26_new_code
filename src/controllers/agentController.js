import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';
import { normalizePhone } from '../utils/phoneUtils.js';

/**
 * Generate next Agent ID (AGT001, AGT002, AGT003, ...)
 */
async function generateAgentId() {
  const [rows] = await pool.query('SELECT agent_id FROM agents ORDER BY id DESC LIMIT 1');
  if (rows.length === 0 || !rows[0].agent_id) {
    return 'AGT001';
  }

  const lastId = rows[0].agent_id;
  const numMatch = lastId.match(/\d+/);
  if (!numMatch) {
    return 'AGT001';
  }

  const nextNum = parseInt(numMatch[0], 10) + 1;
  return `AGT${String(nextNum).padStart(3, '0')}`;
}

// GET /api/agents or /api/agent - List agents
export const getAgents = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (agent_id LIKE ? OR name LIKE ? OR email LIKE ? OR mobile LIKE ? OR role LIKE ?)';
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    // Get total count
    const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM agents ${whereClause}`, params);
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    // Get paginated data
    const [rows] = await pool.query(
      `SELECT id, agent_id, name, email, mobile, profile_image, role, status, last_login, is_online, created_at, updated_at 
       FROM agents ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Format output
    const formattedAgents = rows.map(r => ({
      id: r.id,
      agent_id: r.agent_id,
      name: r.name,
      email: r.email,
      mobile: r.mobile,
      profile_image: r.profile_image,
      role: r.role,
      status: r.status,
      online_status: r.is_online === 1 ? 'Online' : 'Offline',
      is_online: r.is_online === 1,
      created_on: r.created_at,
      created_at: r.created_at,
      last_login: r.last_login
    }));

    res.json({
      agents: formattedAgents,
      data: formattedAgents,
      total,
      totalPages,
      currentPage: page
    });
  } catch (err) {
    console.error('Error fetching agents:', err);
    res.status(500).json({ message: 'Failed to fetch agents', error: err.message });
  }
};

// GET /api/agents/:id - Get single agent
export const getAgentById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT id, agent_id, name, email, mobile, profile_image, role, status, last_login, is_online, created_at 
       FROM agents WHERE id = ? OR agent_id = ? LIMIT 1`,
      [id, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    const r = rows[0];
    res.json({
      agent: {
        ...r,
        online_status: r.is_online === 1 ? 'Online' : 'Offline',
        created_on: r.created_at
      }
    });
  } catch (err) {
    console.error('Error fetching agent:', err);
    res.status(500).json({ message: 'Failed to fetch agent details' });
  }
};

// POST /api/agents - Create Agent
export const createAgent = async (req, res) => {
  try {
    const { name, email, password, mobile, role, status } = req.body;
    let profile_image = null;

    if (req.file) {
      profile_image = `/uploads/agents/${req.file.filename}`;
    }

    if (!name || !email || !password || !mobile) {
      return res.status(400).json({ message: 'Name, email, password, and mobile are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = normalizePhone(mobile) || mobile.trim();
    const agentRole = ['Chat Agent', 'Sender', 'Manager', 'Admin'].includes(role) ? role : 'Sender';

    // Validate unique email
    const [existingEmail] = await pool.query('SELECT id FROM agents WHERE email = ? LIMIT 1', [cleanEmail]);
    if (existingEmail.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    // Validate unique mobile
    const [existingMobile] = await pool.query('SELECT id FROM agents WHERE mobile = ? LIMIT 1', [cleanPhone]);
    if (existingMobile.length > 0) {
      return res.status(409).json({ message: 'An agent with this mobile number already exists' });
    }

    const agentId = await generateAgentId();
    const passwordHash = await bcrypt.hash(password, 10);
    const agentStatus = status || 'Active';

    const [result] = await pool.query(
      `INSERT INTO agents (agent_id, name, email, password_hash, password, mobile, profile_image, role, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [agentId, name.trim(), cleanEmail, passwordHash, password, cleanPhone, profile_image, agentRole, agentStatus]
    );

    res.status(201).json({
      message: 'Agent created successfully',
      agent: {
        id: result.insertId,
        agent_id: agentId,
        name: name.trim(),
        email: cleanEmail,
        mobile: cleanPhone,
        profile_image,
        role: agentRole,
        status: agentStatus,
        online_status: 'Offline',
        created_on: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Error creating agent:', err);
    res.status(500).json({ message: 'Failed to create agent', error: err.message });
  }
};

// PUT /api/agents/:id - Update Agent
export const updateAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, mobile, role, status, password } = req.body;

    const [existing] = await pool.query('SELECT * FROM agents WHERE id = ? LIMIT 1', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Agent not found' });
    }
    const currentAgent = existing[0];

    let profile_image = currentAgent.profile_image;
    if (req.file) {
      profile_image = `/uploads/agents/${req.file.filename}`;
    }

    const cleanEmail = email ? email.trim().toLowerCase() : currentAgent.email;
    const cleanPhone = mobile ? (normalizePhone(mobile) || mobile.trim()) : currentAgent.mobile;
    const agentRole = role && ['Chat Agent', 'Sender', 'Manager', 'Admin'].includes(role) ? role : currentAgent.role;

    // Check unique email
    if (cleanEmail !== currentAgent.email) {
      const [emailCheck] = await pool.query('SELECT id FROM agents WHERE email = ? AND id != ? LIMIT 1', [cleanEmail, id]);
      if (emailCheck.length > 0) {
        return res.status(409).json({ message: 'Email address is already in use by another agent' });
      }
    }

    // Check unique mobile
    if (cleanPhone !== currentAgent.mobile) {
      const [mobileCheck] = await pool.query('SELECT id FROM agents WHERE mobile = ? AND id != ? LIMIT 1', [cleanPhone, id]);
      if (mobileCheck.length > 0) {
        return res.status(409).json({ message: 'Mobile number is already in use by another agent' });
      }
    }

    let passwordHash = currentAgent.password_hash;
    let plainPass = currentAgent.password;
    if (password && password.trim().length >= 8) {
      passwordHash = await bcrypt.hash(password.trim(), 10);
      plainPass = password.trim();
    }

    await pool.query(
      `UPDATE agents SET name = ?, email = ?, password_hash = ?, password = ?, mobile = ?, profile_image = ?, role = ?, status = ? WHERE id = ?`,
      [
        name ? name.trim() : currentAgent.name,
        cleanEmail,
        passwordHash,
        plainPass,
        cleanPhone,
        profile_image,
        agentRole,
        status || currentAgent.status,
        id
      ]
    );

    res.json({
      message: 'Agent updated successfully',
      agent: {
        id: currentAgent.id,
        agent_id: currentAgent.agent_id,
        name: name ? name.trim() : currentAgent.name,
        email: cleanEmail,
        mobile: cleanPhone,
        profile_image,
        role: agentRole,
        status: status || currentAgent.status
      }
    });
  } catch (err) {
    console.error('Error updating agent:', err);
    res.status(500).json({ message: 'Failed to update agent', error: err.message });
  }
};

// DELETE /api/agents/:id - Delete Agent
export const deleteAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user ? req.user.id : null;

    if (currentUserId && (String(currentUserId) === String(id))) {
      return res.status(400).json({ message: 'Action prohibited: You cannot delete your own logged-in user account' });
    }

    const [result] = await pool.query('DELETE FROM agents WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    res.json({ message: 'Agent deleted successfully' });
  } catch (err) {
    console.error('Error deleting agent:', err);
    res.status(500).json({ message: 'Failed to delete agent', error: err.message });
  }
};

// PATCH /api/agents/:id/status - Toggle status
export const updateAgentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Active', 'Inactive'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value. Must be Active or Inactive' });
    }

    const [result] = await pool.query('UPDATE agents SET status = ? WHERE id = ?', [status, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    res.json({ message: `Agent status updated to ${status} successfully`, status });
  } catch (err) {
    console.error('Error updating agent status:', err);
    res.status(500).json({ message: 'Failed to update agent status', error: err.message });
  }
};
