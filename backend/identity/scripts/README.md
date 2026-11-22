# Medplum identity provisioning

This script deploys the generated Clargen Patient profile and the two identity
AccessPolicies to the selected Medplum project. It is safe to re-run: it updates
a single existing resource with the same canonical URL or policy name, creates
it when absent, and stops if duplicate matches exist.

## 1. Build the FHIR profile

From the repository root:

```bash
npm run fhir:build
```

## 2. Obtain a project administrator access token

Sign in to the local Medplum App at `http://localhost:3000` using the administrator
account for the **Clargen Health Development** project. Obtain a short-lived
access token using your approved local development workflow.

Do not paste the token into chat, commit it, or place it in a tracked file.

## 3. Run provisioning

From the repository root, set the values in your current shell:

```bash
export CLARGEN_MEDPLUM_BASE_URL=http://localhost:8103
read -rsp "Medplum access token: " CLARGEN_MEDPLUM_ACCESS_TOKEN
export CLARGEN_MEDPLUM_ACCESS_TOKEN
printf '\\n'
node backend/identity/scripts/provision-medplum.mjs
unset CLARGEN_MEDPLUM_ACCESS_TOKEN
```

The script installs or updates:

- `StructureDefinition/clargen-patient`
- `AccessPolicy` named `Clargen Identity Issuer`
- `AccessPolicy` named `Clargen Patient Identifier Immutability`

It prints the resulting resource IDs, not the access token.

## 4. Create the issuer ClientApplication in Medplum

The ClientApplication and its project membership are intentionally created
through the Medplum App by a project administrator. This keeps the generated
client secret inside Medplum's credential workflow rather than creating or
printing a long-lived secret from a deployment script.

1. Open the **Client Applications** area in the Clargen Health Development project.
2. Create a dedicated application named `Clargen Identity Issuer`.
3. Open its project membership and attach the `Clargen Identity Issuer`
   AccessPolicy created above.
4. Save the client ID and secret directly in the Clargen backend's local secret
   store or untracked environment. Never put the secret in GitHub or browser code.
5. Confirm the application is scoped to the Clargen Health Development project.

The issuer policy grants only Patient create, search and read interactions. It
does not grant Patient update or delete.

## 5. Patient identifier immutability

The `Clargen Patient Identifier Immutability` policy must be attached to each
patient's ProjectMembership alongside the standard patient-compartment policy.
Do not replace the normal compartment policy with the immutability policy.
Patient membership creation and policy composition are wired into the
registration workflow in a later sprint; for the Sprint 1 integration, configure
the policy on any synthetic test Patient membership manually if one is used.

## Security and scope

- Use only the local development project and synthetic records.
- The issuer ClientApplication secret belongs only on a trusted backend.
- A caller-scoped Medplum client must be used for patient profile updates.
- This script does not create a ClientApplication, patient account, or real ABHA.
