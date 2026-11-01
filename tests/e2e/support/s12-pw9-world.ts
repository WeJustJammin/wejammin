/**
 * Preconditions and database readers of the Slice 12 wave-9 journeys (a dependency invalidation, a linked pattern update,
 * the protected decision, a pattern created in the browser): patterns saved through CMS-03C-12 over the registered latency
 * block, a successor of a saved pattern, a version taken to `approved` (not further) through the first-party routes, and
 * the three readers the journeys assert on. Not type-checked by `pnpm type-check`.
 *
 * The two job stand-ins (`runGovernedRecheck`, `runLinkedScan`) are in `s12-pw9-jobs.ts`.
 */
import { randomUUID } from 'node:crypto';

import {
  LATENCY_BLOCK_KEY,
  LATENCY_BLOCK_VERSION,
  registerLatencyBlock,
} from '../../postgrest/support/phase-02-slice-12-latency-blocks';
import { psql } from '../../postgrest/support/stack';
import { expect } from '@playwright/test';

import type { S10Client } from './s10-real-api';
import type { SignedIn } from './s10-real-browser';
import type { S10World } from './s10-real-world';
import { completeStepUp } from './s11-real-browser';
import {
  approveGovernedViaApi,
  assignGovernedViaApi,
  type OpenReview,
} from './s12-governed-world';
import { PATTERN_VERSIONS_API } from './s12-pw5-world';
import type { JourneyCast } from './s12-pw7-flow';
import { submitSubjectViaApi, type SubjectKind } from './s12-pw7-world';

export type PatternNode = Record<string, unknown>;

/** A saved pattern version: the CMS-03C-12 answer the journeys need. */
export type SavedVersion = Readonly<{
  patternKey: string;
  /** The lineage id (`patternId` of a nested reference and of a composition instance). */
  patternId: string;
  /** The version row id (`subjectId` of a review). */
  versionId: string;
  contentHash: string;
  /** The strong-ETag version the next successor names as `expectedVersion` and `If-Match`. */
  version: string;
  /** The pattern's own version number (`patternVersion` of a nested reference). */
  patternVersion: number;
}>;

/** CMS-03C-12 key grammar: `^[a-z][a-z0-9-]{1,63}$` (hyphens, no underscore). */
export const newPatternKey = (label: string): string =>
  `s12-pw9-${label}-${randomUUID().slice(0, 8).replaceAll('-', '')}`;

/** A run-unique text that a diff value or a reason can be scanned for. */
export const marker = (label: string): string =>
  `pw9-${label}-${randomUUID().slice(0, 8).replaceAll('-', '')}`;

/** One top-level block node of the registered latency block; `title` is the prop a diff shows. */
export const latencyRoot = (key: string, title: string): PatternNode => ({
  kind: 'block',
  key,
  blockKey: LATENCY_BLOCK_KEY,
  blockVersion: LATENCY_BLOCK_VERSION,
  props: { title },
  children: [],
});

/** A nested reference to a saved version (a top-level `pattern` node, expanded on placement, DEC-181). */
export const nestedRef = (
  key: string,
  of: Pick<SavedVersion, 'patternId' | 'patternVersion'>,
): PatternNode => ({
  kind: 'pattern',
  key,
  patternId: of.patternId,
  patternVersion: of.patternVersion,
});

/**
 * CMS-03C-12 as a template designer: a first `draft` version of a new lineage (`parent` null) or the successor of
 * `parent` (`expectedVersion` and `If-Match` are the parent's `version`), compatible with the world's content type.
 */
export const savePatternVersion = async (
  designer: S10Client,
  world: S10World,
  patternKey: string,
  blockTree: readonly PatternNode[],
  parent: SavedVersion | null,
): Promise<SavedVersion> => {
  await registerLatencyBlock(world.owner);
  const created = await designer.post(
    PATTERN_VERSIONS_API,
    {
      patternKey,
      compatibleTypeIds: [world.contentTypeId],
      blockTree,
      expectedVersion: parent === null ? null : parent.version,
    },
    parent === null ? undefined : { ifMatch: parent.version },
  );
  if (created.status !== 201)
    throw new Error(`CMS-03C-12 refused: ${created.status} ${created.text}`);
  return {
    patternKey,
    patternId: String(created.body.patternId),
    versionId: String(created.body.id),
    contentHash: String(created.body.contentHash),
    version: String(created.body.version),
    patternVersion: Number(created.body.patternVersion),
  };
};

/**
 * A saved version submitted, assigned to the journey's reviewer and APPROVED through the first-party routes (the same
 * commands the browser sends); it is not activated. Each person has a fresh step-up.
 */
export const approveViaApi = async (
  journey: JourneyCast,
  submitter: SignedIn,
  kind: SubjectKind,
  subject: Readonly<{ versionId: string; contentHash: string }>,
  reason: string,
): Promise<OpenReview> => {
  const { owner, ownerActor, reviewer, cast } = journey;
  const review = await submitSubjectViaApi(submitter.client, kind, subject);
  await completeStepUp(owner.context, cast.world, ownerActor);
  const assigned = await assignGovernedViaApi(
    owner.client,
    review,
    cast.reviewer.principal.personId,
  );
  expect(assigned.status, assigned.text).toBe(201);
  await completeStepUp(reviewer.context, cast.world, cast.reviewer);
  const approved = await approveGovernedViaApi(
    reviewer.client,
    review.reviewId,
    reason,
  );
  expect(approved.status, approved.text).toBe(200);
  return review;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/** Guards every identifier interpolated into SQL: the journeys only ever pass ids the API answered. */
export const uuid = (value: string): string => {
  if (!UUID.test(value)) throw new Error(`not a uuid: ${value.slice(0, 40)}`);
  return value;
};

/** `state|invalidated_reason|version` of a governed review. */
export const reviewRow = (reviewId: string): string =>
  psql(
    `select state || '|' || coalesce(invalidated_reason, '') || '|' || version::text
       from platform_private.cms_governed_reviews where id = '${uuid(reviewId)}'`,
  );

/** The lifecycle state of one pattern version row. */
export const patternState = (versionId: string): string =>
  psql(
    `select state from platform_private.cms_pattern_versions where id = '${uuid(versionId)}'`,
  );

/** Outbox events that name one pattern version (the activation event of CMS-03C-09). */
export const patternEventCount = (versionId: string): number =>
  Number(
    psql(
      `select count(*) from platform_private.outbox_events
        where event_type = 'cms.pattern.activated.v1' and payload->>'patternVersionId' = '${uuid(versionId)}'`,
    ),
  );

/**
 * The newest composition row of one path of one entry's revisions for one pattern lineage, as
 * `state|link_mode|pattern_version|version`. The lineage is unique to the journey, so it names the pattern; the entry
 * names the revisions.
 */
export const newestInstance = (
  entryId: string,
  patternId: string,
  path: string,
): string =>
  psql(
    `select state || '|' || link_mode || '|' || coalesce(pattern_version::text, '') || '|' || version::text
       from platform_private.cms_composition_instances
      where pattern_id = '${uuid(patternId)}' and path = '${path.replaceAll("'", "''")}'
        and revision_id in (select id from platform_private.cms_entry_revisions where entry_id = '${uuid(entryId)}')
      order by version desc limit 1`,
  );
