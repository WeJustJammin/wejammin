/**
 * The committed world of the Slice 12 real-stack latency suites and the request builders of the governed chain.
 *
 * The world is the run-wide shared bootstrap owner (the owner RECEIPT is what CMS-03C-08 derives the assignment authority
 * from, so an isolated owner cannot assign) with the template-designer and taxonomy-curator grants, one active content type
 * (the Slice 10 editorial world) and reviewers that are confirmed members holding `cms.reviewer`. Every governed row after
 * that is written by the production routes: a template or taxonomy version by CMS-03C-01 / CMS-03C-16, the review by
 * CMS-03C-06, assignments by CMS-03C-08, approvals by CMS-03C-07, activation by CMS-03C-09. Commits fixtures; run right after
 * `pnpm db:reset`, and reset again afterwards.
 */
import { randomUUID } from 'node:crypto';

import { expect } from 'vitest';

import {
  type EditorialWorld,
  prepareEditorialWorld,
} from './cms-editorial-world';
import { addMember } from './phase-02-slice-11-world';
import type {
  LatencyActor,
  LatencyResponse,
  LatencyStack,
} from './phase-02-slice-12-latency-stack';
import { psql } from './stack';

export const REGIONS = ['header', 'now', 'record', 'detail', 'provenance'];

export type LatencyWorld = Readonly<{
  editorial: EditorialWorld;
  organizationId: string;
  /** The receipt-derived owner: template designer, taxonomy curator, author and editor. */
  owner: LatencyActor;
  /** A confirmed member holding exactly `cms.reviewer`. */
  reviewer: LatencyActor;
  tzdbVersion: string;
}>;

export const OWNER_CAPABILITIES = [
  'cms.template_designer',
  'cms.taxonomy_curator',
  'cms.author',
  'cms.editor',
  'cms.schema_designer',
] as const;

export const prepareLatencyWorld = async (): Promise<LatencyWorld> => {
  const editorial = await prepareEditorialWorld();
  const bootstrap = editorial.owner;
  psql(`
    insert into identity_private.organization_actor_grant(
      organization_id, person_id, capability_code, valid_from, valid_through, active)
    select '${bootstrap.organizationId}', '${bootstrap.personId}', capability,
           current_date, current_date + 30, true
      from (values ('cms.template_designer'), ('cms.taxonomy_curator')) as capabilities(capability)
    on conflict (organization_id, person_id, capability_code)
    do update set active = true, valid_through = excluded.valid_through`);
  return {
    editorial,
    organizationId: bootstrap.organizationId,
    owner: {
      authUserId: bootstrap.authUserId,
      personId: bootstrap.personId,
      organizationId: bootstrap.organizationId,
      capabilities: OWNER_CAPABILITIES,
    },
    reviewer: addMember(bootstrap.organizationId, bootstrap.personId, [
      'cms.reviewer',
    ]),
    tzdbVersion: psql(`select platform_private.cms_tzdb_version()`),
  };
};

/** `count` more confirmed members holding `cms.reviewer` (the 16 active assignments of the detail bound). */
export const addReviewers = (
  world: LatencyWorld,
  count: number,
): readonly LatencyActor[] =>
  Array.from({ length: count }, () =>
    addMember(world.organizationId, world.owner.personId, ['cms.reviewer']),
  );

export const expectCreated = (answer: LatencyResponse, what: string): void => {
  expect(answer.status, `${what}: ${answer.text.slice(0, 300)}`).toBe(201);
};
export const expectOk = (
  answer: LatencyResponse,
  what: string,
  status = 200,
): void => {
  expect(answer.status, `${what}: ${answer.text.slice(0, 300)}`).toBe(status);
};

const key = (label: string): string =>
  `s12lat-${label}-${randomUUID().slice(0, 12)}`;

/** CMS-03C-01 with `slots` (the 64-slot bound when asked). */
export const templateBody = (
  world: LatencyWorld,
  templateKey: string,
  slotCount = 0,
): Record<string, unknown> => ({
  templateKey,
  compatibleTypeIds: [world.editorial.contentTypeId],
  slots: Array.from({ length: slotCount }, (_, index) => ({
    key: `slot${String(index + 1).padStart(2, '0')}`,
    required: false,
    allowedBlocks: [],
    maxCount: 8,
  })),
  reservedRegions: REGIONS,
  bindings: {},
  locale: 'en-US',
  audience: 'public',
  expectedVersion: null,
});

export type DefinedVersion = Readonly<{
  id: string;
  contentHash: string;
  version: string;
}>;

/** Defines one draft template through CMS-03C-01 as the owner. */
export const defineTemplate = async (
  stack: LatencyStack,
  world: LatencyWorld,
  templateKey: string,
  slotCount = 0,
): Promise<DefinedVersion> => {
  stack.as(world.owner);
  const answer = await stack.post('/api/v1/cms/templates/versions', {
    body: templateBody(world, templateKey, slotCount),
  });
  expectCreated(answer, `define ${templateKey}`);
  return {
    id: String(answer.body.id),
    contentHash: String(answer.body.contentHash),
    version: String(answer.body.version),
  };
};

export type SubmittedReview = Readonly<{ id: string; version: string }>;

export const submitBody = (
  subjectKind: 'template_version' | 'pattern_version' | 'taxonomy_version',
  subject: DefinedVersion,
): Record<string, unknown> => ({
  subjectKind,
  subjectId: subject.id,
  subjectHash: subject.contentHash,
});

/** CMS-03C-06. The call is the caller's to time; this builds nothing but the request. */
export const submitReview = (
  stack: LatencyStack,
  world: LatencyWorld,
  subjectKind: 'template_version' | 'pattern_version' | 'taxonomy_version',
  subject: DefinedVersion,
) => {
  stack.as(world.owner);
  return stack.post('/api/v1/cms/governed-reviews', {
    body: submitBody(subjectKind, subject),
    idempotencyKey: key('submit'),
  });
};

export const assignRequest = (
  review: SubmittedReview,
  reviewer: LatencyActor,
): Record<string, unknown> => ({
  action: 'create',
  reviewerPersonId: reviewer.personId,
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  expectedVersion: review.version,
});

/** CMS-03C-08 create (step-up fresh, the receipt-derived owner). */
export const assignReviewer = (
  stack: LatencyStack,
  world: LatencyWorld,
  review: SubmittedReview,
  reviewer: LatencyActor,
) => {
  stack.as(world.owner, 'fresh');
  return stack.post(`/api/v1/cms/governed-reviews/${review.id}/assignments`, {
    body: assignRequest(review, reviewer),
    ifMatch: review.version,
    idempotencyKey: key('assign'),
  });
};

/** CMS-03C-08 revoke of one assignment. */
export const revokeAssignment = (
  stack: LatencyStack,
  world: LatencyWorld,
  review: SubmittedReview,
  assignmentId: string,
) => {
  stack.as(world.owner, 'fresh');
  return stack.post(`/api/v1/cms/governed-reviews/${review.id}/assignments`, {
    body: {
      action: 'revoke',
      assignmentId,
      expectedVersion: review.version,
    },
    ifMatch: review.version,
    idempotencyKey: key('revoke'),
  });
};

/** CMS-03C-07 approve (step-up fresh, the assigned reviewer). */
export const approveReview = (
  stack: LatencyStack,
  reviewer: LatencyActor,
  review: SubmittedReview,
) => {
  stack.as(reviewer, 'fresh');
  return stack.post(`/api/v1/cms/governed-reviews/${review.id}/decision`, {
    body: {
      reviewId: review.id,
      decision: 'approve',
      reason: 'Reviewed against the frozen policy basis.',
      expectedVersion: review.version,
    },
    ifMatch: review.version,
    idempotencyKey: key('decide'),
  });
};

export const scheduleBody = (
  world: LatencyWorld,
  review: SubmittedReview,
  leadMs = 90_000,
): Record<string, unknown> => {
  const local = new Date(Date.now() + leadMs).toISOString().slice(0, 19);
  return {
    action: 'schedule',
    expectedVersion: review.version,
    activateAt: {
      localDateTime: local,
      timezone: 'UTC',
      resolvedUtc: `${local}Z`,
      tzdbVersion: world.tzdbVersion,
      disambiguation: 'none',
    },
  };
};

/** CMS-03C-09 (step-up fresh, the subject owner). */
export const actOnReview = (
  stack: LatencyStack,
  world: LatencyWorld,
  review: SubmittedReview,
  body: Record<string, unknown>,
) => {
  stack.as(world.owner, 'fresh');
  return stack.post(`/api/v1/cms/governed-reviews/${review.id}/activation`, {
    body,
    ifMatch: review.version,
    idempotencyKey: key('act'),
  });
};

/** The review as the next command needs it: its id and current version string. */
export const reviewOf = (answer: LatencyResponse): SubmittedReview => ({
  id: String(answer.body.reviewId ?? answer.body.id),
  version: String(answer.body.reviewVersion ?? answer.body.version),
});

/**
 * One subject taken through submit, assignment and approval, untimed (the fixture of a read or of a later measured step).
 * Returns the approved review.
 */
export const approvedReview = async (
  stack: LatencyStack,
  world: LatencyWorld,
  subjectKind: 'template_version' | 'pattern_version' | 'taxonomy_version',
  subject: DefinedVersion,
): Promise<SubmittedReview> => {
  const submitted = await submitReview(stack, world, subjectKind, subject);
  expectCreated(submitted, 'submit');
  let review = reviewOf(submitted);
  const assigned = await assignReviewer(stack, world, review, world.reviewer);
  expect([200, 201], assigned.text.slice(0, 300)).toContain(assigned.status);
  const decided = await approveReview(stack, world.reviewer, review);
  expectOk(decided, 'approve');
  review = reviewOf(decided);
  return review;
};
