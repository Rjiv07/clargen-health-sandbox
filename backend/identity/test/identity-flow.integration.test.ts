import { MedplumClient } from '@medplum/core';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, test } from 'vitest';
import {
  CLARGEN_HEALTH_ID_SYSTEM,
  MedplumIdentityFhirClient,
  MedplumPatientIdentityIssuer,
  MedplumPatientIdentityLookup,
} from '../src/index';

const baseUrl = process.env.CLARGEN_MEDPLUM_BASE_URL;
const clientId = process.env.CLARGEN_IDENTITY_ISSUER_CLIENT_ID;
const clientSecret = process.env.CLARGEN_IDENTITY_ISSUER_CLIENT_SECRET;
const enabled = Boolean(baseUrl && clientId && clientSecret);

/**
 * This test is intentionally opt-in. It creates synthetic records only and
 * expects the configured ClientApplication to have the Clargen issuer policy.
 */
describe.skipIf(!enabled)('Clargen identity flow against a development Medplum server', () => {
  const medplum = new MedplumClient({ baseUrl: baseUrl as string });

  afterAll(() => medplum.clear());

  test('issues a synthetic patient identity and looks it up by system and value', async () => {
    await medplum.startClientLogin(clientId as string, clientSecret as string);
    const client = new MedplumIdentityFhirClient(medplum);
    const issued = await new MedplumPatientIdentityIssuer(client).createPatientProfile({
      officialFamilyName: 'Integration',
      officialGivenNames: ['Synthetic'],
      birthDate: '1990-01-02',
      gender: 'unknown',
      email: `synthetic-${randomUUID()}@example.test`,
    });

    expect(issued.patient.identifier).toContainEqual(
      expect.objectContaining({ system: CLARGEN_HEALTH_ID_SYSTEM, value: issued.healthId })
    );
    const found = await new MedplumPatientIdentityLookup(client).findAuthorizedPatientByHealthId(issued.healthId);
    expect(found?.id).toBe(issued.patient.id);
  });
});
