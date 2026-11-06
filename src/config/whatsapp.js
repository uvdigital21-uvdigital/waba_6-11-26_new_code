import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const whatsappConfig = {
  // OAuth Bearer token from Meta Developer Dashboard → App → WhatsApp → API Setup
  get accessToken() { return process.env.ACCESS_TOKEN; },

  // The numeric Phone Number ID found in Meta → WhatsApp → API Setup
  get phoneNumberId() { return process.env.PHONE_NUMBER_ID; },

  // WhatsApp Business Account ID (WABA ID) from Meta Business Suite
  get businessAccountId() { return process.env.BUSINESS_ACCOUNT_ID; },

  // Token you choose yourself – must match exactly what you paste in Meta Dashboard
  get verifyToken() { return process.env.VERIFY_TOKEN; },

  // Your Meta App credentials
  get appId() { return process.env.APP_ID; },
  get appSecret() { return process.env.APP_SECRET; },

  // Meta Graph API base URL and version
  apiVersion: 'v23.0',
  baseUrl: 'https://graph.facebook.com',
};

// ── Startup validation ────────────────────────────────────────────────────────
// Warn early if critical credentials are missing so the server doesn't start
// silently broken.
const required = ['accessToken', 'phoneNumberId', 'verifyToken'];
const missing = required.filter((key) => !whatsappConfig[key]);

if (missing.length > 0) {
  console.warn(
    `[WhatsApp Config] ⚠️  Missing env variables: ${missing
      .map((k) => k.toUpperCase())
      .join(', ')}. WhatsApp features will not work until these are set in .env`
  );
}

export default whatsappConfig;
