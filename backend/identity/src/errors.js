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

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Email/mobile or password is incorrect');
    this.name = 'InvalidCredentialsError';
  }
}

export class AuthenticationRequiredError extends Error {
  constructor() {
    super('A valid bearer access token is required');
    this.name = 'AuthenticationRequiredError';
  }
}

export class UnsupportedMediaTypeError extends Error {
  constructor() {
    super('Send request details as application/json');
    this.name = 'UnsupportedMediaTypeError';
  }
}
