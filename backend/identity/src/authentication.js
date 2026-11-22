import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ContactAlreadyRegisteredError, InvalidCredentialsError, ValidationError } from './errors.js';
import { verifyPassword } from './password.js';
import { isValidHealthId } from './health-id.js';

export const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;

function normalizeIdentifier(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 254) {
    throw new ValidationError('identifier must be a registered email address or mobile number');
  }

  const identifier = value.trim();
  if (identifier.includes('@')) {
    const email = identifier.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ValidationError('identifier must be a valid email address or international mobile number');
    }
    return { column: 'email', value: email };
  }

  const mobile = identifier.replace(/[\s()-]/g, '');
  if (!/^\+?[1-9]\d{7,14}$/.test(mobile)) {
    throw new ValidationError('identifier must be a valid email address or international mobile number');
  }
  return { column: 'mobile', value: mobile };
}

function hashAccessToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export async function signIn(database, input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  const identifier = normalizeIdentifier(input.identifier);
  const password = input.password;
  if (typeof password !== 'string' || !password.length || Buffer.byteLength(password, 'utf8') > 128) {
    throw new ValidationError('password is required and must not exceed 128 bytes');
  }

  // column is selected from a fixed allowlist; the identifier value is parameterised.
  const account = database.prepare(
    `SELECT a.id AS account_id, a.password_hash, a.status, i.health_id
     FROM accounts a
     JOIN individuals i ON i.account_id = a.id
     WHERE a.${identifier.column} = ?
     LIMIT 1`
  ).get(identifier.value);

  const passwordMatches = await (options.verifyPassword ?? verifyPassword)(password, account?.password_hash);
  if (!account || account.status !== 'active' || !passwordMatches) {
    throw new InvalidCredentialsError();
  }

  const accessToken = randomBytes(32).toString('base64url');
  const tokenHash = hashAccessToken(accessToken);
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS).toISOString();

  database.prepare(
    `INSERT INTO sessions
      (id, account_id, token_hash, created_at, expires_at, last_used_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`
  ).run(randomUUID(), account.account_id, tokenHash, createdAt, expiresAt, createdAt);

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresAt,
    healthId: account.health_id,
  };
}

/**
 * Resolve a bearer token to the currently active account. Only a SHA-256 hash
 * of the opaque token is stored in SQLite.
 */
export function authenticateAccessToken(database, token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return undefined;
  }
  const tokenHash = hashAccessToken(token);
  const now = new Date().toISOString();
  const session = database.prepare(
    `SELECT s.id AS session_id, s.account_id, i.health_id
     FROM sessions s
     JOIN accounts a ON a.id = s.account_id
     JOIN individuals i ON i.account_id = a.id
     WHERE s.token_hash = ?
       AND s.revoked_at IS NULL
       AND s.expires_at > ?
       AND a.status = 'active'
     LIMIT 1`
  ).get(tokenHash, now);

  if (!session) return undefined;

  database.prepare('UPDATE sessions SET last_used_at = ? WHERE id = ?')
    .run(now, session.session_id);

  return {
    sessionId: session.session_id,
    accountId: session.account_id,
    healthId: session.health_id,
  };
}

export function revokeAccessToken(database, token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const result = database.prepare(
    'UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL'
  ).run(new Date().toISOString(), hashAccessToken(token));
  return Number(result.changes) === 1;
}

export function getIndividualProfileByHealthId(database, accountId, healthIdInput) {
  if (typeof healthIdInput !== 'string') return undefined;
  const healthId = healthIdInput.trim().toUpperCase();
  if (!isValidHealthId(healthId)) return undefined;

  const individual = database.prepare(
    `SELECT i.health_id, i.given_name, i.family_name, i.date_of_birth, i.created_at,
            a.email, a.mobile
     FROM individuals i
     JOIN accounts a ON a.id = i.account_id
     WHERE i.account_id = ? AND i.health_id = ? AND a.status = 'active'
     LIMIT 1`
  ).get(accountId, healthId);

  return individual ? toPublicProfile(individual) : undefined;
}

export function getOwnIndividualProfile(database, accountId) {
  const individual = database.prepare(
    `SELECT i.health_id, i.given_name, i.family_name, i.date_of_birth, i.created_at,
            a.email, a.mobile
     FROM individuals i
     JOIN accounts a ON a.id = i.account_id
     WHERE i.account_id = ? AND a.status = 'active'
     LIMIT 1`
  ).get(accountId);

  return individual ? toPublicProfile(individual) : undefined;
}

function toPublicProfile(row) {
  return {
    healthId: row.health_id,
    givenName: row.given_name,
    familyName: row.family_name,
    dateOfBirth: row.date_of_birth,
    email: row.email,
    mobile: row.mobile,
    registeredAt: row.created_at,
  };
}
