# Clargen Health ID Sandbox

## Project goal

Build a working, independent, local sandbox that demonstrates a Clargen-owned Health ID system inspired by selected identity capabilities of India's Ayushman Bharat Digital Mission (ABDM), particularly the ABHA identity experience.

The immediate objective is a functional identity lifecycle: a person can sign up, receive a unique Clargen Health ID, sign in, and have their identity retrieved through ID-based queries and search.

This is a development replica for learning and validating identity workflows. It is not an ABDM integration, does not issue government ABHA credentials, and must not represent a Clargen Health ID as an official ABHA number.

## MVP scope

The first milestone is limited to individual identity:

1. **Signup** — register an individual with the minimum required identity details and secure authentication credentials.
2. **Health ID issuance** — generate a unique, persistent Clargen Health ID for the newly registered individual.
3. **Signin** — authenticate an existing registered individual.
4. **Profile retrieval** — retrieve the individual's registered identity/profile using their Clargen Health ID.
5. **Identity queries and search** — provide API-level lookup by Health ID and supported search criteria.
6. **Validation and uniqueness** — validate registration data and prevent duplicate or conflicting Health IDs.
7. **Local persistence** — store identity and authentication data in the local sandbox database.

The MVP should be demonstrable end to end using local APIs and synthetic test data.

## Explicitly out of scope for the first milestone

- Full ABDM implementation or connection to production ABDM services.
- Issuance, validation or use of official ABHA credentials.
- HPR/HFR or other full healthcare-directory replicas.
- Supplier/provider and organisation directory workflows.
- Organisation IDs, employee-to-organisation membership and supplier onboarding.
- Product QR-code journeys and product traceability.
- Raw-material, manufacturing, batch and certificate/document workflows.
- Customer-to-supplier communication or document-sharing workflows.
- Clinical records, patient care, appointments, prescriptions or hospital workflows.
- Production deployment, external hosted infrastructure or cloud dependencies.

These may be considered in later phases if the business requirements call for them.

## Domain principles

- Clargen Health ID is Clargen's own identifier for an individual; it is not an ABHA credential.
- This is a nutraceutical product-traceability business context, not a healthcare-provider or patient-care system.
- Do not assume that an individual is a patient. Avoid patient-care terminology and workflows unless a specific technical requirement justifies an internal mapping.
- Identity, authentication and directory participation are separate concerns. Signup/signin and individual Health ID lookup are the current priority.
- Use ABDM and ABHA as reference models for selected identity concepts, not as business-domain definitions that Clargen must copy.

## Architecture and implementation approach

- Develop and run the sandbox locally.
- Build Clargen's own implementation and data model.
- Study the official Medplum open-source repository as a reference for reusable implementation patterns where relevant (for example authentication, identity persistence, access control, resource querying and API structure).
- Adapt only the components that support the agreed Clargen MVP. Medplum is a code reference, not a runtime dependency or a service that Clargen will integrate with.
- Keep all test records synthetic.
- Preserve applicable upstream copyright and licence notices when adapting open-source code.

## MVP acceptance criteria

The first milestone is complete when all of the following work locally:

- A new individual can sign up successfully.
- A unique Clargen Health ID is issued and persisted.
- The individual can sign in with their registered credentials.
- A query using the issued Health ID returns the correct registered profile.
- Identity search returns matching registered identities according to the supported query criteria.
- Duplicate registration/ID issuance is rejected safely.
- Automated tests cover the core signup, issuance, signin, retrieval and search flows.

## Development

Use the repository's existing scripts as appropriate:

```bash
npm install --no-audit --no-fund
npm run build
npm run typecheck
npm test
npm run fhir:build
```

The implementation and scripts may evolve as the codebase is aligned with this agreed MVP scope.
