import type { Organization, Bundle } from '@medplum/fhirtypes';
import type { WithId } from '@medplum/core';
import type { ClargenHealthId, HealthIdGenerator } from './types';
export type { ClargenHealthId, HealthIdGenerator };
export type ClargenParticipantType = 'supplier' | 'laboratory' | 'manufacturer';
export interface CreateOrganizationProfileInput {
  readonly name: string;
  readonly participantType: ClargenParticipantType;
  readonly registrationNumber?: string;
  readonly email?: string;
  readonly phone?: string;
}
export interface IssuedOrganizationIdentity {
  readonly organization: WithId<Organization>;
  readonly organizationReference: `Organization/${string}`;
  readonly healthId: ClargenHealthId;
  readonly created: true;
}
export interface OrganizationIdentityFhirClient {
  executeOrganizationBatch(bundle: Bundle): Promise<Bundle>;
  searchOrganizationsByIdentifier(system: string, value: string): Promise<WithId<Organization>[]>;
}
