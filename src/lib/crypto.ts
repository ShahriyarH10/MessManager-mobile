/**
 * Password hashing — a straight port of hashPassword / comparePassword in the
 * web app's js/core/config.js.
 *
 * Format: "pbkdf2:<saltHex>:<hashHex>"
 *   - PBKDF2-SHA-256, 100000 iterations, 16-byte salt, 32-byte derived key
 *   - Verified byte-for-byte identical to the browser's crypto.subtle output,
 *     so hashes created on web validate on mobile and vice-versa.
 *
 * Legacy bare SHA-256 hex hashes (64 chars, no prefix) are still accepted by
 * comparePassword for backward compatibility; the caller upgrades them.
 *
 * We use @noble/hashes (pure JS, audited) because Expo Go has no native crypto
 * module that exposes PBKDF2.
 */
import 'react-native-get-random-values';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

const ITERATIONS = 100_000;
const KEY_LEN = 32;
const SALT_LEN = 16;

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return arr;
}

/**
 * Hash a password. Pass an existing salt (hex) to reproduce a stored hash.
 * Async signature kept for parity with the web app even though noble is sync.
 */
export async function hashPassword(plain: string, saltHex?: string): Promise<string> {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const derived = pbkdf2(sha256, utf8ToBytes(plain), salt, { c: ITERATIONS, dkLen: KEY_LEN });
  return `pbkdf2:${bytesToHex(salt)}:${bytesToHex(derived)}`;
}

export async function comparePassword(plain: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  if (stored.startsWith('pbkdf2:')) {
    const saltHex = stored.split(':')[1];
    const rehashed = await hashPassword(plain, saltHex);
    return rehashed === stored;
  }
  // Legacy bare SHA-256 hex
  const legacy = bytesToHex(sha256(utf8ToBytes(plain)));
  return legacy === stored;
}

export function isLegacyHash(stored: string | null | undefined): boolean {
  return !!stored && !stored.startsWith('pbkdf2:');
}
