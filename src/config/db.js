import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  database: process.env.DB_NAME || 'wa_dashboard',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  connectTimeout: 10000,
  timezone: '+05:30',
})


export async function testDbConnection() {
  try {
    const connection = await pool.getConnection()
    connection.release()
    console.log('  [DB] ✅ Database connected successfully (127.0.0.1:3306).')
    return true
  } catch (err) {
    console.error('  [DB] ❌ Database connection failed:', err.message)
    if (err.code === 'ECONNREFUSED') {
      console.error('  [DB] 💡 Tip: Make sure MySQL / XAMPP is running on port 3306.')
    }
    return false
  }
}
