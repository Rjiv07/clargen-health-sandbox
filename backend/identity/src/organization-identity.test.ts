import type { Bundle, Organization } from '@medplum/fhirtypes';
import { describe, expect, test, vi } from 'vitest';
import { CLARGEN_HEALTH_ID_SYSTEM, CLARGEN_ORGANIZATION_PROFILE_URL } from './constants';
import { MedplumOrganizationIdentityIssuer } from './organization-issuer';
import { buildClargenOrganization, validateClargenOrganization } from './organization-profile';
import type { ClargenHealthId, OrganizationIdentityFhirClient } from './participant-types';
const id = 'CLH-550E8400-E29B-41D4-A716-446655440000' as ClargenHealthId;
const input = { name: 'Synthetic Supplier Ltd', participantType: 'supplier' as const, registrationNumber: 'SYN-001' };
function createdOrganization(): Bundle {
  const organization: Organization = { ...buildClargenOrganization(input, id), id: 'organization-1' };
  return { resourceType: 'Bundle', type: 'batch-response', entry: [{ response: { status: '201 Created' }, resource: organization }] };
}
function makeClient(responses: Bundle[]): OrganizationIdentityFhirClient {
  return { executeOrganizationBatch: vi.fn(async () => responses.shift() as Bundle), searchOrganizationsByIdentifier: vi.fn() };
}
describe('Clargen Organization identity', () => {
  test('builds and validates an organisation profile with a shared Health ID system', () => {
    const resource = buildClargenOrganization(input, id);
    expect(resource.meta?.profile).toContain(CLARGEN_ORGANIZATION_PROFILE_URL);
    expect(resource.identifier?.[0]).toEqual({ use: 'usual', system: CLARGEN_HEALTH_ID_SYSTEM, value: id });
    expect(() => validateClargenOrganization(resource)).not.toThrow();
  });
  test('issues an Organization resource conditionally and returns its Health ID', async () => {
    const client = makeClient([createdOrganization()]);
    const issuer = new MedplumOrganizationIdentityIssuer(client, { generate: () => id });
    const result = await issuer.createOrganizationProfile(input);
    expect(result.healthId).toBe(id);
    expect(result.organizationReference).toBe('Organization/organization-1');
    expect(client.executeOrganizationBatch).toHaveBeenCalledWith(expect.objectContaining({ entry: [expect.objectContaining({ request: expect.objectContaining({ url: 'Organization', ifNoneExist: `identifier=${encodeURIComponent(`${CLARGEN_HEALTH_ID_SYSTEM}|${id}`)}` }) })] }));
  });
});
