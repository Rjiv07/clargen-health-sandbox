import { createReference, MedplumClient, type WithId } from '@medplum/core';
import type {
  AccessPolicy,
  Bundle,
  Patient,
  Project,
  ProjectMembership,
  StructureDefinition,
} from '@medplum/fhirtypes';
import { createIdentityIssuerAccessPolicy, createPatientIdentifierImmutabilityPolicy } from './access-policies';
import { CLARGEN_PATIENT_PROFILE_URL } from './constants';
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

  const medplum = new MedplumClient({ baseUrl: connection.baseUrl, cacheTime: 0 });
  await medplum.startClientLogin(connection.clientId, connection.clientSecret);
  return new MedplumIdentityFhirClient(medplum);
}

export interface ProvisionedIdentityResources {
  readonly patientProfile: WithId<StructureDefinition>;
  readonly issuerPolicy: WithId<AccessPolicy>;
  readonly identifierImmutabilityPolicy: WithId<AccessPolicy>;
}

/**
 * Installs or updates the Sprint 1 FHIR profile and access policies.
 * The supplied MedplumClient must be authenticated as a project administrator.
 * Do not use the restricted issuer client for provisioning.
 */
export async function provisionIdentityResources(
  adminClient: MedplumClient,
  patientProfile: StructureDefinition
): Promise<ProvisionedIdentityResources> {
  if (
    patientProfile.resourceType !== 'StructureDefinition' ||
    patientProfile.url !== CLARGEN_PATIENT_PROFILE_URL ||
    patientProfile.type !== 'Patient' ||
    patientProfile.derivation !== 'constraint'
  ) {
    throw new Error('A valid Clargen Patient StructureDefinition is required');
  }

  const installedProfile = await upsertStructureDefinition(adminClient, patientProfile);
  const issuerPolicy = await upsertAccessPolicy(
    adminClient,
    createIdentityIssuerAccessPolicy()
  );
  const identifierImmutabilityPolicy = await upsertAccessPolicy(
    adminClient,
    createPatientIdentifierImmutabilityPolicy()
  );

  return {
    patientProfile: installedProfile,
    issuerPolicy,
    identifierImmutabilityPolicy,
  };
}

/**
 * Assigns a derived patient policy to an existing Patient membership.
 *
 * Medplum ProjectMembership has one accessPolicy reference. The derived policy
 * therefore uses basedOn to retain the project's normal Patient compartment
 * policy while adding a read-only Patient.identifier field restriction.
 * This must run with a project administrator client.
 */
export async function configurePatientMembershipAccess(
  adminClient: MedplumClient,
  patientId: string
): Promise<WithId<ProjectMembership>> {
  if (!patientId || !/^[A-Za-z0-9.-]+$/.test(patientId)) {
    throw new Error('A valid Medplum Patient resource ID is required');
  }

  const patient = await adminClient.readResource('Patient', patientId);
  const memberships = await adminClient.searchResources(
    'ProjectMembership',
    `profile=Patient/${encodeURIComponent(patient.id as string)}`
  );
  if (memberships.length !== 1) {
    throw new Error(
      `Expected exactly one ProjectMembership for Patient/${patientId}; found ${memberships.length}. Create or resolve the membership first.`
    );
  }

  const membership = memberships[0];
  const projectId = membership.project.reference?.split('/')[1];
  if (!projectId) {
    throw new Error('Patient membership does not reference a valid project');
  }
  const project = await adminClient.readResource<Project>('Project', projectId);
  const defaultPatientPolicy = project.defaultAccessPolicies?.find(
    (entry) => entry.profileType === 'Patient'
  )?.accessPolicy ?? project.defaultPatientAccessPolicy;
  const basePolicy = membership.accessPolicy ?? defaultPatientPolicy;
  if (!basePolicy?.reference) {
    throw new Error(
      'No Patient access policy is configured on this membership or as the project default. Configure the standard Patient compartment policy first.'
    );
  }

  const composedName = `Clargen Patient Access Policy - ${projectId}`;
  const composedPolicy: AccessPolicy = {
    resourceType: 'AccessPolicy',
    name: composedName,
    basedOn: [basePolicy],
    resource: [
      {
        resourceType: 'Patient',
        criteria: 'Patient?_id=%patient.id',
        readonlyFields: ['identifier'],
      },
    ],
  };
  const installedPolicy = await upsertAccessPolicy(adminClient, composedPolicy);

  return adminClient.updateResource({
    ...membership,
    accessPolicy: createReference(installedPolicy),
  });
}

async function upsertStructureDefinition(
  client: MedplumClient,
  resource: StructureDefinition
): Promise<WithId<StructureDefinition>> {
  const matches = await client.searchResources(
    'StructureDefinition',
    `url=${encodeURIComponent(resource.url as string)}`
  );
  if (matches.length > 1) {
    throw new Error('Multiple StructureDefinitions use the Clargen Patient canonical URL');
  }
  if (matches.length === 1) {
    return client.updateResource({ ...resource, id: matches[0].id });
  }
  return client.createResource(resource);
}

async function upsertAccessPolicy(
  client: MedplumClient,
  resource: AccessPolicy
): Promise<WithId<AccessPolicy>> {
  const matches = await client.searchResources(
    'AccessPolicy',
    `name=${encodeURIComponent(resource.name as string)}`
  );
  if (matches.length > 1) {
    throw new Error(`Multiple AccessPolicies are named "${resource.name}"`);
  }
  if (matches.length === 1) {
    return client.updateResource({ ...resource, id: matches[0].id });
  }
  return client.createResource(resource);
}
