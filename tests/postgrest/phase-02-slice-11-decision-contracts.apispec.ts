/**
 * CMS-03B-06 production command composition; parent owns execution.
 * Shared world's synthetic activation/session setup does not prove fixture authority.
 */
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  expectSafeEqual,
  expectSafeError,
  expectStatus,
  expectUnchanged,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import {
  type S11World,
  prepareS11World,
} from './support/phase-02-slice-11-world';
import {
  type S11Stack,
  createS11Stack,
} from './support/phase-02-slice-11-stack';
import { decisionFixture } from './support/phase-02-slice-11-decision-support';

let world: S11World;
let stack: S11Stack;
beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
});

describe('CMS-03B-06 exact decision contracts', () => {
  for (const proof of ['none', 'stale', 'future'] as const) {
    it(`[CMS-03B-06] ${proof} proof returns exact STEP_UP_REQUIRED recovery before any RPC or reservation`, async () => {
      const fixture = await decisionFixture(stack, world);
      stack.as(world.reviewer, proof);
      stack.clearRpcs();
      const before = snapshotDigest();
      const response = await stack.post(fixture.path, {
        body: fixture.body,
        ifMatch: fixture.review.version,
      });
      expectSafeError(response, {
        status: 401,
        code: 'STEP_UP_REQUIRED',
        details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
      });
      expect(stack.rpcs()).toEqual([]);
      expectUnchanged(
        before,
        snapshotDigest(),
        'step-up has no reservation or other effects',
      );
    });
  }

  for (const [label, reason] of [
    ['empty', ''],
    ['2001 code points', '🎵'.repeat(2001)],
    ['non-NFC', 'e\u0301'],
    ['markup', '<p>review</p>'],
    ['bidi', 'review\u202e'],
  ] as const) {
    it(`[CMS-03B-06] ${label} reason is 422 at reason before RPC with no effects`, async () => {
      const fixture = await decisionFixture(stack, world);
      stack.clearRpcs();
      const before = snapshotDigest();
      const response = await stack.post(fixture.path, {
        body: { ...fixture.body, reason },
        ifMatch: fixture.review.version,
      });
      expectSafeError(response, {
        status: 422,
        code: 'VALIDATION_FAILED',
        detailsKeys: ['violations'],
      });
      const violations = (
        response.body.details as { violations: { path: string }[] }
      ).violations;
      expect(
        violations.length > 0 &&
          violations.every((item) => item.path === '/reason'),
        'all violations identify only the reason',
      ).toBe(true);
      const codes =
        label === 'empty'
          ? ['invalid_value']
          : label === '2001 code points'
            ? ['invalid_value', 'reason_too_long']
            : label === 'non-NFC'
              ? ['reason_must_be_nfc']
              : label === 'markup'
                ? ['reason_unsafe_characters']
                : ['reason_control_or_bidi_characters'];
      expectSafeEqual(
        response.body.details,
        {
          violations: codes.map((code) => ({
            path: '/reason',
            code,
            message: 'The value is invalid.',
          })),
        },
        'exact reason failure semantics',
      );
      expect(stack.rpcs()).toEqual([]);
      expectUnchanged(
        before,
        snapshotDigest(),
        'invalid reason has no effects',
      );
    });
  }

  for (const mismatch of ['decision', 'reason', 'version', 'path'] as const) {
    it(`[CMS-03B-06] completed idempotency binds ${mismatch} and adds no second decision or other effects`, async () => {
      const first = await decisionFixture(stack, world);
      const second =
        mismatch === 'path' ? await decisionFixture(stack, world) : first;
      const key = `decision-binding-${randomUUID()}`;
      expectStatus(
        await stack.post(first.path, {
          body: first.body,
          ifMatch: first.review.version,
          idempotencyKey: key,
        }),
        200,
      );
      const body =
        mismatch === 'decision'
          ? { ...first.body, decision: 'reject' }
          : mismatch === 'reason'
            ? { ...first.body, reason: 'Changed decision reason.' }
            : mismatch === 'version'
              ? { ...first.body, expectedVersion: '9' }
              : second.body;
      const before = snapshotDigest();
      const response = await stack.post(second.path, {
        body,
        ifMatch: mismatch === 'version' ? '9' : second.review.version,
        idempotencyKey: key,
      });
      expectSafeError(response, {
        status: 409,
        code: 'CONFLICT',
        details: {
          conflict: 'IDEMPOTENCY_MISMATCH',
          recoveryAction: 'use_new_idempotency_key',
        },
      });
      expectUnchanged(
        before,
        snapshotDigest(),
        'changed replay writes nothing',
      );
    });
  }

  it('[CMS-03B-06] body expectedVersion and strong If-Match disagreement is exact 400 before RPC', async () => {
    const fixture = await decisionFixture(stack, world);
    stack.clearRpcs();
    const before = snapshotDigest();
    const response = await stack.post(fixture.path, {
      body: fixture.body,
      ifMatch: '9',
    });
    expectSafeError(response, {
      status: 400,
      code: 'INVALID_REQUEST',
      details: {
        violations: [
          {
            path: '/expectedVersion',
            code: 'mismatch',
            message: 'The value is invalid.',
          },
        ],
      },
    });
    expect(stack.rpcs()).toEqual([]);
    expectUnchanged(
      before,
      snapshotDigest(),
      'mismatched operands write nothing',
    );
  });

  it('[CMS-03B-06] matching stale operands reach the RPC and return exact authorized CAS versions without effects', async () => {
    const fixture = await decisionFixture(stack, world);
    stack.clearRpcs();
    const before = snapshotDigest();
    const response = await stack.post(fixture.path, {
      body: { ...fixture.body, expectedVersion: '9' },
      ifMatch: '9',
    });
    expectSafeError(response, {
      status: 409,
      code: 'CONFLICT',
      details: {
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'reload',
        expectedVersion: '9',
        currentVersion: fixture.review.version,
      },
    });
    expect(stack.rpcs().map((rpc) => rpc.rpc)).toEqual([
      'cms_record_review_decision',
    ]);
    expectUnchanged(
      before,
      snapshotDigest(),
      'CAS failure rolls back reservation',
    );
  });

  it('[CMS-03B-06] command transport outage is exact retryable 503 and preserves all durable rows', async () => {
    const fixture = await decisionFixture(stack, world);
    const before = snapshotDigest();
    stack.breakRpc('cms_record_review_decision');
    try {
      const response = await stack.post(fixture.path, {
        body: fixture.body,
        ifMatch: fixture.review.version,
      });
      expectSafeError(response, {
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        details: { dependencyClass: 'cms_editorial', retryable: true },
        retryAfter: true,
      });
      for (const header of [
        'ratelimit-limit',
        'ratelimit-remaining',
        'ratelimit-reset',
      ])
        expect(/^\d+$/u.test(response.headers.get(header) ?? ''), header).toBe(
          true,
        );
      expectUnchanged(
        before,
        snapshotDigest(),
        'decision outage writes nothing',
      );
    } finally {
      stack.breakRpc(null);
    }
  });
});
