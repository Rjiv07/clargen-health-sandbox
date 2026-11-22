# Clargen Health ID Sandbox

## Goal

Build a working, independent local identity sandbox for Clargen. The first milestone is an ABHA-inspired individual identity experience: sign up, receive a unique Clargen Health ID, and persist the identity locally. This is a selected capability replica for development and learning, not a full ABDM implementation.

Clargen Health IDs are issued by Clargen in this sandbox. They are not government-issued ABHA credentials, ABHA numbers, or proof of ABDM registration.

## Sprint 1 — Identity registration and issuance

Sprint 1 implements an individual signup endpoint that:

- validates name, date of birth, at least one of email/mobile and password;
- normalises email and mobile values;
- hashes the password with a per-account random salt using Node.js `scrypt`;
- generates a random, non-sequential 128-bit `CLG-` Health ID;
- stores account credentials and individual profile in a local SQLite database;
- enforces unique email, mobile and Health ID constraints; and
- returns the newly issued Health ID and profile (never the password hash).

## Sprint 2 — Authentication and profile access

Sprint 2 adds:

- signin using the registered email address or mobile number and password;
- opaque 256-bit bearer access tokens with a 12-hour expiry;
- server-side session records that store only a SHA-256 token hash;
- session revocation through signout;
- an authenticated `GET /api/v1/me` endpoint; and
- authenticated profile retrieval using the individual's own Clargen Health ID.

The profile-by-Health-ID endpoint is deliberately self-only in this milestone. An authenticated user cannot use it to retrieve another individual's private profile. Cross-identity search and authorised directory lookup are deferred to Sprint 3.

## Local requirements

- Node.js 22.18 or newer (the sandbox uses Node's built-in `node:sqlite` module)
- npm

Node currently labels `node:sqlite` experimental on the Node 22 line. It is suitable for this isolated local MVP; treat the persistence adapter as replaceable before any production deployment.

No Medplum server, cloud service, external database server or third-party runtime package is required.

## Run locally

```bash
npm test
npm start
```

The API listens on `http://127.0.0.1:8080` by default. Override `HOST`, `PORT` or `CLARGEN_DB_PATH` with environment variables. By default, the SQLite database is created at `./data/clargen.sqlite`; the `data/` directory is ignored by Git.

## API

All request bodies must use `Content-Type: application/json`.

### Health check

`GET /health`

### Signup and Health ID issuance

`POST /api/v1/signup`

```json
{
  "givenName": "Asha",
  "familyName": "Rao",
  "dateOfBirth": "1998-04-16",
  "email": "asha.rao@example.com",
  "mobile": "+919876543210",
  "password": "A-long-local-test-passphrase-2026"
}
```

Successful response: `201 Created`. At least one contact method (email or mobile) is required; either can be supplied on its own.

### Signin

`POST /api/v1/signin`

```json
{
  "identifier": "asha.rao@example.com",
  "password": "A-long-local-test-passphrase-2026"
}
```

Use the email address or mobile number registered at signup. A successful response contains:

```json
{
  "accessToken": "opaque-bearer-token",
  "tokenType": "Bearer",
  "expiresAt": "2026-11-22T21:00:00.000Z",
  "healthId": "CLG-8F2A61D0C9B471E3A07C4E9A2F61B805"
}
```

The token value above is illustrative. The real token is returned only at signin; SQLite stores its SHA-256 hash.

### Retrieve the signed-in individual's profile

`GET /api/v1/me`

Header: `Authorization: Bearer <accessToken>`

### Retrieve own profile by Clargen Health ID

`GET /api/v1/individuals/health-id/:healthId`

Header: `Authorization: Bearer <accessToken>`

Only the profile belonging to the authenticated account is returned. A different individual's Health ID returns `404 PROFILE_NOT_FOUND`.

### Signout and revoke the current token

`POST /api/v1/signout`

Header: `Authorization: Bearer <accessToken>`

Successful response: `204 No Content`. The same token cannot be used again.

## Scope boundaries

Not included in Sprint 1–2: OTP, password reset, email/mobile verification, profile editing, cross-identity search, provider and organisation directories, product QR traceability, raw-material/manufacturing documents, customer-to-supplier communication or official ABDM integration. These are deliberately deferred rather than represented by incomplete endpoints.

The sandbox is for synthetic test data. Do not enter real customer identity data or production credentials.

## Medplum as a reference

The official Medplum source is studied for patterns, not used as a runtime dependency. See [docs/medplum-reference.md](docs/medplum-reference.md) for the source review and adaptation boundaries.
