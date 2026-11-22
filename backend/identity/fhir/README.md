# Clargen Health FHIR profile

This folder is a self-contained FHIR R4 ImplementationGuide source project.
The FSH source lives in `input/fsh/ClargenPatient.fsh`; SUSHI compiles it into
FHIR resources under `fsh-generated/resources/`.

## Build

From the repository root:

```bash
npm install
npm run fhir:build
```

Or from this folder:

```bash
npm run build
```

The generated profile is:

`fsh-generated/resources/StructureDefinition-clargen-patient.json`

Its canonical URL is:

`https://clargen.health/fhir/StructureDefinition/clargen-patient`

## Install into Medplum

After building, authenticate to the intended Medplum development project as
an administrator and create/update the generated StructureDefinition resource.
Use the generated JSON resource, not the FSH source file.

For a local Medplum instance, the FHIR API is typically:

`http://localhost:8103/fhir/R4`

Do not install this draft profile into a production project without formal
review, validation and approval. The profile is an independent Clargen
development profile, not an official ABDM profile or ABHA credential.

## Validation checklist

- FHIR version: R4 (4.0.1)
- Canonical base: https://clargen.health/fhir
- Profile id: clargen-patient
- Health ID identifier system: https://clargen.health/fhir/identifier/health-id
- Patient.active is required and fixed to true
- Exactly one Clargen Health ID identifier slice is required
- Name, birthDate and gender are required
