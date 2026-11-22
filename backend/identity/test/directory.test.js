import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/database.js';
import { registerIndividual } from '../src/registration.js';
import { searchDiscoverableIndividuals, setIndividualDiscoverability } from '../src/directory.js';
import { getOwnIndividualProfile } from '../src/authentication.js';
import { ValidationError } from '../src/errors.js';

const user = (givenName, familyName, email, mobile) => ({
  givenName, familyName, dateOfBirth: '1998-04-16', email, mobile,
  password: 'A-long-test-passphrase-for-directory',
});

async function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), 'clargen-directory-'));
  const database = openDatabase(join(directory, 'directory.sqlite'));
  try { await run(database); }
  finally { if (database.isOpen) database.close(); rmSync(directory, { recursive: true, force: true }); }
}

test('directory is opt-in by default and returns minimal identity fields only', async () => {
  await withDatabase(async (database) => {
    await registerIndividual(database, user('Asha', 'Rao', 'asha@example.com', '+919876543210'), { hashPassword: async () => 'test-hash' });
    const second = await registerIndividual(database, user('Ashwin', 'Rao', 'ashwin@example.com', '+919876543211'), { hashPassword: async () => 'test-hash' });
    const firstId = database.prepare("SELECT id FROM accounts WHERE email = 'asha@example.com'").get().id;
    const secondId = database.prepare("SELECT id FROM accounts WHERE email = 'ashwin@example.com'").get().id;
    assert.equal(getOwnIndividualProfile(database, secondId).discoverable, false);
    assert.deepEqual(searchDiscoverableIndividuals(database, firstId, { query: 'Ash' }).individuals, []);
    assert.equal(setIndividualDiscoverability(database, secondId, true), true);
    const result = searchDiscoverableIndividuals(database, firstId, { query: 'Ash' });
    assert.equal(result.individuals.length, 1);
    assert.deepEqual(result.individuals[0], { healthId: second.healthId, givenName: 'Ashwin', familyName: 'Rao' });
    assert.equal(Object.hasOwn(result.individuals[0], 'email'), false);
    assert.equal(Object.hasOwn(result.individuals[0], 'mobile'), false);
    assert.equal(Object.hasOwn(result.individuals[0], 'dateOfBirth'), false);
    assert.equal(getOwnIndividualProfile(database, secondId).discoverable, true);
  });
});

test('individuals can withdraw discoverability and disappear from later searches', async () => {
  await withDatabase(async (database) => {
    await registerIndividual(database, user('Asha', 'Rao', 'asha@example.com', '+919876543210'), { hashPassword: async () => 'test-hash' });
    const second = await registerIndividual(database, user('Ashwin', 'Rao', 'ashwin@example.com', '+919876543211'), { hashPassword: async () => 'test-hash' });
    const firstId = database.prepare("SELECT id FROM accounts WHERE email = 'asha@example.com'").get().id;
    const secondId = database.prepare("SELECT id FROM accounts WHERE email = 'ashwin@example.com'").get().id;
    setIndividualDiscoverability(database, secondId, true);
    assert.equal(searchDiscoverableIndividuals(database, firstId, { query: second.healthId }).individuals.length, 1);
    setIndividualDiscoverability(database, secondId, false);
    assert.equal(searchDiscoverableIndividuals(database, firstId, { query: second.healthId }).individuals.length, 0);
  });
});

test('directory search supports bounded pagination and excludes the searching account', async () => {
  await withDatabase(async (database) => {
    await registerIndividual(database, user('Asha', 'Rao', 'asha@example.com', '+919876543210'), { hashPassword: async () => 'test-hash' });
    await registerIndividual(database, user('Ashwin', 'Rao', 'ashwin@example.com', '+919876543211'), { hashPassword: async () => 'test-hash' });
    await registerIndividual(database, user('Ashlee', 'Rao', 'ashlee@example.com', '+919876543212'), { hashPassword: async () => 'test-hash' });
    const rows = database.prepare("SELECT id FROM accounts WHERE email <> 'asha@example.com'").all();
    const firstId = database.prepare("SELECT id FROM accounts WHERE email = 'asha@example.com'").get().id;
    rows.forEach((row) => setIndividualDiscoverability(database, row.id, true));
    const page = searchDiscoverableIndividuals(database, firstId, { query: 'Ash', limit: 1, offset: 0 });
    assert.equal(page.individuals.length, 1);
    assert.equal(page.pagination.hasMore, true);
    const next = searchDiscoverableIndividuals(database, firstId, { query: 'Ash', limit: 1, offset: 1 });
    assert.equal(next.individuals.length, 1);
    assert.equal(next.pagination.hasMore, false);
  });
});

test('directory input and pagination limits are validated', async () => {
  await withDatabase(async (database) => {
    assert.throws(() => searchDiscoverableIndividuals(database, 'account', { query: 'a' }), ValidationError);
    assert.throws(() => searchDiscoverableIndividuals(database, 'account', { query: 'Ash', limit: 51 }), ValidationError);
    assert.throws(() => searchDiscoverableIndividuals(database, 'account', { query: 'Ash', offset: -1 }), ValidationError);
    assert.throws(() => setIndividualDiscoverability(database, 'account', 'true'), ValidationError);
  });
});

test('LIKE wildcard characters are treated literally in search input', async () => {
  await withDatabase(async (database) => {
    await registerIndividual(database, user('100% Natural', 'Foods', 'natural@example.com', '+919876543210'), { hashPassword: async () => 'test-hash' });
    const second = await registerIndividual(database, user('Other', 'Person', 'other@example.com', '+919876543211'), { hashPassword: async () => 'test-hash' });
    const naturalId = database.prepare("SELECT id FROM accounts WHERE email = 'natural@example.com'").get().id;
    const otherId = database.prepare("SELECT id FROM accounts WHERE email = 'other@example.com'").get().id;
    setIndividualDiscoverability(database, naturalId, true);
    setIndividualDiscoverability(database, otherId, true);
    const result = searchDiscoverableIndividuals(database, otherId, { query: '100%' });
    assert.equal(result.individuals.length, 1);
    assert.equal(result.individuals[0].givenName, '100% Natural');
    assert.notEqual(result.individuals[0].healthId, second.healthId);
  });
});
