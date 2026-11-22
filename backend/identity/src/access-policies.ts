import type { AccessPolicy } from '@medplum/fhirtypes';

/**
 * Attach to the server-side ClientApplication used only for conditional Patient
 * issuance. It can create and perform the search/read required by conditional
 * create, but cannot modify or delete patient data.
 */
export function createIdentityIssuerAccessPolicy(): AccessPolicy {
  return {
    resourceType: 'AccessPolicy',
    name: 'Clargen Identity Issuer',
    resource: [
      {
        resourceType: 'Patient',
        interaction: ['create', 'search', 'read'],
      },
    ],
  };
}

/**
 * Compose this policy with the project's standard Patient compartment policy
 * through AccessPolicy.basedOn. The derived policy can then be assigned as the
 * membership's single accessPolicy reference.
 */
export function createPatientIdentifierImmutabilityPolicy(): AccessPolicy {
  return {
    resourceType: 'AccessPolicy',
    name: 'Clargen Patient Identifier Immutability',
    resource: [
      {
        resourceType: 'Patient',
        criteria: 'Patient?_id=%patient.id',
        readonlyFields: ['identifier'],
      },
    ],
  };
}
