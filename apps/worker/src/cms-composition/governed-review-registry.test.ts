import {
  GovernedActivationRequestSchema,
  GovernedDecisionRequestSchema,
  GovernedReviewAssignmentRequestSchema,
  GovernedReviewQueueQuerySchema,
  GovernedReviewSubmissionRequestSchema,
  platformRegistrySet,
  ScheduledInstantSchema,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  GOVERNED_POLICIES,
  type GovernedOperation,
} from './governed-review-policy';
import { OPERATIONS } from './governed-review-ops-table.test-support';
import {
  expectError,
  governedHarness,
} from './governed-review-ops.test-support';
import { submitRequest } from './governed-review-submit.test-support';

/**
 * The Worker policy table is pinned to the frozen registry rows for method, path, quota, deadline,
 * step-up, CSRF, idempotency and If-Match (below). Three fields have no registry column and are
 * pinned to their own source instead: `capabilities` (the registry lists the database-resolved
 * capabilities, the Worker gate is only the coarse any-of), `declared` (the generated OpenAPI
 * status sets) and `pointers` (the request-schema members).
 */
const DATABASE_RESOLVED_GATE: Readonly<
  Partial<Record<GovernedOperation, string>>
> = {
  // BE03c 170: `cms.definition_review.assign` is derived from the owner receipt, never a session capability.
  'CMS-03C-08': 'owner receipt',
  // BE03c 1467: the read scope (404 hidden, 403 no scope) is the database's.
  'CMS-03C-10': 'review read scope',
  'CMS-03C-11': 'review read scope',
};
/** Mirrors `tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts` (ALL, then the two reads). */
const OPENAPI_STATUSES: Readonly<Record<GovernedOperation, readonly number[]>> =
  {
    'CMS-03C-06': [400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, 504],
    'CMS-03C-07': [400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, 504],
    'CMS-03C-08': [400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, 504],
    'CMS-03C-09': [400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, 504],
    'CMS-03C-10': [400, 401, 403, 404, 415, 429, 500, 502, 503, 504],
    'CMS-03C-11': [400, 401, 409, 415, 422, 429, 500, 502, 503, 504],
  };
/** The request members a validation failure may name, from the contract schemas. */
const REQUEST_MEMBERS: Readonly<Record<GovernedOperation, readonly string[]>> =
  {
    'CMS-03C-06': Object.keys(GovernedReviewSubmissionRequestSchema.shape),
    'CMS-03C-07': Object.keys(GovernedDecisionRequestSchema.shape),
    'CMS-03C-08': [
      ...new Set(
        GovernedReviewAssignmentRequestSchema.unwrap().options.flatMap(
          (option) => Object.keys(option.unwrap().shape),
        ),
      ),
    ],
    // The review is addressed by path (no `reviewId` member); `activateAt` also names its five members.
    'CMS-03C-09': [
      ...new Set(
        GovernedActivationRequestSchema.options.flatMap((option) =>
          Object.keys(option.shape),
        ),
      ),
      ...Object.keys(ScheduledInstantSchema.shape).map(
        (member) => `activateAt/${member}`,
      ),
    ],
    // Addressed entirely by path: a malformed id is a bare 400, no member is named.
    'CMS-03C-10': [],
    'CMS-03C-11': Object.keys(GovernedReviewQueueQuerySchema.shape),
  };
describe.each(Object.entries(GOVERNED_POLICIES))(
  'policy of %s matches its registry row',
  (operationId, policy) => {
    const row = platformRegistrySet.routes.find(
      (candidate) => candidate.operationId === operationId,
    );

    it('is registered', () => {
      expect(row).toBeDefined();
    });

    it('agrees on method, path, quota, deadline and step-up', () => {
      expect(row).toMatchObject({
        method: policy.method,
        rateClass: policy.rateClass,
        rateLimit: policy.userLimit,
        partyRateLimit: policy.partyLimit,
        rateWindowSeconds: policy.windowSeconds,
        timeoutMs: policy.deadlineMs,
      });
      expect(row?.path.replace(/\{reviewId\}/u, ':reviewId')).toBe(
        policy.honoPath,
      );
      expect(row?.stepUp === 'required').toBe(policy.stepUp);
    });

    it('gates on the registry capabilities, or leaves the gate to the database where documented', () => {
      const reason = DATABASE_RESOLVED_GATE[operationId as GovernedOperation];
      if (reason === undefined) {
        expect(policy.capabilities.length).toBeGreaterThan(0);
        expect([...policy.capabilities]).toEqual(row?.capabilities);
      } else {
        // An intentional divergence: no Worker gate; the database decides 403 vs 404.
        expect(policy.capabilities).toEqual([]);
      }
    });

    it('documents exactly the statuses of the generated OpenAPI operation', () => {
      expect([...policy.declared].sort((a, b) => a - b)).toEqual(
        OPENAPI_STATUSES[operationId as GovernedOperation],
      );
    });

    it('lets a validation failure name only request-schema members', () => {
      expect([...policy.pointers].sort()).toEqual(
        REQUEST_MEMBERS[operationId as GovernedOperation]
          .map((member) => `/${member}`)
          .sort(),
      );
    });

    it('agrees on CSRF, idempotency and If-Match', () => {
      expect(row?.csrf === 'required').toBe(policy.method === 'POST');
      expect(row?.idempotency === 'required').toBe(policy.method === 'POST');
      expect(row?.ifMatch === 'required').toBe(policy.ifMatch);
    });
  },
);

describe('every governed route is mounted in the production runtime', () => {
  it.each(OPERATIONS)(
    '$id answers an anonymous caller 401, not 404',
    async (row) => {
      const harness = governedHarness({ integrated: true, anonymous: true });
      expect((await harness.send(row.request())).status).toBe(401);
    },
  );

  it('keeps CMS-03C-06 mounted', async () => {
    const harness = governedHarness({ integrated: true, anonymous: true });
    await expectError(
      await harness.send(submitRequest()),
      401,
      'UNAUTHENTICATED',
    );
  });

  it('mounts no route of its own for the activation sub-actions', async () => {
    const harness = governedHarness({ integrated: true, anonymous: true });
    for (const segment of ['retire', 'schedule', 'activate']) {
      const response = await harness.send(
        new Request(
          `https://api.example.test/api/v1/cms/governed-reviews/d1200000-0000-4000-8000-000000000195/${segment}`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          },
        ),
      );
      expect(response.status).toBe(404);
    }
  });
});
