import type { AccessPolicy } from '@medplum/fhirtypes';

/** Server-side issuer policy: conditional creation and identifier lookup only. */
export function createIdentityIssuerAccessPolicy(): AccessPolicy {
  return {
    resourceType: 'AccessPolicy',
    name: 'Clargen Identity Issuer',
    resource: [
      { resourceType: 'Patient', interaction: ['create', 'search', 'read'] },
      { resourceType: 'Organization', interaction: ['create', 'search', 'read'] },
    ],
  };
}

export function createPatientIdentifierImmutabilityPolicy(): AccessPolicy {
  return {
    resourceType: 'AccessPolicy',
    name: 'Clargen Patient Identifier Immutability',
    resource: [{ resourceType: 'Patient', criteria: 'Patient?_id=%patient.id', readonlyFields: ['identifier'] }],
  };
}

export function createOrganizationIdentifierImmutabilityPolicy(): AccessPolicy {
  return {
    resourceType: 'AccessPolicy',
    name: 'Clargen Organization Identifier Immutability',
    resource: [{ resourceType: 'Organization', criteria: 'Organization?_id=%organization.id', readonlyFields: ['identifier'] }],
  };
}
