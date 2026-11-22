import { randomBytes } from 'node:crypto';

const HEALTH_ID_PATTERN = /^CLG-[0-9A-F]{32}$/;

/** Generate a non-sequential, cryptographically random Clargen identifier. */
export function generateHealthId() {
  return `CLG-${randomBytes(16).toString('hex').toUpperCase()}`;
}

export function isValidHealthId(value) {
  return typeof value === 'string' && HEALTH_ID_PATTERN.test(value);
}
