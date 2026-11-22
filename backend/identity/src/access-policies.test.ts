import { describe, expect, test } from 'vitest';
import { createIdentityIssuerAccessPolicy, createPatientIdentifierImmutabilityPolicy } from './access-policies';

describe('Clargen identity access policies', () => {
  test('limits the issuer to the interactions needed for conditional creation', () => {
    expect(createIdentityIssuerAccessPolicy().resource).toEqual([
      { resourceType: 'Patient', interaction: ['create', 'search', 'read'] },
    ]);
  });

  test('makes the patient identifier read-only to the patient profile', () => {
    expect(createPatientIdentifierImmutabilityPolicy().resource).toEqual([
      { resourceType: 'Patient', criteria: 'Patient?_id=%patient.id', readonlyFields: ['identifier'] },
    ]);
  });
});
