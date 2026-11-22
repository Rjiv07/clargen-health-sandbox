import { describe, expect, test } from 'vitest';
import { createIdentityIssuerAccessPolicy, createOrganizationIdentifierImmutabilityPolicy, createPatientIdentifierImmutabilityPolicy } from './access-policies';

describe('identity access policies', () => {
  test('allows the restricted issuer to create and search both identity resource types', () => {
    expect(createIdentityIssuerAccessPolicy().resource).toEqual([
      { resourceType: 'Patient', interaction: ['create', 'search', 'read'] },
      { resourceType: 'Organization', interaction: ['create', 'search', 'read'] },
    ]);
  });
  test('keeps individual identity identifiers immutable', () => {
    expect(createPatientIdentifierImmutabilityPolicy().resource).toEqual([
      { resourceType: 'Patient', criteria: 'Patient?_id=%patient.id', readonlyFields: ['identifier'] },
    ]);
  });
  test('keeps organisation identity identifiers immutable', () => {
    expect(createOrganizationIdentifierImmutabilityPolicy().resource).toEqual([
      { resourceType: 'Organization', criteria: 'Organization?_id=%organization.id', readonlyFields: ['identifier'] },
    ]);
  });
});
