import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/database.js';
import { createIdentityServer } from '../src/server.js';

const signup = {
  givenName: 'Dev',
  familyName: 'Tester',
  dateOfBirth: '1995-07-12',
  email: 'dev.tester@example.com',
  password: 'A-second-local-test-passphrase-2026',
};

test('local HTTP API exposes health and signup endpoints', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'clargen-http-'));
  const database = openDatabase(join(directory, 'api.sqlite'));
  const server = createIdentityServer({ database });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok', service: 'clargen-health-id' });

    const response = await fetch(`${baseUrl}/api/v1/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(signup),
    });
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.match(result.healthId, /^CLG-[0-9A-F]{32}$/);
    assert.equal(result.individual.email, signup.email);
    assert.equal(Object.hasOwn(result, 'password'), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});

test('signup HTTP route rejects missing JSON content type and duplicate email', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'clargen-http-errors-'));
  const database = openDatabase(join(directory, 'api.sqlite'));
  const server = createIdentityServer({ database });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const unsupported = await fetch(`${baseUrl}/api/v1/signup`, { method: 'POST', body: JSON.stringify(signup) });
    assert.equal(unsupported.status, 415);

    const options = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(signup) };
    const first = await fetch(`${baseUrl}/api/v1/signup`, options);
    const duplicate = await fetch(`${baseUrl}/api/v1/signup`, options);
    assert.equal(first.status, 201);
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).error, 'CONTACT_ALREADY_REGISTERED');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});
