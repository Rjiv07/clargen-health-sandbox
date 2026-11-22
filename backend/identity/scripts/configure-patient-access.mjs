#!/usr/bin/env node

/**
 * Adds the identifier-immutability restriction to one existing synthetic
 * Patient membership while preserving the project's default Patient policy.
 */

import { MedplumClient } from '@medplum/core';
import { configurePatientMembershipAccess } from '../dist/medplum-client.js';

const baseUrl = process.env.CLARGEN_MEDPLUM_BASE_URL?.replace(/\/$/, '');
const accessToken = process.env.CLARGEN_MEDPLUM_ACCESS_TOKEN;
const patientId = process.argv[2];

if (!baseUrl || !accessToken || !patientId) {
  console.error(
    'Usage: set CLARGEN_MEDPLUM_BASE_URL and CLARGEN_MEDPLUM_ACCESS_TOKEN, then run: npm run configure:patient-access -- <patient-resource-id>'
  );
  process.exit(1);
}

async function main() {
  const adminClient = new MedplumClient({
    baseUrl,
    accessToken,
    cacheTime: 0,
    logLevel: 'none',
  });
  const membership = await configurePatientMembershipAccess(adminClient, patientId);
  console.log('Patient membership policy configured:');
  console.log(`ProjectMembership/${membership.id}`);
  console.log(`Patient/${patientId}`);
  console.log(`AccessPolicy/${membership.accessPolicy?.reference?.split('/')[1] ?? 'unknown'}`);
}

main().catch((error) => {
  console.error(`Patient access configuration failed: ${error.message}`);
  process.exitCode = 1;
});
