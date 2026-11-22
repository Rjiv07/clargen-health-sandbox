import type { Patient } from '@medplum/fhirtypes';
import { describe, expect, test, vi } from 'vitest';
import { CLARGEN_HEALTH_ID_SYSTEM } from './constants';
import { MedplumPatientIdentityLookup } from './patient-lookup';
import type { IdentityFhirClient } from './types';
import { IdentityIntegrityError, IdentityValidationError } from './types';

const client: IdentityFhirClient = {
  executeBatch: vi.fn(),
  searchPatientsByIdentifier: vi.fn(),
  readPatient: vi.fn(),
  updatePatient: vi.fn(),
};

describe('MedplumPatientIdentityLookup', () => {
  test('uses the canonical system and normalized Health ID', async () => {
    vi.mocked(client.searchPatientsByIdentifier).mockResolvedValue([{ resourceType: 'Patient', id: 'patient-1' } as Patient & { id: string }]);
    const result = await new MedplumPatientIdentityLookup(client).findAuthorizedPatientByHealthId(
      'clh-550e8400-e29b-41d4-a716-446655440000'
    );
    expect(result?.id).toBe('patient-1');
    expect(client.searchPatientsByIdentifier).toHaveBeenCalledWith(
      CLARGEN_HEALTH_ID_SYSTEM,
      'CLH-550E8400-E29B-41D4-A716-446655440000'
    );
  });

  test('rejects malformed IDs before querying Medplum', async () => {
    await expect(new MedplumPatientIdentityLookup(client).findAuthorizedPatientByHealthId('not-an-id')).rejects.toThrow(
      IdentityValidationError
    );
  });

  test('fails closed on duplicate matches', async () => {
    vi.mocked(client.searchPatientsByIdentifier).mockResolvedValue([
      { resourceType: 'Patient', id: 'patient-1' } as Patient & { id: string },
      { resourceType: 'Patient', id: 'patient-2' } as Patient & { id: string },
    ]);
    await expect(
      new MedplumPatientIdentityLookup(client).findAuthorizedPatientByHealthId('CLH-550E8400-E29B-41D4-A716-446655440000')
    ).rejects.toThrow(IdentityIntegrityError);
  });
});
