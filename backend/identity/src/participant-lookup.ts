import type { Organization, Patient } from '@medplum/fhirtypes';
import type { WithId } from '@medplum/core';
import { CLARGEN_HEALTH_ID_SYSTEM } from './constants';
import { normalizeHealthId } from './health-id';
import type { OrganizationIdentityFhirClient } from './participant-types';
import type { IdentityFhirClient } from './types';
import { IdentityIntegrityError, IdentityValidationError } from './types';
export type ClargenParticipantMatch =
  | { readonly participantType: 'individual'; readonly resource: WithId<Patient> }
  | { readonly participantType: 'organization'; readonly resource: WithId<Organization> };
export class MedplumParticipantIdentityLookup {
  constructor(private readonly individualClient: Pick<IdentityFhirClient, 'searchPatientsByIdentifier'>, private readonly organizationClient: Pick<OrganizationIdentityFhirClient, 'searchOrganizationsByIdentifier'>) {}
  async findAuthorizedParticipantByHealthId(input: string): Promise<ClargenParticipantMatch | undefined> {
    const healthId = normalizeHealthId(input);
    if (!healthId) throw new IdentityValidationError('Invalid Clargen Health ID');
    const [individuals, organizations] = await Promise.all([
      this.individualClient.searchPatientsByIdentifier(CLARGEN_HEALTH_ID_SYSTEM, healthId),
      this.organizationClient.searchOrganizationsByIdentifier(CLARGEN_HEALTH_ID_SYSTEM, healthId),
    ]);
    if (individuals.length + organizations.length > 1) throw new IdentityIntegrityError('Multiple Clargen participant records match this Health ID');
    if (individuals.length === 1) return { participantType: 'individual', resource: individuals[0] };
    if (organizations.length === 1) return { participantType: 'organization', resource: organizations[0] };
    return undefined;
  }
}
