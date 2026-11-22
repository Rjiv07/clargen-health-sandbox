import type { Patient } from '@medplum/fhirtypes';
import { describe, expect, test, vi } from 'vitest';
import { CLARGEN_HEALTH_ID_SYSTEM, CLARGEN_PATIENT_PROFILE_URL } from './constants';
import { MedplumPatientProfileService } from './patient-profile-service';
import type { IdentityFhirClient } from './types';

const patient: Patient & { id: string } = {
  resourceType: 'Patient',
  id: 'patient-1',
  active: true,
  meta: { versionId: '3', profile: [CLARGEN_PATIENT_PROFILE_URL] },
  identifier: [
    {
      use: 'usual',
      system: CLARGEN_HEALTH_ID_SYSTEM,
      value: 'CLH-550E8400-E29B-41D4-A716-446655440000',
    },
  ],
  name: [{ use: 'official', family: 'Example', given: ['Synthetic'] }],
  birthDate: '1990-01-02',
  gender: 'unknown',
};

describe('MedplumPatientProfileService', () => {
  test('uses a caller-scoped client and an optimistic version precondition', async () => {
    const client: IdentityFhirClient = {
      executeBatch: vi.fn(),
      searchPatientsByIdentifier: vi.fn(),
      readPatient: vi.fn().mockResolvedValue(patient),
      updatePatient: vi.fn().mockImplementation(async (resource) => ({ ...resource, id: 'patient-1' })),
    };

    const result = await new MedplumPatientProfileService(client).updateAuthorizedProfile('patient-1', {
      officialFamilyName: 'Updated',
      expectedVersionId: '3',
    });

    expect(result.name?.[0].family).toBe('Updated');
    expect(client.updatePatient).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: patient.identifier }),
      '3'
    );
  });
});
