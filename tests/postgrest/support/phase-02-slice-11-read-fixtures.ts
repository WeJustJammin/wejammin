/**
 * Shared refusal fixtures for the Slice 11 read/command-refusal suites (lane
 * S11-4R read families). Extracted from the inherited `review-refusals` suite so
 * the feature-split files reuse one definition instead of duplicating it. Every
 * helper is parameterised on the caller's `stack`/`world` so each focused file
 * keeps its own isolated fixtures.
 */
import { readWorkflow } from './phase-02-slice-11-flow';
import type { S11Stack } from './phase-02-slice-11-stack';
import type { S11World } from './phase-02-slice-11-world';
import { psql } from './stack';

/**
 * The CMS-03B-05 submit body built from the live preparation read, as the owner.
 */
export const s11SubmitBody = async (
  stack: S11Stack,
  world: S11World,
  entryId: string,
  revisionId: string,
) => {
  stack.as(world.owner);
  const { preparation } = await readWorkflow(stack, entryId);
  return {
    entryId,
    revisionId,
    frozenHash: preparation?.frozenHash,
    dependencyManifest: preparation?.dependencyManifest,
  };
};

/** POST one CMS-03B-05 submission under the strong entry `If-Match`. */
export const s11Submit = (
  stack: S11Stack,
  entryId: string,
  body: unknown,
  ifMatch: string,
  idempotencyKey?: string,
) =>
  stack.post(`/api/v1/cms/entries/${entryId}/reviews`, {
    body,
    ifMatch,
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
  });

/**
 * Fixture drift of a frozen manifest (what the real invalidation job detects):
 * the stored manifest no longer equals the rebuilt one, so a decision on it is
 * the COMMITTED `dependency_changed` refusal. Guarded rows are only touched
 * inside the CMS RPC context with the review triggers disabled, exactly as the
 * pgTAP fixtures do.
 */
export const s11DriftFrozenManifest = (reviewId: string): void => {
  psql(`
    begin;
    select set_config('app.cms_rpc', 'true', true);
    alter table platform_private.cms_editorial_reviews disable trigger user;
    update platform_private.cms_editorial_reviews
       set dependency_manifest = jsonb_set(dependency_manifest, '{checker,version}', '"2"'),
           dependency_hash = platform_private.cms_jcs_sha256(
             jsonb_set(dependency_manifest, '{checker,version}', '"2"'))
     where id = '${reviewId}';
    alter table platform_private.cms_editorial_reviews enable trigger user;
    commit;`);
};

/** The owner party of one entry (derived from the actual row, not assumed). */
export const s11EntryOwnerPartyId = (entryId: string): string =>
  psql(
    `select owner_party_id from platform_private.cms_content_entries where id = '${entryId}'`,
  );

/**
 * The number of stored publication-settings snapshots for ONE owner party, via a
 * read-only count SELECT. Narrowed to the fresh entry's owner so a snapshot another
 * owner holds can never mask a per-owner read effect.
 */
export const s11OwnerSettingsSnapshotCount = (ownerPartyId: string): number =>
  Number(
    psql(
      `select count(*) from platform_private.cms_publication_settings_snapshots where owner_id = '${ownerPartyId}'`,
    ),
  );
