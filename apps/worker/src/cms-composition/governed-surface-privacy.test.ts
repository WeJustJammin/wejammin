import { createLogger } from '@wejammin/observability/logging';
import { describe, expect, it, vi } from 'vitest';

import { createPatternUpdateHarness } from './pattern-update-routes.test-support';
import {
  diffNodeValue,
  diffResource,
  puDiffPath,
} from './pattern-update.test-support';

import {
  assignmentRequest,
  assignmentResource,
  createBody,
  decidedReview,
  decisionBody,
  decisionRequest,
  detailRequest,
  detailResource,
  FRESH_STEP_UP,
  governedHarness,
  jsonReply,
  ownerSession,
  queuePage,
  queueRequest,
  reviewerSession,
  sqlRefusal,
} from './governed-review-ops.test-support';

/**
 * FE03 895 (and BE03c "no-store"): decision reasons, the policy basis, pattern diff values,
 * canonical ids and every assignment identifier "never enter a public/private cache, analytics
 * event, Realtime body, URL, or log". Each sentinel travels through the real governed routes (the
 * decision, assignment, detail and queue operations, success and refusal); the sweep then looks
 * at every place the Worker could leak one: response cache headers, the ETag, the outbound URLs,
 * and every structured log line (the sink the telemetry events are written to).
 */
const REASON = 'sentinel-reason-9c41';
const POLICY_HASH = 'a1b2c3d4'.repeat(8);
const ASSIGNMENT_ID = 'd1200000-0000-4000-8000-0000000fa001';
const REVIEWER_ID = 'd1200000-0000-4000-8000-0000000fa002';
const CANONICAL_ID = 'd1200000-0000-4000-8000-0000000fa003';
const SENTINELS = [
  REASON,
  POLICY_HASH,
  ASSIGNMENT_ID,
  REVIEWER_ID,
  CANONICAL_ID,
];

const harness = (
  session: typeof reviewerSession,
  reply: () => Promise<Response>,
) => {
  const lines: string[] = [];
  const logger = createLogger(
    { environment: 'staging', release: 'slice-12', service: 'wejammin-api' },
    { sink: (line) => lines.push(line) },
  );
  return {
    lines,
    ...governedHarness({
      session,
      stepUpAt: FRESH_STEP_UP,
      reply,
      tuning: { logger },
    }),
  };
};

type Scenario = Readonly<{
  name: string;
  session: typeof reviewerSession;
  request: () => Request;
  reply: () => Promise<Response>;
  status: number;
  /** A sentinel the request carries: proof it reached the provider body, so its absence elsewhere means something. */
  travelled?: string;
}>;

const withPolicy = decidedReview('approved', { policyBasisHash: POLICY_HASH });
const scenarios: readonly Scenario[] = [
  {
    name: 'CMS-03C-07 decision with a reason',
    session: reviewerSession,
    request: () => decisionRequest(decisionBody({ reason: REASON })),
    reply: () => jsonReply(withPolicy),
    status: 200,
    travelled: REASON,
  },
  {
    name: 'CMS-03C-07 refusal carrying a canonical id in its provider details',
    session: reviewerSession,
    request: () => decisionRequest(decisionBody({ reason: REASON })),
    reply: () =>
      sqlRefusal(
        'CONFLICT',
        JSON.stringify({ canonicalId: CANONICAL_ID, reason: REASON }),
      ),
    status: 409,
  },
  {
    name: 'CMS-03C-08 assignment create naming a reviewer',
    session: ownerSession,
    request: () =>
      assignmentRequest(
        createBody({ reviewerPersonId: REVIEWER_ID, reason: REASON }),
      ),
    reply: () =>
      jsonReply(assignmentResource({ id: ASSIGNMENT_ID, reason: REASON }), 201),
    status: 201,
    travelled: REVIEWER_ID,
  },
  {
    name: 'CMS-03C-10 review detail with a policy basis and assignments',
    session: reviewerSession,
    request: () => detailRequest(),
    reply: () =>
      jsonReply(
        detailResource({
          policyBasisHash: POLICY_HASH,
          assignments: [
            {
              assignmentId: ASSIGNMENT_ID,
              version: '1',
              state: 'active',
              startsAt: '2026-10-14T00:00:00Z',
              endsAt: '2026-10-15T00:00:00Z',
              reviewerLabel: 'Reviewer A',
            },
          ],
          myAssignment: {
            assignmentId: ASSIGNMENT_ID,
            endsAt: '2026-10-15T00:00:00Z',
          },
        }),
      ),
    status: 200,
  },
  {
    name: 'CMS-03C-11 review queue',
    session: reviewerSession,
    request: () => queueRequest(),
    reply: () => jsonReply(queuePage()),
    status: 200,
  },
];

describe('governed surface privacy sweep (Worker)', () => {
  it.each(scenarios)(
    '[P2-S12-AC-272] $name: no-store response, and no sentinel in the ETag, an outbound URL or a log line',
    async (scenario) => {
      const h = harness(scenario.session, scenario.reply);
      const response = await h.send(scenario.request());
      expect(response.status).toBe(scenario.status);
      const cache = response.headers.get('cache-control') ?? '';
      expect(cache).toBe('no-store');
      expect(response.headers.get('etag') ?? '').not.toMatch(
        /sentinel|[a-f0-9]{32}/u,
      );
      expect(h.fetchImpl).toHaveBeenCalled();
      if (scenario.travelled !== undefined)
        expect(String(h.fetchImpl.mock.calls[0]?.[1]?.body)).toContain(
          scenario.travelled,
        );
      const urls = h.fetchImpl.mock.calls.map(([url]) => String(url));
      for (const url of urls)
        for (const sentinel of SENTINELS) expect(url).not.toContain(sentinel);
      const logged = h.lines.join('\n');
      expect(h.lines.length).toBeGreaterThan(0);
      for (const sentinel of SENTINELS) expect(logged).not.toContain(sentinel);
    },
  );

  it('[P2-S12-AC-272] every refusal of the governed surface is no-store too', async () => {
    for (const status of [401, 403, 404, 409, 422, 500, 503]) {
      const h = harness(reviewerSession, () =>
        status === 401 || status === 403 || status === 404
          ? sqlRefusal('NOT_FOUND', REASON)
          : jsonReply({ code: 'PGRST000', details: REASON }, status),
      );
      const response = await h.send(detailRequest());
      expect(response.headers.get('cache-control'), String(status)).toBe(
        'no-store',
      );
      expect(await response.text()).not.toContain(REASON);
      expect(h.lines.join('\n')).not.toContain(REASON);
    }
  });
});

describe('pattern diff values (CMS-03C-14, Worker)', () => {
  it('[P2-S12-AC-272] CMS-03C-14 serves a diff carrying a sentinel value no-store, with the instance version as the only validator and nothing of the diff in telemetry or the outbound request', async () => {
    const VALUE = 'sentinel-diff-value-5d2e';
    const readUpdateDiff = vi.fn(async () => ({
      ok: true,
      value: diffResource({
        paths: [
          {
            path: '/hero',
            base: diffNodeValue({ title: 'Old' }),
            theirs: diffNodeValue({ title: VALUE }),
            yours: null,
            collision: false,
            collisionKind: null,
          },
        ],
      }),
    }));
    const harness = createPatternUpdateHarness({
      readUpdateDiff: readUpdateDiff as never,
    });
    const response = await harness.request(puDiffPath());
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(VALUE);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBe('"3"');
    for (const [, value] of response.headers)
      expect(value).not.toContain(VALUE);
    expect(harness.telemetry).toHaveBeenCalled();
    expect(JSON.stringify(harness.telemetry.mock.calls)).not.toContain(VALUE);
    expect(JSON.stringify(readUpdateDiff.mock.calls[0])).not.toContain(VALUE);
  });
});
