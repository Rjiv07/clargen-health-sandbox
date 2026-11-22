import { randomUUID } from 'node:crypto';
import { CLARGEN_HEALTH_ID_PREFIX, CLARGEN_HEALTH_ID_REGEX } from './constants';
import type { ClargenHealthId, HealthIdGenerator } from './types';

export class CryptoHealthIdGenerator implements HealthIdGenerator {
  generate(): ClargenHealthId {
    return `${CLARGEN_HEALTH_ID_PREFIX}${randomUUID().toUpperCase()}`;
  }
}

export function normalizeHealthId(value: string): ClargenHealthId | undefined {
  const normalized = value.trim().toUpperCase();
  return CLARGEN_HEALTH_ID_REGEX.test(normalized) ? (normalized as ClargenHealthId) : undefined;
}

export function isClargenHealthId(value: string): value is ClargenHealthId {
  return CLARGEN_HEALTH_ID_REGEX.test(value);
}
