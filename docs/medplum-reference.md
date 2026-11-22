# Medplum source review — Sprint 1

Medplum is a source-code reference for selected identity and account-management patterns. Clargen's local sandbox does not import Medplum packages, run a Medplum server, or depend on a hosted Medplum service.

## Official source files reviewed

- [`newpatient.ts`](https://github.com/medplum/medplum/blob/main/packages/server/src/auth/newpatient.ts) — shows how Medplum completes an existing partial login by creating a profile and project membership. Its Patient-specific workflow is not copied into Clargen.
- [`utils.ts`](https://github.com/medplum/medplum/blob/main/packages/server/src/auth/utils.ts) — contains reusable conceptual patterns around password hashing, profile creation and membership creation. Clargen uses its own account/profile model and Node.js `scrypt` hashing.
- [`register.ts`](https://github.com/medplum/medplum/blob/main/packages/server/src/auth/register.ts) — explicitly documents `registerNew()` as a test-only utility, not a production registration endpoint. It is not treated as a signup API template.

## Sprint 1 decisions

1. Keep the identity domain independent of clinical records. An individual signing up to Clargen is not automatically a healthcare patient.
2. Separate login credentials (`accounts`) from the individual's Clargen identity profile (`individuals`).
3. Issue a Clargen-owned identifier as part of the same database transaction as account/profile creation.
4. Enforce unique email and Health ID values in the database, not only in application code.
5. Store only a salted password hash. Never return credentials or password hashes from the API.
6. Use local SQLite for the isolated sandbox so Sprint 1 can run without a Medplum service or external database.

No Medplum source code is copied into the Sprint 1 implementation. If code is adapted in a later change, preserve the applicable Apache-2.0 copyright and licence notices.
