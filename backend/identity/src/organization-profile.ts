import type { Identifier, Organization } from '@medplum/fhirtypes';
import { CLARGEN_HEALTH_ID_SYSTEM, CLARGEN_ORGANIZATION_PROFILE_URL, CLARGEN_PARTICIPANT_TYPE_SYSTEM } from './constants';
import { isClargenHealthId } from './health-id';
import type { ClargenHealthId, CreateOrganizationProfileInput } from './participant-types';
import { IdentityValidationError } from './types';
const participantTypes = new Set(['supplier', 'laboratory', 'manufacturer']);
export function buildClargenOrganization(input: CreateOrganizationProfileInput, healthId: ClargenHealthId): Organization {
  validateCreateOrganizationProfileInput(input);
  const telecom = [
    ...(input.email ? [{ system: 'email' as const, value: input.email.trim() }] : []),
    ...(input.phone ? [{ system: 'phone' as const, value: input.phone.trim() }] : []),
  ];
  return {
    resourceType: 'Organization', active: true, meta: { profile: [CLARGEN_ORGANIZATION_PROFILE_URL] },
    identifier: [buildClargenHealthIdentifier(healthId)],
    type: [{ coding: [{ system: CLARGEN_PARTICIPANT_TYPE_SYSTEM, code: input.participantType }] }],
    name: input.name.trim(),
    ...(input.registrationNumber ? { alias: [`Registration: ${input.registrationNumber.trim()}`] } : {}),
    ...(telecom.length ? { telecom } : {}),
  };
}
export function buildClargenHealthIdentifier(healthId: ClargenHealthId): Identifier {
  return { use: 'usual', system: CLARGEN_HEALTH_ID_SYSTEM, value: healthId };
}
export function getOrganizationHealthId(organization: Organization): ClargenHealthId | undefined {
  const matches = organization.identifier?.filter((item) => item.system === CLARGEN_HEALTH_ID_SYSTEM) ?? [];
  if (matches.length !== 1 || !matches[0].value || !isClargenHealthId(matches[0].value)) return undefined;
  return matches[0].value;
}
export function validateClargenOrganization(organization: Organization): void {
  const issues: string[] = [];
  if (organization.active !== true) issues.push('Organization.active must be true at identity issuance');
  if (!organization.meta?.profile?.includes(CLARGEN_ORGANIZATION_PROFILE_URL)) issues.push('Organization.meta.profile must include the Clargen Organization profile');
  if (!getOrganizationHealthId(organization)) issues.push('Organization must have exactly one valid Clargen Health ID');
  if (!organization.name?.trim()) issues.push('Organization.name is required');
  const type = organization.type?.flatMap((item) => item.coding ?? []).find((coding) => coding.system === CLARGEN_PARTICIPANT_TYPE_SYSTEM)?.code;
  if (!type || !participantTypes.has(type)) issues.push('Organization must have a supported Clargen participant type');
  if (issues.length) throw new IdentityValidationError('Invalid Clargen Organization profile', issues);
}
export function validateCreateOrganizationProfileInput(input: CreateOrganizationProfileInput): void {
  const issues: string[] = [];
  if (!input.name?.trim()) issues.push('name is required');
  if (!participantTypes.has(input.participantType)) issues.push('participantType must be supplier, laboratory or manufacturer');
  if (input.email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(input.email.trim())) issues.push('email must be a valid email address');
  if (input.phone !== undefined && !input.phone.trim()) issues.push('phone must not be blank');
  if (input.registrationNumber !== undefined && !input.registrationNumber.trim()) issues.push('registrationNumber must not be blank');
  if (issues.length) throw new IdentityValidationError('Invalid organization profile input', issues);
}
