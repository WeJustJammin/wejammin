/** Real command setup and safe persistence proofs for CMS-03B-06. */
import { createHash } from 'node:crypto';
import { expect } from 'vitest';
import {
  EditorialReviewAssignmentResourceSchema,
  EditorialReviewDetailResourceSchema,
  EditorialReviewResourceSchema,
} from '@wejammin/contracts';
import { expectSafeEqual, expectStatus } from './phase-02-slice-11-assert';
import { assignReviewer, submitForReview } from './phase-02-slice-11-flow';
import type {
  S11Stack,
  S11Actor,
  S11Response,
} from './phase-02-slice-11-stack';
import { type S11World, seedDraft } from './phase-02-slice-11-world';
import { psql } from './stack';

export const DECISION_EFFECTS = {
  'platform_private.cms_editorial_reviews': 0,
  'platform_private.cms_editorial_decisions': 1,
  'platform_private.idempotency_records': 1,
  'platform_private.outbox_events': 1,
  'audit_private.audit_events': 1,
} as const;

export const decisionFixture = async (stack: S11Stack, world: S11World) => {
  const draft = await seedDraft(stack, world, 'Decision contract');
  const review = await submitForReview(stack, world, draft);
  const assigned = await assignReviewer(
    stack,
    world,
    review.id,
    review.version,
  );
  const assignment = EditorialReviewAssignmentResourceSchema.parse(
    assigned.body,
  );
  stack.as(world.reviewer, 'fresh');
  return {
    draft,
    review,
    assignment,
    path: `/api/v1/cms/reviews/${review.id}/decision`,
    body: {
      reviewId: review.id,
      decision: 'approve' as 'approve' | 'reject',
      reason: 'Reviewed against the frozen policy.',
      expectedVersion: review.version,
    },
  };
};

export const expectDecisionRow = (
  fixture: Awaited<ReturnType<typeof decisionFixture>>,
  actor: S11Actor,
  decision: 'approve' | 'reject',
  reason: string,
): void => {
  const commentHash = createHash('sha256').update(reason, 'utf8').digest('hex');
  const valid = psql(`select count(*) = 1 and bool_and(
    d.state = 'recorded' and d.version = 1 and d.reviewer_person_id = '${actor.personId}'
    and d.acting_party_id = '${actor.organizationId}' and d.owner_id = r.owner_id
    and d.assignment_id = '${fixture.assignment.id}' and d.assignment_version = ${fixture.assignment.version}
    and d.decision = '${decision}' and d.capability = 'cms.reviewer'
    and d.reviewed_hash = r.frozen_hash and d.comment_hash = '${commentHash}'
    and d.comment_hash = encode(sha256(convert_to(d.reason, 'UTF8')), 'hex')
    and char_length(d.reason) = ${Array.from(reason).length}
    and d.created_at = d.updated_at and d.created_at = d.decided_at
    and d.step_up_at <= d.decided_at + interval '30 seconds'
    and d.step_up_at >= d.decided_at - interval '600 seconds'
    and a.starts_at <= d.decided_at and d.decided_at < a.ends_at)
    from platform_private.cms_editorial_decisions d
    join platform_private.cms_editorial_reviews r on r.id = d.review_id
    join platform_private.cms_editorial_review_assignments a on a.id = d.assignment_id
    where d.review_id = '${fixture.review.id}'`);
  expect(
    valid,
    'one append-only decision bound to real assignment, reason hash and fresh proof',
  ).toBe('t');
  expect(
    psql(`begin; select set_config('app.cms_rpc', 'true', true) \\gset
    create function pg_temp.decision_immutable_probe(p_delete boolean) returns boolean
    language plpgsql as $probe$
    begin
      if p_delete then
        delete from platform_private.cms_editorial_decisions where review_id = '${fixture.review.id}';
      else
        update platform_private.cms_editorial_decisions set reason = 'Replacement reason'
          where review_id = '${fixture.review.id}';
      end if;
      return false;
    exception when others then
      return sqlstate = 'P0001' and sqlerrm = 'IMMUTABLE_RECORD';
    end; $probe$;
    select pg_temp.decision_immutable_probe(false) and pg_temp.decision_immutable_probe(true);
    rollback;`),
    'both UPDATE and DELETE are rejected by the live append-only guard',
  ).toBe('t');
};

export const expectDecisionResource = (
  response: S11Response,
  original: Awaited<ReturnType<typeof decisionFixture>>['review'],
  decision: 'approve' | 'reject',
) => {
  expectStatus(response, 200);
  const review = EditorialReviewResourceSchema.parse(response.body);
  expectSafeEqual(
    {
      ...review,
      version: original.version,
      updatedAt: original.updatedAt,
      state: original.state,
      recordedDecisionCount: original.recordedDecisionCount,
      decidedAt: original.decidedAt,
    },
    original,
    'decision changes only state, CAS, count and decision timestamps',
  );
  expect(review.version).toBe(String(Number(original.version) + 1));
  expect(review.recordedDecisionCount).toBe(1);
  expect(review.requiredDecisionCount).toBe(1);
  expect(review.state).toBe(decision === 'approve' ? 'approved' : 'rejected');
  expect(review.decidedAt !== null).toBe(true);
  expect(response.headers.get('etag')).toBe(`"${review.version}"`);
  expect(response.headers.get('location')).toBeNull();
  expect(response.headers.get('cache-control')).toBe('no-store');
  return review;
};

export const expectReasonPrivacy = async (
  stack: S11Stack,
  world: S11World,
  fixture: Awaited<ReturnType<typeof decisionFixture>>,
  decision: 'approve' | 'reject',
  reason: string,
): Promise<void> => {
  for (const actor of [world.reviewer, world.owner, world.publisher]) {
    stack.as(actor);
    const response = await stack.get(
      `/api/v1/cms/reviews/${fixture.review.id}`,
    );
    expectStatus(response, 200);
    const detail = EditorialReviewDetailResourceSchema.parse(response.body);
    expect(detail.decisions).toHaveLength(1);
    const mine = actor === world.reviewer;
    expectSafeEqual(
      detail.decisions.map((row) => ({
        decision: row.decision,
        capability: row.capability,
        mine: row.mine,
        reason: row.reason,
      })),
      [
        {
          decision,
          capability: 'cms.reviewer',
          mine,
          reason: mine ? reason : null,
        },
      ],
      'nonempty decision list with exact own-only reason',
    );
    expect(detail.distinctApprovalCount).toBe(decision === 'approve' ? 1 : 0);
    expect(detail.recordedDecisionCount).toBe(1);
    for (const id of [
      world.reviewer.personId,
      world.owner.personId,
      world.organizationId,
    ])
      expect(
        response.text.includes(id),
        'person and ownership identity absent',
      ).toBe(false);
  }
};
