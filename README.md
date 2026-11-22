# Clargen Health ID Sandbox

## Goal

Build a working, independent local identity sandbox for Clargen. The first milestone is an ABHA-inspired individual identity experience: sign up, receive a unique Clargen Health ID, and persist the identity locally. This is a selected capability replica for development and learning, not a full ABDM implementation.

Clargen Health IDs are issued by Clargen in this sandbox. They are not government-issued ABHA credentials, ABHA numbers, or proof of ABDM registration.

## Sprint 1 deliverable

Sprint 1 implements an individual signup endpoint that:

- validates name, date of birth, at least one of email/mobile and password;
- normalises email and mobile values;
- hashes the password with a per-account random salt using Node.js `scrypt`;
- generates a random, non-sequential 128-bit `CLG-` Health ID;
- stores account credentials and individual profile in a local SQLite database;
- enforces unique email and Health ID constraints transactionally; and
- returns the newly issued Health ID and profile (never the password hash).

Signin, profile retrieval, identity query/search and broader provider or organisation directories are later milestones.

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

## Sprint 1 API

### Health check

`GET /health`

### Individual signup and Health ID issuance

`POST /api/v1/signup`

Content-Type: `application/json`

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

Successful response: `201 Created`

```json
{
  "healthId": "CLG-8F2A61D0C9B471E3A07C4E9A2F61B805",
  "status": "registered",
  "issuedAt": "2026-11-22T09:00:00.000Z",
  "individual": {
    "givenName": "Asha",
    "familyName": "Rao",
    "dateOfBirth": "1998-04-16",
    "email": "asha.rao@example.com",
    "mobile": "+919876543210"
  }
}
```

At least one contact method (email or mobile) is required; either can be supplied on its own. The Health ID in this example is illustrative. The service uses random bytes and a database uniqueness constraint; IDs are not sequential. A duplicate email or mobile returns `409 CONTACT_ALREADY_REGISTERED`; invalid input returns `400 VALIDATION_ERROR`.

## Scope boundaries

Not included in Sprint 1: signin, sessions/tokens, OTP, identity lookup/search, profile retrieval/update, provider and organisation directories, product QR traceability, raw-material/manufacturing documents, customer-to-supplier communication or official ABDM integration. These are deliberately deferred rather than represented by incomplete endpoints.

The sandbox is for synthetic test data. Do not enter real customer identity data or production credentials.

## Medplum as a reference

The official Medplum source is studied for patterns, not used as a runtime dependency. See [docs/medplum-reference.md](docs/medplum-reference.md) for the Sprint 1 source review and adaptation boundaries.
