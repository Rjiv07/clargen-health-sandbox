import type { Identifier, Patient } from '@medplum/fhirtypes';
import { CLARGEN_HEALTH_ID_SYSTEM, CLARGEN_PATIENT_PROFILE_URL } from './constants';
import { isClargenHealthId } from './health-id';
import type { ClargenHealthId, CreatePatientProfileInput, UpdatePatientProfileInput } from './types';
import { IdentityIntegrityError, IdentityValidationError } from './types';

const allowedGenders = new Set<NonNullable<Patient['gender']>>(['female', 'male', 'other', 'unknown']);

export function buildClargenPatient(input: CreatePatientProfileInput, healthId: ClargenHealthId): Patient {
  validateCreatePatientProfileInput(input);
  return {
    resourceType: 'Patient',
    active: true,
    meta: { profile: [CLARGEN_PATIENT_PROFILE_URL] },
    identifier: [buildClargenHealthIdentifier(healthId)],
    name: [
      {
        use: 'official',
        family: input.officialFamilyName.trim(),
        given: input.officialGivenNames.map((name) => name.trim()),
      },
    ],
    birthDate: input.birthDate,
    gender: input.gender,
    telecom: buildTelecom(input.email, input.phone),
  };
}

export function buildClargenHealthIdentifier(healthId: ClargenHealthId): Identifier {
  return { use: 'usual', system: CLARGEN_HEALTH_ID_SYSTEM, value: healthId };
}

export function getClargenHealthId(patient: Patient): ClargenHealthId | undefined {
  const identifiers = patient.identifier?.filter((identifier) => identifier.system === CLARGEN_HEALTH_ID_SYSTEM) ?? [];
  if (identifiers.length !== 1 || !identifiers[0].value || !isClargenHealthId(identifiers[0].value)) {
    return undefined;
  }
  return identifiers[0].value;
}

export function validateClargenPatient(patient: Patient): void {
  const issues: string[] = [];
  if (patient.active !== true) {
    issues.push('Patient.active must be true at identity issuance');
  }
  if (!patient.meta?.profile?.includes(CLARGEN_PATIENT_PROFILE_URL)) {
    issues.push('Patient.meta.profile must include the Clargen Patient profile');
  }
  if (!getClargenHealthId(patient)) {
    issues.push('Patient must have exactly one valid Clargen Health ID identifier');
  }
  const officialName = patient.name?.find((name) => name.use === 'official');
  if (!officialName?.family?.trim() || !officialName.given?.some((name) => name.trim())) {
    issues.push('Patient must have an official family name and given name');
  }
  if (!isFhirDate(patient.birthDate)) {
    issues.push('Patient.birthDate must be a valid FHIR date');
  }
  if (!patient.gender || !allowedGenders.has(patient.gender)) {
    issues.push('Patient.gender is required');
  }
  if (issues.length > 0) {
    throw new IdentityValidationError('Invalid Clargen Patient profile', issues);
  }
}

export function applyPatientProfileUpdate(patient: Patient, update: UpdatePatientProfileInput): Patient {
  if (!update.expectedVersionId) {
    throw new IdentityValidationError('expectedVersionId is required');
  }
  if (patient.meta?.versionId !== update.expectedVersionId) {
    throw new IdentityValidationError('Patient version does not match expectedVersionId');
  }
  const healthId = getClargenHealthId(patient);
  if (!healthId) {
    throw new IdentityIntegrityError('Patient does not have one valid immutable Clargen Health ID');
  }

  const currentOfficialName = patient.name?.find((name) => name.use === 'official');
  const family = update.officialFamilyName?.trim() ?? currentOfficialName?.family;
  const given = update.officialGivenNames?.map((name) => name.trim()) ?? currentOfficialName?.given;
  const updated: Patient = {
    ...patient,
    identifier: patient.identifier?.map((identifier) => ({ ...identifier })),
    name: patient.name?.map((name) =>
      name.use === 'official' ? { ...name, family: family ?? undefined, given: given ? [...given] : undefined } : { ...name }
    ),
    birthDate: update.birthDate ?? patient.birthDate,
    gender: update.gender ?? patient.gender,
    telecom: mergeTelecom(patient, update),
  };
  validateClargenPatient(updated);
  if (getClargenHealthId(updated) !== healthId) {
    throw new IdentityIntegrityError('Clargen Health ID mutation is not permitted');
  }
  return updated;
}

export function validateCreatePatientProfileInput(input: CreatePatientProfileInput): void {
  const issues: string[] = [];
  if (!input.officialFamilyName?.trim()) {
    issues.push('officialFamilyName is required');
  }
  if (!input.officialGivenNames?.length || input.officialGivenNames.some((name) => !name.trim())) {
    issues.push('At least one non-empty officialGivenName is required');
  }
  if (!isFhirDate(input.birthDate)) {
    issues.push('birthDate must be a valid FHIR date');
  }
  if (!allowedGenders.has(input.gender)) {
    issues.push('gender is required');
  }
  if (input.email && !isEmail(input.email)) {
    issues.push('email must be a valid email address');
  }
  if (input.phone && !input.phone.trim()) {
    issues.push('phone must not be blank');
  }
  if (issues.length > 0) {
    throw new IdentityValidationError('Invalid patient profile input', issues);
  }
}

function buildTelecom(email: string | undefined, phone: string | undefined): Patient['telecom'] {
  const telecom = [
    ...(email ? [{ system: 'email' as const, use: 'home' as const, value: email.trim() }] : []),
    ...(phone ? [{ system: 'phone' as const, use: 'mobile' as const, value: phone.trim() }] : []),
  ];
  return telecom.length ? telecom : undefined;
}

function mergeTelecom(patient: Patient, update: UpdatePatientProfileInput): Patient['telecom'] {
  const retained = (patient.telecom ?? []).filter((point) => point.system !== 'email' && point.system !== 'phone');
  const existingEmail = patient.telecom?.find((point) => point.system === 'email')?.value;
  const existingPhone = patient.telecom?.find((point) => point.system === 'phone')?.value;
  const telecom = [...retained, ...(buildTelecom(update.email ?? existingEmail, update.phone ?? existingPhone) ?? [])];
  return telecom.length ? telecom : undefined;
}

function isFhirDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
