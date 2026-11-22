# Clargen Health Identity

Server-side, independent Clargen Health ID issuance, Patient lookup and Patient
profile management for one Medplum development project.

This Sprint 1 package provides identity primitives and the Medplum adapter. It
does not contain patient signup/login, provider-facing record querying, a UI,
external identity integration, or real patient data.

## FHIR profile

Build the profile from
`backend/identity/fhir/input/fsh/ClargenPatient.fsh`:

```bash
npm run fhir:build
```

The generated StructureDefinition is:
`backend/identity/fhir/fsh-generated/resources/StructureDefinition-clargen-patient.json`

Install this generated JSON resource into the intended Medplum development
project. Do not upload the FSH source file. Its canonical URL is
`https://clargen.health/fhir/StructureDefinition/clargen-patient`.

## Medplum project configuration

Use a project administrator in the **Clargen Health Development** project.

1. Create the `Clargen Identity Issuer` AccessPolicy using
   `createIdentityIssuerAccessPolicy()`. It must grant only Patient
   `create`, `search` and `read`.
2. Create a dedicated `ClientApplication` named `Clargen Identity Issuer`.
3. Attach the issuer AccessPolicy to the ClientApplication's
   `ProjectMembership`.
4. Store the ClientApplication ID and secret in the trusted backend's local
   secret store. Never commit them or expose them to a browser.
5. Create the `Clargen Patient Identifier Immutability` AccessPolicy using
   `createPatientIdentifierImmutabilityPolicy()`.
6. Add the immutability policy to each Patient membership alongside the
   standard patient-compartment policy. Do not replace the compartment policy.

The issuer credential is not allowed to update or delete Patient resources.
Profile updates must use a Medplum client authenticated as the requesting
patient/user so the caller's own AccessPolicy is enforced.

## Identity model

- `Patient.id` is the Medplum FHIR resource ID.
- `Patient.identifier` with system
  `https://clargen.health/fhir/identifier/health-id` is the Clargen Health ID.
- The Clargen Health ID is a lookup identifier, not an authentication secret.
- Medplum `User` is a separate authentication identity; signup and login are
  outside Sprint 1.
- `MedplumPatientIdentityLookup` requires a caller-scoped client. It does not
  bypass Medplum access control.

## Local commands

```bash
npm install
npm run build
npm run typecheck
npm test
npm run fhir:build
```

The opt-in integration test creates synthetic Patient records only. It requires
the dedicated issuer ClientApplication credentials and a development project:

```bash
export CLARGEN_MEDPLUM_BASE_URL=http://localhost:8103
export CLARGEN_IDENTITY_ISSUER_CLIENT_ID=...
export CLARGEN_IDENTITY_ISSUER_CLIENT_SECRET=...
npm run test:integration --workspace @clargen/identity
```

## Security boundary

Construct `MedplumIdentityFhirClient` only in a trusted Clargen server
process. Never send a ClientApplication secret, access token, or privileged
client to a browser.
