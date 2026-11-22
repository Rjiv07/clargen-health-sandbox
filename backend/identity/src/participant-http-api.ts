import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import type { CreatePatientProfileInput, IssuedPatientIdentity, PatientIdentityIssuer } from './types';
import type { CreateOrganizationProfileInput, IssuedOrganizationIdentity } from './participant-types';
import type { MedplumOrganizationIdentityIssuer } from './organization-issuer';
import type { ClargenParticipantMatch, MedplumParticipantIdentityLookup } from './participant-lookup';
import { IdentityIntegrityError, IdentityIssuanceError, IdentityValidationError } from './types';

export interface ParticipantRequestContext {
  readonly canIssueIndividual: boolean;
  readonly canIssueOrganization: boolean;
  readonly lookup: MedplumParticipantIdentityLookup;
}
export interface ParticipantHttpApiDependencies {
  readonly individualIssuer: PatientIdentityIssuer;
  readonly organizationIssuer: Pick<MedplumOrganizationIdentityIssuer, 'createOrganizationProfile'>;
  readonly authenticate: (request: IncomingMessage) => Promise<ParticipantRequestContext | undefined>;
}
const MAX_BODY_BYTES = 32 * 1024;

export function createParticipantHttpServer(dependencies: ParticipantHttpApiDependencies): Server {
  return createServer((request, response) => { void handle(request, response, dependencies); });
}
async function handle(request: IncomingMessage, response: ServerResponse, dependencies: ParticipantHttpApiDependencies): Promise<void> {
  try {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (request.method === 'GET' && pathname === '/health') {
      send(response, 200, { status: 'ok', service: 'clargen-health-identity' });
      return;
    }
    if (!pathname.startsWith('/api/v1/')) { send(response, 404, { error: 'NOT_FOUND' }); return; }
    const context = await dependencies.authenticate(request);
    if (!context) { send(response, 401, { error: 'UNAUTHENTICATED', message: 'Authentication is required' }); return; }

    if (request.method === 'POST' && pathname === '/api/v1/participants/individuals') {
      if (!context.canIssueIndividual) { send(response, 403, { error: 'FORBIDDEN' }); return; }
      const issued = await dependencies.individualIssuer.createPatientProfile(await readJson(request) as CreatePatientProfileInput);
      send(response, 201, toIndividual(issued)); return;
    }
    if (request.method === 'POST' && pathname === '/api/v1/participants/organizations') {
      if (!context.canIssueOrganization) { send(response, 403, { error: 'FORBIDDEN' }); return; }
      const issued = await dependencies.organizationIssuer.createOrganizationProfile(await readJson(request) as CreateOrganizationProfileInput);
      send(response, 201, toOrganization(issued)); return;
    }
    const match = pathname.match(/^\/api\/v1\/participants\/health-id\/([^/]+)$/);
    if (request.method === 'GET' && match) {
      const result = await context.lookup.findAuthorizedParticipantByHealthId(decodeURIComponent(match[1]));
      if (!result) { send(response, 404, { error: 'PARTICIPANT_NOT_FOUND', message: 'No participant matches this Clargen Health ID' }); return; }
      send(response, 200, serializeMatch(result)); return;
    }
    send(response, 404, { error: 'NOT_FOUND', message: 'Route not found' });
  } catch (error) {
    if (error instanceof IdentityValidationError) { send(response, 400, { error: 'VALIDATION_ERROR', message: error.message, issues: error.issues }); return; }
    if (error instanceof IdentityIntegrityError) { send(response, 409, { error: 'IDENTITY_INTEGRITY_ERROR', message: error.message }); return; }
    if (error instanceof IdentityIssuanceError) { send(response, 503, { error: 'IDENTITY_ISSUANCE_FAILED', message: error.message }); return; }
    if (error instanceof SyntaxError) { send(response, 400, { error: 'INVALID_JSON', message: 'Request body must contain valid JSON' }); return; }
    if (error instanceof RangeError) { send(response, 400, { error: 'INVALID_REQUEST', message: error.message }); return; }
    send(response, 500, { error: 'INTERNAL_SERVER_ERROR', message: 'The request could not be completed' });
  }
}
async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += part.length;
    if (size > MAX_BODY_BYTES) throw new RangeError('Request body exceeds the 32 KB limit');
    chunks.push(part);
  }
  if (!size) throw new SyntaxError('Empty request body');
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RangeError('Request body must be a JSON object');
  return value;
}
function toIndividual(value: IssuedPatientIdentity): object {
  return { participantType: 'individual', healthId: value.healthId, resourceReference: value.patientReference, created: true, profile: value.patient };
}
function toOrganization(value: IssuedOrganizationIdentity): object {
  return { participantType: 'organization', healthId: value.healthId, resourceReference: value.organizationReference, created: true, profile: value.organization };
}
function serializeMatch(value: ClargenParticipantMatch): object {
  return { participantType: value.participantType, resource: value.resource };
}
function send(response: ServerResponse, status: number, body: unknown): void {
  if (response.headersSent) return;
  const payload = JSON.stringify(body);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(payload);
}
