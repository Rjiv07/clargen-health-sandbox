import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import type { Patient } from '@medplum/fhirtypes';
import type { WithId } from '@medplum/core';
import type {
  CreatePatientProfileInput,
  IssuedPatientIdentity,
  PatientIdentityIssuer,
  PatientIdentityLookup,
  PatientProfileService,
  UpdatePatientProfileInput,
} from './types';
import { IdentityIntegrityError, IdentityIssuanceError, IdentityValidationError } from './types';

export interface IdentityRequestContext {
  /** True only when the authenticated actor is permitted to issue identities. */
  readonly canIssue: boolean;
  /** Must be constructed with the authenticated caller's Medplum permissions. */
  readonly lookup: PatientIdentityLookup;
  /** Must use the authenticated caller's Medplum permissions. */
  readonly profiles: PatientProfileService;
  /** Must read through the authenticated caller's Medplum client. */
  readonly readPatient: (patientId: string) => Promise<WithId<Patient>>;
}

export interface IdentityHttpApiDependencies {
  readonly issuer: PatientIdentityIssuer;
  /** Validate the incoming bearer/session and return caller-scoped services. */
  readonly authenticate: (request: IncomingMessage) => Promise<IdentityRequestContext | undefined>;
}

const MAX_BODY_BYTES = 32 * 1024;

export function createIdentityHttpServer(dependencies: IdentityHttpApiDependencies): Server {
  return createServer((request, response) => {
    void handleRequest(request, response, dependencies);
  });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: IdentityHttpApiDependencies
): Promise<void> {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const pathname = url.pathname;

    if (request.method === 'GET' && pathname === '/health') {
      sendJson(response, 200, { status: 'ok', service: 'clargen-health-identity' });
      return;
    }

    if (!pathname.startsWith('/api/v1/')) {
      sendJson(response, 404, { error: 'NOT_FOUND', message: 'Route not found' });
      return;
    }

    const context = await dependencies.authenticate(request);
    if (!context) {
      sendJson(response, 401, { error: 'UNAUTHENTICATED', message: 'Authentication is required' });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/v1/patients') {
      if (!context.canIssue) {
        sendJson(response, 403, { error: 'FORBIDDEN', message: 'Identity issuance is not permitted' });
        return;
      }
      const input = asCreateInput(await readJson(request));
      const issued = await dependencies.issuer.createPatientProfile(input);
      sendJson(response, 201, toIssuedResponse(issued));
      return;
    }

    const lookupMatch = pathname.match(/^\/api\/v1\/patients\/health-id\/([^/]+)$/);
    if (request.method === 'GET' && lookupMatch) {
      const healthId = decodeURIComponent(lookupMatch[1]);
      const patient = await context.lookup.findAuthorizedPatientByHealthId(healthId);
      if (!patient) {
        sendJson(response, 404, { error: 'PATIENT_NOT_FOUND', message: 'No Patient matches this Health ID' });
        return;
      }
      sendJson(response, 200, { patient });
      return;
    }

    const profileMatch = pathname.match(/^\/api\/v1\/patients\/([^/]+)\/profile$/);
    if (profileMatch) {
      const patientId = decodeURIComponent(profileMatch[1]);
      if (request.method === 'GET') {
        const patient = await context.readPatient(patientId);
        sendJson(response, 200, { patient });
        return;
      }
      if (request.method === 'PATCH') {
        const update = asUpdateInput(await readJson(request));
        const patient = await context.profiles.updateAuthorizedProfile(patientId, update);
        sendJson(response, 200, { patient });
        return;
      }
    }

    sendJson(response, 404, { error: 'NOT_FOUND', message: 'Route not found' });
  } catch (error) {
    if (error instanceof IdentityValidationError) {
      sendJson(response, 400, { error: 'VALIDATION_ERROR', message: error.message, issues: error.issues });
      return;
    }
    if (error instanceof IdentityIntegrityError) {
      sendJson(response, 409, { error: 'IDENTITY_INTEGRITY_ERROR', message: error.message });
      return;
    }
    if (error instanceof IdentityIssuanceError) {
      sendJson(response, 503, { error: 'IDENTITY_ISSUANCE_FAILED', message: error.message });
      return;
    }
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: 'INVALID_JSON', message: 'Request body must contain valid JSON' });
      return;
    }
    if (error instanceof RangeError) {
      sendJson(response, 400, { error: 'INVALID_REQUEST', message: error.message });
      return;
    }
    // Do not return raw Medplum/server errors or stack traces to API callers.
    sendJson(response, 500, { error: 'INTERNAL_SERVER_ERROR', message: 'The request could not be completed' });
  }
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new RangeError('Request body exceeds the 32 KB limit');
    }
    chunks.push(buffer);
  }
  if (size === 0) {
    throw new SyntaxError('Empty request body');
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function asCreateInput(value: unknown): CreatePatientProfileInput {
  if (!isRecord(value)) {
    throw new RangeError('Request body must be a JSON object');
  }
  return value as unknown as CreatePatientProfileInput;
}

function asUpdateInput(value: unknown): UpdatePatientProfileInput {
  if (!isRecord(value) || typeof value.expectedVersionId !== 'string' || !value.expectedVersionId.trim()) {
    throw new RangeError('expectedVersionId is required in the request body');
  }
  return value as unknown as UpdatePatientProfileInput;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toIssuedResponse(issued: IssuedPatientIdentity): {
  healthId: string;
  patientReference: string;
  created: true;
  patient: Patient;
} {
  return {
    healthId: issued.healthId,
    patientReference: issued.patientReference,
    created: true,
    patient: issued.patient,
  };
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  if (response.headersSent) {
    return;
  }
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(payload);
}
