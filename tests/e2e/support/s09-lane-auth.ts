import type { AuthenticationSession } from '../../../apps/worker/src/authentication/types';
import type { ContentSchemaRegistrySession } from '../../../apps/worker/src/content-schema-registry/types';

import {
  LANE_ACTING_PARTY_ID,
  LANE_CAPABILITIES,
  lanePersonId,
  laneRoleOfUser,
  laneUserId,
  parseLaneSessionId,
  type LaneRole,
} from './s09-lane-ids';
import { SESSION_SIGNING_SECRET } from './s09-session-authority';
import { iso, worldFor, type World } from './s09-lane-world';

/** Step-up proofs are fresh for ten minutes (BE01a), checked on every read. */
export const STEP_UP_WINDOW_MS = 600_000;

export type LaneClaim = Readonly<{
  sessionId: string;
  userId: string;
  role: LaneRole;
  testId: string;
  generation: number;
}>;

const revokedLaneSessions = new Set<string>();
export const revokeLaneSession = (sessionId: string): void => {
  revokedLaneSessions.add(sessionId);
};

const cookieValue = (request: Request, name: string): string | null => {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf('=');
    if (separator > 0 && trimmed.slice(0, separator) === name)
      return trimmed.slice(separator + 1);
  }
  return null;
};

const decode = (value: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  try {
    const padded =
      value.replace(/-/gu, '+').replace(/_/gu, '/') +
      '='.repeat((4 - (value.length % 4)) % 4);
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
};

/** Verify one signed lane access token; null for anything else (legacy included). */
const verifyLaneToken = async (token: string): Promise<LaneClaim | null> => {
  const parts = token.split('.');
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (
    parts.length !== 3 ||
    encodedHeader === undefined ||
    encodedPayload === undefined ||
    encodedSignature === undefined
  )
    return null;
  const header = decode(encodedHeader);
  const payload = decode(encodedPayload);
  const signature = decode(encodedSignature);
  if (header === null || payload === null || signature === null) return null;
  try {
    const head = JSON.parse(new TextDecoder().decode(header)) as { alg?: unknown; typ?: unknown };
    const body = JSON.parse(new TextDecoder().decode(payload)) as {
      exp?: unknown;
      session_id?: unknown;
      sub?: unknown;
    };
    const parsed = parseLaneSessionId(body.session_id);
    if (head.alg !== 'HS256' || head.typ !== 'JWT' || parsed === null) return null;
    if (
      laneRoleOfUser(body.sub) !== parsed.role ||
      typeof body.exp !== 'number' ||
      body.exp <= Math.floor(Date.now() / 1_000) ||
      revokedLaneSessions.has(body.session_id as string)
    )
      return null;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SESSION_SIGNING_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );
    return valid
      ? {
          sessionId: body.session_id as string,
          userId: body.sub as string,
          role: parsed.role,
          testId: parsed.testId,
          generation: parsed.generation,
        }
      : null;
  } catch {
    return null;
  }
};

/** Verify a lane session cookie pair (the browser session shape). */
export const verifyLaneRequest = async (request: Request): Promise<LaneClaim | null> => {
  if (cookieValue(request, 'wj_session_ref') === null) return null;
  const token = cookieValue(request, 'wj_access');
  return token === null ? null : verifyLaneToken(token);
};

const bearerToken = (request: Request): string | null => {
  const value = request.headers.get('authorization');
  return value !== null && /^Bearer [^\s]+$/u.test(value)
    ? value.slice('Bearer '.length)
    : null;
};

/** Verify the bearer the web job boundary forwards (the cookie's token). */
export const verifyLaneBearer = async (request: Request): Promise<LaneClaim | null> => {
  const token = bearerToken(request);
  return token === null ? null : verifyLaneToken(token);
};

/** Read the claim of a request the route already admitted (no re-verification). */
export const laneClaimOf = (request: Request): LaneClaim | null => {
  const token = cookieValue(request, 'wj_access');
  const payload = token?.split('.')[1];
  const bytes = payload === undefined ? null : decode(payload);
  if (bytes === null) return null;
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes)) as {
      session_id?: unknown;
      sub?: unknown;
    };
    const parsed = parseLaneSessionId(body.session_id);
    return parsed === null
      ? null
      : {
          sessionId: body.session_id as string,
          userId: laneUserId(parsed.role),
          ...parsed,
        };
  } catch {
    return null;
  }
};

export const worldOfClaim = (claim: LaneClaim): World => worldFor(claim.testId);

/** Server-owned step-up freshness for one role of one world (never client input). */
export const stepUpFreshUntil = (world: World, role: LaneRole): string | null => {
  const at = world.stepUpAt[role];
  if (at === undefined) return null;
  const until = Date.parse(at) + STEP_UP_WINDOW_MS;
  return until > Date.now() ? iso(until) : null;
};

export const registrySessionFor = (
  claim: LaneClaim,
): ContentSchemaRegistrySession => {
  const world = worldOfClaim(claim);
  const freshUntil = stepUpFreshUntil(world, claim.role);
  return {
    userId: claim.userId,
    actingPartyId: LANE_ACTING_PARTY_ID,
    capabilities: LANE_CAPABILITIES[claim.role],
    mfaFresh: freshUntil !== null,
    ...(freshUntil === null ? {} : { stepUpFreshUntil: freshUntil }),
  };
};

export const authenticationSessionFor = (
  claim: LaneClaim,
): AuthenticationSession => {
  const world = worldOfClaim(claim);
  return {
    authUserId: claim.userId,
    sessionId: claim.sessionId,
    accountState: 'active',
    personId: lanePersonId(claim.role),
    actingPartyId: LANE_ACTING_PARTY_ID,
    expiresAt: '2099-01-01T00:00:00.000Z',
    stepUpAt: world.stepUpAt[claim.role] ?? null,
    primaryAuthAt: iso(Date.now() - 60_000),
  };
};
