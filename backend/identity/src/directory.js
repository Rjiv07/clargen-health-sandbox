import { ValidationError } from './errors.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_OFFSET = 10000;

function escapeLike(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

export function setIndividualDiscoverability(database, accountId, discoverable) {
  if (typeof discoverable !== 'boolean') {
    throw new ValidationError('discoverable must be a boolean');
  }
  const result = database.prepare(
    "UPDATE individuals SET discoverable = ? WHERE account_id = ? " +
    "AND EXISTS (SELECT 1 FROM accounts WHERE id = ? AND status = 'active')"
  ).run(discoverable ? 1 : 0, accountId, accountId);
  if (Number(result.changes) !== 1) {
    throw new ValidationError('The authenticated individual profile is unavailable');
  }
  return discoverable;
}

export function searchDiscoverableIndividuals(database, accountId, options = {}) {
  const query = typeof options.query === 'string' ? options.query.trim() : '';
  if (query.length < 2 || query.length > 80) {
    throw new ValidationError('q must contain between 2 and 80 characters');
  }
  const limit = options.limit === undefined ? DEFAULT_LIMIT : options.limit;
  const offset = options.offset === undefined ? 0 : options.offset;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new ValidationError('limit must be an integer between 1 and 50');
  }
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
    throw new ValidationError('offset must be an integer between 0 and 10000');
  }

  const escapedQuery = escapeLike(query);
  const namePattern = '%' + escapedQuery + '%';
  const healthIdPattern = query.toUpperCase().startsWith('CLG-')
    ? escapeLike(query.toUpperCase()) + '%'
    : '\u0000';

  const rows = database.prepare(
    "SELECT i.health_id, i.given_name, i.family_name " +
    "FROM individuals i JOIN accounts a ON a.id = i.account_id " +
    "WHERE i.discoverable = 1 AND a.status = 'active' AND i.account_id <> ? " +
    "AND (i.health_id LIKE ? ESCAPE '\\' COLLATE NOCASE " +
    "OR i.given_name LIKE ? ESCAPE '\\' COLLATE NOCASE " +
    "OR i.family_name LIKE ? ESCAPE '\\' COLLATE NOCASE " +
    "OR (i.given_name || ' ' || i.family_name) LIKE ? ESCAPE '\\' COLLATE NOCASE) " +
    "ORDER BY i.family_name COLLATE NOCASE, i.given_name COLLATE NOCASE, i.health_id " +
    "LIMIT ? OFFSET ?"
  ).all(accountId, healthIdPattern, namePattern, namePattern, namePattern, limit + 1, offset);

  const hasMore = rows.length > limit;
  const individuals = rows.slice(0, limit).map((row) => ({
    healthId: row.health_id,
    givenName: row.given_name,
    familyName: row.family_name,
  }));
  return { individuals, pagination: { limit, offset, hasMore } };
}
