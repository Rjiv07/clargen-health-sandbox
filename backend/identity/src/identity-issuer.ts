
import type { Bundle, BundleEntry, Patient } from '@medplum/fhirtypes';
import { CLARGEN_HEALTH_ID_SYSTEM, MAX_ID_ISSUANCE_ATTEMPTS } from './constants';
import { buildClargenPatient, validateCreatePatientProfileInput } from './patient-profile';
import type {
  CreatePatientProfileInput,
  HealthIdGenerator,
  IdentityFhirClient,
  IssuedPatientIdentity,
  PatientIdentityIssuer,
} from './types';
import { IdentityIntegrityError, IdentityIssuanceError, isResource } from './types';
import { CryptoHealthIdGenerator } from './health-id';

export class MedplumPatientIdentityIssuer implements PatientIdentityIssuer {
  private readonly client: IdentityFhirClient;
  private readonly generator: HealthIdGenerator;
  private readonly maxAttempts: number;

  constructor(
    client: IdentityFhirClient,
    generator: HealthIdGenerator = new CryptoHealthIdGenerator(),
    maxAttempts = MAX_ID_ISSUANCE_ATTEMPTS
  ) {
    this.client = client;
    this.generator = generator;
    this.maxAttempts = maxAttempts;
  }

  async createPatientProfile(input: CreatePatientProfileInput): Promise<IssuedPatientIdentity> {
    validateCreatePatientProfileInput(input);

    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      const healthId = this.generator.generate();
      const patient = buildClargenPatient(input, healthId);
      let result: Bundle;

      try {
        result = await this.client.executeBatch(createConditionalPatientBundle(patient, healthId));
      } catch (err) {
        if (attempt + 1 < this.maxAttempts && isRetryableIssuanceFailure(err)) {
          continue;
        }
        throw err;
      }

      const entry = result.entry?.[0];
      const status = entry?.response?.status;

      if (isCreated(entry)) {
        const createdPatient = entry?.resource;

        if (
          !createdPatient ||
          !isResource<Patient>(createdPatient, 'Patient') ||
          !createdPatient.id
        ) {
          throw new IdentityIssuanceError(
            'FHIR server created a Patient without returning a valid Patient resource'
          );
        }

        return {
          patient: createdPatient,
          patientReference: `Patient/${createdPatient.id}`,
          healthId,
          created: true,
        };
      }

      if (isExistingMatch(entry)) {
        // A match means this randomly generated candidate is already occupied.
        // Never expose or reuse that Patient; generate another candidate.
        continue;
      }

      if (status?.startsWith('412')) {
        throw new IdentityIntegrityError(
          'Multiple Patient records already use a Clargen Health ID candidate'
        );
      }

      throw new IdentityIssuanceError(
        `Unexpected conditional Patient create response: ${status ?? 'missing status'}`
      );
    }

    throw new IdentityIssuanceError(
      'Unable to issue a unique Clargen Health ID after bounded retries'
    );
  }
}

export function createConditionalPatientBundle(patient: Patient, healthId: string): Bundle {
  const identifierQuery = encodeURIComponent(`${CLARGEN_HEALTH_ID_SYSTEM}|${healthId}`);

  return {
    resourceType: 'Bundle',
    type: 'batch',
    entry: [
      {
        resource: patient,
        request: {
          method: 'POST',
          url: 'Patient',
          ifNoneExist: `identifier=${identifierQuery}`,
        },
      },
    ],
  };
}

function isCreated(entry: BundleEntry | undefined): boolean {
  return entry?.response?.status?.startsWith('201') === true;
}

function isExistingMatch(entry: BundleEntry | undefined): boolean {
  return entry?.response?.status?.startsWith('200') === true;
}

function isRetryableIssuanceFailure(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /could not serialize|serialization|deadlock|retry|\b429\b|\b503\b/i.test(message);
}
