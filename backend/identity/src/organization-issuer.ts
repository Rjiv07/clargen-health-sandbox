import type { Bundle, Organization } from '@medplum/fhirtypes';
import { CLARGEN_HEALTH_ID_SYSTEM, MAX_ID_ISSUANCE_ATTEMPTS } from './constants';
import { CryptoHealthIdGenerator } from './health-id';
import { buildClargenOrganization, validateCreateOrganizationProfileInput } from './organization-profile';
import type { CreateOrganizationProfileInput, IssuedOrganizationIdentity, OrganizationIdentityFhirClient } from './participant-types';
import type { HealthIdGenerator } from './types';
import { IdentityIntegrityError, IdentityIssuanceError, isResource } from './types';
export class MedplumOrganizationIdentityIssuer {
  constructor(private readonly client: OrganizationIdentityFhirClient, private readonly generator: HealthIdGenerator = new CryptoHealthIdGenerator(), private readonly maxAttempts = MAX_ID_ISSUANCE_ATTEMPTS) {}
  async createOrganizationProfile(input: CreateOrganizationProfileInput): Promise<IssuedOrganizationIdentity> {
    validateCreateOrganizationProfileInput(input);
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      const healthId = this.generator.generate();
      const organization = buildClargenOrganization(input, healthId);
      const result = await this.client.executeOrganizationBatch(createConditionalOrganizationBundle(organization, healthId));
      const entry = result.entry?.[0];
      const status = entry?.response?.status;
      if (status?.startsWith('201')) {
        if (!entry?.resource || !isResource<Organization>(entry.resource, 'Organization')) throw new IdentityIssuanceError('FHIR server created an Organization without returning a valid Organization resource');
        return { organization: entry.resource, organizationReference: `Organization/${entry.resource.id}`, healthId, created: true };
      }
      if (status?.startsWith('200')) continue;
      if (status?.startsWith('412')) throw new IdentityIntegrityError('Multiple Organization records already use a Clargen Health ID candidate');
      throw new IdentityIssuanceError(`Unexpected conditional Organization create response: ${status ?? 'missing status'}`);
    }
    throw new IdentityIssuanceError('Unable to issue a unique Clargen Health ID after bounded retries');
  }
}
export function createConditionalOrganizationBundle(organization: Organization, healthId: string): Bundle {
  const identifierQuery = encodeURIComponent(`${CLARGEN_HEALTH_ID_SYSTEM}|${healthId}`);
  return { resourceType: 'Bundle', type: 'batch', entry: [{ resource: organization, request: { method: 'POST', url: 'Organization', ifNoneExist: `identifier=${identifierQuery}` } }] };
}
