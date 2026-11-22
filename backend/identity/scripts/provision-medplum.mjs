#!/usr/bin/env node

/**
 * Deploys the Clargen Patient StructureDefinition and identity AccessPolicies
 * to one Medplum development project.
 *
 * Requires a short-lived access token belonging to a project administrator.
 * The token is read only from the process environment and is never printed.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const profilePath = resolve(
  scriptDirectory,
  '../fhir/fsh-generated/resources/StructureDefinition-clargen-patient.json'
);

const baseUrl = process.env.CLARGEN_MEDPLUM_BASE_URL?.replace(/\/$/, '');
const accessToken = process.env.CLARGEN_MEDPLUM_ACCESS_TOKEN;

if (!baseUrl || !accessToken) {
  console.error(
    'Set CLARGEN_MEDPLUM_BASE_URL and CLARGEN_MEDPLUM_ACCESS_TOKEN in your shell.'
  );
  process.exit(1);
}

const fhirBaseUrl = baseUrl.endsWith('/fhir/R4') ? baseUrl : `${baseUrl}/fhir/R4`;

async function request(resourceType, searchParameter, resource) {
  const url = resource
    ? `${fhirBaseUrl}/${resourceType}/${encodeURIComponent(resource.id)}`
    : `${fhirBaseUrl}/${resourceType}?${new URLSearchParams(searchParameter)}`;

  const response = await fetch(url, {
    method: resource ? 'PUT' : 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/fhir+json',
      ...(resource ? { 'Content-Type': 'application/fhir+json' } : {}),
    },
    ...(resource ? { body: JSON.stringify(resource) } : {}),
  });

  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    const detail =
      body?.issue?.map((issue) => issue.diagnostics ?? issue.details?.text).filter(Boolean).join('; ') ??
      body?.message ??
      response.statusText;
    throw new Error(`${response.status} ${response.statusText}: ${detail}`);
  }
  return body;
}

async function upsertBySearch(resourceType, searchParameter, resource) {
  const bundle = await request(resourceType, searchParameter);
  const matches = (bundle.entry ?? []).map((entry) => entry.resource).filter(Boolean);

  if (matches.length > 1) {
    throw new Error(
      `Expected at most one ${resourceType} matching ${JSON.stringify(searchParameter)}, found ${matches.length}. Resolve duplicates manually.`
    );
  }

  if (matches.length === 1) {
    const existing = matches[0];
    const updated = await request(resourceType, {}, { ...resource, id: existing.id });
    console.log(`Updated ${resourceType}/${updated.id}`);
    return updated;
  }

  const response = await fetch(`${fhirBaseUrl}/${resourceType}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/fhir+json',
      'Content-Type': 'application/fhir+json',
    },
    body: JSON.stringify(resource),
  });
  const created = await response.json().catch(() => undefined);
  if (!response.ok) {
    const detail =
      created?.issue?.map((issue) => issue.diagnostics ?? issue.details?.text).filter(Boolean).join('; ') ??
      created?.message ??
      response.statusText;
    throw new Error(`Create ${resourceType} failed: ${response.status} ${detail}`);
  }
  console.log(`Created ${resourceType}/${created.id}`);
  return created;
}

function validateProfile(profile) {
  const expected = {
    resourceType: 'StructureDefinition',
    id: 'clargen-patient',
    url: 'https://clargen.health/fhir/StructureDefinition/clargen-patient',
    type: 'Patient',
    derivation: 'constraint',
  };
  for (const [key, value] of Object.entries(expected)) {
    if (profile[key] !== value) {
      throw new Error(`Generated StructureDefinition has unexpected ${key}: ${profile[key]}`);
    }
  }
}

async function main() {
  const profile = JSON.parse(await readFile(profilePath, 'utf8'));
  validateProfile(profile);

  const issuerPolicy = {
    resourceType: 'AccessPolicy',
    name: 'Clargen Identity Issuer',
    resource: [
      {
        resourceType: 'Patient',
        interaction: ['create', 'search', 'read'],
      },
    ],
  };

  const immutabilityPolicy = {
    resourceType: 'AccessPolicy',
    name: 'Clargen Patient Identifier Immutability',
    resource: [
      {
        resourceType: 'Patient',
        criteria: 'Patient?_id=%patient.id',
        readonlyFields: ['identifier'],
      },
    ],
  };

  console.log(`Deploying Clargen identity resources to ${fhirBaseUrl}`);
  const deployedProfile = await upsertBySearch(
    'StructureDefinition',
    { url: profile.url },
    profile
  );
  const deployedIssuerPolicy = await upsertBySearch(
    'AccessPolicy',
    { name: issuerPolicy.name },
    issuerPolicy
  );
  const deployedImmutabilityPolicy = await upsertBySearch(
    'AccessPolicy',
    { name: immutabilityPolicy.name },
    immutabilityPolicy
  );

  console.log('\nDeployment resource IDs:');
  console.log(`StructureDefinition: ${deployedProfile.id}`);
  console.log(`Issuer AccessPolicy: ${deployedIssuerPolicy.id}`);
  console.log(`Immutability AccessPolicy: ${deployedImmutabilityPolicy.id}`);
  console.log('\nNext: create the dedicated ClientApplication in Medplum and attach the issuer policy to its ProjectMembership.');
}

main().catch((error) => {
  console.error(`Medplum provisioning failed: ${error.message}`);
  process.exitCode = 1;
});
