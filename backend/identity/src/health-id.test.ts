import { describe, expect, test } from 'vitest';
import { CLARGEN_HEALTH_ID_REGEX } from './constants';
import { CryptoHealthIdGenerator, isClargenHealthId, normalizeHealthId } from './health-id';

describe('Clargen Health ID', () => {
  test('generates an uppercase CLH UUIDv4 identifier', () => {
    const healthId = new CryptoHealthIdGenerator().generate();
    expect(healthId).toMatch(CLARGEN_HEALTH_ID_REGEX);
  });

  test('normalizes lookup input but validates the canonical value', () => {
    const healthId = 'CLH-550E8400-E29B-41D4-A716-446655440000';
    expect(normalizeHealthId(`  ${healthId.toLowerCase()}  `)).toBe(healthId);
    expect(isClargenHealthId(healthId)).toBe(true);
    expect(isClargenHealthId(healthId.toLowerCase())).toBe(false);
  });

  test('rejects malformed or non-v4 Health IDs', () => {
    expect(normalizeHealthId('EXT-550E8400-E29B-41D4-A716-446655440000')).toBeUndefined();
    expect(normalizeHealthId('CLH-550E8400-E29B-11D4-A716-446655440000')).toBeUndefined();
    expect(normalizeHealthId('Patient/550e8400-e29b-41d4-a716-446655440000')).toBeUndefined();
  });
});
