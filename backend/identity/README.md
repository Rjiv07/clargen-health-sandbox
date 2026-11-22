# Identity service — Sprints 1–3

This package area contains Clargen's independent local individual identity service. It does not use Medplum packages or FHIR Patient/Practitioner workflows.

## Components

- \`src/server.js\` — local HTTP API and error mapping.
- \`src/database.js\` — local SQLite schema and idempotent schema migrations for accounts, individuals, sessions and directory visibility.
- \`src/registration.js\` — transactional account/profile creation and Health ID issuance.
- \`src/health-id.js\` — random \`CLG-\` identifier generation and validation.
- \`src/password.js\` — salted \`scrypt\` password hashing and verification.
- \`src/authentication.js\` — signin, opaque access tokens, session validation/revocation and own-profile retrieval.
- \`src/directory.js\` — opt-in visibility preference and privacy-filtered identity search.
- \`src/validation.js\` — signup input validation and normalisation.
- \`test/\` — registration, authentication, directory and HTTP tests using temporary local databases.

At least one contact method (email or mobile) is required at signup. Signin accepts either one as the \`identifier\`.

## Run

From repository root:

\`\`\`bash
npm test
npm start
\`\`\`

## Authentication and profile routes

- \`POST /api/v1/signin\` — authenticate by email/mobile and password; returns a 12-hour bearer access token.
- \`GET /api/v1/me\` — retrieve the authenticated individual's own profile and directory visibility preference.
- \`GET /api/v1/individuals/health-id/:healthId\` — retrieve the authenticated individual's own profile by Health ID.
- \`POST /api/v1/signout\` — revoke the current bearer token.

Private profile routes require \`Authorization: Bearer <accessToken>\`.

## Directory routes

- \`PATCH /api/v1/me/discoverability\` — enable or withdraw the individual's directory visibility. It is off by default.
- \`GET /api/v1/individuals/search?q=<query>&limit=20&offset=0\` — authenticated search over discoverable identities.

Directory search returns only Health ID, given name and family name. Email, mobile number and date of birth are neither searchable nor disclosed. Directory visibility does not change the self-only access policy of the private profile route.
