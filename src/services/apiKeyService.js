import crypto from 'crypto'
import { pool } from '../config/db.js'

export async function getUserApiKeys(userId) {
  const [rows] = await pool.query(
    `SELECT id, api_key, status, created_at, last_used_at FROM api_keys WHERE user_id = ? AND deleted_at IS NULL ORDER BY id DESC`,
    [userId]
  )
  return rows
}

export async function generateApiKey(userId) {
  const apiKey = crypto.randomBytes(16).toString('hex')
  const [result] = await pool.query(
    `INSERT INTO api_keys (user_id, api_key, status) VALUES (?, ?, 'active')`,
    [userId, apiKey]
  )

  const [rows] = await pool.query(
    `SELECT id, api_key, status, created_at, last_used_at FROM api_keys WHERE id = ?`,
    [result.insertId]
  )
  return rows[0]
}

export async function deleteApiKey(userId, keyId) {
  const [result] = await pool.query(
    `UPDATE api_keys SET deleted_at = CURRENT_TIMESTAMP, status = 'inactive' WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [keyId, userId]
  )
  return result.affectedRows > 0
}
