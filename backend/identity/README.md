# Clargen Health Identity

Server-side, independent Clargen Health ID issuance and Patient profile management for one Medplum development project.

This package contains no UI, signup/login workflow, external identity integration, or real patient data.

## Required deployment configuration

Before wiring this package into a server endpoint, create these project-scoped FHIR resources with a project administrator:

1. Install the compiled `fhir/clargen-patient.fsh` profile as a `StructureDefinition` with canonical URL `https://clargen.health/fhir/StructureDefinition/clargen-patient`.
2. Create the issuer `AccessPolicy` returned by `createIdentityIssuerAccessPolicy()`.
3. Create a dedicated `ClientApplication`, assign that policy through its membership, and keep its secret only in the Clargen backend's secret store.
4. Add `createPatientIdentifierImmutabilityPolicy()` to each patient membership alongside the normal patient-compartment policy.

The issuer requires `Patient` `create`, `search`, and `read` only. It intentionally has no update or delete authority. A profile-update request must use a caller-scoped Medplum token so Medplum evaluates that caller's own `AccessPolicy`.

## Local commands

```bash
npm install
npm run build --workspace @clargen/identity
npm test --workspace @clargen/identity
```

The integration test is skipped unless all variables below are set. The configured issuer must target a development-only project and may create synthetic Patient records.

```bash
export CLARGEN_MEDPLUM_BASE_URL=http://localhost:8103
export CLARGEN_IDENTITY_ISSUER_CLIENT_ID=...
export CLARGEN_IDENTITY_ISSUER_CLIENT_SECRET=...
npm test --workspace @clargen/identity -- --run test/identity-flow.integration.test.ts
```

## Security boundary

Create `MedplumIdentityFhirClient` only in a Clargen server process. Never send its `ClientApplication` secret, access token, or conditional-create capability to a browser.
