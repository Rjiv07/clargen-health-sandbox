import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const MAX_MEMORY = 64 * 1024 * 1024;
const DUMMY_SALT = Buffer.from('b6e5a7d912c430f18a9b037d51e6c2fa', 'hex');
const DUMMY_KEY = Buffer.alloc(KEY_LENGTH);

/**
 * Hash a password with a unique salt. The encoded format stores parameters so
 * the verifier can validate the parameters before using them.
 */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: MAX_MEMORY,
  });
  return [
    'scrypt', COST, BLOCK_SIZE, PARALLELIZATION,
    salt.toString('hex'), Buffer.from(derivedKey).toString('hex'),
  ].join('$');
}

/**
 * Verify the current Clargen scrypt encoding. Missing or malformed hashes still
 * perform a dummy scrypt operation to reduce account-enumeration timing leaks.
 */
export async function verifyPassword(password, encodedHash) {
  const parts = typeof encodedHash === 'string' ? encodedHash.split('$') : [];
  const validFormat =
    parts.length === 6 &&
    parts[0] === 'scrypt' &&
    parts[1] === String(COST) &&
    parts[2] === String(BLOCK_SIZE) &&
    parts[3] === String(PARALLELIZATION) &&
    /^[0-9a-f]{32}$/i.test(parts[4]) &&
    /^[0-9a-f]{128}$/i.test(parts[5]);

  const salt = validFormat ? Buffer.from(parts[4], 'hex') : DUMMY_SALT;
  const expected = validFormat ? Buffer.from(parts[5], 'hex') : DUMMY_KEY;
  const derived = await scrypt(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: MAX_MEMORY,
  });
  const matches = timingSafeEqual(Buffer.from(derived), expected);
  return validFormat && matches;
}
