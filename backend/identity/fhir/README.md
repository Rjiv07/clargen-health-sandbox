# Clargen Health FHIR profile

This folder is a self-contained FHIR R4 ImplementationGuide source project.
The sole FSH source lives in `input/fsh/ClargenPatient.fsh`; SUSHI compiles it
into FHIR resources under `fsh-generated/resources/`.

## Build

From the repository root:

```bash
npm run fhir:build
```

The generated profile is:

`fsh-generated/resources/StructureDefinition-clargen-patient.json`

Its canonical URL is:

`https://clargen.health/fhir/StructureDefinition/clargen-patient`

## Install into Medplum

After building, use the repository's `npm run provision:medplum` command.
It installs the generated StructureDefinition and the identity AccessPolicies
into the selected Medplum development project. See
`backend/identity/README.md` for the complete procedure.

Do not install this draft profile into a production project without formal
review, validation and approval. The profile is an independent Clargen
development profile, not an official ABDM profile or ABHA credential.

## Profile requirements

- FHIR version: R4 (4.0.1)
- Canonical base: https://clargen.health/fhir
- Profile id: clargen-patient
- Health ID identifier system: https://clargen.health/fhir/identifier/health-id
- Patient.active is required and fixed to true
- Exactly one Clargen Health ID identifier slice is required
- Patient name, birthDate and gender are required
