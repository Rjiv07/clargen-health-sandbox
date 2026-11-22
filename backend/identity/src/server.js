import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { ContactAlreadyRegisteredError, ValidationError, HealthIdIssuanceError } from './errors.js';
import { openDatabase } from './database.js';
import { registerIndividual } from './registration.js';

const MAX_BODY_BYTES = 16 * 1024;

export function createIdentityServer({ database = openDatabase() } = {}) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, { status: 'ok', service: 'clargen-health-id' });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/v1/signup') {
        if (!request.headers['content-type']?.toLowerCase().includes('application/json')) {
          sendJson(response, 415, { error: 'UNSUPPORTED_MEDIA_TYPE', message: 'Send signup details as application/json' });
          return;
        }
        const body = await readJson(request);
        const result = await registerIndividual(database, body);
        sendJson(response, 201, result);
        return;
      }

      sendJson(response, 404, { error: 'NOT_FOUND', message: 'Route not found' });
    } catch (error) {
      if (error instanceof ValidationError) {
        sendJson(response, 400, { error: 'VALIDATION_ERROR', message: error.message, issues: error.issues });
      } else if (error instanceof ContactAlreadyRegisteredError) {
        sendJson(response, 409, { error: 'CONTACT_ALREADY_REGISTERED', message: error.message });
      } else if (error instanceof HealthIdIssuanceError) {
        sendJson(response, 503, { error: 'HEALTH_ID_ISSUANCE_FAILED', message: error.message });
      } else if (error instanceof SyntaxError) {
        sendJson(response, 400, { error: 'INVALID_JSON', message: 'Request body must contain valid JSON' });
      } else if (error instanceof RangeError) {
        sendJson(response, 413, { error: 'REQUEST_TOO_LARGE', message: error.message });
      } else {
        // Avoid exposing SQL errors, password hashes, or stack traces to clients.
        sendJson(response, 500, { error: 'INTERNAL_SERVER_ERROR', message: 'The request could not be completed' });
      }
    }
  });

  server.on('close', () => {
    if (database.isOpen) database.close();
  });
  return server;
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_BODY_BYTES) throw new RangeError('Request body exceeds the 16 KB limit');
    chunks.push(bytes);
  }
  if (size === 0) throw new SyntaxError('Request body is empty');
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  return body;
}

function sendJson(response, statusCode, value) {
  if (response.headersSent) return;
  const payload = JSON.stringify(value);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  response.end(payload);
}

async function main() {
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(process.env.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const server = createIdentityServer();
  server.listen(port, host, () => {
    process.stdout.write(`Clargen Health ID API listening at http://${host}:${port}\n`);
    process.stdout.write(`SQLite database: ${process.env.CLARGEN_DB_PATH ?? './data/clargen.sqlite'}\n`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
