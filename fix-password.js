import bcrypt from 'bcryptjs'
import { pool } from './src/config/db.js'

async function fixPassword() {
    try {
        // Hash the password '123' to match what's expected
        const hashedPassword = await bcrypt.hash('123', 10)
        console.log('Generated bcrypt hash:', hashedPassword)

        // Update the admin user with the correct bcrypt hash
        const [result] = await pool.query(
            'UPDATE users SET password = ? WHERE username = ?',
            [hashedPassword, 'admin']
        )

        console.log('✓ Password updated successfully')
        console.log('Affected rows:', result.affectedRows)

        // Verify the update
        const [rows] = await pool.query(
            'SELECT username, password FROM users WHERE username = ?',
            ['admin']
        )
        console.log('Updated user:', rows[0])

        process.exit(0)
    } catch (err) {
        console.error('Error:', err.message)
        process.exit(1)
    }
}

fixPassword()