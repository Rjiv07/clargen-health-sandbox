#!/usr/bin/env node

/**
 * Deploys the generated Clargen Patient profile and identity AccessPolicies.
 * The actual upsert logic lives in the identity package so deployment and
 * application provisioning cannot drift apart.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MedplumClient } from '@medplum/core';
import { provisionIdentityResources } from '../dist/medplum-client.js';

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

async function main() {
  const patientProfile = JSON.parse(await readFile(profilePath, 'utf8'));
  const adminClient = new MedplumClient({
    baseUrl,
    accessToken,
    cacheTime: 0,
    logLevel: 'none',
  });

  console.log('Provisioning Clargen identity resources in the selected Medplum project...');
  const deployed = await provisionIdentityResources(adminClient, patientProfile);

  console.log('\nProvisioning complete:');
  console.log(`StructureDefinition/${deployed.patientProfile.id}`);
  console.log(`AccessPolicy/${deployed.issuerPolicy.id} (identity issuer)`);
  console.log(
    `AccessPolicy/${deployed.identifierImmutabilityPolicy.id} (identifier immutability)`
  );
}

main().catch((error) => {
  // Do not print request headers or credentials.
  console.error(`Medplum provisioning failed: ${error.message}`);
  process.exitCode = 1;
});
