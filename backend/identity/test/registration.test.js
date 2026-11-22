import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/database.js';
import { registerIndividual } from '../src/registration.js';
import { ContactAlreadyRegisteredError, ValidationError } from '../src/errors.js';

const validInput = {
  givenName: 'Asha',
  familyName: 'Rao',
  dateOfBirth: '1998-04-16',
  email: 'ASHA.RAO@example.com',
  mobile: '+91 98765 43210',
  password: 'A-long-local-test-passphrase-2026',
};

async function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), 'clargen-sprint1-'));
  const path = join(directory, 'test.sqlite');
  let database = openDatabase(path);
  try { await run(database, path, () => { database.close(); database = openDatabase(path); }); }
  finally { if (database.isOpen) database.close(); rmSync(directory, { recursive: true, force: true }); }
}

test('signup issues a unique persistent Clargen Health ID and stores only a password hash', async () => {
  await withDatabase(async (database) => {
    const result = await registerIndividual(database, validInput);
    assert.match(result.healthId, /^CLG-[0-9A-F]{32}$/);
    assert.equal(result.status, 'registered');
    assert.equal(result.individual.email, 'asha.rao@example.com');
    assert.equal(result.individual.mobile, '+919876543210');
    const account = database.prepare('SELECT email, mobile, password_hash FROM accounts').get();
    assert.equal(account.email, 'asha.rao@example.com');
    assert.equal(account.mobile, '+919876543210');
    assert.match(account.password_hash, /^scrypt\$16384\$8\$1\$/);
    assert.notEqual(account.password_hash, validInput.password);
    const profile = database.prepare('SELECT health_id FROM individuals').get();
    assert.equal(profile.health_id, result.healthId);
  });
});

test('signup rejects an already registered email case-insensitively', async () => {
  await withDatabase(async (database) => {
    await registerIndividual(database, validInput);
    await assert.rejects(
      registerIndividual(database, { ...validInput, email: 'asha.rao@EXAMPLE.com' }),
      ContactAlreadyRegisteredError,
    );
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM accounts').get().count, 1);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM individuals').get().count, 1);
  });
});

test('signup rejects invalid dates, malformed email and weak passwords', async () => {
  await withDatabase(async (database) => {
    await assert.rejects(
      registerIndividual(database, { ...validInput, email: '', mobile: '' }),
      ValidationError,
    );
    await assert.rejects(
      registerIndividual(database, { ...validInput, dateOfBirth: '2001-02-29' }),
      ValidationError,
    );
    await assert.rejects(
      registerIndividual(database, { ...validInput, email: 'not-an-email' }),
      ValidationError,
    );
    await assert.rejects(
      registerIndividual(database, { ...validInput, password: 'short' }),
      ValidationError,
    );
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM accounts').get().count, 0);
  });
});

test('Health ID collision is retried and database uniqueness is preserved', async () => {
  await withDatabase(async (database) => {
    const ids = ['CLG-0123456789ABCDEF0123456789ABCDEF', 'CLG-0123456789ABCDEF0123456789ABCDEF', 'CLG-FEDCBA9876543210FEDCBA9876543210'];
    const generator = () => ids.shift();
    const first = await registerIndividual(database, validInput, { generateHealthId: generator, hashPassword: async () => 'test-hash' });
    assert.equal(first.healthId, 'CLG-0123456789ABCDEF0123456789ABCDEF');
    const second = await registerIndividual(database, { ...validInput, email: 'second@example.com', mobile: '+919876543211' }, { generateHealthId: generator, hashPassword: async () => 'test-hash' });
    assert.equal(second.healthId, 'CLG-FEDCBA9876543210FEDCBA9876543210');
  });
});

test('issued identity survives closing and reopening the local database', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'clargen-persistence-'));
  const path = join(directory, 'persistent.sqlite');
  let database = openDatabase(path);
  try {
    const result = await registerIndividual(database, validInput);
    database.close();
    database = openDatabase(path);
    const saved = database.prepare(
      `SELECT i.health_id, i.given_name, i.family_name, a.email, a.mobile
       FROM individuals i JOIN accounts a ON a.id = i.account_id`
    ).get();
    assert.equal(saved.health_id, result.healthId);
    assert.equal(saved.given_name, 'Asha');
    assert.equal(saved.family_name, 'Rao');
    assert.equal(saved.email, 'asha.rao@example.com');
    assert.equal(saved.mobile, '+919876543210');
  } finally {
    if (database.isOpen) database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('signup supports mobile-only registration when email is not provided', async () => {
  await withDatabase(async (database) => {
    const result = await registerIndividual(database, {
      givenName: 'Mobile',
      familyName: 'Only',
      dateOfBirth: '1999-09-09',
      mobile: '+91 98765 43211',
      password: 'A-mobile-only-local-test-passphrase',
    });
    assert.match(result.healthId, /^CLG-[0-9A-F]{32}$/);
    assert.equal(result.individual.email, null);
    assert.equal(result.individual.mobile, '+919876543211');
    const account = database.prepare('SELECT email, mobile FROM accounts').get();
    assert.equal(account.email, null);
    assert.equal(account.mobile, '+919876543211');
  });
});

test('signup rejects an already registered mobile number', async () => {
  await withDatabase(async (database) => {
    await registerIndividual(database, validInput);
    await assert.rejects(
      registerIndividual(database, { ...validInput, email: 'second@example.com' }),
      ContactAlreadyRegisteredError,
    );
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM accounts').get().count, 1);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM individuals').get().count, 1);
  });
});
