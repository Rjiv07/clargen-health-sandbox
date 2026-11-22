# Medplum identity provisioning

The provisioning script delegates all resource validation and upsert behavior to
`provisionIdentityResources()` in the identity package. This is the single
source of truth for the StructureDefinition and AccessPolicy provisioning rules.

## 1. Build the FHIR profile

From the repository root:

```bash
npm run fhir:build
```

## 2. Obtain a project administrator access token

Sign in to the local Medplum App at `http://localhost:3000` using the
administrator account for the **Clargen Health Development** project. Obtain a
short-lived access token using your approved local development workflow.

Do not paste the token into chat, commit it, or place it in a tracked file.

## 3. Run provisioning

From the repository root:

```bash
export CLARGEN_MEDPLUM_BASE_URL=http://localhost:8103
read -rsp "Medplum access token: " CLARGEN_MEDPLUM_ACCESS_TOKEN
export CLARGEN_MEDPLUM_ACCESS_TOKEN
printf '\\n'
npm run provision:medplum
unset CLARGEN_MEDPLUM_ACCESS_TOKEN
```

The command builds the identity package, then uses the Medplum SDK and the
shared provisioning function to install or update:

- `StructureDefinition/clargen-patient`
- `AccessPolicy` named `Clargen Identity Issuer`
- `AccessPolicy` named `Clargen Patient Identifier Immutability`

It prints resource IDs only. It does not print the access token. The token is
read from the current shell environment and is not written to disk.

## 4. Create the issuer ClientApplication in Medplum

The ClientApplication and its project membership are intentionally created
through the Medplum App by a project administrator. This keeps the generated
client secret inside Medplum's credential workflow rather than creating or
printing a long-lived secret from a deployment script.

1. Open the **Client Applications** area in the Clargen Health Development project.
2. Create a dedicated application named `Clargen Identity Issuer`.
3. Attach the `Clargen Identity Issuer` AccessPolicy to its
   `ProjectMembership`.
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
- Use a short-lived project administrator token for provisioning only.
- The issuer ClientApplication secret belongs only on a trusted backend.
- A caller-scoped Medplum client must be used for patient profile updates.
- This script does not create a ClientApplication, patient account, or real ABHA.
