Profile: ClargenOrganization
Parent: Organization
Id: clargen-organization
Title: "Clargen Organization"
Description: "Clargen identity profile for suppliers, laboratories and manufacturers."
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
* type 1..*
* type.coding 1..*
* name 1..1
