# Identity service — Sprint 1

This package area contains Clargen's independent local individual signup and Health ID issuance service. It does not use Medplum packages or FHIR Patient/Practitioner workflows.

## Components

- `src/server.js` — local HTTP API and error mapping.
- `src/database.js` — local SQLite schema and connection setup.
- `src/registration.js` — transactional account/profile creation and Health ID issuance.
- `src/health-id.js` — random `CLG-` identifier generation and validation.
- `src/password.js` — salted `scrypt` password hashing.
- `src/validation.js` — signup input validation and normalisation.
- `test/` — registration and HTTP tests using temporary local databases.

At least one contact method (email or mobile) is required; either can be used independently.

## Run

From repository root:

```bash
npm test
npm start
```

See the root README for the signup request and response contract.
