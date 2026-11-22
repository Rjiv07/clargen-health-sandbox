import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const MAX_MEMORY = 64 * 1024 * 1024;

/**
 * Hash a password with a unique salt. The encoded format stores parameters so
 * the verifier can remain compatible when authentication is implemented later.
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
