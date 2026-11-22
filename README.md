# Clargen Health Sandbox

Clargen Health is an independent identity foundation for the company's product-traceability ecosystem. Sandbox V1 focuses on ABDM-inspired identity issuance and authorised participant lookup, not the complete product traceability website.

## Participant identity types

- Individuals/consumers use FHIR Patient.
- Suppliers, laboratories and manufacturers use FHIR Organization.
- Both use the same Clargen Health ID identifier system and UUIDv4-based format.
- Organisation identity is separate from employee login accounts.

## Backend capabilities

- Individual identity issuance and lookup.
- Organisation identity issuance and lookup.
- Unified Health ID lookup across both participant types.
- FHIR profile validation and restricted issuer access policies.
- Authenticated API host factory with caller-scoped services.

All records must be synthetic. This is an independent sandbox and is not an official ABDM integration or ABHA credential.

## Development

```bash
npm install --no-audit --no-fund
npm run build
npm run typecheck
npm test
npm run fhir:build
```

See [backend/identity/README.md](backend/identity/README.md) for the participant identity model.
