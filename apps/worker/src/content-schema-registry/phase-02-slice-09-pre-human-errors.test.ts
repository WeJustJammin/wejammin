/**
 * BE03a "Operation error coverage" for the original human mutations
 * A01-A03: every declared failure maps to its ApiError envelope and leaves no
 * partial aggregate or false success (no 2xx body, ETag or Location, no second
 * port call, no port call at all for a failure decided before the RPC).
 */
import { describe, expect, it } from 'vitest';

import {
  bodyOf,
  humanCase,
  makeHarness,
  sendHuman,
  type HumanCase,
} from './phase-02-slice-09-pre-support';
import {
  error,
  ok,
  session,
  validDraft,
  validField,
  validRelation,
} from './phase-02-slice-09-test-values';
import { jsonRequest } from './phase-02-slice-09-pre-support';

type Op = 'CMS-03A-01' | 'CMS-03A-02' | 'CMS-03A-03';
const BODY: Record<Op, unknown> = {
  'CMS-03A-01': validDraft,
  'CMS-03A-02': validField,
  'CMS-03A-03': validRelation,
};
const INVALID_BODY: Record<Op, unknown> = {
  'CMS-03A-01': { ...validDraft, typeKey: 'Bad Key' },
  'CMS-03A-02': { ...validField, kind: 'nope' },
  'CMS-03A-03': { ...validRelation, cardinality: 'few' },
};

const noSuccessArtifacts = (response: Response, text: string): void => {
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(response.headers.get('etag')).toBeNull();
  expect(response.headers.get('location')).toBeNull();
  expect(text).not.toContain('resourceKind');
};

const portOf = (harness: ReturnType<typeof makeHarness>, spec: HumanCase) =>
  harness.ports[spec.port];

const matrix = async (op: Op): Promise<void> => {
  const spec = humanCase(op);
  // 400 INVALID_REQUEST: a malformed mutation header (BE00 step 8) follows the
  // session, capability and quota steps and never reaches the RPC.
  const missingKey = makeHarness();
  const r400 = await sendHuman(missingKey, op, BODY[op], {
    'idempotency-key': 'short',
  });
  expect(r400.status).toBe(400);
  expect((await bodyOf(r400)).code).toBe('INVALID_REQUEST');
  expect(portOf(missingKey, spec)).not.toHaveBeenCalled();
  expect(missingKey.resolveSession).toHaveBeenCalledTimes(1);
  // 401 UNAUTHENTICATED with the reauthenticate recovery.
  const anonymous = makeHarness({
    session: error(401, 'UNAUTHENTICATED', 'Sign in required.', {
      recoveryAction: 'reauthenticate',
    }),
  });
  const r401 = await sendHuman(anonymous, op, BODY[op]);
  expect(r401.status).toBe(401);
  const b401 = await bodyOf(r401);
  expect(b401.code).toBe('UNAUTHENTICATED');
  expect(b401.details).toEqual({ recoveryAction: 'reauthenticate' });
  expect(portOf(anonymous, spec)).not.toHaveBeenCalled();
  // 403 FORBIDDEN with a registered reasonCode: capability, origin and CSRF.
  const noCapability = makeHarness({
    session: ok({ ...session, capabilities: [] }),
  });
  const r403 = await sendHuman(noCapability, op, BODY[op]);
  expect(r403.status).toBe(403);
  expect((await bodyOf(r403)).details.reasonCode).toBe('CAPABILITY_REQUIRED');
  expect(portOf(noCapability, spec)).not.toHaveBeenCalled();
  const origin = makeHarness();
  expect(
    (
      await sendHuman(origin, op, BODY[op], {
        origin: 'https://evil.example.test',
      })
    ).status,
  ).toBe(403);
  const csrf = makeHarness();
  expect(
    (
      await sendHuman(csrf, op, BODY[op], {
        cookie: 'wj_session_ref=s; wj_csrf=a',
        'x-csrf-token': 'b',
      })
    ).status,
  ).toBe(403);
  for (const harness of [origin, csrf])
    expect(portOf(harness, spec)).not.toHaveBeenCalled();
  // 415 UNSUPPORTED_MEDIA_TYPE and 413 PAYLOAD_TOO_LARGE before any authority.
  const media = makeHarness();
  const r415 = await sendHuman(media, op, BODY[op], {
    'content-type': 'text/plain',
  });
  expect(r415.status).toBe(415);
  expect((await bodyOf(r415)).code).toBe('UNSUPPORTED_MEDIA_TYPE');
  const large = makeHarness();
  const r413 = await large.app.request(
    jsonRequest(spec.path, BODY[op], {
      'content-length': String(256 * 1024 + 1),
      ...(spec.ifMatch ? { 'if-match': '"1"' } : {}),
    }),
  );
  expect(r413.status).toBe(413);
  for (const harness of [media, large]) {
    expect(portOf(harness, spec)).not.toHaveBeenCalled();
    expect(harness.resolveSession).not.toHaveBeenCalled();
  }
  // 422 VALIDATION_FAILED with path violations.
  const invalid = makeHarness();
  const r422 = await sendHuman(invalid, op, INVALID_BODY[op]);
  expect(r422.status).toBe(422);
  expect((await bodyOf(r422)).details.violations?.length).toBeGreaterThan(0);
  expect(portOf(invalid, spec)).not.toHaveBeenCalled();
  // 429 RATE_LIMITED with Retry-After before the RPC.
  const limited = makeHarness({
    rate: ok({
      allowed: false,
      limit: 30,
      remaining: 0,
      resetAt: 1_788_345_660,
    }),
  });
  const r429 = await sendHuman(limited, op, BODY[op]);
  expect(r429.status).toBe(429);
  expect((await bodyOf(r429)).code).toBe('RATE_LIMITED');
  expect(Number(r429.headers.get('retry-after'))).toBeGreaterThan(0);
  expect(portOf(limited, spec)).not.toHaveBeenCalled();
  // After the RPC: 404 (hidden parent, A02/A03), 409 (stale/immutable/duplicate), 502/503/504, 500.
  const rpc = async (result: unknown, status: number, code: string) => {
    const harness = makeHarness();
    portOf(harness, spec).mockResolvedValueOnce(result);
    const response = await sendHuman(harness, op, BODY[op]);
    expect(response.status).toBe(status);
    const text = await response.text();
    expect((JSON.parse(text) as { code: string }).code).toBe(code);
    expect(portOf(harness, spec)).toHaveBeenCalledTimes(1);
    noSuccessArtifacts(response, text);
    return response;
  };
  if (op !== 'CMS-03A-01') await rpc(error(404, 'NOT_FOUND'), 404, 'NOT_FOUND');
  for (const conflict of [
    'VERSION_MISMATCH',
    'INVALID_TRANSITION',
    'IDEMPOTENCY_MISMATCH',
  ])
    await rpc(
      error(409, 'CONFLICT', 'conflict', { conflict }),
      409,
      'CONFLICT',
    );
  for (const status of [502, 503, 504] as const) {
    const response = await rpc(
      error(status, 'DEPENDENCY_UNAVAILABLE'),
      status,
      'DEPENDENCY_UNAVAILABLE',
    );
    expect(response.headers.get('x-content-schema-registry-retryable')).toBe(
      'true',
    );
  }
  const crashing = makeHarness();
  portOf(crashing, spec).mockRejectedValueOnce(
    new Error('SQLSTATE 23505 duplicate key on cms_content_types'),
  );
  const r500 = await sendHuman(crashing, op, BODY[op]);
  expect(r500.status).toBe(500);
  const t500 = await r500.text();
  expect((JSON.parse(t500) as { code: string }).code).toBe('INTERNAL_ERROR');
  expect(t500).not.toMatch(/SQLSTATE|cms_content_types/u);
  noSuccessArtifacts(r500, t500);
};

describe('BE03a original human mutation error coverage', () => {
  it('[P2-S09-AC-193] maps every A01 failure to its declared ApiError and leaves no partial aggregate or false success', () =>
    matrix('CMS-03A-01'));
  it('[P2-S09-AC-194] maps every A02 failure to its declared ApiError and leaves the prior draft unchanged', () =>
    matrix('CMS-03A-02'));
  it('[P2-S09-AC-195] maps every A03 failure to its declared ApiError and leaves the prior schema unchanged', () =>
    matrix('CMS-03A-03'));
});
