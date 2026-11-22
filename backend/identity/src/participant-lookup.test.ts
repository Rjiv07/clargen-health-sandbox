import type { Organization, Patient } from '@medplum/fhirtypes';
import { describe, expect, test, vi } from 'vitest';
import { MedplumParticipantIdentityLookup } from './participant-lookup';
import type { OrganizationIdentityFhirClient } from './participant-types';
import type { IdentityFhirClient } from './types';

const id = 'CLH-550E8400-E29B-41D4-A716-446655440000';
function clients(patientMatches: Patient[] = [], organizationMatches: Organization[] = []) {
  const individual = { searchPatientsByIdentifier: vi.fn().mockResolvedValue(patientMatches) } as unknown as IdentityFhirClient;
  const organization = { searchOrganizationsByIdentifier: vi.fn().mockResolvedValue(organizationMatches) } as unknown as OrganizationIdentityFhirClient;
  return { individual, organization };
}
describe('Clargen participant identity lookup', () => {
  test('returns an individual match', async () => {
    const { individual, organization } = clients([{ resourceType: 'Patient', id: 'p1' }]);
    const result = await new MedplumParticipantIdentityLookup(individual, organization).findAuthorizedParticipantByHealthId(id);
    expect(result?.participantType).toBe('individual');
  });
  test('returns an organisation match', async () => {
    const { individual, organization } = clients([], [{ resourceType: 'Organization', id: 'o1' }]);
    const result = await new MedplumParticipantIdentityLookup(individual, organization).findAuthorizedParticipantByHealthId(id);
    expect(result?.participantType).toBe('organization');
  });
  test('fails closed if both resource types match the same ID', async () => {
    const { individual, organization } = clients([{ resourceType: 'Patient', id: 'p1' }], [{ resourceType: 'Organization', id: 'o1' }]);
    await expect(new MedplumParticipantIdentityLookup(individual, organization).findAuthorizedParticipantByHealthId(id)).rejects.toThrow('Multiple Clargen participant records');
  });
});
