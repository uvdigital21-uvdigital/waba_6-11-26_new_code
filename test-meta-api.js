import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const BUSINESS_ACCOUNT_ID = process.env.BUSINESS_ACCOUNT_ID;
const APP_ID = process.env.APP_ID;
const APP_SECRET = process.env.APP_SECRET;

const baseUrl = 'https://graph.facebook.com/v23.0';

async function runDiagnostics() {
    console.log('=== WhatsApp Meta API Diagnostics ===');
    console.log('Loaded credentials:');
    console.log(`- Phone Number ID: ${PHONE_NUMBER_ID}`);
    console.log(`- WABA ID: ${BUSINESS_ACCOUNT_ID}`);
    console.log(`- Access Token (Length): ${ACCESS_TOKEN ? ACCESS_TOKEN.length : 0}`);
    console.log(`- App ID: ${APP_ID}`);

    if (!ACCESS_TOKEN || !PHONE_NUMBER_ID || !BUSINESS_ACCOUNT_ID) {
        console.error('❌ Missing credentials in backend/.env!');
        process.exit(1);
    }

    const client = axios.create({
        baseURL: baseUrl,
        headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        timeout: 10000
    });

    // 1. Debug Access Token Info
    try {
        console.log('\n--- 1. Checking Access Token and Account Info ---');
        // Check WABA settings
        const response = await client.get(`/${BUSINESS_ACCOUNT_ID}`);
        console.log('✓ Token is VALID.');
        console.log('Meta WABA Details:', JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.log('❌ Failed WABA access check.');
        if (err.response) {
            console.log(`HTTP Status: ${err.response.status}`);
            console.log('Response Error:', JSON.stringify(err.response.data, null, 2));
        } else {
            console.log('Network Error:', err.message);
        }
    }

    // 2. Check Phone Number Details
    try {
        console.log('\n--- 2. Checking Phone Number ID Details ---');
        const response = await client.get(`/${PHONE_NUMBER_ID}`);
        console.log('✓ Phone Number ID is VALID.');
        console.log('Meta Phone Details:', JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.log('❌ Failed Phone Number ID access check.');
        if (err.response) {
            console.log(`HTTP Status: ${err.response.status}`);
            console.log('Response Error:', JSON.stringify(err.response.data, null, 2));
        } else {
            console.log('Network Error:', err.message);
        }
    }

    // 3. Fetch approved message templates and look for 'uv_digital'
    try {
        console.log('\n--- 3. Checking Templates (looking for "uv_digital") ---');
        const response = await client.get(`/${BUSINESS_ACCOUNT_ID}/message_templates`, {
            params: { limit: 1000 }
        });
        const templates = response.data?.data || [];
        console.log(`✓ Retrieved ${templates.length} templates.`);
        
        const uvDigitalTemplates = templates.filter(t => t.name === 'uv_digital');
        if (uvDigitalTemplates.length > 0) {
            console.log('Found "uv_digital" templates:');
            console.log(JSON.stringify(uvDigitalTemplates, null, 2));
        } else {
            console.log('⚠️ Template "uv_digital" NOT found in WABA template list!');
            console.log('Available template names:', Array.from(new Set(templates.map(t => t.name))));
        }
    } catch (err) {
        console.log('❌ Failed to fetch message templates.');
        if (err.response) {
            console.log(`HTTP Status: ${err.response.status}`);
            console.log('Response Error:', JSON.stringify(err.response.data, null, 2));
        } else {
            console.log('Network Error:', err.message);
        }
    }

    // 4. Attempt to send test message to 919913847423
    try {
        console.log('\n--- 4. Attempting to send Template "uv_digital" ---');
        const recipient = '919913847423';
        const payload = {
            messaging_product: 'whatsapp',
            to: recipient,
            type: 'template',
            template: {
                name: 'uv_digital',
                language: { code: 'en_US' } // Testing en_US mismatch
            }
        };

        console.log('Sending payload to Meta:');
        console.log(JSON.stringify(payload, null, 2));

        const response = await client.post(`/${PHONE_NUMBER_ID}/messages`, payload);
        console.log('✓ Success sending template!');
        console.log('Meta Send Response:', JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.log('❌ Failed to send template.');
        if (err.response) {
            console.log(`HTTP Status: ${err.response.status}`);
            console.log('Response Error:', JSON.stringify(err.response.data, null, 2));
        } else {
            console.log('Network Error:', err.message);
        }
    }

    process.exit(0);
}

runDiagnostics();
