// Verschlüsselung für die Nachrichten in der Datenbank (AES-256-GCM)
// jeder Wert bekommt einen eigenen zufälligen IV, der Tag merkt wenn jemand was verändert hat
// gespeichert wird: enc:v1:<base64 von iv + tag + verschlüsselter text>
// der Schlüssel steht nur in der .env, nicht in der DB
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

const PREFIX = 'enc:v1:';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function encrypt(plaintext, key = config.encryptionKey) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decrypt(stored, key = config.encryptionKey) {
  if (!isEncrypted(stored)) {
    throw new Error('Wert ist nicht verschlüsselt.');
  }
  const data = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

// zwei Strings vergleichen ohne dass man es an der Zeit merkt (Timing-Angriff)
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// zufälliger Token
export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}
