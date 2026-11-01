/**
 * Slice 11 real composition, CMS-03B-05 submission refusals (lane S11-4R read
 * families; split from the inherited combined refusal suite). The typed refusal
 * families of the submit command through the production Worker routes, adapters,
 * Kong, PostgREST and SQL: a stale entry version, a not-submittable revision, a
 * drifted manifest, the revocation preflight, an unavailable accessibility proof
 * and the capability split. Every assertion is on what the database decided.
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  expectEvidenceNull,
  expectSafeError,
  expectStatus,
  expectUnchanged,
  snapshotDigest,
  expectSafeEqual,
} from './support/phase-02-slice-11-assert';
import {
  s11Submit,
  s11SubmitBody,
} from './support/phase-02-slice-11-read-fixtures';
import {
  type S11Stack,
  createS11Stack,
} from './support/phase-02-slice-11-stack';
import {
  type S11World,
  prepareS11World,
  seedDraft,
  workflowEffects,
} from './support/phase-02-slice-11-world';
import { psql } from './support/stack';
import { assignReviewer, decide } from './support/phase-02-slice-11-flow';
import {
  SUBMIT_CATEGORIES,
  submitFixture,
} from './support/phase-02-slice-11-submit-support';
import { EditorialReviewResourceSchema } from '@wejammin/contracts';

let world: S11World;
let stack: S11Stack;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
});

const submitBody = (entryId: string, revisionId: string) =>
  s11SubmitBody(stack, world, entryId, revisionId);
const submit = (
  entryId: string,
  body: unknown,
  ifMatch: string,
  idempotencyKey?: string,
) => s11Submit(stack, entryId, body, ifMatch, idempotencyKey);

describe('CMS-03B-05 refusals through the real stack', () => {
  for (const decision of ['approve', 'reject'] as const) {
    it(`[CMS-03B-05] ${decision === 'approve' ? 'approved' : 'rejected'} revision cannot be submitted again and adds no effects`, async () => {
      const fixture = await submitFixture(stack, world);
      const submitted = await stack.post(fixture.path, {
        body: fixture.body,
        ifMatch: fixture.draft.entryVersion,
      });
      expectStatus(submitted, 201);
      const review = EditorialReviewResourceSchema.parse(submitted.body);
      await assignReviewer(stack, world, review.id, review.version);
      await decide(stack, world, review.id, review.version, decision);
      stack.as(world.owner);
      const before = snapshotDigest();
      const response = await stack.post(fixture.path, {
        body: fixture.body,
        ifMatch: fixture.draft.entryVersion,
      });
      expectSafeError(response, {
        status: 409,
        code: 'CONFLICT',
        details: { reasonCode: 'revision_not_submittable' },
      });
      expectUnchanged(
        before,
        snapshotDigest(),
        'terminal reviewed revision cannot make a second review',
      );
    });
  }

  it('[CMS-03B-05] a stale entry version is 409 VERSION_MISMATCH carrying only the expected and current versions', async () => {
    const draft = await seedDraft(stack, world, 'Submit version');
    const body = await submitBody(draft.entryId, draft.revisionId);
    const response = await submit(draft.entryId, body, '9');
    expectSafeError(response, {
      status: 409,
      code: 'CONFLICT',
      details: {
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'reload',
        expectedVersion: '9',
        currentVersion: draft.entryVersion,
      },
    });
    expect(workflowEffects(draft.entryId).reviews).toBe(0);
  });

  it('[CMS-03B-05] a second submission of an under-review revision is 409 revision_not_submittable', async () => {
    const draft = await seedDraft(stack, world, 'Submit twice');
    const body = await submitBody(draft.entryId, draft.revisionId);
    expect((await submit(draft.entryId, body, draft.entryVersion)).status).toBe(
      201,
    );
    const again = await submit(draft.entryId, body, draft.entryVersion);
    expectSafeError(again, {
      status: 409,
      code: 'CONFLICT',
      details: { reasonCode: 'revision_not_submittable' },
    });
    expect(workflowEffects(draft.entryId).reviews).toBe(1);
  });

  it('[CMS-03B-05] a tampered manifest is 409 dependency_changed with the current dependency hash and a wrong frozenHash is 422 at /frozenHash', async () => {
    const draft = await seedDraft(stack, world, 'Submit drift');
    const body = await submitBody(draft.entryId, draft.revisionId);
    const manifest = body.dependencyManifest as {
      checker: { version: unknown };
    };
    const tampered = {
      ...body,
      dependencyManifest: {
        ...manifest,
        checker: { ...manifest.checker, version: '2' },
      },
    };
    const drift = await submit(draft.entryId, tampered, draft.entryVersion);
    expectSafeError(drift, {
      status: 409,
      code: 'CONFLICT',
      detailsKeys: ['reasonCode', 'dependencyHash'],
    });
    expect(drift.body.details).toMatchObject({
      reasonCode: 'dependency_changed',
      dependencyHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });

    const hash = await submit(
      draft.entryId,
      { ...body, frozenHash: 'f'.repeat(64) },
      draft.entryVersion,
    );
    expectStatus(hash, 422);
    expect(hash.body.details).toMatchObject({
      violations: [{ path: '/frozenHash' }],
    });
    expect(workflowEffects(draft.entryId).reviews).toBe(0);
  });

  it('[CMS-03B-05] an archived entry fails the revocation preflight category: preflight_failed with the 17-entry report and no review', async () => {
    const draft = await seedDraft(stack, world, 'Submit archived');
    const body = await submitBody(draft.entryId, draft.revisionId);
    psql(`begin;
      select set_config('app.cms_rpc', 'true', true);
      update platform_private.cms_content_entries set lifecycle = 'archived' where id = '${draft.entryId}';
      commit;`);
    const before = snapshotDigest();
    const response = await submit(draft.entryId, body, draft.entryVersion);
    // BE03b:1807: preflight_failed is authoritative 422, never 409.
    expectSafeError(response, {
      status: 422,
      code: 'VALIDATION_FAILED',
      detailsKeys: ['preflight', 'reasonCode'],
    });
    expect(response.body.details).toMatchObject({
      reasonCode: 'preflight_failed',
      preflight: expect.arrayContaining([
        expect.objectContaining({ category: 'revocation', outcome: 'failed' }),
      ]),
    });
    expect(
      (response.body.details as { preflight: unknown[] }).preflight,
    ).toHaveLength(17);
    expect(workflowEffects(draft.entryId).reviews).toBe(0);
    expectSafeEqual(
      (response.body.details as { preflight: unknown }).preflight,
      SUBMIT_CATEGORIES.map((category) => ({
        category,
        outcome:
          category === 'revocation'
            ? 'failed'
            : category === 'accessibility'
              ? 'unavailable'
              : 'passed',
        reasonCode:
          category === 'revocation'
            ? 'entry_unavailable'
            : category === 'accessibility'
              ? 'checker_failed'
              : null,
      })),
      'archived entry evaluates all seventeen ordered categories',
    );
    expectUnchanged(
      before,
      snapshotDigest(),
      'preflight rejection rolls back all fourteen groups',
    );
  });

  it('[CMS-03B-05] an unavailable accessibility proof is 503 DEPENDENCY_UNAVAILABLE with Retry-After and no review', async () => {
    const draft = await seedDraft(stack, world, 'Submit proof');
    const body = await submitBody(draft.entryId, draft.revisionId);
    stack.as(world.owner);
    stack.breakRpc('cms_load_quality_gate_input');
    stack.clearRpcs();
    const beforeSnapshot = snapshotDigest();
    try {
      const response = await submit(draft.entryId, body, draft.entryVersion);
      expectSafeError(response, {
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        details: { dependencyClass: 'preflight', retryable: true },
        retryAfter: true,
      });
      // Full 14-group effect snapshot is unchanged (no review committed).
      expectUnchanged(
        beforeSnapshot,
        snapshotDigest(),
        'the CMS-03B-05 outage commits no durable effect',
      );
      // The genuine command RPC was issued with its OWN evidence member exactly
      // null (the checker proof is unavailable, not absent): deleting the member
      // would still answer 503 because SQL reads a missing member as null, so the
      // wire assertion must pin the exact null member itself.
      const wire = stack.rpcs().find((rpc) => rpc.rpc === 'cms_submit_review');
      expect(wire).toBeDefined();
      expectEvidenceNull(wire?.request ?? {});
    } finally {
      stack.breakRpc(null);
    }
  });

  it('[CMS-03B-05] a session without an author capability is 403 at the Worker; one claiming it without the database grant is capability_missing from the database', async () => {
    const draft = await seedDraft(stack, world, 'Submit capability');
    const body = await submitBody(draft.entryId, draft.revisionId);
    stack.as(world.reviewer);
    stack.clearRpcs();
    expect((await submit(draft.entryId, body, draft.entryVersion)).status).toBe(
      403,
    );
    expect(stack.rpcs().map((rpc) => rpc.rpc)).not.toContain(
      'cms_submit_review',
    );

    stack.as({ ...world.reviewer, capabilities: ['cms.author'] });
    const claimed = await submit(draft.entryId, body, draft.entryVersion);
    expectSafeError(claimed, {
      status: 403,
      code: 'FORBIDDEN',
      details: { reasonCode: 'capability_missing' },
    });
    expect(workflowEffects(draft.entryId).reviews).toBe(0);
  });
});
