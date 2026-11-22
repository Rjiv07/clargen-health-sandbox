# Clargen Health Sandbox

An independent, ABDM-inspired digital health development sandbox.

## Phase 1 objectives

1. Unique Clargen Health ID creation.
2. Patient registration, authentication and profile management.
3. Secure patient lookup and health-record querying.
4. Local synthetic replicas of relevant healthcare directories, as confirmed
   by the project requirements.

## Sprint 1 scope

Sprint 1 delivers the Clargen Health ID identity foundation: a FHIR R4 Patient
profile, server-side identity issuance, Health ID lookup, version-aware profile
updates, Medplum access-policy configuration, and an authenticated HTTP API
factory.

Patient signup/login and OTP, provider record-query APIs, and local HPR/HFR
directory replicas are later sprint work. This repository does not connect to
official ABDM services and does not issue real ABHA identities.

## Development principles

- Synthetic patient data only.
- Isolated development environment.
- FHIR R4 resource interoperability.
- Medplum as healthcare infrastructure.
- Server-side identity issuance and access control.
- No real ABDM identities or live ABDM patient data.

## Architecture

- Backend: Node.js and TypeScript.
- Healthcare infrastructure: Medplum.
- Data model and APIs: HL7 FHIR R4.
- Unit and integration testing: Vitest.
- FHIR profile source: FSH, compiled with SUSHI.

## Prerequisites

- Node.js 22.18 or newer in the supported 22.x line (or Node.js 24.2+).
- npm.
- A Medplum development project for deployment and integration testing.

## Local development

Install dependencies from the repository root:

```bash
npm install
npm run fhir:build
npm run build
npm run typecheck
npm test
```

See [Sprint 1 demo instructions](backend/identity/README.md) for Medplum
provisioning, issuer ClientApplication setup, membership policy configuration,
API routes, and the Postman collection.

## Continuous integration

The current GitHub Actions workflow builds the FHIR profile, validates its
canonical URL, and uploads the generated FHIR resources. TypeScript build,
typecheck, unit tests, and the opt-in Medplum integration test are listed in
the Sprint 1 handoff instructions and must be run during final sprint
validation. The Medplum integration test requires the isolated development
project and dedicated issuer credentials.

## Security

Never commit environment secrets, ClientApplication credentials, access tokens
or real patient data. Use synthetic data only in this sandbox.
