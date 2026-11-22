import type { MedplumClient, WithId } from '@medplum/core';
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
