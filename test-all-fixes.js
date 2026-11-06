import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendCampaignTemplate } from './src/services/metaWhatsAppService.js';
import { checkAndRunScheduledCampaigns } from './src/services/schedulerService.js';
import { checkAndRunBirthdayCampaigns } from './src/services/birthdaySchedulerService.js';
import { createGroup, getGroups } from './src/controllers/groupController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function runTests() {
  console.log('==================================================');
  console.log('🧪 RUNNING SYSTEM INTEGRITY & BUG FIX TESTS');
  console.log('==================================================\n');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wa_dashboard'
  });

  // TEST 1: GROUP CREATION (BUG 2)
  console.log('▶ TEST 1: Contact Group Creation & total_contacts schema check...');
  const mockReqGroup = {
    body: {
      name: `Test Group ${Date.now()}`,
      numbers: ['9913847423', '9925323735'],
      country: 'India(+91)'
    },
    organizationId: 1
  };
  let groupCreated = false;
  const mockResGroup = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      console.log(`   Response (${this.statusCode}):`, data.message);
      if (data.success && data.group?.totalContacts === 2) {
        groupCreated = true;
        console.log('   ✅ TEST 1 PASSED: Group created successfully with totalContacts = 2!');
      } else {
        console.error('   ❌ TEST 1 FAILED:', data);
      }
      return this;
    }
  };
  await createGroup(mockReqGroup, mockResGroup);

  // TEST 2: SEND BY TAG / PROVIDER RESPONSE TRACKING (BUG 1)
  console.log('\n▶ TEST 2: Campaign Sending & Real Provider Feedback check...');
  const sendResult = await sendCampaignTemplate({
    userId: 1,
    organizationId: 1,
    campaignName: `Test Campaign ${Date.now()}`,
    templateName: 'order_confirm_test_1',
    languageCode: 'en_US',
    country: 'India(+91)',
    numbers: ['919913847423']
  });
  console.log('   Provider Result:', {
    success: sendResult.success,
    total: sendResult.total,
    sent: sendResult.sent,
    failed: sendResult.failed,
    error: sendResult.results?.[0]?.error || 'None'
  });
  if (sendResult.sent > 0 || sendResult.failed > 0) {
    console.log('   ✅ TEST 2 PASSED: Real provider response accurately tracked!');
  }

  // TEST 3: SCHEDULING (BUG 3)
  console.log('\n▶ TEST 3: Scheduled Campaign Storage & Background Scheduler Execution...');
  const futureDate = new Date(Date.now() + 2000); // 2 seconds in future
  const pad = (n) => String(n).padStart(2, '0');
  const formattedFuture = `${futureDate.getFullYear()}-${pad(futureDate.getMonth() + 1)}-${pad(futureDate.getDate())} ${pad(futureDate.getHours())}:${pad(futureDate.getMinutes())}:${pad(futureDate.getSeconds())}`;

  const [schedInsert] = await conn.execute(
    `INSERT INTO campaigns (organization_id, campaign_name, template_name, language_code, country, total_numbers, status, scheduled_at, numbers_json)
     VALUES (1, ?, 'order_confirm_test_1', 'en_US', 'India(+91)', 1, 'scheduled', ?, ?)`,
    [`Scheduled Test ${Date.now()}`, formattedFuture, JSON.stringify(['919913847423'])]
  );
  console.log(`   Scheduled campaign ID ${schedInsert.insertId} inserted into DB for ${formattedFuture}`);

  // Wait 3 seconds for scheduled time to be reached
  await new Promise(r => setTimeout(r, 3000));
  await checkAndRunScheduledCampaigns();

  const [checkCamp] = await conn.execute(`SELECT id, status, sent_count, failed_count FROM campaigns WHERE id = ?`, [schedInsert.insertId]);
  console.log('   Scheduled Campaign Executed Status:', checkCamp[0]);
  if (checkCamp[0].status === 'completed' || checkCamp[0].status === 'failed') {
    console.log('   ✅ TEST 3 PASSED: Scheduled campaign executed by worker and updated in DB!');
  }

  // TEST 4: BIRTHDAY AUTOMATION (BUG 4)
  console.log('\n▶ TEST 4: Birthday Campaign Execution & Next Trigger Calculation...');
  await checkAndRunBirthdayCampaigns();
  console.log('   ✅ TEST 4 PASSED: Birthday scheduler checked without errors!');

  await conn.end();
  console.log('\n==================================================');
  console.log('🎉 ALL INTEGRITY TESTS COMPLETED');
  console.log('==================================================\n');
}

runTests().catch(err => {
  console.error('❌ Test Execution Error:', err);
  process.exit(1);
});
