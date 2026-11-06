import { pool } from '../config/db.js';

async function fixColumns() {
  const fixes = [
    // Fix whatsapp_accounts: add missing 'status' column
    `ALTER TABLE whatsapp_accounts ADD COLUMN status VARCHAR(50) DEFAULT 'active'`,
    // Fix whatsapp_accounts: add missing 'updated_at' column
    `ALTER TABLE whatsapp_accounts ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
    // Fix conversations: add missing 'has_replied' column
    `ALTER TABLE conversations ADD COLUMN has_replied TINYINT(1) DEFAULT 0`,
  ];

  for (const sql of fixes) {
    try {
      await pool.query(sql);
      console.log('✅ Added column:', sql.slice(32, 90).trim());
    } catch(e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('⏭️  Column already exists (skipped):', sql.slice(32, 90).trim());
      } else {
        console.error('❌ Error:', e.message);
      }
    }
  }

  console.log('\n✅ All column fixes applied!');
  process.exit(0);
}

fixColumns();
