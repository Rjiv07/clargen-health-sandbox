import type { Bundle, Patient } from '@medplum/fhirtypes';
import { describe, expect, test, vi } from 'vitest';
import { CLARGEN_HEALTH_ID_SYSTEM, CLARGEN_PATIENT_PROFILE_URL } from './constants';
import { MedplumPatientIdentityIssuer } from './identity-issuer';
import type { ClargenHealthId, HealthIdGenerator, IdentityFhirClient } from './types';
import { IdentityIntegrityError } from './types';

const firstId = 'CLH-550E8400-E29B-41D4-A716-446655440000' as ClargenHealthId;
const secondId = 'CLH-550E8400-E29B-41D4-A716-446655440001' as ClargenHealthId;

function makeClient(responses: Bundle[]): IdentityFhirClient {
  return {
    executeBatch: vi.fn(async () => {
      const response = responses.shift();
      if (!response) {
        throw new Error('Unexpected batch request');
      }
      return response;
    }),
    searchPatientsByIdentifier: vi.fn(),
    readPatient: vi.fn(),
    updatePatient: vi.fn(),
  };
}

function createdPatient(healthId: ClargenHealthId): Bundle {
  const patient: Patient = {
    resourceType: 'Patient',
    id: `patient-${healthId.slice(-1)}`,
    active: true,
    meta: { profile: [CLARGEN_PATIENT_PROFILE_URL] },
    identifier: [{ use: 'usual', system: CLARGEN_HEALTH_ID_SYSTEM, value: healthId }],
    name: [{ use: 'official', family: 'Example', given: ['Synthetic'] }],
    birthDate: '1990-01-02',
    gender: 'unknown',
  };
  return { resourceType: 'Bundle', type: 'batch-response', entry: [{ response: { status: '201 Created' }, resource: patient }] };
}

const input = {
  officialFamilyName: 'Example',
  officialGivenNames: ['Synthetic'] as [string],
  birthDate: '1990-01-02',
  gender: 'unknown' as const,
};

describe('MedplumPatientIdentityIssuer', () => {
  test('conditionally creates a complete Patient with the generated ID', async () => {
    const client = makeClient([createdPatient(firstId)]);
    const issuer = new MedplumPatientIdentityIssuer(client, { generate: () => firstId });
    const result = await issuer.createPatientProfile(input);

    expect(result.healthId).toBe(firstId);
    expect(result.patientReference).toBe('Patient/patient-0');
    expect(client.executeBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'batch',
        entry: [
          expect.objectContaining({
            request: expect.objectContaining({
              ifNoneExist: `identifier=${encodeURIComponent(`${CLARGEN_HEALTH_ID_SYSTEM}|${firstId}`)}`,
            }),
          }),
        ],
      })
    );
  });

  test('retries a candidate collision instead of adopting another patient', async () => {
    const existing: Bundle = {
      resourceType: 'Bundle',
      type: 'batch-response',
      entry: [{ response: { status: '200 OK' }, resource: { resourceType: 'Patient', id: 'another-patient' } }],
    };
    const generator: HealthIdGenerator = { generate: vi.fn().mockReturnValueOnce(firstId).mockReturnValueOnce(secondId) };
    const client = makeClient([existing, createdPatient(secondId)]);
    const result = await new MedplumPatientIdentityIssuer(client, generator).createPatientProfile(input);

    expect(result.healthId).toBe(secondId);
    expect(generator.generate).toHaveBeenCalledTimes(2);
  });

  test('fails closed when duplicate legacy matches make conditional create ambiguous', async () => {
    const client = makeClient([
      { resourceType: 'Bundle', type: 'batch-response', entry: [{ response: { status: '412 Precondition Failed' } }] },
    ]);
    await expect(new MedplumPatientIdentityIssuer(client, { generate: () => firstId }).createPatientProfile(input)).rejects.toThrow(
      IdentityIntegrityError
    );
  });

  test('retries a transient serialization failure with a new candidate', async () => {
    const generator: HealthIdGenerator = { generate: vi.fn().mockReturnValueOnce(firstId).mockReturnValueOnce(secondId) };
    const client = makeClient([createdPatient(secondId)]);
    vi.mocked(client.executeBatch).mockRejectedValueOnce(new Error('could not serialize access due to concurrent update'));

    const result = await new MedplumPatientIdentityIssuer(client, generator).createPatientProfile(input);
    expect(result.healthId).toBe(secondId);
    expect(generator.generate).toHaveBeenCalledTimes(2);
  });
});
