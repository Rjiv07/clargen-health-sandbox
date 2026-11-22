# Medplum source review — Sprints 1 and 2

Medplum is a source-code reference for selected identity and account-management patterns. Clargen's local sandbox does not import Medplum packages, run a Medplum server, or depend on a hosted Medplum service.

## Sprint 1 source files reviewed

- [`newpatient.ts`](https://github.com/medplum/medplum/blob/main/packages/server/src/auth/newpatient.ts) — shows how Medplum completes an existing partial login by creating a profile and project membership. Its Patient-specific workflow is not copied into Clargen.
- [`utils.ts`](https://github.com/medplum/medplum/blob/main/packages/server/src/auth/utils.ts) — contains reusable conceptual patterns around password hashing, profile creation and membership creation. Clargen uses its own account/profile model and Node.js `scrypt` hashing.
- [`register.ts`](https://github.com/medplum/medplum/blob/main/packages/server/src/auth/register.ts) — explicitly documents `registerNew()` as a test-only utility, not a production registration endpoint. It is not treated as a signup API template.

## Sprint 2 source files reviewed

- [`login.ts`](https://github.com/medplum/medplum/blob/main/packages/server/src/auth/login.ts) — the login route passes credentials and context to the authentication flow, then returns the login result.
- [`oauth/utils.ts`](https://github.com/medplum/medplum/blob/main/packages/server/src/oauth/utils.ts) — `tryLogin()` validates credentials, creates a Login record and establishes login state. The implementation also performs a dummy password check when a user is not found, reducing account-enumeration timing differences. `getAuthTokens()` creates access/ID tokens and `revokeLogin()` marks a login revoked.
- [`context.ts`](https://github.com/medplum/medplum/blob/main/packages/server/src/context.ts) — validates/authenticates requests and constructs an authenticated request context. It refreshes the underlying project and membership state so revoked or inactive access is not blindly trusted.

## Clargen Sprint 2 decisions

1. Keep Clargen accounts, individual profiles and authentication sessions as separate concepts.
2. Signin accepts the registered email address or mobile number plus the password.
3. Return the same generic invalid-credentials response for an unknown account and a wrong password.
4. Use a random opaque 256-bit bearer token with a fixed 12-hour lifetime for this local MVP.
5. Store only the SHA-256 hash of the bearer token in SQLite; return the raw token only in the signin response.
6. Validate the token and account status on every protected request. Persist session expiry and revocation state.
7. Let a signed-in individual retrieve their own profile by Clargen Health ID. Do not let this endpoint become an unrestricted directory-search API; cross-identity search is a later milestone.
8. Keep authentication and authorization logic inside Clargen's own local implementation. Do not import Medplum's User, Login, ProjectMembership, OAuth or FHIR runtime.

These are design adaptations, not copied Medplum code. No Medplum source code is copied into the Sprint 1 or Sprint 2 implementation. If code is adapted in a later change, preserve applicable Apache-2.0 copyright and licence notices.
