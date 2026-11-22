import { ValidationError } from './errors.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[1-9]\d{7,14}$/;

export function validateSignupInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('Request body must be a JSON object');
  }

  const issues = [];
  const givenName = cleanName(input.givenName, 'givenName', issues);
  const familyName = cleanName(input.familyName, 'familyName', issues);
  const dateOfBirth = typeof input.dateOfBirth === 'string' ? input.dateOfBirth.trim() : '';
  const emailInput = typeof input.email === 'string' ? input.email.trim() : '';
  const email = emailInput ? emailInput.toLowerCase() : null;
  const password = typeof input.password === 'string' ? input.password : '';
  const mobile = normalizeMobile(input.mobile, issues);

  if (!isValidDateOfBirth(dateOfBirth)) {
    issues.push('dateOfBirth must be a real date in YYYY-MM-DD format and cannot be in the future');
  }
  if (email && (email.length > 254 || !EMAIL_PATTERN.test(email))) {
    issues.push('email must be a valid email address (maximum 254 characters)');
  }
  if (!email && !mobile) {
    issues.push('provide at least one contact method: email or mobile');
  }
  if (Buffer.byteLength(password, 'utf8') < 12 || Buffer.byteLength(password, 'utf8') > 128) {
    issues.push('password must be between 12 and 128 bytes');
  }

  if (issues.length) {
    throw new ValidationError('Signup details are invalid', issues);
  }

  return { givenName, familyName, dateOfBirth, email, mobile, password };
}

function cleanName(value, field, issues) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > 80) {
    issues.push(`${field} is required and must be at most 80 characters`);
  }
  return name;
}

function normalizeMobile(value, issues) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    issues.push('mobile must be a string');
    return null;
  }
  const normalized = value.replace(/[\s()-]/g, '');
  if (!PHONE_PATTERN.test(normalized)) {
    issues.push('mobile must be in international format, for example +919876543210');
    return null;
  }
  return normalized;
}

function isValidDateOfBirth(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return false;
  }
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return value <= todayIso;
}