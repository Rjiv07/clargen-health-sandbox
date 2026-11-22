# Identity service — Sprints 1 and 2

This package area contains Clargen's independent local individual identity service. It does not use Medplum packages or FHIR Patient/Practitioner workflows.

## Components

- `src/server.js` — local HTTP API and error mapping.
- `src/database.js` — local SQLite schema for accounts, individuals and sessions.
- `src/registration.js` — transactional account/profile creation and Health ID issuance.
- `src/health-id.js` — random `CLG-` identifier generation and validation.
- `src/password.js` — salted `scrypt` password hashing and verification.
- `src/authentication.js` — signin, opaque access tokens, session validation/revocation and self-profile retrieval.
- `src/validation.js` — signup input validation and normalisation.
- `test/` — registration, authentication and HTTP tests using temporary local databases.

At least one contact method (email or mobile) is required at signup. Signin accepts either one as the `identifier`.

## Run

From repository root:

```bash
npm test
npm start
```

## Authentication and profile routes

- `POST /api/v1/signin` — authenticate by email/mobile and password; returns a 12-hour bearer access token.
- `GET /api/v1/me` — retrieve the authenticated individual's own profile.
- `GET /api/v1/individuals/health-id/:healthId` — retrieve the authenticated individual's own profile by Health ID.
- `POST /api/v1/signout` — revoke the current bearer token.

Private profile routes require `Authorization: Bearer <accessToken>`. The profile lookup is self-only; it does not search or return other individuals' records.
