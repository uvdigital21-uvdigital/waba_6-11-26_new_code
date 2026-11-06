/**
 * fix-db-columns.js
 * Run this to instantly fix all missing DB columns causing errors.
 * Usage: node fix-db-columns.js
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function fixColumns() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wa_dashboard',
    multipleStatements: false
  });

  console.log('✅ Connected to MySQL database.');

  const fixes = [];

  // ── contact_groups fixes ────────────────────────────────────────────────────
  console.log('\n📋 Checking contact_groups table...');
  const [cgCols] = await conn.query(`SHOW COLUMNS FROM contact_groups`);
  const cgFields = cgCols.map(c => c.Field);
  console.log('   Existing columns:', cgFields.join(', '));

  if (!cgFields.includes('total_contacts')) {
    await conn.query(`ALTER TABLE contact_groups ADD COLUMN total_contacts INT DEFAULT 0 AFTER name`);
    console.log('   ✅ Added total_contacts column');
    fixes.push('contact_groups.total_contacts');
  } else {
    console.log('   ✔ total_contacts already exists');
  }

  if (!cgFields.includes('numbers_json')) {
    await conn.query(`ALTER TABLE contact_groups ADD COLUMN numbers_json LONGTEXT DEFAULT NULL AFTER total_contacts`);
    console.log('   ✅ Added numbers_json column');
    fixes.push('contact_groups.numbers_json');
  } else {
    console.log('   ✔ numbers_json already exists');
  }

  if (!cgFields.includes('updated_at')) {
    await conn.query(`ALTER TABLE contact_groups ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
    console.log('   ✅ Added updated_at column');
    fixes.push('contact_groups.updated_at');
  } else {
    console.log('   ✔ updated_at already exists');
  }

  // ── campaigns fixes ─────────────────────────────────────────────────────────
  console.log('\n📋 Checking campaigns table...');
  const [campCols] = await conn.query(`SHOW COLUMNS FROM campaigns`);
  const campFields = campCols.map(c => c.Field);
  console.log('   Existing columns:', campFields.join(', '));

  // Fix status column to support VARCHAR (needed for 'scheduled', 'running', 'cancelled')
  const statusCol = campCols.find(c => c.Field === 'status');
  if (statusCol && statusCol.Type.includes('enum')) {
    await conn.query(`ALTER TABLE campaigns MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending'`);
    console.log('   ✅ Changed status column from ENUM to VARCHAR(50)');
    fixes.push('campaigns.status (ENUM→VARCHAR)');
  } else {
    console.log('   ✔ status column is already VARCHAR');
  }

  if (!campFields.includes('scheduled_at')) {
    await conn.query(`ALTER TABLE campaigns ADD COLUMN scheduled_at DATETIME DEFAULT NULL AFTER country`);
    console.log('   ✅ Added scheduled_at column');
    fixes.push('campaigns.scheduled_at');
  } else {
    console.log('   ✔ scheduled_at already exists');
  }

  if (!campFields.includes('numbers_json')) {
    await conn.query(`ALTER TABLE campaigns ADD COLUMN numbers_json LONGTEXT DEFAULT NULL AFTER scheduled_at`);
    console.log('   ✅ Added numbers_json column');
    fixes.push('campaigns.numbers_json');
  } else {
    console.log('   ✔ numbers_json already exists');
  }

  if (!campFields.includes('whatsapp_account_id')) {
    await conn.query(`ALTER TABLE campaigns ADD COLUMN whatsapp_account_id INT UNSIGNED NULL AFTER organization_id`);
    console.log('   ✅ Added whatsapp_account_id column');
    fixes.push('campaigns.whatsapp_account_id');
  } else {
    console.log('   ✔ whatsapp_account_id already exists');
  }

  if (!campFields.includes('organization_id')) {
    await conn.query(`ALTER TABLE campaigns ADD COLUMN organization_id INT UNSIGNED NULL AFTER id`);
    console.log('   ✅ Added organization_id column');
    fixes.push('campaigns.organization_id');
  } else {
    console.log('   ✔ organization_id already exists');
  }

  // ── campaign_recipients fixes ───────────────────────────────────────────────
  console.log('\n📋 Checking campaign_recipients table...');
  try {
    const [crCols] = await conn.query(`SHOW COLUMNS FROM campaign_recipients`);
    const crFields = crCols.map(c => c.Field);
    console.log('   Existing columns:', crFields.join(', '));

    if (!crFields.includes('organization_id')) {
      await conn.query(`ALTER TABLE campaign_recipients ADD COLUMN organization_id INT UNSIGNED NULL AFTER id`);
      console.log('   ✅ Added organization_id column');
      fixes.push('campaign_recipients.organization_id');
    } else {
      console.log('   ✔ organization_id already exists');
    }

    if (!crFields.includes('whatsapp_account_id')) {
      await conn.query(`ALTER TABLE campaign_recipients ADD COLUMN whatsapp_account_id INT UNSIGNED NULL AFTER organization_id`);
      console.log('   ✅ Added whatsapp_account_id column');
      fixes.push('campaign_recipients.whatsapp_account_id');
    } else {
      console.log('   ✔ whatsapp_account_id already exists');
    }

    if (!crFields.includes('error')) {
      await conn.query(`ALTER TABLE campaign_recipients ADD COLUMN error TEXT NULL AFTER status`);
      console.log('   ✅ Added error column');
      fixes.push('campaign_recipients.error');
    }

    if (!crFields.includes('error_code')) {
      await conn.query(`ALTER TABLE campaign_recipients ADD COLUMN error_code VARCHAR(50) NULL AFTER error`);
      console.log('   ✅ Added error_code column');
      fixes.push('campaign_recipients.error_code');
    }

    if (!crFields.includes('error_details')) {
      await conn.query(`ALTER TABLE campaign_recipients ADD COLUMN error_details TEXT NULL AFTER error_code`);
      console.log('   ✅ Added error_details column');
      fixes.push('campaign_recipients.error_details');
    }
  } catch (err) {
    console.log('   ⚠ campaign_recipients table check error:', err.message);
  }

  // ── messages error columns ──────────────────────────────────────────────────
  try {
    const [msgCols] = await conn.query(`SHOW COLUMNS FROM messages`);
    const msgFields = msgCols.map(c => c.Field);
    if (!msgFields.includes('error')) {
      await conn.query(`ALTER TABLE messages ADD COLUMN error TEXT NULL`);
      fixes.push('messages.error');
    }
    if (!msgFields.includes('error_code')) {
      await conn.query(`ALTER TABLE messages ADD COLUMN error_code VARCHAR(50) NULL`);
      fixes.push('messages.error_code');
    }
    if (!msgFields.includes('error_details')) {
      await conn.query(`ALTER TABLE messages ADD COLUMN error_details TEXT NULL`);
      fixes.push('messages.error_details');
    }
  } catch (_) {}

  // ── message_logs error columns ──────────────────────────────────────────────
  try {
    const [apiCols] = await conn.query(`SHOW COLUMNS FROM message_logs`);
    const apiFields = apiCols.map(c => c.Field);
    if (!apiFields.includes('error_code')) {
      await conn.query(`ALTER TABLE message_logs ADD COLUMN error_code VARCHAR(50) NULL`);
      fixes.push('message_logs.error_code');
    }
    if (!apiFields.includes('error_details')) {
      await conn.query(`ALTER TABLE message_logs ADD COLUMN error_details TEXT NULL`);
      fixes.push('message_logs.error_details');
    }
  } catch (_) {}

  // ── meta_billing_insights check ──────────────────────────────────────────────
  console.log('\n📋 Checking meta_billing_insights table...');
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS meta_billing_insights (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        organization_id INT UNSIGNED NOT NULL,
        whatsapp_account_id INT UNSIGNED NULL,
        waba_id VARCHAR(100) NULL,
        phone_number_id VARCHAR(100) NULL,
        date DATE NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'TOTAL',
        sent_count INT UNSIGNED DEFAULT 0,
        delivered_count INT UNSIGNED DEFAULT 0,
        received_count INT UNSIGNED DEFAULT 0,
        free_count INT UNSIGNED DEFAULT 0,
        paid_count INT UNSIGNED DEFAULT 0,
        rate DECIMAL(10, 4) DEFAULT 0.0000,
        cost DECIMAL(10, 4) DEFAULT 0.0000,
        currency VARCHAR(10) DEFAULT 'INR',
        meta_data JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_org_phone_date_cat (organization_id, phone_number_id, date, category),
        INDEX idx_org_date (organization_id, date),
        INDEX idx_waba_date (waba_id, date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('   ✔ meta_billing_insights table verified.');
    fixes.push('meta_billing_insights table');
  } catch (err) {
    console.log('   ⚠ meta_billing_insights table error:', err.message);
  }

  // ── meta_sync_logs check ───────────────────────────────────────────────────
  console.log('\n📋 Checking meta_sync_logs table...');
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS meta_sync_logs (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        organization_id INT UNSIGNED NOT NULL,
        whatsapp_account_id INT UNSIGNED NULL,
        waba_id VARCHAR(100) NULL,
        phone_number_id VARCHAR(100) NULL,
        status ENUM('success', 'failed') DEFAULT 'success',
        records_synced INT DEFAULT 0,
        error_message TEXT NULL,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_org_sync (organization_id, synced_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('   ✔ meta_sync_logs table verified.');
    fixes.push('meta_sync_logs table');
  } catch (err) {
    console.log('   ⚠ meta_sync_logs table error:', err.message);
  }

  // ── birthday_campaigns check ────────────────────────────────────────────────
  console.log('\n📋 Checking birthday_campaigns table...');
  try {
    const [bcCols] = await conn.query(`SHOW COLUMNS FROM birthday_campaigns`);
    const bcFields = bcCols.map(c => c.Field);
    console.log('   Existing columns:', bcFields.join(', '));
    console.log('   ✔ birthday_campaigns table looks good');

    // Show any campaigns that have next_trigger_on in the past so we know status
    const [pastTriggers] = await conn.query(
      `SELECT id, name, mobile_number, template_name, wish_time, next_trigger_on, last_triggered_at FROM birthday_campaigns WHERE is_active = 1`
    );
    if (pastTriggers.length > 0) {
      console.log('\n   Active Birthday Campaigns:');
      for (const c of pastTriggers) {
        console.log(`     - [${c.id}] ${c.name} | ${c.mobile_number} | wish_time: ${c.wish_time} | next_trigger: ${c.next_trigger_on} | last_triggered: ${c.last_triggered_at}`);
      }
    }
  } catch (err) {
    console.log('   ⚠ birthday_campaigns table not found (will be created on first use)');
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  if (fixes.length === 0) {
    console.log('✅ All columns already in place. No changes needed.');
  } else {
    console.log(`✅ Fixed ${fixes.length} column(s):`);
    fixes.forEach(f => console.log(`   - ${f}`));
  }
  console.log('══════════════════════════════════════════════════\n');

  await conn.end();
  console.log('🎉 Database column fixes completed!');
}

fixColumns().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
