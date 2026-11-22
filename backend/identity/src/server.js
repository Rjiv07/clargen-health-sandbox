import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import {
  authenticateAccessToken,
  getIndividualProfileByHealthId,
  getOwnIndividualProfile,
  revokeAccessToken,
  signIn,
} from './authentication.js';
import {
  AuthenticationRequiredError,
  ContactAlreadyRegisteredError,
  InvalidCredentialsError,
  UnsupportedMediaTypeError,
  ValidationError,
  HealthIdIssuanceError,
} from './errors.js';
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
        const body = await readJsonRequest(request);
        const result = await registerIndividual(database, body);
        sendJson(response, 201, result);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/v1/signin') {
        const body = await readJsonRequest(request);
        const result = await signIn(database, body);
        sendJson(response, 200, result);
        return;
      }

      const isMeRoute = request.method === 'GET' && url.pathname === '/api/v1/me';
      const healthIdMatch = request.method === 'GET'
        ? url.pathname.match(/^\/api\/v1\/individuals\/health-id\/([^/]+)$/)
        : null;
      const isSignoutRoute = request.method === 'POST' && url.pathname === '/api/v1/signout';

      if (isMeRoute || healthIdMatch || isSignoutRoute) {
        const token = readBearerToken(request.headers.authorization);
        const session = token ? authenticateAccessToken(database, token) : undefined;
        if (!session) throw new AuthenticationRequiredError();

        if (isSignoutRoute) {
          revokeAccessToken(database, token);
          sendEmpty(response, 204);
          return;
        }

        let requestedHealthId;
        if (healthIdMatch) {
          try {
            requestedHealthId = decodeURIComponent(healthIdMatch[1]);
          } catch {
            sendJson(response, 404, { error: 'PROFILE_NOT_FOUND', message: 'No profile is available for this Health ID' });
            return;
          }
        }

        const profile = isMeRoute
          ? getOwnIndividualProfile(database, session.accountId)
          : getIndividualProfileByHealthId(database, session.accountId, requestedHealthId);

        if (!profile) {
          sendJson(response, 404, {
            error: 'PROFILE_NOT_FOUND',
            message: 'No profile is available for this Health ID',
          });
          return;
        }
        sendJson(response, 200, { individual: profile });
        return;
      }

      sendJson(response, 404, { error: 'NOT_FOUND', message: 'Route not found' });
    } catch (error) {
      if (error instanceof ValidationError) {
        sendJson(response, 400, { error: 'VALIDATION_ERROR', message: error.message, issues: error.issues });
      } else if (error instanceof UnsupportedMediaTypeError) {
        sendJson(response, 415, { error: 'UNSUPPORTED_MEDIA_TYPE', message: error.message });
      } else if (error instanceof ContactAlreadyRegisteredError) {
        sendJson(response, 409, { error: 'CONTACT_ALREADY_REGISTERED', message: error.message });
      } else if (error instanceof InvalidCredentialsError) {
        sendJson(response, 401, { error: 'INVALID_CREDENTIALS', message: error.message });
      } else if (error instanceof AuthenticationRequiredError) {
        sendJson(response, 401, { error: 'UNAUTHENTICATED', message: error.message });
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

async function readJsonRequest(request) {
  if (!request.headers['content-type']?.toLowerCase().includes('application/json')) {
    throw new UnsupportedMediaTypeError();
  }
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

function readBearerToken(header) {
  if (typeof header !== 'string') return undefined;
  const match = header.match(/^Bearer\s+([A-Za-z0-9_-]{43})$/i);
  return match?.[1];
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

function sendEmpty(response, statusCode) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end();
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
