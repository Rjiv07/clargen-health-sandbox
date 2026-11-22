import { applyPatientProfileUpdate } from './patient-profile';
import type { IdentityFhirClient, PatientProfileService, UpdatePatientProfileInput } from './types';

/**
 * The client must be scoped to the authenticated actor. Server-side Medplum
 * policy remains the authority for whether the actor may read or update a Patient.
 */
export class MedplumPatientProfileService implements PatientProfileService {
  private readonly client: IdentityFhirClient;

  constructor(client: IdentityFhirClient) {
    this.client = client;
  }

  async updateAuthorizedProfile(patientId: string, update: UpdatePatientProfileInput) {
    const current = await this.client.readPatient(patientId);
    const updated = applyPatientProfileUpdate(current, update);
    return this.client.updatePatient(updated, update.expectedVersionId);
  }
}
