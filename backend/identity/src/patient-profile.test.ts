import { describe, expect, test } from 'vitest';
import { CLARGEN_HEALTH_ID_SYSTEM, CLARGEN_PATIENT_PROFILE_URL } from './constants';
import { applyPatientProfileUpdate, buildClargenPatient, validateClargenPatient } from './patient-profile';
import { IdentityValidationError } from './types';

const healthId = 'CLH-550E8400-E29B-41D4-A716-446655440000' as const;

function input() {
  return {
    officialFamilyName: 'Example',
    officialGivenNames: ['Synthetic'] as [string],
    birthDate: '1990-01-02',
    gender: 'unknown' as const,
    email: 'synthetic@example.test',
  };
}

describe('Clargen Patient profile', () => {
  test('builds a profile-conformant synthetic patient', () => {
    const patient = buildClargenPatient(input(), healthId);
    expect(patient.meta?.profile).toContain(CLARGEN_PATIENT_PROFILE_URL);
    expect(patient.identifier).toEqual([{ use: 'usual', system: CLARGEN_HEALTH_ID_SYSTEM, value: healthId }]);
    expect(() => validateClargenPatient(patient)).not.toThrow();
  });

  test('rejects missing required demographic data', () => {
    expect(() => buildClargenPatient({ ...input(), birthDate: '1990-02-30' }, healthId)).toThrow(IdentityValidationError);
    expect(() => buildClargenPatient({ ...input(), officialGivenNames: ['   '] }, healthId)).toThrow(IdentityValidationError);
  });

  test('preserves the immutable identifier during approved profile update', () => {
    const patient = { ...buildClargenPatient(input(), healthId), id: 'patient-1', meta: { versionId: '7', profile: [CLARGEN_PATIENT_PROFILE_URL] } };
    const updated = applyPatientProfileUpdate(patient, {
      officialFamilyName: 'Updated',
      expectedVersionId: '7',
    });
    expect(updated.identifier).toEqual(patient.identifier);
    expect(updated.name?.[0].family).toBe('Updated');
  });

  test('rejects stale profile updates', () => {
    const patient = { ...buildClargenPatient(input(), healthId), id: 'patient-1', meta: { versionId: '7', profile: [CLARGEN_PATIENT_PROFILE_URL] } };
    expect(() => applyPatientProfileUpdate(patient, { expectedVersionId: '6' })).toThrow(IdentityValidationError);
  });
});
