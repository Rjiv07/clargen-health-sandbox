# Clargen Health FHIR profiles

This folder is a self-contained FHIR R4 ImplementationGuide source project. The FSH sources live in `input/fsh/` and are compiled by SUSHI.

## Profiles
- `ClargenPatient.fsh`: Clargen individual identity profile (consumers/individual participants).
- `ClargenOrganization.fsh`: Clargen organisation identity profile (suppliers, laboratories and manufacturers).

Both profiles use the shared identifier system `https://clargen.health/fhir/identifier/health-id`. Individual and organisation identities are distinct FHIR resource types; employee login accounts are separate from organisation identity.

## Build
From the repository root run `npm run fhir:build`.

This is an independent Clargen sandbox profile set, not an official ABDM profile or ABHA credential. Use synthetic data only and do not install draft profiles in production without review.
