# Clargen Health Identity — Sprint 1 demo

This package contains an independent identity sandbox built on Medplum and
FHIR R4. It is not an ABHA issuer, an ABDM integration, or a production
health-record system.

## What Sprint 1 demonstrates

- A unique `CLH-...` Clargen Health ID stored as a FHIR Patient identifier.
- A constrained Clargen Patient StructureDefinition.
- Server-side issuance using a dedicated Medplum ClientApplication.
- Patient lookup by identifier system and value.
- Version-aware Patient profile updates.
- A restricted issuer policy and a derived Patient membership policy that
  retains the project's default Patient compartment permissions while making
  `Patient.identifier` read-only.
- An authenticated HTTP API factory with caller-scoped read/update services.

Patient signup/login, OTP, provider directories, provider search, record sharing,
and official ABDM integrations are not Sprint 1 deliverables.

## 1. Start local Medplum

Start the local Medplum stack. The expected local endpoints are:

- App: `http://localhost:3000`
- API: `http://localhost:8103`

Use the **Clargen Health Development** project and synthetic records only.

## 2. Install the FHIR profile and policies

From the repository root:

```bash
npm install
npm run fhir:build
export CLARGEN_MEDPLUM_BASE_URL=http://localhost:8103
read -rsp "Medplum admin access token: " CLARGEN_MEDPLUM_ACCESS_TOKEN
export CLARGEN_MEDPLUM_ACCESS_TOKEN
printf '\\n'
npm run provision:medplum
```

This installs or updates the Clargen Patient StructureDefinition, the
restricted issuer AccessPolicy, and the Patient identifier immutability
AccessPolicy. The token is read from the shell and is not written to a file.

## 3. Create the issuer ClientApplication

In the Medplum App, as a project administrator:

1. Open the **Clargen Health Development** project.
2. Open **Client Applications** and create `Clargen Identity Issuer`.
3. Attach the `Clargen Identity Issuer` AccessPolicy to its membership.
4. Confirm the application belongs to this development project.
5. Copy its client ID and secret directly into your local secret manager or
   untracked environment. Never put them in Git or browser code.

The policy grants Patient create, search and read only. It does not grant
Patient update or delete. The Health ID is an identifier, not a login secret.

## 4. Configure Patient membership protection

Patient issuance creates the FHIR Patient resource. It does not automatically
create a Medplum User or ProjectMembership; account registration is Sprint 2.

For a demo of membership-level identifier protection, create or invite a
synthetic Patient membership in Medplum, then configure its policy using the
Patient resource ID:

```bash
npm run configure:patient-access -- <patient-resource-id>
```

This command derives a project-specific AccessPolicy using both the
membership's existing/default Patient compartment policy and the provisioned
`Clargen Patient Identifier Immutability` policy via `AccessPolicy.basedOn`.
It updates the membership to reference the derived policy. It stops if the
membership is missing/ambiguous or no base Patient policy is configured.
This preserves the normal Patient compartment restrictions.

## 5. Run the identity integration test

Set the dedicated issuer credentials in the current shell:

```bash
export CLARGEN_IDENTITY_ISSUER_CLIENT_ID=...
read -rsp "Issuer client secret: " CLARGEN_IDENTITY_ISSUER_CLIENT_SECRET
export CLARGEN_IDENTITY_ISSUER_CLIENT_SECRET
printf '\\n'
npm run test:integration --workspace @clargen/identity
```

The opt-in integration test creates a synthetic Patient, confirms the Health ID
identifier and looks it up. It does not use real patient information.

## 6. HTTP API demo

The package exports `createIdentityHttpServer()`. It is a server factory, not
a standalone server or an authentication provider. A trusted host must inject:

- an `authenticate(request)` function that validates a session/bearer token;
- an issuer service backed by the restricted issuer ClientApplication; and
- lookup, profile and read services backed by the authenticated caller's
  Medplum permissions.

Never use the administrator token as the API bearer token. Never use the
restricted issuer client for patient reads or profile updates. Import the
Postman collection at
`postman/Clargen-Health-Identity-Sprint-1.postman_collection.json`, then set
`baseUrl` and `accessToken` after deploying a trusted host.

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| POST | `/api/v1/patients` | Issue identity (issuer-authorized actor only) |
| GET | `/api/v1/patients/health-id/:healthId` | Caller-authorized Health ID lookup |
| GET | `/api/v1/patients/:patientId/profile` | Caller-authorized Patient read |
| PATCH | `/api/v1/patients/:patientId/profile` | Caller-authorized, version-aware profile update |

## 7. End-of-sprint validation

Run from the repository root:

```bash
npm run build
npm run typecheck
npm test
npm run fhir:build
npm run test:integration --workspace @clargen/identity
```

The integration test is opt-in and needs a local Medplum server plus the
dedicated issuer ClientApplication credentials. Use only synthetic data.

## Security and limitations

- Independent Clargen Health identifiers are not ABHA numbers.
- No connection to official ABDM production or sandbox services is implemented.
- No real patient data should be entered.
- API authentication is injected by the host and is not yet a login/OTP system.
- The Postman collection is an API contract/demo aid; it does not replace a
  deployed host or authentication adapter.
