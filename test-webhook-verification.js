import http from 'http';

function testVerification(url, expectedStatus, expectedBody = null) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const contentType = res.headers['content-type'] || '';
        console.log(`\nTesting URL: ${url}`);
        console.log(`HTTP Status: ${res.statusCode} (Expected: ${expectedStatus})`);
        console.log(`Content-Type: ${contentType}`);
        console.log(`Body: "${data}"`);

        const statusMatch = res.statusCode === expectedStatus;
        const bodyMatch = expectedBody !== null ? data.trim() === expectedBody.trim() : true;
        const isPlainText = expectedStatus === 200 ? contentType.includes('text/plain') : true;

        if (statusMatch && bodyMatch && isPlainText) {
          console.log('✅ TEST PASSED!');
          resolve(true);
        } else {
          console.error('❌ TEST FAILED!');
          resolve(false);
        }
      });
    }).on('error', err => {
      console.error('❌ HTTP Request Error:', err.message);
      resolve(false);
    });
  });
}

async function runWebhookTests() {
  console.log('==================================================');
  console.log('🧪 TESTING META WHATSAPP WEBHOOK VERIFICATION (GET /webhook)');
  console.log('==================================================');

  // Test 1: Valid Verification Request with exact required token & challenge
  const validUrl = 'http://127.0.0.1:5000/webhook?hub.mode=subscribe&hub.verify_token=my_super_secret_verify_token_2024&hub.challenge=123456789';
  const t1 = await testVerification(validUrl, 200, '123456789');

  // Test 2: Alternate route /api/webhook
  const validApiUrl = 'http://127.0.0.1:5000/api/webhook?hub.mode=subscribe&hub.verify_token=my_super_secret_verify_token_2024&hub.challenge=987654321';
  const t2 = await testVerification(validApiUrl, 200, '987654321');

  // Test 3: Invalid token should return 403 Forbidden
  const invalidUrl = 'http://127.0.0.1:5000/webhook?hub.mode=subscribe&hub.verify_token=wrong_token_123&hub.challenge=123456789';
  const t3 = await testVerification(invalidUrl, 403);

  console.log('\n==================================================');
  if (t1 && t2 && t3) {
    console.log('🎉 ALL WEBHOOK VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('⚠️ SOME WEBHOOK TESTS FAILED!');
  }
  console.log('==================================================\n');
}

runWebhookTests();
