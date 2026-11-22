import { MedplumClient, type WithId } from '@medplum/core';
import type { Bundle, Patient } from '@medplum/fhirtypes';
import type { IdentityFhirClient } from './types';

/**
 * Adapter for a server-held MedplumClient.
 * Never expose its credentials to a client application.
 */
export class MedplumIdentityFhirClient implements IdentityFhirClient {
  private readonly medplum: MedplumClient;

  constructor(medplum: MedplumClient) {
    this.medplum = medplum;
  }

  executeBatch(bundle: Bundle): Promise<Bundle> {
    return this.medplum.executeBatch(bundle);
  }

  searchPatientsByIdentifier(system: string, value: string): Promise<WithId<Patient>[]> {
    return this.medplum.searchResources(
      'Patient',
      `identifier=${encodeURIComponent(`${system}|${value}`)}`
    );
  }

  readPatient(id: string): Promise<WithId<Patient>> {
    return this.medplum.readResource('Patient', id);
  }

  updatePatient(patient: Patient, expectedVersionId: string): Promise<WithId<Patient>> {
    return this.medplum.updateResource(patient, {
      headers: {
        'If-Match': `W/"${expectedVersionId}"`,
      },
    });
  }
}

export interface IdentityIssuerConnection {
  readonly baseUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
}

/**
 * Creates an authenticated issuer adapter for trusted server-side use only.
 * Keep clientSecret in a server secret store; never call this from browser code.
 */
export async function connectIdentityIssuer(
  connection: IdentityIssuerConnection
): Promise<MedplumIdentityFhirClient> {
  if (!connection.baseUrl || !connection.clientId || !connection.clientSecret) {
    throw new Error('Medplum issuer baseUrl, clientId and clientSecret are required');
  }

  const medplum = new MedplumClient({ baseUrl: connection.baseUrl });
  await medplum.startClientLogin(connection.clientId, connection.clientSecret);
  return new MedplumIdentityFhirClient(medplum);
}
