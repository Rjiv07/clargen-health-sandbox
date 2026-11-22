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
 * Add this policy to patient memberships alongside the standard patient
 * compartment policy. It prevents direct FHIR updates to Patient.identifier.
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
