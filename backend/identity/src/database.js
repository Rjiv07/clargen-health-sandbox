import { chmodSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT COLLATE NOCASE UNIQUE,
  mobile TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  CHECK (email IS NOT NULL OR mobile IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS individuals (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  health_id TEXT NOT NULL UNIQUE,
  given_name TEXT NOT NULL,
  family_name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(health_id) = 36 AND substr(health_id, 1, 4) = 'CLG-' AND substr(health_id, 5) NOT GLOB '*[^0-9A-F]*')
);

CREATE INDEX IF NOT EXISTS individuals_name_idx
  ON individuals(family_name COLLATE NOCASE, given_name COLLATE NOCASE);
`;

export function openDatabase(databasePath = process.env.CLARGEN_DB_PATH ?? './data/clargen.sqlite') {
  const isMemoryDatabase = databasePath === ':memory:';
  const absolutePath = isMemoryDatabase ? ':memory:' : resolve(databasePath);
  if (!isMemoryDatabase) {
    mkdirSync(dirname(absolutePath), { recursive: true, mode: 0o700 });
  }
  const database = new DatabaseSync(absolutePath);
  database.exec(SCHEMA);
  if (!isMemoryDatabase) {
    try { chmodSync(absolutePath, 0o600); } catch { /* Best-effort local file permission hardening. */ }
  }
  return database;
}