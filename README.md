# Clargen Health Sandbox

An independent, ABDM-inspired digital health development sandbox.

## Phase 1 objectives

1. Unique Clargen Health ID creation.
2. Patient registration, authentication and profile management.
3. Secure patient lookup and health-record querying.
4. Local synthetic replicas of relevant healthcare directories, as confirmed
   by the project requirements.

## Sprint 1 scope

Sprint 1 implements the Clargen Health ID, its FHIR R4 Patient profile,
server-side issuance and lookup primitives, and the Medplum security
configuration needed to issue synthetic Patient identities.

Patient signup/login, provider record-query APIs, and local HPR/HFR directory
replicas are later sprint work. This repository does not connect to official
ABDM production services and does not issue real ABHA identities.

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
```

Build, typecheck and run identity unit tests:

```bash
npm run build
npm run typecheck
npm test
```

Compile the Clargen Patient FHIR R4 profile:

```bash
npm run fhir:build
```

The generated StructureDefinition is written to:

`backend/identity/fhir/fsh-generated/resources/StructureDefinition-clargen-patient.json`

See `backend/identity/fhir/README.md` and
`backend/identity/README.md` for FHIR profile and Medplum setup instructions.

The Medplum development server is provisioned separately from this repository.

## Continuous integration

GitHub Actions builds and validates the FHIR profile and runs the identity
workspace build, TypeScript checks and unit tests on Sprint 1 branches and pull
requests to main. The Medplum integration test remains opt-in and is run only
against the isolated development project.

## Security

Never commit environment secrets, ClientApplication credentials, access tokens
or real patient data. Use synthetic data only in this sandbox.
