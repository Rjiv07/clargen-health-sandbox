# Clargen Health ID Sandbox

## Goal

Build a working, independent local identity sandbox for Clargen. The initial milestones deliver individual signup, unique Clargen Health ID issuance, local persistence, signin and authenticated profile access. This is a selected capability replica for development and learning, not a full ABDM implementation.

Clargen Health IDs are issued by Clargen in this sandbox. They are not government-issued ABHA credentials, ABHA numbers, or proof of ABDM registration.

## Sprint 1 — Identity registration and issuance

Sprint 1 implements an individual signup endpoint that validates identity details, normalises email/mobile, hashes passwords with Node.js \`scrypt\`, generates a random non-sequential 128-bit \`CLG-\` Health ID and stores the account and individual profile in local SQLite. Email, mobile and Health ID uniqueness are enforced.

## Sprint 2 — Authentication and own-profile access

Sprint 2 adds signin by registered email/mobile, opaque 256-bit bearer tokens with a 12-hour expiry, server-side sessions storing only a SHA-256 token hash, signout/revocation, \`GET /api/v1/me\` and self-only profile retrieval by Health ID.

## Sprint 3 — Opt-in identity directory

Sprint 3 adds an authenticated search directory with explicit individual consent:

- Directory visibility is **off by default**, including for identities registered before this migration.
- An individual can enable or withdraw visibility using \`PATCH /api/v1/me/discoverability\`.
- Authenticated users can search discoverable individuals by name or Clargen Health ID using \`GET /api/v1/individuals/search\`.
- Search results include only Clargen Health ID, given name and family name.
- Email, mobile number and date of birth are not searchable and are never included in another individual's search results.
- Search excludes the currently signed-in identity and supports bounded pagination.
- The existing \`GET /api/v1/individuals/health-id/:healthId\` profile route remains self-only. Directory discovery does not grant access to another person's private profile.

A user can opt out at any time. After opting out, their identity is removed from subsequent searches.

## Local requirements

- Node.js 22.18 or newer (the sandbox uses Node's built-in \`node:sqlite\` module)
- npm

Node currently labels \`node:sqlite\` experimental on the Node 22 line. It is suitable for this isolated local MVP; treat the persistence adapter as replaceable before any production deployment.

No Medplum server, cloud service, external database server or third-party runtime package is required.

## Run locally

\`\`\`bash
npm test
npm start
\`\`\`

The API listens on \`http://127.0.0.1:8080\` by default. Override \`HOST\`, \`PORT\` or \`CLARGEN_DB_PATH\` with environment variables. By default, SQLite is created at \`./data/clargen.sqlite\`; the \`data/\` directory is ignored by Git.

## API

All request bodies must use \`Content-Type: application/json\`.

### Health check

\`GET /health\`

### Signup and Health ID issuance

\`POST /api/v1/signup\`

\`\`\`json
{
  "givenName": "Asha",
  "familyName": "Rao",
  "dateOfBirth": "1998-04-16",
  "email": "asha.rao@example.com",
  "mobile": "+919876543210",
  "password": "A-long-local-test-passphrase-2026"
}
\`\`\`

Successful response: \`201 Created\`. At least one contact method (email or mobile) is required.

### Signin

\`POST /api/v1/signin\`

\`\`\`json
{
  "identifier": "asha.rao@example.com",
  "password": "A-long-local-test-passphrase-2026"
}
\`\`\`

Use the email address or mobile number registered at signup. A successful response returns an opaque bearer token, its expiry and the individual's Clargen Health ID. The actual token is returned only at signin; SQLite stores its SHA-256 hash.

### Retrieve the signed-in individual's profile

\`GET /api/v1/me\`

Header: \`Authorization: Bearer <accessToken>\`

The response includes the current \`discoverable\` preference.

### Change directory visibility

\`PATCH /api/v1/me/discoverability\`

Header: \`Authorization: Bearer <accessToken>\`

Enable visibility:

\`\`\`json
{ "discoverable": true }
\`\`\`

Withdraw visibility:

\`\`\`json
{ "discoverable": false }
\`\`\`

Successful response: \`200 OK\` with the saved preference. A JSON boolean is required.

### Search the identity directory

\`GET /api/v1/individuals/search?q=asha&limit=20&offset=0\`

Header: \`Authorization: Bearer <accessToken>\`

- \`q\` is required and must contain 2–80 characters.
- Search matches names or a Clargen Health ID prefix.
- \`limit\` defaults to 20 and must be 1–50.
- \`offset\` defaults to 0 and must be 0–10000.

Example response:

\`\`\`json
{
  "individuals": [
    {
      "healthId": "CLG-0123456789ABCDEF0123456789ABCDEF",
      "givenName": "Asha",
      "familyName": "Rao"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
\`\`\`

Only discoverable identities belonging to active accounts are returned. Search does not grant access to a private profile.

### Retrieve own profile by Clargen Health ID

\`GET /api/v1/individuals/health-id/:healthId\`

Header: \`Authorization: Bearer <accessToken>\`

Only the profile belonging to the authenticated account is returned. Another individual's Health ID returns \`404 PROFILE_NOT_FOUND\`, even when that identity is discoverable.

### Signout and revoke the current token

\`POST /api/v1/signout\`

Header: \`Authorization: Bearer <accessToken>\`

Successful response: \`204 No Content\`. The same token cannot be used again.

## Scope boundaries

Not included: OTP, password reset, email/mobile verification, profile editing, provider and organisation directories, product QR traceability, raw-material/manufacturing documents, customer-to-supplier communication or official ABDM integration.

The sandbox is for synthetic test data. Do not enter real customer identity data or production credentials.

## Medplum as a reference

The official Medplum source is studied for patterns, not used as a runtime dependency. See [docs/medplum-reference.md](docs/medplum-reference.md) for the source review and adaptation boundaries.
