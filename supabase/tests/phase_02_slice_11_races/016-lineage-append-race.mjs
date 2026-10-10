#!/usr/bin/env node

/**
 * Slice 11 N-session race evidence for the publication-lineage append helper
 * `platform_private.cms_append_publication_lineage` (BE03b "Publication lineage (E3)": appends to one
 * (entry, locale, audience) lineage serialize on the lineage advisory transaction lock, and a command that carries
 * the head it OBSERVED (expectedHead { id, version }, null/null for an absent head) before it serialized finds that
 * head compared under the lock: when another append moved the head first it is 409 publication_conflict and
 * nothing commits - never a duplicate, never a gap, never a raw unique violation; tracker P2-S11-AC-114,
 * AC-115).  Each session is a fresh committed `psql` process that calls the helper itself, the unit the pgTAP
 * suite can only reach from one session.  The named commands' own early observation is proved by race 014.
 *
 *   L1  two sessions that observed the SAME (absent) head: the first is parked right before its row insert
 *       (after it took the lineage lock and compared the head), the second BLOCKS on the lineage lock; once
 *       released exactly one commits version 1 and the second is publication_conflict: one row, one event, one
 *       audit record, nothing of the loser.
 *   L2  six sessions that observed the same absent head at once: exactly one commits version 1, five are
 *       publication_conflict, one event; no raw unique violation reaches any session.
 *   L3  a publish and an unpublish that observed the same active head at once: exactly one commits version 2
 *       (either order of arrival), the other is publication_conflict; a session that observes the NEW head
 *       afterwards appends version 3.
 *
 * Run only against the disposable local database right after `pnpm db:reset`.
 */
import * as kit from '../../../infra/database-races/publication-kit.mjs';

const { check } = kit;
const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const ids = kit.buildPublicationFixture();
kit.installLineageGate();
const LINEAGE_GATE = 7703;

/**
 * The head observation of a tag's lineage as a SQL literal, taken NOW (what a command saw before it serialized). The
 * reads of the private lineage table run under the CMS RPC context, exactly as a named command does.
 */
const observe = (tag) =>
  `${sql(
    kit
      .runValue(
        `select set_config('app.cms_rpc', 'true', false), platform_private.cms_lineage_head_observation(${sql(ids.entries[tag])}::uuid, 'en-US', 'public')::text;`,
        's11race-observe',
      )
      .split('|')
      .slice(1)
      .join('|'),
  )}::jsonb`;

/** A session script: one committed call of the helper for the committed approved review of a tag. */
const appendScript = (tag, action, observed) => `begin;
select set_config('app.cms_rpc', 'true', true);
select platform_private.cms_append_publication_lineage(${
  action === 'publish'
    ? `jsonb_build_object(
    'entryId', review.entry_id, 'revisionId', review.revision_id, 'locale', 'en-US', 'audience', 'public',
    'action', 'publish', 'publisherPersonId', review.submitted_by,
    'versionSet', platform_private.cms_revision_version_set(review.revision_id, review.dependency_manifest),
    'dependencyHash', review.dependency_hash, 'activationEvidenceHash', repeat('b', 64),
    'expectedHead', ${observed},
    'correlationId', extensions.gen_random_uuid())`
    : `jsonb_build_object(
    'entryId', review.entry_id, 'locale', 'en-US', 'audience', 'public', 'action', ${sql(action)},
    'publisherPersonId', review.submitted_by, 'expectedHead', ${observed},
    'correlationId', extensions.gen_random_uuid())`
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

const append = (tag, action, appName, observed) =>
  kit.spawnSession(appName, appendScript(tag, action, observed));

const conflictOf = (outcome) =>
  outcome.code !== 0 && outcome.stderr.includes('publication_conflict');
const rawViolation = (outcomes) =>
  outcomes.some((outcome) => /duplicate key|23505/u.test(outcome.stderr));

try {
  // ------------------------------------------------------------ L1 ----
  const absent = observe('dp-3');
  await kit.closeGate(LINEAGE_GATE);
  const firstApp = `s11race-lineage-${LINEAGE_GATE}-first`;
  const first = append('dp-3', 'publish', firstApp, absent);
  await kit.waitParked(firstApp);
  const secondApp = 's11race-append-second';
  const second = append('dp-3', 'publish', secondApp, absent);
  check(
    (await kit.blockedOrCompleted(secondApp, second)) === 'blocked' &&
      kit.blockedBy(secondApp).includes(firstApp),
    'L1: a second append that observed the same head BLOCKS on the lineage advisory lock while the first is parked before its insert',
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
      resourceOf(firstOutcome)?.version === '1' &&
      conflictOf(secondOutcome) &&
      !rawViolation([firstOutcome, secondOutcome]),
    `L1: the first append commits version 1 and the second, which observed an absent head, is publication_conflict - never a raw unique violation (${secondOutcome.stderr.trim() || 'no error'})`,
  );
  check(
    kit.lineage(ids, 'dp-3') === '1:publish:active' &&
      kit.publicationEvents(ids, 'dp-3') === 1 &&
      kit.publicationAudits(ids, 'dp-3') === 1,
    'L1: exactly one row, one cms.publication.changed.v1 and one audit record: the loser committed nothing',
  );

  // ------------------------------------------------------------ L2 ----
  const absentMany = observe('pe-2');
  const sessions = [1, 2, 3, 4, 5, 6].map((n) =>
    append('pe-2', 'publish', `s11race-append-many-${n}`, absentMany),
  );
  const many = await Promise.all(sessions.map((session) => session.done));
  const winners = many.filter((outcome) => outcome.code === 0);
  check(
    winners.length === 1 &&
      many.filter(conflictOf).length === 5 &&
      !rawViolation(many),
    `L2: of six simultaneous appends that observed one absent head exactly one commits and five are publication_conflict, none a raw unique violation (${many.map((outcome) => (outcome.code === 0 ? 'ok' : conflictOf(outcome) ? 'conflict' : outcome.stderr.trim())).join(',')})`,
  );
  check(
    kit.lineage(ids, 'pe-2') === '1:publish:active' &&
      resourceOf(winners[0])?.version === '1' &&
      kit.publicationEvents(ids, 'pe-2') === 1 &&
      kit.publicationAudits(ids, 'pe-2') === 1,
    'L2: version 1 exactly (no duplicate, no gap), one event and one audit record',
  );

  // ------------------------------------------------------------ L3 ----
  const observedHead = observe('dp-3');
  const publishing = append(
    'dp-3',
    'publish',
    's11race-append-l3-publish',
    observedHead,
  );
  const unpublishing = append(
    'dp-3',
    'unpublish',
    's11race-append-l3-unpublish',
    observedHead,
  );
  const [published, unpublished] = await Promise.all([
    publishing.done,
    unpublishing.done,
  ]);
  const l3 = [published, unpublished];
  check(
    l3.filter((outcome) => outcome.code === 0).length === 1 &&
      l3.filter(conflictOf).length === 1 &&
      /^1:publish:active,2:(publish:active|unpublish:revoked)$/u.test(
        kit.lineage(ids, 'dp-3'),
      ) &&
      kit.publicationEvents(ids, 'dp-3') === 2,
    `L3: a publish and an unpublish that observed one head: exactly one commits version 2, the other is publication_conflict (${kit.lineage(ids, 'dp-3')}; ${l3.map((outcome) => (outcome.code === 0 ? 'ok' : outcome.stderr.trim())).join(' | ')})`,
  );
  const afterHead = observe('dp-3');
  const later = append('dp-3', 'publish', 's11race-append-l3-later', afterHead);
  const laterOutcome = await later.done;
  check(
    laterOutcome.code === 0 &&
      resourceOf(laterOutcome)?.version === '3' &&
      /^1:publish:active,2:(publish:active|unpublish:revoked),3:publish:active$/u.test(
        kit.lineage(ids, 'dp-3'),
      ),
    `L3: a genuinely later publish that observed the new head is not a conflict: it appends version 3 (${laterOutcome.stderr.trim() || 'ok'})`,
  );
  console.log(
    '# all lineage append race assertions passed; run `pnpm db:reset` before the pgTAP suite',
  );
} finally {
  await kit.openAllGates();
}
