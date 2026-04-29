import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const IV_LEN = 12;
const TAG_LEN = 16;

function encryptionKey(): Buffer {
  const raw = process.env.GOOGLE_OAUTH_SECRET;
  if (!raw) {
    throw new Error('GOOGLE_OAUTH_SECRET is not set (use openssl rand -base64 32)');
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error('GOOGLE_OAUTH_SECRET must decode to exactly 32 bytes (openssl rand -base64 32)');
  }
  return buf;
}

/** Compact opaque blob stored in Postgres — IV + ciphertext + GCM auth tag. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString('base64');
}

export function decryptSecret(blob: string): string {
  const raw = Buffer.from(blob, 'base64');
  if (raw.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('Invalid encrypted blob');
  }
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(raw.length - TAG_LEN);
  const data = raw.subarray(IV_LEN, raw.length - TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
