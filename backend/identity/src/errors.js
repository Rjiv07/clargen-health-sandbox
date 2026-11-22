export class ValidationError extends Error {
  constructor(message, issues = [message]) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

export class ContactAlreadyRegisteredError extends Error {
  constructor() {
    super('An account already exists for this email address or mobile number');
    this.name = 'ContactAlreadyRegisteredError';
  }
}

export class HealthIdIssuanceError extends Error {
  constructor() {
    super('A unique Clargen Health ID could not be issued');
    this.name = 'HealthIdIssuanceError';
  }
}
