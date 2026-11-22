import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/database.js';
import { registerIndividual } from '../src/registration.js';
import {
  authenticateAccessToken,
  getIndividualProfileByHealthId,
  getOwnIndividualProfile,
  revokeAccessToken,
  signIn,
} from '../src/authentication.js';
import { InvalidCredentialsError } from '../src/errors.js';

const firstUser = {
  givenName: 'Asha',
  familyName: 'Rao',
  dateOfBirth: '1998-04-16',
  email: 'asha.rao@example.com',
  mobile: '+919876543210',
  password: 'A-long-local-test-passphrase-2026',
};

async function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), 'clargen-auth-'));
  const database = openDatabase(join(directory, 'auth.sqlite'));
  try { await run(database); }
  finally { if (database.isOpen) database.close(); rmSync(directory, { recursive: true, force: true }); }
}

test('sign in accepts a registered email and returns a bearer token', async () => {
  await withDatabase(async (database) => {
    const registration = await registerIndividual(database, firstUser);
    const result = await signIn(database, { identifier: 'ASHA.RAO@EXAMPLE.COM', password: firstUser.password });
    assert.equal(result.tokenType, 'Bearer');
    assert.match(result.accessToken, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(result.healthId, registration.healthId);
    assert.ok(Date.parse(result.expiresAt) > Date.now());
  });
});

test('sign in accepts a registered mobile number', async () => {
  await withDatabase(async (database) => {
    await registerIndividual(database, firstUser);
    const result = await signIn(database, { identifier: '+91 98765 43210', password: firstUser.password });
    assert.match(result.accessToken, /^[A-Za-z0-9_-]{43}$/);
  });
});

test('unknown account and wrong password use the same invalid-credentials error', async () => {
  await withDatabase(async (database) => {
    await registerIndividual(database, firstUser);
    await assert.rejects(
      signIn(database, { identifier: firstUser.email, password: 'Wrong-password-for-this-account' }),
      InvalidCredentialsError,
    );
    await assert.rejects(
      signIn(database, { identifier: 'unknown@example.com', password: 'Wrong-password-for-this-account' }),
      InvalidCredentialsError,
    );
  });
});

test('only a hash of the bearer token is persisted', async () => {
  await withDatabase(async (database) => {
    await registerIndividual(database, firstUser);
    const result = await signIn(database, { identifier: firstUser.email, password: firstUser.password });
    const session = database.prepare('SELECT token_hash FROM sessions').get();
    assert.equal(session.token_hash.length, 64);
    assert.notEqual(session.token_hash, result.accessToken);
    assert.equal(authenticateAccessToken(database, result.accessToken)?.healthId, result.healthId);
  });
});

test('expired and revoked sessions cannot authenticate', async () => {
  await withDatabase(async (database) => {
    await registerIndividual(database, firstUser);
    const result = await signIn(database, { identifier: firstUser.email, password: firstUser.password });
    database.prepare('UPDATE sessions SET expires_at = ?').run(new Date(Date.now() - 1000).toISOString());
    assert.equal(authenticateAccessToken(database, result.accessToken), undefined);

    const second = await signIn(database, { identifier: firstUser.email, password: firstUser.password });
    assert.equal(revokeAccessToken(database, second.accessToken), true);
    assert.equal(authenticateAccessToken(database, second.accessToken), undefined);
  });
});

test('own profile can be retrieved using the Clargen Health ID', async () => {
  await withDatabase(async (database) => {
    const registration = await registerIndividual(database, firstUser);
    const login = await signIn(database, { identifier: firstUser.email, password: firstUser.password });
    const session = authenticateAccessToken(database, login.accessToken);
    const profile = getIndividualProfileByHealthId(database, session.accountId, registration.healthId);
    assert.equal(profile.healthId, registration.healthId);
    assert.equal(profile.givenName, 'Asha');
    assert.equal(profile.familyName, 'Rao');
    assert.equal(profile.email, firstUser.email);
    assert.equal(Object.hasOwn(profile, 'passwordHash'), false);
  });
});

test('an individual cannot retrieve another account profile by Health ID', async () => {
  await withDatabase(async (database) => {
    const first = await registerIndividual(database, firstUser);
    const second = await registerIndividual(database, {
      ...firstUser,
      email: 'other@example.com',
      mobile: '+919876543211',
    });
    const login = await signIn(database, { identifier: firstUser.email, password: firstUser.password });
    const session = authenticateAccessToken(database, login.accessToken);
    assert.equal(getIndividualProfileByHealthId(database, session.accountId, second.healthId), undefined);
    assert.equal(getOwnIndividualProfile(database, session.accountId).healthId, first.healthId);
  });
});
