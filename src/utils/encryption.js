import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ALGORITHM = 'aes-256-gcm';
// Ensure 32-byte key from process.env.ENCRYPTION_KEY or hashed default secret
const SECRET_KEY = crypto
  .createHash('sha256')
  .update(String(process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'wa_saas_encryption_key_2026'))
  .digest();

/**
 * Encrypts a plain text string into a hex string containing IV, Auth Tag, and Encrypted Data.
 * @param {string} text 
 * @returns {string}
 */
export function encryptToken(text) {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag().toString('hex');
    
    // Format: iv:tag:encrypted
    return `${iv.toString('hex')}:${tag}:${encrypted}`;
  } catch (err) {
    console.error('[Encryption] Error encrypting token:', err);
    throw new Error('Failed to encrypt access token');
  }
}

/**
 * Decrypts an encrypted hex string back into original plain text.
 * @param {string} cipherText 
 * @returns {string}
 */
export function decryptToken(cipherText) {
  if (!cipherText) return '';
  
  // Return raw text if not encrypted in expected format
  if (!cipherText.includes(':')) {
    return cipherText;
  }
  
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) return cipherText;
    
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error('[Encryption] Error decrypting token:', err);
    return cipherText; // Fallback for plain tokens
  }
}

/**
 * Sanitizes sensitive token strings for API responses to frontend.
 * @param {string} token 
 * @returns {string}
 */
export function maskToken(token) {
  if (!token) return '';
  if (token.length <= 8) return '****';
  return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
}
