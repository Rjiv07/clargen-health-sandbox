import { randomUUID } from 'node:crypto';
import { ContactAlreadyRegisteredError, HealthIdIssuanceError } from './errors.js';
import { generateHealthId, isValidHealthId } from './health-id.js';
import { hashPassword } from './password.js';
import { validateSignupInput } from './validation.js';

const MAX_HEALTH_ID_ATTEMPTS = 5;

export async function registerIndividual(database, rawInput, options = {}) {
  const input = validateSignupInput(rawInput);
  const passwordHash = await (options.hashPassword ?? hashPassword)(input.password);
  const makeHealthId = options.generateHealthId ?? generateHealthId;
  const now = new Date().toISOString();
  const accountId = randomUUID();
  const individualId = randomUUID();

  for (let attempt = 0; attempt < MAX_HEALTH_ID_ATTEMPTS; attempt++) {
    const healthId = makeHealthId();
    if (!isValidHealthId(healthId)) {
      throw new HealthIdIssuanceError();
    }

    database.exec('BEGIN IMMEDIATE');
    try {
      database.prepare(
        'INSERT INTO accounts (id, email, mobile, password_hash, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(accountId, input.email, input.mobile, passwordHash, 'active', now);

      database.prepare(
        `INSERT INTO individuals
          (id, account_id, health_id, given_name, family_name, date_of_birth, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        individualId, accountId, healthId, input.givenName, input.familyName,
        input.dateOfBirth, now,
      );

      database.exec('COMMIT');
      return {
        healthId,
        status: 'registered',
        issuedAt: now,
        individual: {
          givenName: input.givenName,
          familyName: input.familyName,
          dateOfBirth: input.dateOfBirth,
          email: input.email,
          mobile: input.mobile,
        },
      };
    } catch (error) {
      try { database.exec('ROLLBACK'); } catch { /* Transaction may already be closed. */ }
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('UNIQUE constraint failed: accounts.email') || message.includes('UNIQUE constraint failed: accounts.mobile')) {
        throw new ContactAlreadyRegisteredError();
      }
      if (message.includes('UNIQUE constraint failed: individuals.health_id')) {
        if (attempt + 1 < MAX_HEALTH_ID_ATTEMPTS) continue;
        throw new HealthIdIssuanceError();
      }
      throw error;
    }
  }

  throw new HealthIdIssuanceError();
}