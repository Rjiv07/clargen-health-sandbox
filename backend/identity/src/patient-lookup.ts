
import { CLARGEN_HEALTH_ID_SYSTEM } from './constants';
import { normalizeHealthId } from './health-id';
import type { IdentityFhirClient, PatientIdentityLookup } from './types';
import { IdentityIntegrityError, IdentityValidationError } from './types';

/**
 * The supplied client must represent the requesting user. Medplum applies the
 * caller's AccessPolicy to this search; this class never filters around it.
 */
export class MedplumPatientIdentityLookup implements PatientIdentityLookup {
  private readonly client: IdentityFhirClient;

  constructor(client: IdentityFhirClient) {
    this.client = client;
  }

  async findAuthorizedPatientByHealthId(healthIdInput: string) {
    const healthId = normalizeHealthId(healthIdInput);

    if (!healthId) {
      throw new IdentityValidationError('Invalid Clargen Health ID');
    }

    const matches = await this.client.searchPatientsByIdentifier(
      CLARGEN_HEALTH_ID_SYSTEM,
      healthId
    );

    if (matches.length > 1) {
      throw new IdentityIntegrityError(
        'Multiple Patient records match the supplied Clargen Health ID'
      );
    }

    return matches[0];
  }
}
