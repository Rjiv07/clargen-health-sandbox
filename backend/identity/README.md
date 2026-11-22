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

Its canonical URL is
`https://clargen.health/fhir/StructureDefinition/clargen-patient`.

## Provision the Medplum project

The package exports `provisionIdentityResources(adminClient, patientProfile)`.
Call it from a trusted deployment script with:

- a MedplumClient authenticated as a project administrator for the
  **Clargen Health Development** project; and
- the generated StructureDefinition JSON parsed as a FHIR resource.

The function idempotently creates or updates the StructureDefinition and both
Sprint 1 AccessPolicies. It stops if duplicate canonical URLs or policy names
are found. Do not use the restricted issuer client for provisioning.

The issuer policy grants only Patient `create`, `search` and `read`.
The identifier immutability policy is a separate policy and must be composed
with the normal patient-compartment policy on each Patient membership.

## Create the issuer ClientApplication

Create the dedicated application in the Medplum App as a project administrator:

1. Open **Client Applications** in the Clargen Health Development project.
2. Create a dedicated application named `Clargen Identity Issuer`.
3. Attach the `Clargen Identity Issuer` AccessPolicy to its
   `ProjectMembership`.
4. Store the ClientApplication ID and secret in the trusted backend's local
   secret store. Never commit them or expose them to a browser.

The credential must not have Patient update or delete authority. The
`connectIdentityIssuer()` factory creates a server-side Medplum client from
the base URL, client ID and secret.

## Identity model

- `Patient.id` is the Medplum FHIR resource ID.
- `Patient.identifier` with system
  `https://clargen.health/fhir/identifier/health-id` is the Clargen Health ID.
- The Clargen Health ID is a lookup identifier, not an authentication secret.
- Medplum `User` is a separate authentication identity; signup and login are
  outside Sprint 1.
- `MedplumPatientIdentityLookup` requires a caller-scoped client. It does not
  bypass Medplum access control.
- Profile updates must use a client scoped to the authenticated caller, not
  the privileged issuer credential.

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
