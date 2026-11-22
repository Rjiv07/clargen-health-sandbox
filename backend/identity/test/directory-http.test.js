import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/database.js';
import { createIdentityServer } from '../src/server.js';
import { registerIndividual } from '../src/registration.js';

const asha = {
  givenName: 'Asha', familyName: 'Rao', dateOfBirth: '1998-04-16',
  email: 'asha.http@example.com', mobile: '+919876543210',
  password: 'A-long-local-test-passphrase-for-directory',
};
const ashwin = {
  ...asha, givenName: 'Ashwin', familyName: 'Kumar',
  email: 'ashwin.http@example.com', mobile: '+919876543211',
};

async function withServer(run) {
  const directory = mkdtempSync(join(tmpdir(), 'clargen-directory-http-'));
  const database = openDatabase(join(directory, 'http.sqlite'));
  const server = createIdentityServer({ database });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = 'http://127.0.0.1:' + server.address().port;
  try { await run(baseUrl, database); }
  finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
}

function createSession(database, accountId) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex');
  const now = new Date();
  const createdAt = now.toISOString();
  database.prepare(
    'INSERT INTO sessions (id, account_id, token_hash, created_at, expires_at, last_used_at, revoked_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, NULL)'
  ).run(randomUUID(), accountId, tokenHash, createdAt, new Date(now.getTime() + 3600000).toISOString(), createdAt);
  return token;
}

test('directory HTTP flow requires authentication, consent and returns only minimal fields', async () => {
  await withServer(async (baseUrl, database) => {
    await registerIndividual(database, asha, { hashPassword: async () => 'test-hash' });
    const second = await registerIndividual(database, ashwin, { hashPassword: async () => 'test-hash' });
    const firstId = database.prepare("SELECT id FROM accounts WHERE email = 'asha.http@example.com'").get().id;
    const secondId = database.prepare("SELECT id FROM accounts WHERE email = 'ashwin.http@example.com'").get().id;
    const firstToken = createSession(database, firstId);
    const secondToken = createSession(database, secondId);

    const unauthenticated = await fetch(baseUrl + '/api/v1/individuals/search?q=Ash');
    assert.equal(unauthenticated.status, 401);

    const hidden = await fetch(baseUrl + '/api/v1/individuals/search?q=Ash', {
      headers: { authorization: 'Bearer ' + firstToken },
    });
    assert.equal(hidden.status, 200);
    assert.deepEqual((await hidden.json()).individuals, []);

    const optIn = await fetch(baseUrl + '/api/v1/me/discoverability', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + secondToken },
      body: JSON.stringify({ discoverable: true }),
    });
    assert.equal(optIn.status, 200);
    assert.deepEqual(await optIn.json(), { discoverable: true });

    const visible = await fetch(baseUrl + '/api/v1/individuals/search?q=Ash', {
      headers: { authorization: 'Bearer ' + firstToken },
    });
    assert.equal(visible.status, 200);
    const result = await visible.json();
    assert.equal(result.individuals.length, 1);
    assert.deepEqual(result.individuals[0], {
      healthId: second.healthId, givenName: 'Ashwin', familyName: 'Kumar',
    });
    assert.deepEqual(result.pagination, { limit: 20, offset: 0, hasMore: false });

    const me = await fetch(baseUrl + '/api/v1/me', {
      headers: { authorization: 'Bearer ' + secondToken },
    });
    assert.equal((await me.json()).individual.discoverable, true);

    const crossProfile = await fetch(
      baseUrl + '/api/v1/individuals/health-id/' + encodeURIComponent(second.healthId),
      { headers: { authorization: 'Bearer ' + firstToken } },
    );
    assert.equal(crossProfile.status, 404);

    const optOut = await fetch(baseUrl + '/api/v1/me/discoverability', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + secondToken },
      body: JSON.stringify({ discoverable: false }),
    });
    assert.equal(optOut.status, 200);
    const afterOptOut = await fetch(baseUrl + '/api/v1/individuals/search?q=Ash', {
      headers: { authorization: 'Bearer ' + firstToken },
    });
    assert.deepEqual((await afterOptOut.json()).individuals, []);
  });
});

test('directory HTTP route validates query and discoverability payload', async () => {
  await withServer(async (baseUrl, database) => {
    await registerIndividual(database, asha, { hashPassword: async () => 'test-hash' });
    const accountId = database.prepare("SELECT id FROM accounts WHERE email = 'asha.http@example.com'").get().id;
    const token = createSession(database, accountId);
    const invalidQuery = await fetch(baseUrl + '/api/v1/individuals/search?q=a', {
      headers: { authorization: 'Bearer ' + token },
    });
    assert.equal(invalidQuery.status, 400);

    const invalidPreference = await fetch(baseUrl + '/api/v1/me/discoverability', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ discoverable: 'yes' }),
    });
    assert.equal(invalidPreference.status, 400);
  });
});
