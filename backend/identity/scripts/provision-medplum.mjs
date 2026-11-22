#!/usr/bin/env node

/** Deploys generated Clargen FHIR profiles and identity AccessPolicies. */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MedplumClient } from '@medplum/core';
import { provisionIdentityResources } from '../dist/medplum-client.js';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const generatedResources = resolve(scriptDirectory, '../fhir/fsh-generated/resources');
const baseUrl = process.env.CLARGEN_MEDPLUM_BASE_URL?.replace(/\/$/, '');
const accessToken = process.env.CLARGEN_MEDPLUM_ACCESS_TOKEN;
if (!baseUrl || !accessToken) {
  console.error('Set CLARGEN_MEDPLUM_BASE_URL and CLARGEN_MEDPLUM_ACCESS_TOKEN in your shell.');
  process.exit(1);
}
async function main() {
  const patientProfile = JSON.parse(await readFile(resolve(generatedResources, 'StructureDefinition-clargen-patient.json'), 'utf8'));
  const organizationProfile = JSON.parse(await readFile(resolve(generatedResources, 'StructureDefinition-clargen-organization.json'), 'utf8'));
  const adminClient = new MedplumClient({ baseUrl, accessToken, cacheTime: 0, logLevel: 'none' });
  console.log('Provisioning Clargen individual and organisation identity resources...');
  const deployed = await provisionIdentityResources(adminClient, patientProfile, organizationProfile);
  console.log('\nProvisioning complete:');
  console.log(`StructureDefinition/${deployed.patientProfile.id} (individual)`);
  console.log(`StructureDefinition/${deployed.organizationProfile.id} (organisation)`);
  console.log(`AccessPolicy/${deployed.issuerPolicy.id} (issuer)`);
  console.log(`AccessPolicy/${deployed.identifierImmutabilityPolicy.id} (individual identifier immutability)`);
  console.log(`AccessPolicy/${deployed.organizationIdentifierImmutabilityPolicy.id} (organisation identifier immutability)`);
}
main().catch((error) => {
  console.error(`Medplum provisioning failed: ${error.message}`);
  process.exitCode = 1;
});
