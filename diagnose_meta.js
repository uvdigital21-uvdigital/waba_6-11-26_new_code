// ─────────────────────────────────────────────────────────────────────────────
// diagnose_meta.js
// Standalone Live Meta API & Carousel Diagnostics
// Run with: node diagnose_meta.js
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { pool } from './src/config/db.js';
import { decryptToken } from './src/utils/encryption.js';
import whatsappConfig from './src/config/whatsapp.js';
import { buildCentralTemplateComponents, uploadMediaToMeta } from './src/services/templateMessageSenderService.js';

async function runDiagnostics() {
  console.log('\n============================================================');
  console.log('   OFFICIAL WABA LIVE META & CAROUSEL DIAGNOSTICS');
  console.log('============================================================\n');

  // 1. Inspect Database Accounts
  console.log('1. Checking Connected WhatsApp Accounts in Database...');
  const [accounts] = await pool.query('SELECT id, organization_id, verified_name, display_phone_number, phone_number_id, waba_id, access_token, status FROM whatsapp_accounts');
  
  if (accounts.length === 0) {
    console.error('❌ No WhatsApp accounts found in database!');
    process.exit(1);
  }

  console.log(`✅ Found ${accounts.length} account(s) in database:\n`);
  accounts.forEach((acc, idx) => {
    console.log(`  [Account #${acc.id}] Org: ${acc.organization_id}, Name: "${acc.verified_name || acc.display_phone_number}", Phone ID: ${acc.phone_number_id}, WABA: ${acc.waba_id}, Status: ${acc.status}`);
  });

  const activeAcc = accounts.find(a => a.status === 'Active' || a.phone_number_id) || accounts[0];
  const token = decryptToken(activeAcc.access_token);
  const phoneId = activeAcc.phone_number_id;
  const wabaId = activeAcc.waba_id;

  console.log(`\nUsing Active Account #${activeAcc.id} (Phone ID: ${phoneId}, WABA: ${wabaId})\n`);

  // 2. Query Live Templates from Meta
  console.log('2. Querying Templates from Meta Graph API...');
  try {
    const metaRes = await axios.get(`https://graph.facebook.com/v19.0/${wabaId}/message_templates`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const templates = metaRes.data?.data || [];
    console.log(`✅ Found ${templates.length} template(s) on Meta:`);
    templates.forEach(t => {
      const carousel = t.components?.find(c => c.type === 'CAROUSEL');
      console.log(`  - "${t.name}" (${t.language}) [${t.status}] Category: ${t.category} ${carousel ? `[CAROUSEL: ${carousel.cards?.length} cards]` : ''}`);
    });

    const videoTemplate = templates.find(t => t.name === 'video') || templates.find(t => t.name.includes('video') || t.components?.some(c => c.type === 'CAROUSEL')) || templates[0];

    if (videoTemplate) {
      console.log(`\nDetailed inspection of template: "${videoTemplate.name}"`);
      console.log(JSON.stringify(videoTemplate.components, null, 2));
    }
  } catch (err) {
    console.error('❌ Failed to fetch templates from Meta:', err.response?.data || err.message);
  }

  // 3. Test Direct Media Upload to Meta
  console.log('\n3. Testing Direct Media Upload to Meta Media API (/media)...');
  try {
    const sampleBuf = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const mediaId = await uploadMediaToMeta(sampleBuf, 'image/png', 'diag_test.png', phoneId, token);
    if (mediaId) {
      console.log(`✅ Meta Media API Upload Succeeded! Generated runtime Media ID: ${mediaId}`);
    } else {
      console.warn('⚠️ Meta Media API returned null (Check token permissions or phone ID).');
    }
  } catch (mErr) {
    console.error('❌ Meta Media Upload Error:', mErr.response?.data || mErr.message);
  }

  // 4. Test Component Generation for "video" or Carousel template
  console.log('\n4. Simulating Payload Generation for Template: "video"...');
  try {
    const comps = await buildCentralTemplateComponents({
      templateName: 'video',
      languageCode: 'en_US',
      phoneNumberId: phoneId,
      accessToken: token
    });
    console.log('✅ Generated Components Payload:');
    console.log(JSON.stringify(comps, null, 2));
  } catch (cErr) {
    console.error('❌ Component Generation Error:', cErr.message);
  }

  // 5. Inspect Uploads Folder on Disk
  console.log('\n5. Checking Local Uploads Directory (/uploads/templates)...');
  const uploadDirs = [
    path.resolve(process.cwd(), 'uploads/templates'),
    path.resolve(process.cwd(), 'backend/uploads/templates'),
    path.resolve(process.cwd(), 'backend/backend/uploads/templates')
  ];

  uploadDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      console.log(`  Found directory: ${dir} (${files.length} files)`);
      files.forEach(f => {
        const stats = fs.statSync(path.join(dir, f));
        const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`    - ${f} (${sizeMb} MB)`);
      });
    } else {
      console.log(`  Directory does not exist: ${dir}`);
    }
  });

  console.log('\n============================================================');
  console.log('   DIAGNOSTICS COMPLETE');
  console.log('============================================================\n');
  process.exit(0);
}

runDiagnostics().catch(err => {
  console.error('Fatal Diagnostic Error:', err);
  process.exit(1);
});
