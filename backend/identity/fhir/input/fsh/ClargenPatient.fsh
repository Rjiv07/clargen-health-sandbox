Profile: ClargenPatient
Parent: Patient
Id: clargen-patient
Title: "Clargen Patient"
Description: "Independent Clargen Health patient identity profile."

* active 1..1
* active = true
* identifier 1..*
* identifier ^slicing.discriminator.type = #value
* identifier ^slicing.discriminator.path = "system"
* identifier ^slicing.rules = #open
* identifier contains clargenHealthId 1..1
* identifier[clargenHealthId].use = #usual
* identifier[clargenHealthId].system = "https://clargen.health/fhir/identifier/health-id" (exactly)
* identifier[clargenHealthId].value 1..1
* name 1..*
* name.given 1..*
* name.family 1..1
* birthDate 1..1
* gender 1..1
