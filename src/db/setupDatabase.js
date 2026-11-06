import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMultitenantMigrations } from './migrateAndSeed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupDatabase() {
  console.log('🚀 [DB Setup] Connecting to MySQL server on 127.0.0.1:3306...');
  
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    multipleStatements: true
  });

  try {
    console.log('✅ [DB Setup] Connected to MySQL server.');

    // 1. Re-create database wa_dashboard fresh
    console.log('📦 [DB Setup] Creating clean database `wa_dashboard`...');
    await connection.query('DROP DATABASE IF EXISTS `wa_dashboard`;');
    await connection.query('CREATE DATABASE `wa_dashboard` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
    await connection.query('USE `wa_dashboard`;');
    console.log('✅ [DB Setup] Fresh database `wa_dashboard` created.');

    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');

    // 2. Run database/schema.sql
    const baseSchemaPath = path.resolve(__dirname, '../../../database/schema.sql');
    if (fs.existsSync(baseSchemaPath)) {
      console.log(`📜 [DB Setup] Importing base schema: ${baseSchemaPath}`);
      const sql = fs.readFileSync(baseSchemaPath, 'utf8');
      await connection.query(sql);
      console.log('✅ [DB Setup] Base schema imported.');
    }

    // 3. Run all migrations in order
    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        console.log(`📜 [DB Setup] Applying migration: ${file}`);
        const sqlPath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await connection.query(sql);
        console.log(`✅ [DB Setup] Applied ${file}`);
      }
    }

    // 4. Ensure whatsapp_accounts has all required columns
    try {
      const [waCols] = await connection.query(`SHOW COLUMNS FROM whatsapp_accounts`);
      const colNames = waCols.map(c => c.Field);
      
      if (!colNames.includes('phone_number_id')) {
        await connection.query(`ALTER TABLE whatsapp_accounts ADD COLUMN phone_number_id VARCHAR(100) NULL DEFAULT '1133105516561988' AFTER phone_number`);
      }
      if (!colNames.includes('waba_id')) {
        await connection.query(`ALTER TABLE whatsapp_accounts ADD COLUMN waba_id VARCHAR(100) NULL DEFAULT '1507295783967485' AFTER phone_number_id`);
      }
      if (!colNames.includes('verified_name')) {
        await connection.query(`ALTER TABLE whatsapp_accounts ADD COLUMN verified_name VARCHAR(255) NULL AFTER waba_id`);
        await connection.query(`UPDATE whatsapp_accounts SET verified_name = business_name WHERE verified_name IS NULL`);
      }
      if (!colNames.includes('display_phone_number')) {
        await connection.query(`ALTER TABLE whatsapp_accounts ADD COLUMN display_phone_number VARCHAR(100) NULL AFTER verified_name`);
        await connection.query(`UPDATE whatsapp_accounts SET display_phone_number = phone_number WHERE display_phone_number IS NULL`);
      }
      if (!colNames.includes('access_token')) {
        await connection.query(`ALTER TABLE whatsapp_accounts ADD COLUMN access_token TEXT NULL AFTER display_phone_number`);
      }
      if (!colNames.includes('quality_rating')) {
        await connection.query(`ALTER TABLE whatsapp_accounts ADD COLUMN quality_rating VARCHAR(50) DEFAULT 'UNKNOWN' AFTER access_token`);
      }
      if (!colNames.includes('verification_status')) {
        await connection.query(`ALTER TABLE whatsapp_accounts ADD COLUMN verification_status VARCHAR(50) DEFAULT 'CONNECTED' AFTER quality_rating`);
      }
      if (!colNames.includes('connected_at')) {
        await connection.query(`ALTER TABLE whatsapp_accounts ADD COLUMN connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER verification_status`);
      }
      if (!colNames.includes('allowed_modules')) {
        await connection.query(`ALTER TABLE whatsapp_accounts ADD COLUMN allowed_modules TEXT NULL AFTER connected_at`);
      }
      if (!colNames.includes('organization_id')) {
        await connection.query(`ALTER TABLE whatsapp_accounts ADD COLUMN organization_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id`);
      }
      console.log('✅ [DB Setup] whatsapp_accounts table columns upgraded.');
    } catch (e) {
      console.warn('⚠️ [DB Setup] Columns check warning:', e.message);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
    await connection.end();

    // 5. Run multitenant seed and sync from migrateAndSeed.js
    console.log('🌱 [DB Setup] Running multi-tenant sync & seeding...');
    await runMultitenantMigrations();

    // 6. Verify & Print table list with counts
    const connCheck = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: 'wa_dashboard'
    });

    const [tables] = await connCheck.query('SHOW TABLES');
    const tableNames = tables.map(r => Object.values(r)[0]);
    console.log('\n==================================================');
    console.log(`🎉 [SUCCESS] Total ${tableNames.length} Tables Created in \`wa_dashboard\`:`);
    console.log('==================================================');
    for (let i = 0; i < tableNames.length; i++) {
      const t = tableNames[i];
      const [cnt] = await connCheck.query(`SELECT COUNT(*) as c FROM \`${t}\``);
      console.log(` ${i + 1}. ${t} (${cnt[0].c} rows)`);
    }
    console.log('==================================================\n');

    await connCheck.end();
    console.log('✨ [DB Setup] Database creation & table imports completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ [DB Setup Error]:', err);
    process.exit(1);
  }
}

setupDatabase();
