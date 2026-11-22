# Clargen Health Sandbox

An independent, ABDM-inspired digital health development sandbox.

## Phase 1 objectives

1. Unique Clargen Health ID creation.
2. Patient registration, authentication and profile management.
3. Secure patient lookup and health-record querying.
4. Local synthetic replicas of relevant healthcare directories, as confirmed by project requirements.

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
- A Medplum development project for integration testing and deployment.

## Local development

Install dependencies from the repository root:

```bash
npm install
```

Build and test the identity workspace:

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

See `backend/identity/fhir/README.md` for profile installation instructions and `backend/identity/README.md` for identity service configuration.

The Medplum development server is currently provisioned separately; a repository-contained Docker Compose deployment is planned as a later Sprint 1 handover task.

## Security

Never commit environment secrets, ClientApplication credentials, access tokens or real patient data. Use synthetic data only in this sandbox.
