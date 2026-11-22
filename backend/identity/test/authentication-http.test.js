import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/database.js';
import { createIdentityServer } from '../src/server.js';

const user = {
  givenName: 'HTTP',
  familyName: 'Tester',
  dateOfBirth: '1997-05-14',
  email: 'http.tester@example.com',
  mobile: '+919812345678',
  password: 'A-valid-http-test-passphrase-2026',
};

async function withServer(run) {
  const directory = mkdtempSync(join(tmpdir(), 'clargen-auth-http-'));
  const database = openDatabase(join(directory, 'http.sqlite'));
  const server = createIdentityServer({ database });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try { await run(baseUrl, database); }
  finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
}

async function postJson(baseUrl, path, body, token) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

test('HTTP flow: signup, signin, retrieve own profile by Health ID and sign out', async () => {
  await withServer(async (baseUrl) => {
    const signup = await postJson(baseUrl, '/api/v1/signup', user);
    assert.equal(signup.status, 201);
    const registered = await signup.json();

    const signin = await postJson(baseUrl, '/api/v1/signin', {
      identifier: user.email,
      password: user.password,
    });
    assert.equal(signin.status, 200);
    const session = await signin.json();
    assert.match(session.accessToken, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(session.healthId, registered.healthId);

    const me = await fetch(`${baseUrl}/api/v1/me`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).individual.healthId, registered.healthId);

    const byHealthId = await fetch(
      `${baseUrl}/api/v1/individuals/health-id/${encodeURIComponent(registered.healthId)}`,
      { headers: { authorization: `Bearer ${session.accessToken}` } },
    );
    assert.equal(byHealthId.status, 200);
    assert.equal((await byHealthId.json()).individual.email, user.email);

    const signout = await postJson(baseUrl, '/api/v1/signout', {}, session.accessToken);
    assert.equal(signout.status, 204);
    const afterSignout = await fetch(`${baseUrl}/api/v1/me`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    assert.equal(afterSignout.status, 401);
  });
});

test('profile endpoints require a valid bearer token', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/me`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 'UNAUTHENTICATED');
  });
});

test('signin does not reveal whether an email exists', async () => {
  await withServer(async (baseUrl) => {
    const registered = await postJson(baseUrl, '/api/v1/signup', user);
    assert.equal(registered.status, 201);
    const wrongPassword = await postJson(baseUrl, '/api/v1/signin', {
      identifier: user.email,
      password: 'A-wrong-password-for-this-account',
    });
    const unknownAccount = await postJson(baseUrl, '/api/v1/signin', {
      identifier: 'missing@example.com',
      password: 'A-wrong-password-for-this-account',
    });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownAccount.status, 401);
    assert.deepEqual(await wrongPassword.json(), await unknownAccount.json());
  });
});
