import type { Bundle, Patient, Resource } from '@medplum/fhirtypes';
import type { WithId } from '@medplum/core';

export type ClargenHealthId = `CLH-${string}`;

export type AdministrativeGender = NonNullable<Patient['gender']>;

export interface CreatePatientProfileInput {
  readonly officialFamilyName: string;
  readonly officialGivenNames: readonly [string, ...string[]];
  readonly birthDate: string;
  readonly gender: AdministrativeGender;
  readonly email?: string;
  readonly phone?: string;
}

export interface UpdatePatientProfileInput {
  readonly officialFamilyName?: string;
  readonly officialGivenNames?: readonly [string, ...string[]];
  readonly birthDate?: string;
  readonly gender?: AdministrativeGender;
  readonly email?: string;
  readonly phone?: string;
  readonly expectedVersionId: string;
}

export interface IssuedPatientIdentity {
  readonly patient: WithId<Patient>;
  readonly patientReference: `Patient/${string}`;
  readonly healthId: ClargenHealthId;
  readonly created: true;
}

/**
 * A narrow server-side adapter. Implement it with a server-held MedplumClient;
 * never construct it in a browser bundle with a privileged client secret.
 */
export interface IdentityFhirClient {
  executeBatch(bundle: Bundle): Promise<Bundle>;
  searchPatientsByIdentifier(system: string, value: string): Promise<WithId<Patient>[]>;
  readPatient(id: string): Promise<WithId<Patient>>;
  updatePatient(patient: Patient, expectedVersionId: string): Promise<WithId<Patient>>;
}

export interface HealthIdGenerator {
  generate(): ClargenHealthId;
}

export interface PatientIdentityIssuer {
  createPatientProfile(input: CreatePatientProfileInput): Promise<IssuedPatientIdentity>;
}

export interface PatientIdentityLookup {
  findAuthorizedPatientByHealthId(healthIdInput: string): Promise<WithId<Patient> | undefined>;
}

export interface PatientProfileService {
  updateAuthorizedProfile(patientId: string, update: UpdatePatientProfileInput): Promise<WithId<Patient>>;
}

export class IdentityValidationError extends Error {
  readonly issues: readonly string[];

  constructor(message: string, issues: readonly string[] = [message]) {
    super(message);
    this.name = 'IdentityValidationError';
    this.issues = issues;
  }
}

export class IdentityIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdentityIntegrityError';
  }
}

export class IdentityIssuanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdentityIssuanceError';
  }
}

export function isResource<T extends Resource>(value: unknown, resourceType: T['resourceType']): value is WithId<T> {
  return !!value && typeof value === 'object' && (value as Resource).resourceType === resourceType && !!(value as Resource).id;
}
