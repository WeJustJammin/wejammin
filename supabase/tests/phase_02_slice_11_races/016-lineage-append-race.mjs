#!/usr/bin/env node

/**
 * Slice 11 N-session race evidence for the publication-lineage append helper
 * `platform_private.cms_append_publication_lineage` (BE03b "Publication lineage (E3)": appends to one
 * (entry, locale, audience) lineage serialize on the lineage advisory transaction lock, so two sessions that
 * start from the same head never commit a duplicate or a gap and the loser never sees a raw unique
 * violation; tracker P2-S11-AC-114, AC-115).  Each session is a fresh committed `psql` process that calls the
 * helper itself, the unit the pgTAP suite can only reach from one session.
 *
 *   L1  two sessions append to the SAME head: the first is parked right before its row insert (after it took
 *       the lineage lock and read the head), the second BLOCKS on the lineage lock; once released both commit as
 *       versions 1 and 2, the second names the first as its predecessor, same lineage id, two events, no error.
 *   L2  six sessions append to one lineage at once: versions 1..6 exactly, one event each, no
 *       publication_conflict and no unique violation reaches any session.
 *   L3  a publish and an unpublish of one lineage at once: both commit as the next two versions in either
 *       order (the unpublish finds an active head in both), no gap and no duplicate.
 *
 * Run only against the disposable local database right after `pnpm db:reset`.
 */
import * as kit from '../../../infra/database-races/publication-kit.mjs';

const { check } = kit;
const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const ids = kit.buildPublicationFixture();
kit.installLineageGate();
const LINEAGE_GATE = 7703;

/** A session script: one committed call of the helper for the committed approved review of a tag. */
const appendScript = (tag, action) => `begin;
select set_config('app.cms_rpc', 'true', true);
select platform_private.cms_append_publication_lineage(${
  action === 'publish'
    ? `jsonb_build_object(
    'entryId', review.entry_id, 'revisionId', review.revision_id, 'locale', 'en-US', 'audience', 'public',
    'action', 'publish', 'publisherPersonId', review.submitted_by,
    'versionSet', platform_private.cms_revision_version_set(review.revision_id, review.dependency_manifest),
    'dependencyHash', review.dependency_hash, 'activationEvidenceHash', repeat('b', 64),
    'correlationId', extensions.gen_random_uuid())`
    : `jsonb_build_object(
    'entryId', review.entry_id, 'locale', 'en-US', 'audience', 'public', 'action', ${sql(action)},
    'publisherPersonId', review.submitted_by, 'correlationId', extensions.gen_random_uuid())`
})::text
  from platform_private.cms_editorial_reviews review where review.id = ${sql(ids.reviews[tag])};
commit;`;

/** The PublicationResource a session printed (its last `{` line), or null. */
const resourceOf = (outcome) => {
  const line = outcome.stdout
    .split('\n')
    .filter((candidate) => candidate.startsWith('{'))
    .at(-1);
  return line === undefined ? null : JSON.parse(line);
};

const append = (tag, action, appName) =>
  kit.spawnSession(appName, appendScript(tag, action));

const rowsOf = (tag) =>
  kit.runValue(
    `select coalesce(string_agg(version || ':' || id || ':' || coalesce(supersedes_id::text, '-') || ':' || publication_id, ',' order by version), '-')
       from platform_private.cms_publication_versions
      where entry_id = ${sql(ids.entries[tag])} and locale = 'en-US' and audience = 'public';`,
  );

try {
  // ------------------------------------------------------------ L1 ----
  await kit.closeGate(LINEAGE_GATE);
  const firstApp = `s11race-lineage-${LINEAGE_GATE}-first`;
  const first = append('dp-3', 'publish', firstApp);
  await kit.waitParked(firstApp);
  const secondApp = 's11race-append-second';
  const second = append('dp-3', 'publish', secondApp);
  check(
    (await kit.blockedOrCompleted(secondApp, second)) === 'blocked',
    'L1: a second append to the same head BLOCKS on the lineage advisory lock while the first is parked before its insert',
  );
  check(
    kit.lineage(ids, 'dp-3') === '-',
    'L1: neither append has committed a row while the first holds the lineage lock',
  );
  await kit.openGate(LINEAGE_GATE);
  const [firstOutcome, secondOutcome] = await Promise.all([
    first.done,
    second.done,
  ]);
  check(
    firstOutcome.code === 0 &&
      secondOutcome.code === 0 &&
      !`${firstOutcome.stderr}${secondOutcome.stderr}`.includes(
        'publication_conflict',
      ) &&
      !`${firstOutcome.stderr}${secondOutcome.stderr}`.includes(
        'duplicate key',
      ) &&
      resourceOf(firstOutcome)?.version === '1' &&
      resourceOf(secondOutcome)?.version === '2',
    `L1: both appends commit, as versions 1 and 2, with no conflict surfaced (${firstOutcome.stderr.trim() || secondOutcome.stderr.trim() || 'no error'})`,
  );
  const [version1, version2] = rowsOf('dp-3').split(',');
  const [, firstId, , lineageId] = version1.split(':');
  const [, , supersedes, secondLineageId] = version2.split(':');
  check(
    kit.lineage(ids, 'dp-3') === '1:publish:active,2:publish:active' &&
      supersedes === firstId &&
      secondLineageId === lineageId &&
      lineageId === firstId,
    'L1: the second row names the first as its predecessor inside the same lineage (the first row id is the lineage id)',
  );
  check(
    kit.publicationEvents(ids, 'dp-3') === 2,
    'L1: exactly one cms.publication.changed.v1 per appended row',
  );

  // ------------------------------------------------------------ L2 ----
  const sessions = [1, 2, 3, 4, 5, 6].map((n) =>
    append('pe-2', 'publish', `s11race-append-many-${n}`),
  );
  const many = await Promise.all(sessions.map((session) => session.done));
  const text = many.map((outcome) => outcome.stderr).join(' ');
  check(
    many.every((outcome) => outcome.code === 0) &&
      !text.includes('publication_conflict') &&
      !text.includes('duplicate key'),
    `L2: six simultaneous appends all commit with no conflict surfaced (${text.trim() || 'no error'})`,
  );
  check(
    kit.lineage(ids, 'pe-2') ===
      '1:publish:active,2:publish:active,3:publish:active,4:publish:active,5:publish:active,6:publish:active' &&
      many
        .map((outcome) => Number(resourceOf(outcome)?.version))
        .sort((left, right) => left - right)
        .join(',') === '1,2,3,4,5,6' &&
      kit.publicationEvents(ids, 'pe-2') === 6,
    'L2: versions 1..6 exactly (no duplicate, no gap), each answered once, one event per row',
  );

  // ------------------------------------------------------------ L3 ----
  const publishing = append('dp-3', 'publish', 's11race-append-l3-publish');
  const unpublishing = append(
    'dp-3',
    'unpublish',
    's11race-append-l3-unpublish',
  );
  const [published, unpublished] = await Promise.all([
    publishing.done,
    unpublishing.done,
  ]);
  check(
    published.code === 0 &&
      unpublished.code === 0 &&
      /^1:publish:active,2:publish:active,(3:publish:active,4:unpublish:revoked|3:unpublish:revoked,4:publish:active)$/u.test(
        kit.lineage(ids, 'dp-3'),
      ) &&
      kit.publicationEvents(ids, 'dp-3') === 4,
    `L3: a publish and an unpublish at once both commit as versions 3 and 4 in one serial order (${kit.lineage(ids, 'dp-3')})`,
  );
  console.log(
    '# all lineage append race assertions passed; run `pnpm db:reset` before the pgTAP suite',
  );
} finally {
  await kit.openAllGates();
}
