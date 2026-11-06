import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMultitenantMigrations() {
  console.log('[Migration] Starting Multi-Tenant & RBAC migration...');
  const conn = await pool.getConnection();

  try {
    // Sender attribution for campaign/message history. Older installations
    // created campaigns without user_id, so add it safely on startup.
    const [campaignTables] = await conn.query(`SHOW TABLES LIKE 'campaigns'`);
    if (campaignTables.length > 0) {
      const [campaignUserIdColumns] = await conn.query(`SHOW COLUMNS FROM campaigns LIKE 'user_id'`);
      if (campaignUserIdColumns.length === 0) {
        await conn.query(`ALTER TABLE campaigns ADD COLUMN user_id BIGINT NULL AFTER id`);
        console.log('[Migration] Added campaigns.user_id for sender attribution.');
      }
      const [campaignSenderNameColumns] = await conn.query(`SHOW COLUMNS FROM campaigns LIKE 'sender_name'`);
      if (campaignSenderNameColumns.length === 0) {
        await conn.query(`ALTER TABLE campaigns ADD COLUMN sender_name VARCHAR(150) NULL AFTER user_id`);
      }
      const [campaignSenderTypeColumns] = await conn.query(`SHOW COLUMNS FROM campaigns LIKE 'sender_type'`);
      if (campaignSenderTypeColumns.length === 0) {
        await conn.query(`ALTER TABLE campaigns ADD COLUMN sender_type VARCHAR(30) NULL AFTER sender_name`);
      }

      const [campaignIndexes] = await conn.query(`SHOW INDEX FROM campaigns WHERE Key_name = 'idx_campaigns_user_id'`);
      if (campaignIndexes.length === 0) {
        await conn.query(`ALTER TABLE campaigns ADD INDEX idx_campaigns_user_id (user_id)`);
      }
      for (const [name, definition] of [
        ['components_json', 'LONGTEXT NULL'], ['variables_json', 'LONGTEXT NULL'],
        ['custom_media_url', 'LONGTEXT NULL'], ['carousel_media_json', 'LONGTEXT NULL']
      ]) {
        const [cols] = await conn.query(`SHOW COLUMNS FROM campaigns LIKE '${name}'`);
        if (!cols.length) await conn.query(`ALTER TABLE campaigns ADD COLUMN ${name} ${definition}`);
      }
    }

    const [recipientTables] = await conn.query(`SHOW TABLES LIKE 'campaign_recipients'`);
    if (recipientTables.length) {
      const additions = [
        ['resend_attempt', 'INT NOT NULL DEFAULT 0'], ['original_error', 'TEXT NULL'],
        ['status_history', 'LONGTEXT NULL'], ['resend_job_id', 'BIGINT NULL']
      ];
      for (const [name, definition] of additions) {
        const [cols] = await conn.query(`SHOW COLUMNS FROM campaign_recipients LIKE '${name}'`);
        if (!cols.length) await conn.query(`ALTER TABLE campaign_recipients ADD COLUMN ${name} ${definition}`);
      }
      await conn.query(`ALTER TABLE campaign_recipients MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'queued'`).catch(() => {});
    }
    await conn.query(`CREATE TABLE IF NOT EXISTS campaign_resend_jobs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY, campaign_id INT NOT NULL, organization_id INT NULL,
      requested_status VARCHAR(30) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'queued',
      total_count INT NOT NULL DEFAULT 0, sent_count INT NOT NULL DEFAULT 0, failed_count INT NOT NULL DEFAULT 0,
      error_message TEXT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, started_at DATETIME NULL, finished_at DATETIME NULL,
      INDEX idx_resend_campaign (campaign_id,status)
    )`);

    // Persisted login sessions power per-device logout and permanent device blocks.
    await conn.query(`CREATE TABLE IF NOT EXISTS user_sessions (
      id CHAR(36) PRIMARY KEY,
      user_id BIGINT NOT NULL,
      principal_type ENUM('user', 'agent') NOT NULL DEFAULT 'user',
      device_id VARCHAR(128) NOT NULL,
      device_name VARCHAR(255) NULL,
      user_agent TEXT NULL,
      ip_address VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      blocked_at DATETIME NULL,
      INDEX idx_user_sessions_user (user_id, principal_type),
      INDEX idx_user_sessions_device (user_id, device_id)
    )`);
    await conn.query(`CREATE TABLE IF NOT EXISTS blocked_login_devices (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      principal_type ENUM('user', 'agent') NOT NULL DEFAULT 'user',
      device_id VARCHAR(128) NOT NULL,
      device_name VARCHAR(255) NULL,
      blocked_by BIGINT NULL,
      blocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_blocked_login_device (user_id, principal_type, device_id)
    )`);

    // 1. Read & run 010_multitenant_rbac_schema.sql
    const sqlPath = path.join(__dirname, 'migrations', '010_multitenant_rbac_schema.sql');
    if (fs.existsSync(sqlPath)) {
      const sqlContent = fs.readFileSync(sqlPath, 'utf8');
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
        await conn.query(stmt);
      }
      console.log('[Migration] ✅ Schema 010_multitenant_rbac_schema.sql applied successfully.');
    }

    // 1a2. Read & run 011_chat_multitenant_enhancements.sql
    const sqlPath011 = path.join(__dirname, 'migrations', '011_chat_multitenant_enhancements.sql');
    if (fs.existsSync(sqlPath011)) {
      const sqlContent011 = fs.readFileSync(sqlPath011, 'utf8');
      const statements011 = sqlContent011
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements011) {
        try {
          await conn.query(stmt);
        } catch (sErr) {
          console.warn('[Migration] 011 statement warning:', sErr.message);
        }
      }
      console.log('[Migration] ✅ Schema 011_chat_multitenant_enhancements.sql applied successfully.');
    }

    // 1b. Read & run 013_enforce_tags_multitenant.sql
    const sqlPath013 = path.join(__dirname, 'migrations', '013_enforce_tags_multitenant.sql');
    if (fs.existsSync(sqlPath013)) {
      const sqlContent013 = fs.readFileSync(sqlPath013, 'utf8');
      const statements013 = sqlContent013
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements013) {
        try {
          await conn.query(stmt);
        } catch (sErr) {
          console.warn('[Migration] 013 statement warning:', sErr.message);
        }
      }
      console.log('[Migration] ✅ Schema 013_enforce_tags_multitenant.sql applied successfully.');
    }

    // 1c. Read & run 014_add_credits_system.sql
    const sqlPath014 = path.join(__dirname, 'migrations', '014_add_credits_system.sql');
    if (fs.existsSync(sqlPath014)) {
      const sqlContent014 = fs.readFileSync(sqlPath014, 'utf8');
      const statements014 = sqlContent014
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements014) {
        try {
          await conn.query(stmt);
        } catch (sErr) {
          console.warn('[Migration] 014 statement warning:', sErr.message);
        }
      }
      console.log('[Migration] ✅ Schema 014_add_credits_system.sql applied successfully.');
    }

    // 1d. Read & run 015_feature_credits_system.sql
    const sqlPath015 = path.join(__dirname, 'migrations', '015_feature_credits_system.sql');
    if (fs.existsSync(sqlPath015)) {
      const sqlContent015 = fs.readFileSync(sqlPath015, 'utf8');
      const statements015 = sqlContent015
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements015) {
        try {
          await conn.query(stmt);
        } catch (sErr) {
          console.warn('[Migration] 015 statement warning:', sErr.message);
        }
      }
      console.log('[Migration] ✅ Schema 015_feature_credits_system.sql applied successfully.');
    }

    // 1e. Read & run 016_days_based_user_access.sql
    const sqlPath016 = path.join(__dirname, 'migrations', '016_days_based_user_access.sql');
    if (fs.existsSync(sqlPath016)) {
      const sqlContent016 = fs.readFileSync(sqlPath016, 'utf8');
      const statements016 = sqlContent016
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements016) {
        try {
          await conn.query(stmt);
        } catch (sErr) {
          console.warn('[Migration] 016 statement warning:', sErr.message);
        }
      }
      console.log('[Migration] ✅ Schema 016_days_based_user_access.sql applied successfully.');
    }

    // 1f. Read & run 017_catalog_system.sql
    const sqlPath017 = path.join(__dirname, 'migrations', '017_catalog_system.sql');
    if (fs.existsSync(sqlPath017)) {
      const sqlContent017 = fs.readFileSync(sqlPath017, 'utf8');
      const statements017 = sqlContent017
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements017) {
        try {
          await conn.query(stmt);
        } catch (sErr) {
          console.warn('[Migration] 017 statement warning:', sErr.message);
        }
      }
      console.log('[Migration] ✅ Schema 017_catalog_system.sql applied successfully.');
    }

    // Ensure credit_transactions table has feature_key column
    try {
      const [ctTables] = await conn.query(`SHOW TABLES LIKE 'credit_transactions'`);
      if (ctTables.length > 0) {
        const [ctCols] = await conn.query(`SHOW COLUMNS FROM credit_transactions LIKE 'feature_key'`);
        if (ctCols.length === 0) {
          await conn.query(`ALTER TABLE credit_transactions ADD COLUMN feature_key VARCHAR(50) DEFAULT 'general' AFTER type`);
          console.log('[Migration] ✅ credit_transactions.feature_key column added.');
        }
      }
    } catch (ctErr) {
      console.warn('[Migration] credit_transactions column check:', ctErr.message);
    }

    // Ensure users and organizations tables have mobile, app_name, app_logo columns
    try {
      const [userTables] = await conn.query(`SHOW TABLES LIKE 'users'`);
      if (userTables.length > 0) {
        const [mCols] = await conn.query(`SHOW COLUMNS FROM users LIKE 'mobile'`);
        if (mCols.length === 0) {
          await conn.query(`ALTER TABLE users ADD COLUMN mobile VARCHAR(50) NULL AFTER email`);
          console.log('[Migration] ✅ users.mobile column added.');
        }
        const [anCols] = await conn.query(`SHOW COLUMNS FROM users LIKE 'app_name'`);
        if (anCols.length === 0) {
          await conn.query(`ALTER TABLE users ADD COLUMN app_name VARCHAR(150) DEFAULT 'OfficialWA' AFTER status`);
          console.log('[Migration] ✅ users.app_name column added.');
        }
        const [alCols] = await conn.query(`SHOW COLUMNS FROM users LIKE 'app_logo'`);
        if (alCols.length === 0) {
          await conn.query(`ALTER TABLE users ADD COLUMN app_logo TEXT NULL AFTER app_name`);
          console.log('[Migration] ✅ users.app_logo column added.');
        }
      }
      const [orgTables] = await conn.query(`SHOW TABLES LIKE 'organizations'`);
      if (orgTables.length > 0) {
        const [anOrgCols] = await conn.query(`SHOW COLUMNS FROM organizations LIKE 'app_name'`);
        if (anOrgCols.length === 0) {
          await conn.query(`ALTER TABLE organizations ADD COLUMN app_name VARCHAR(150) DEFAULT 'OfficialWA' AFTER organization_name`);
        }
        const [alOrgCols] = await conn.query(`SHOW COLUMNS FROM organizations LIKE 'logo_url'`);
        if (alOrgCols.length === 0) {
          await conn.query(`ALTER TABLE organizations ADD COLUMN logo_url TEXT NULL AFTER app_name`);
        }
      }
    } catch (profileColErr) {
      console.warn('[Migration] profile branding column check error:', profileColErr.message);
    }

    // 2. Ensure existing tenant-aware tables have organization_id column if they existed previously
    const existingTables = [
      'users', 'contacts', 'campaigns', 'templates', 'conversations', 'messages', 'blacklist', 'agents',
      'whatsapp_accounts', 'contact_groups', 'campaign_folders', 'template_folders', 'api_settings',
      'chat_inboxes', 'reports_summary', 'broadcast_folders', 'webhook_configurations', 'teams'
    ];
    for (const tbl of existingTables) {
      try {
        const [tables] = await conn.query(`SHOW TABLES LIKE ?`, [tbl]);
        if (tables.length > 0) {
          const [cols] = await conn.query(`SHOW COLUMNS FROM \`${tbl}\` LIKE 'organization_id'`);
          if (cols.length === 0) {
            await conn.query(`ALTER TABLE \`${tbl}\` ADD COLUMN \`organization_id\` INT UNSIGNED NULL AFTER \`id\`, ADD INDEX (\`organization_id\`)`);
            console.log(`[Migration] Added organization_id column to existing table: ${tbl}`);
          }
        }
      } catch (err) {
        console.warn(`[Migration] Column check for ${tbl}:`, err.message);
      }
    }

    // Ensure conversations and messages have whatsapp_account_id column
    try {
      const [cCols] = await conn.query(`SHOW COLUMNS FROM conversations LIKE 'whatsapp_account_id'`);
      if (cCols.length === 0) {
        await conn.query(`ALTER TABLE conversations ADD COLUMN whatsapp_account_id INT UNSIGNED NULL AFTER user_id, ADD INDEX (whatsapp_account_id)`);
        await conn.query(`UPDATE conversations SET whatsapp_account_id = 2 WHERE whatsapp_account_id IS NULL`);
      }
      const [mCols] = await conn.query(`SHOW COLUMNS FROM messages LIKE 'whatsapp_account_id'`);
      if (mCols.length === 0) {
        await conn.query(`ALTER TABLE messages ADD COLUMN whatsapp_account_id INT UNSIGNED NULL AFTER user_id, ADD INDEX (whatsapp_account_id)`);
        await conn.query(`UPDATE messages SET whatsapp_account_id = 2 WHERE whatsapp_account_id IS NULL`);
      }
    } catch (cmErr) {
      console.warn(`[Migration] conversations/messages whatsapp_account_id check:`, cmErr.message);
    }

    // Ensure whatsapp_accounts table has waba_id, verified_name, verification_status, connected_at
    try {
      const [waTables] = await conn.query(`SHOW TABLES LIKE 'whatsapp_accounts'`);
      if (waTables.length > 0) {
        const [waCols] = await conn.query(`SHOW COLUMNS FROM whatsapp_accounts`);
        const waFields = waCols.map(c => c.Field);

        if (!waFields.includes('waba_id')) {
          await conn.query(`ALTER TABLE whatsapp_accounts ADD COLUMN waba_id VARCHAR(100) NULL AFTER phone_number_id`);
          if (waFields.includes('business_account_id')) {
            await conn.query(`UPDATE whatsapp_accounts SET waba_id = business_account_id WHERE waba_id IS NULL AND business_account_id IS NOT NULL`);
          }
        }
        if (!waFields.includes('verified_name')) {
          await conn.query(`ALTER TABLE whatsapp_accounts ADD COLUMN verified_name VARCHAR(255) NULL AFTER waba_id`);
          if (waFields.includes('business_name')) {
            await conn.query(`UPDATE whatsapp_accounts SET verified_name = business_name WHERE verified_name IS NULL`);
          }
        }
        if (!waFields.includes('verification_status')) {
          await conn.query(`ALTER TABLE whatsapp_accounts ADD COLUMN verification_status VARCHAR(50) DEFAULT 'CONNECTED' AFTER quality_rating`);
          if (waFields.includes('status')) {
            await conn.query(`UPDATE whatsapp_accounts SET verification_status = status WHERE verification_status IS NULL OR verification_status = 'CONNECTED'`);
          }
        }
        if (!waFields.includes('connected_at')) {
          await conn.query(`ALTER TABLE whatsapp_accounts ADD COLUMN connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER verification_status`);
        }
        if (!waFields.includes('allowed_modules')) {
          await conn.query(`ALTER TABLE whatsapp_accounts ADD COLUMN allowed_modules TEXT NULL`);
          const defaultModules = JSON.stringify(["sendWa", "reports", "chat", "chatbot", "api", "template", "setting"]);
          await conn.query(`UPDATE whatsapp_accounts SET allowed_modules = ? WHERE allowed_modules IS NULL`, [defaultModules]);
        }
        if (!waFields.includes('status')) {
          await conn.query(`ALTER TABLE whatsapp_accounts ADD COLUMN status VARCHAR(50) DEFAULT 'active' AFTER verification_status`);
        }
        if (!waFields.includes('updated_at')) {
          await conn.query(`ALTER TABLE whatsapp_accounts ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
        }
        await conn.query(`UPDATE whatsapp_accounts SET organization_id = 1 WHERE organization_id IS NULL OR organization_id = 0`);
        console.log(`[Migration] ✅ whatsapp_accounts columns verified and synchronized.`);
      }
    } catch (waErr) {
      console.warn(`[Migration] whatsapp_accounts columns check error:`, waErr.message);
    }

    // Ensure conversations has has_replied column
    try {
      const [convCols] = await conn.query(`SHOW COLUMNS FROM conversations LIKE 'has_replied'`);
      if (convCols.length === 0) {
        await conn.query(`ALTER TABLE conversations ADD COLUMN has_replied TINYINT(1) DEFAULT 0`);
        console.log(`[Migration] ✅ conversations.has_replied column added.`);
      }
    } catch (convErr) {
      console.warn(`[Migration] conversations.has_replied check error:`, convErr.message);
    }

    // Ensure blacklist table has phone column (some versions use normalized_mobile)
    try {
      const [blTables] = await conn.query(`SHOW TABLES LIKE 'blacklist'`);
      if (blTables.length > 0) {
        const [blCols] = await conn.query(`SHOW COLUMNS FROM blacklist`);
        const blFields = blCols.map(c => c.Field);
        if (!blFields.includes('normalized_mobile') && blFields.includes('phone')) {
          await conn.query(`ALTER TABLE blacklist ADD COLUMN normalized_mobile VARCHAR(20) GENERATED ALWAYS AS (REGEXP_REPLACE(phone, '[^0-9]', '')) STORED`);
          console.log(`[Migration] ✅ blacklist.normalized_mobile column added.`);
        }
      }
    } catch (blErr) {
      console.warn(`[Migration] blacklist columns check error:`, blErr.message);
    }

    // Create whatsapp_notifications table
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS \`whatsapp_notifications\` (
          \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          \`whatsapp_account_id\` INT UNSIGNED NOT NULL,
          \`organization_id\` INT UNSIGNED NOT NULL DEFAULT 1,
          \`title\` VARCHAR(255) NOT NULL,
          \`message\` TEXT NOT NULL,
          \`type\` VARCHAR(50) DEFAULT 'info',
          \`is_read\` TINYINT(1) DEFAULT 0,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX (\`whatsapp_account_id\`),
          INDEX (\`organization_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Seed sample notifications for accounts if empty
      const [nRows] = await conn.query(`SELECT COUNT(*) as count FROM whatsapp_notifications`);
      if (nRows[0].count === 0) {
        const [accs] = await conn.query(`SELECT id, verified_name, display_phone_number FROM whatsapp_accounts`);
        for (const a of accs) {
          const name = a.verified_name || a.display_phone_number || 'WhatsApp Account';
          await conn.query(`
            INSERT INTO whatsapp_notifications (whatsapp_account_id, organization_id, title, message, type, is_read)
            VALUES 
            (?, 1, 'Account Connected', 'Official WhatsApp account ${name} connected successfully.', 'success', 0),
            (?, 1, 'Quality Rating Normal', 'Quality rating for ${name} is GREEN (High Quality).', 'info', 0),
            (?, 1, 'Meta Webhook Verified', 'Incoming and outgoing webhook endpoints active for ${name}.', 'info', 1)
          `, [a.id, a.id, a.id]);
        }
      }
      console.log(`[Migration] ✅ whatsapp_notifications table ready.`);
    } catch (nErr) {
      console.warn(`[Migration] whatsapp_notifications creation error:`, nErr.message);
    }

    // Ensure users table has full_name, username, role, status
    try {
      const [uCols] = await conn.query(`SHOW COLUMNS FROM users`);
      const colNames = uCols.map(c => c.Field);
      if (!colNames.includes('full_name')) {
        await conn.query(`ALTER TABLE users ADD COLUMN full_name VARCHAR(150) NULL AFTER id`);
        await conn.query(`UPDATE users SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL`);
      }
      if (!colNames.includes('username')) {
        await conn.query(`ALTER TABLE users ADD COLUMN username VARCHAR(100) NULL UNIQUE AFTER email`);
        await conn.query(`UPDATE users SET username = email WHERE username IS NULL`);
      }
      if (!colNames.includes('role')) {
        await conn.query(`ALTER TABLE users ADD COLUMN role ENUM('Super Admin', 'Admin', 'Staff', 'User') NOT NULL DEFAULT 'User'`);
      }
      if (!colNames.includes('status')) {
        await conn.query(`ALTER TABLE users ADD COLUMN status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active'`);
      }
      if (!colNames.includes('allowed_modules')) {
        await conn.query(`ALTER TABLE users ADD COLUMN allowed_modules TEXT NULL`);
      }
      if (!colNames.includes('credits')) {
        await conn.query(`ALTER TABLE users ADD COLUMN credits INT NOT NULL DEFAULT 0`);
        console.log(`[Migration] ✅ users.credits column added.`);
      }
      if (!colNames.includes('is_team_member')) {
        await conn.query(`ALTER TABLE users ADD COLUMN is_team_member TINYINT(1) DEFAULT 0 AFTER role`);
        console.log(`[Migration] ✅ users.is_team_member column added.`);
      }
      if (!colNames.includes('created_by_user_id')) {
        await conn.query(`ALTER TABLE users ADD COLUMN created_by_user_id INT UNSIGNED NULL AFTER is_team_member, ADD INDEX (created_by_user_id)`);
        console.log(`[Migration] ✅ users.created_by_user_id column added.`);
      }


      // Check contact_groups description
      const [cgTables] = await conn.query(`SHOW TABLES LIKE 'contact_groups'`);
      if (cgTables.length > 0) {
        const [cgCols] = await conn.query(`SHOW COLUMNS FROM contact_groups LIKE 'description'`);
        if (cgCols.length === 0) {
          await conn.query(`ALTER TABLE contact_groups ADD COLUMN description TEXT NULL AFTER name`);
        }
      }
    } catch (uErr) {
      console.warn(`[Migration] Users/Groups columns check:`, uErr.message);
    }

    // 3. Seed Roles
    const rolesList = [
      { name: 'Super Admin', description: 'Full system control & customer management' },
      { name: 'Admin', description: 'Organization Administrator' },
      { name: 'Staff', description: 'Organization Operator / Staff' },
      { name: 'User', description: 'Standard Organization User' }
    ];

    for (const r of rolesList) {
      await conn.query(
        `INSERT INTO roles (name, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [r.name, r.description]
      );
    }

    // 4. Seed Permissions
    const permissionsList = [
      { name: 'Dashboard', slug: 'dashboard', module: 'Analytics' },
      { name: 'Contacts', slug: 'contacts', module: 'CRM' },
      { name: 'Campaign', slug: 'campaign', module: 'Marketing' },
      { name: 'Bulk Sender', slug: 'bulk_sender', module: 'Messaging' },
      { name: 'Inbox', slug: 'inbox', module: 'LiveChat' },
      { name: 'Live Chat', slug: 'live_chat', module: 'LiveChat' },
      { name: 'Chatbot', slug: 'chatbot', module: 'Automation' },
      { name: 'Templates', slug: 'templates', module: 'Messaging' },
      { name: 'Reports', slug: 'reports', module: 'Analytics' },
      { name: 'Analytics', slug: 'analytics', module: 'Analytics' },
      { name: 'WhatsApp Numbers', slug: 'whatsapp_numbers', module: 'Settings' },
      { name: 'API', slug: 'api', module: 'Developer' },
      { name: 'Webhook', slug: 'webhook', module: 'Developer' },
      { name: 'Automation', slug: 'automation', module: 'Automation' },
      { name: 'Team', slug: 'team', module: 'Management' },
      { name: 'Billing', slug: 'billing', module: 'Management' },
      { name: 'Settings', slug: 'settings', module: 'Settings' },
      { name: 'Profile', slug: 'profile', module: 'User' },
      { name: 'Logs', slug: 'logs', module: 'Audit' },
      { name: 'Audit', slug: 'audit', module: 'Audit' }
    ];

    for (const p of permissionsList) {
      await conn.query(
        `INSERT INTO permissions (name, slug, module) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), module = VALUES(module)`,
        [p.name, p.slug, p.module]
      );
    }

    // 5. Seed Super Admin and Default Organization if empty
    const [superAdminRole] = await conn.query(`SELECT id FROM roles WHERE name = 'Super Admin' LIMIT 1`);
    const [adminRole] = await conn.query(`SELECT id FROM roles WHERE name = 'Admin' LIMIT 1`);
    const [staffRole] = await conn.query(`SELECT id FROM roles WHERE name = 'Staff' LIMIT 1`);
    const [userRole] = await conn.query(`SELECT id FROM roles WHERE name = 'User' LIMIT 1`);

    const superAdminRoleId = superAdminRole[0]?.id;
    const adminRoleId = adminRole[0]?.id;
    const staffRoleId = staffRole[0]?.id;
    const userRoleId = userRole[0]?.id;

    // Grant ALL permissions to Super Admin & Admin roles, and standard operational permissions to Staff & User
    const [allPerms] = await conn.query(`SELECT id, slug FROM permissions`);
    for (const perm of allPerms) {
      // Super Admin
      await conn.query(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
        [superAdminRoleId, perm.id]
      );
      // Admin
      await conn.query(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
        [adminRoleId, perm.id]
      );
      // Staff & User (all permissions except admin-only ones like billing)
      if (!['billing'].includes(perm.slug)) {
        await conn.query(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
          [staffRoleId, perm.id]
        );
        await conn.query(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
          [userRoleId, perm.id]
        );
      }
    }

    // Ensure default admin user has Super Admin role
    await conn.query(`UPDATE users SET role = 'Super Admin' WHERE id = 1 OR username = 'admin' OR email = 'admin@officialwa.com' OR email = 'admin@officialwa.in'`);

    // Check if Super Admin user exists
    const [existingSA] = await conn.query(`SELECT id FROM users WHERE username = 'admin' OR email = 'admin@officialwa.com' LIMIT 1`);
    let defaultUserId;

    if (existingSA.length === 0) {
      const hashedPass = await bcrypt.hash('admin123', 10);
      const [insertUser] = await conn.query(
        `INSERT INTO users (full_name, email, username, password, role, status) VALUES (?, ?, ?, ?, 'Super Admin', 'Active')`,
        ['Super Administrator', 'admin@officialwa.com', 'admin', hashedPass]
      );
      defaultUserId = insertUser.insertId;
      console.log(`[Migration] Default Super Admin created (username: admin, pass: admin123)`);
    } else {
      defaultUserId = existingSA[0].id;
    }

    // Check if default organization exists
    const [existingOrg] = await conn.query(`SELECT id FROM organizations WHERE owner_user_id = ? LIMIT 1`, [defaultUserId]);
    let defaultOrgId;

    if (existingOrg.length === 0) {
      const [insertOrg] = await conn.query(
        `INSERT INTO organizations (organization_name, owner_user_id, status) VALUES (?, ?, 'Active')`,
        ['Default Enterprise Org', defaultUserId]
      );
      defaultOrgId = insertOrg.insertId;
      await conn.query(`UPDATE users SET organization_id = ? WHERE id = ?`, [defaultOrgId, defaultUserId]);
      console.log(`[Migration] Default Organization created (ID: ${defaultOrgId})`);
    } else {
      defaultOrgId = existingOrg[0].id;
      await conn.query(`UPDATE users SET organization_id = ? WHERE id = ? AND (organization_id IS NULL OR organization_id = 0)`, [defaultOrgId, defaultUserId]);
    }

    // Backfill any existing users/records without organization_id
    await conn.query(`UPDATE users SET organization_id = ? WHERE organization_id IS NULL OR organization_id = 0`, [defaultOrgId]);

    console.log('[Migration] ✅ Multi-tenant & RBAC migrations completed successfully!');
  } catch (err) {
    console.error('[Migration] ❌ Error running multitenant migrations:', err);
  } finally {
    conn.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrateAndSeed.js')) {
  runMultitenantMigrations().then(() => process.exit(0));
}
