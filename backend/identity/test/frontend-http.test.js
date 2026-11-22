import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/database.js';
import { createIdentityServer } from '../src/server.js';

test('local demo frontend and assets are served by the identity server', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'clargen-frontend-'));
  const database = openDatabase(join(directory, 'frontend.sqlite'));
  const server = createIdentityServer({ database });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = 'http://127.0.0.1:' + server.address().port;

  try {
    const page = await fetch(baseUrl + '/');
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    assert.match(await page.text(), /Create a test account/);

    const script = await fetch(baseUrl + '/app.js');
    assert.equal(script.status, 200);
    assert.match(script.headers.get('content-type'), /javascript/);
    assert.match(await script.text(), /api\/v1\/individuals\/search/);

    const styles = await fetch(baseUrl + '/styles.css');
    assert.equal(styles.status, 200);
    assert.match(styles.headers.get('content-type'), /text\/css/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});