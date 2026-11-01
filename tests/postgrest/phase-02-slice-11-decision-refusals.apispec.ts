/**
 * Slice 11 real composition, CMS-03B-06 decision refusals (lane S11-4R read
 * families; split from the inherited combined refusal suite). The typed refusal
 * families of the decision command through the production Worker routes,
 * adapters, Kong, PostgREST and SQL: unconditional step-up before any RPC or
 * reservation, the Worker gate, the effective-assignment gate versus concealment,
 * a stale review version, a closed review and the COMMITTED `dependency_changed`
 * refusal of a drifted frozen manifest (HTTP 200 `kind: refusal` on the wire, 409
 * for the browser, the invalidation kept, no decision recorded).
 *
 * The drift test belongs with 06: its asserted trigger is the review's own frozen
 * manifest no longer matching the rebuilt one, not an assignment revocation.
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards.
 */
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  assignReviewer,
  submitForReview,
} from './support/phase-02-slice-11-flow';
import {
  expectSafeError,
  expectStatus,
  expectSafeEqual,
  expectUnchanged,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import { s11DriftFrozenManifest } from './support/phase-02-slice-11-read-fixtures';
import {
  type S11Stack,
  createS11Stack,
} from './support/phase-02-slice-11-stack';
import {
  type S11World,
  prepareS11World,
  reservationCount,
  seedDraft,
  workflowEffects,
} from './support/phase-02-slice-11-world';
import { psql } from './support/stack';
import { decisionFixture } from './support/phase-02-slice-11-decision-support';

let world: S11World;
let stack: S11Stack;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
});

describe('CMS-03B-06 refusals through the real stack', () => {
  for (const fault of [
    'json',
    'media',
    'anonymous',
    'missing-key',
    'path-body',
    'caller-capability',
  ] as const) {
    it(`[CMS-03B-06] ${fault} admission refuses before RPC and leaves all durable groups unchanged`, async () => {
      const fixture = await decisionFixture(stack, world);
      if (fault === 'anonymous') stack.as(null);
      stack.clearRpcs();
      const before = snapshotDigest();
      const response = await stack.post(fixture.path, {
        body:
          fault === 'json'
            ? '{'
            : fault === 'path-body'
              ? { ...fixture.body, reviewId: randomUUID() }
              : fault === 'caller-capability'
                ? { ...fixture.body, capability: 'cms.reviewer.policy' }
                : fixture.body,
        ifMatch: fixture.review.version,
        ...(fault === 'missing-key' ? { idempotencyKey: null } : {}),
        headers: fault === 'media' ? { 'content-type': 'text/plain' } : {},
      });
      const status =
        fault === 'media'
          ? 415
          : fault === 'anonymous'
            ? 401
            : fault === 'path-body' || fault === 'caller-capability'
              ? 422
              : 400;
      const code =
        status === 415
          ? 'UNSUPPORTED_MEDIA_TYPE'
          : status === 401
            ? 'UNAUTHENTICATED'
            : status === 422
              ? 'VALIDATION_FAILED'
              : 'INVALID_REQUEST';
      const details =
        fault === 'media'
          ? { allowedMediaTypes: ['application/json'] }
          : fault === 'anonymous'
            ? { recoveryAction: 'reauthenticate' }
            : fault === 'json'
              ? {}
              : undefined;
      expectSafeError(response, {
        status,
        code,
        ...(details === undefined
          ? { detailsKeys: ['violations'] }
          : { details }),
      });
      if (details === undefined)
        expectSafeEqual(
          response.body.details,
          {
            violations: [
              {
                path:
                  fault === 'path-body'
                    ? '/reviewId'
                    : fault === 'caller-capability'
                      ? '/capability'
                      : '/idempotencyKey',
                code:
                  fault === 'path-body'
                    ? 'mismatch'
                    : fault === 'caller-capability'
                      ? 'unknown_field'
                      : 'invalid_value',
                message: 'The value is invalid.',
              },
            ],
          },
          'exact decision admission violation semantics',
        );
      expect(stack.rpcs()).toEqual([]);
      expectUnchanged(
        before,
        snapshotDigest(),
        'decision admission has no effects',
      );
    });
  }

  it('[CMS-03B-06] step-up, the Worker gate, the assignment gate, a stale version and a decided review', async () => {
    const draft = await seedDraft(stack, world, 'Decision refusals');
    const review = await submitForReview(stack, world, draft);
    const version = String(review.version);
    await assignReviewer(stack, world, review.id, version);
    const path = `/api/v1/cms/reviews/${review.id}/decision`;
    const body = (over: Record<string, unknown> = {}) => ({
      reviewId: review.id,
      decision: 'approve',
      reason: 'Looks right.',
      expectedVersion: version,
      ...over,
    });

    for (const proof of ['none', 'stale', 'future'] as const) {
      stack.as(world.reviewer, proof);
      stack.clearRpcs();
      const before = reservationCount();
      const refused = await stack.post(path, {
        body: body(),
        ifMatch: version,
      });
      expectStatus(refused, 401, proof);
      expect(refused.body.code).toBe('STEP_UP_REQUIRED');
      expect(stack.rpcs()).toEqual([]);
      expect(reservationCount()).toBe(before);
    }

    stack.as(world.owner, 'fresh');
    stack.clearRpcs();
    expect(
      (await stack.post(path, { body: body(), ifMatch: version })).status,
    ).toBe(403);
    expect(stack.rpcs()).toEqual([]);

    // A confirmed member who can READ the review but holds no assignment on it: world.dual
    // holds cms.publisher (a read scope) so the review is visible; without an effective
    // assignment the refusal is 403 capability_missing, never a concealment 404.
    stack.as(world.dual, 'fresh');
    const unassigned = await stack.post(path, {
      body: body(),
      ifMatch: version,
    });
    expectSafeError(unassigned, {
      status: 403,
      code: 'FORBIDDEN',
      details: { reasonCode: 'capability_missing' },
    });

    // A confirmed member with NO read scope on this review (world.reviewer2 is neither
    // assignee, submitter, publisher nor owner) is concealed: the same request is 404,
    // indistinguishable from an absent review.
    stack.as(world.reviewer2, 'fresh');
    const hiddenUnassigned = await stack.post(path, {
      body: body(),
      ifMatch: version,
    });
    expectSafeError(hiddenUnassigned, {
      status: 404,
      code: 'NOT_FOUND',
      details: {},
    });

    stack.as(world.reviewer, 'fresh');
    const stale = await stack.post(path, {
      body: body({ expectedVersion: '8' }),
      ifMatch: '8',
    });
    expectStatus(stale, 409);
    expect(stale.body.details).toMatchObject({
      expectedVersion: '8',
      currentVersion: version,
    });

    const decided = await stack.post(path, { body: body(), ifMatch: version });
    expectStatus(decided, 200);
    const closed = await stack.post(path, {
      body: body({ expectedVersion: String(Number(version) + 1) }),
      ifMatch: String(Number(version) + 1),
    });
    expectStatus(closed, 409);
    expect(closed.body.details).toMatchObject({
      reasonCode: 'review_not_open',
    });
    expect(workflowEffects(draft.entryId).decisions).toBe(1);
  });

  it('[CMS-03B-06] a stale frozen manifest is the COMMITTED refusal: 200 kind refusal on the wire, 409 dependency_changed for the browser, the review stays invalidated and no decision is recorded', async () => {
    const draft = await seedDraft(stack, world, 'Decision drift');
    const review = await submitForReview(stack, world, draft);
    const version = String(review.version);
    await assignReviewer(stack, world, review.id, version);
    s11DriftFrozenManifest(review.id);
    stack.as(world.reviewer, 'fresh');
    stack.clearRpcs();
    const response = await stack.post(
      `/api/v1/cms/reviews/${review.id}/decision`,
      {
        body: {
          reviewId: review.id,
          decision: 'approve',
          reason: 'Looks right.',
          expectedVersion: version,
        },
        ifMatch: version,
      },
    );
    expectStatus(response, 409);
    expect(response.body.details).toMatchObject({
      reasonCode: 'dependency_changed',
      dependencyHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });
    const wire = stack
      .rpcs()
      .find((rpc) => rpc.rpc === 'cms_record_review_decision');
    expect(wire?.status).toBe(200);
    expect(wire?.response).toMatchObject({
      kind: 'refusal',
      reasonCode: 'dependency_changed',
    });
    expect(
      psql(
        `select state from platform_private.cms_editorial_reviews where id = '${review.id}'`,
      ),
    ).toBe('invalidated');
    expect(workflowEffects(draft.entryId).decisions).toBe(0);
  });
});
