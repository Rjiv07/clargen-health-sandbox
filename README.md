# Clargen Health Sandbox

An independent, ABDM-inspired digital health development sandbox.

## Phase 1 objectives

1. Unique Clargen Health ID creation.
2. Patient registration, authentication and profile management.
3. Secure patient lookup and health-record querying.
4. Local synthetic replicas of relevant healthcare directories, as confirmed
   by project requirements.

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

## Local development

See `backend/identity/README.md` for identity package instructions.

The Medplum development server must be running separately.

## Security

Never commit environment secrets, ClientApplication credentials,
access tokens or real patient data.
