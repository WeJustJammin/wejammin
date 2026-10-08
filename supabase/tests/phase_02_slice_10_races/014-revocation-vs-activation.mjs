#!/usr/bin/env node

/**
 * Slice 10 two-session race evidence (Codex SQL review 3 finding 2; DEC-143, BE03a
 * "Specialist capability expires or is revoked after approval"): authority REVOCATION
 * versus schema ACTIVATION.
 *
 * Losing a counted approver's specialist capability or membership invalidates the
 * approved review and returns its candidate to draft from an AFTER ROW trigger on the
 * authority table (platform_private.cms_activation_review_invalidation_trigger, which
 * locks the candidate and its reviews).  The activation locks the same authority rows.
 * Taken in opposite orders they deadlocked: the activation held the candidate and
 * waited for the grant or tenure row, the revocation held that row and waited for the
 * candidate (SQLSTATE 40P01, so revocation did not deterministically win and a raw
 * deadlock error could reach the caller).  Both now follow ONE order, authority rows
 * (binding, tenure, grants) first, then the candidate, then its reviews, so each
 * interleaving has one deterministic, typed outcome.
 *
 * The candidates are PROTECTED-policy successors (two distinct humans including the
 * specialist rev1, who holds cms.reviewer.policy through CMS-03A-15), produced only
 * through the named commands (infra/database-races/chain-kit.mjs).  The revocation is the
 * real CMS-03A-17 command (platform_api.cms_revoke_capability_grant) of rev1's specialist
 * grant, and the real end of rev1's confirmed membership; the activation is the real
 * human switch or the Worker's second switch.  For each of both revocations and both
 * activation paths:
 *
 *   R1  the activation is paused right after it took its first locks (a helper holds a row
 *       of the candidate's dependency graph) and the revocation starts: both blocked, the
 *       helper releases.  Exactly one of the two is first, the other waits for it: no
 *       SQLSTATE 40P01, the activation commits (it held the authority rows first), and
 *       the revocation then commits and finds nothing left to invalidate.  Under the old
 *       order the activation held the candidate while the revocation held the grant row
 *       and PostgreSQL aborted one of them.
 *   R3  (Codex final review) the activation never RESCANS authority rows once it holds the
 *       candidate: a reviewer-class grant row committed after its early scan is revoked while
 *       the activation is paused, and neither side waits for the other (see the block below).
 *   R2  the revocation commits first (held in flight, its trigger already invalidated the
 *       review) when the activation starts: the activation waits, and once the revocation
 *       commits it is refused with a typed error; the review is invalidated, the
 *       candidate is back to draft and the source is still active (revocation wins).
 *
 * Run only against the disposable local database right after `pnpm db:reset`
 * (the gate in infra/run-database-race-runners.mjs does); it commits rows.
 */
import * as kit from '../../../infra/database-races/race-kit.mjs';
import * as chain from '../../../infra/database-races/chain-kit.mjs';

const { check, sql } = kit;

const HELPER_GATE = 7201;
const REVOKER_GATE = 7202;
const SPECIALIST = 'cms.reviewer.policy';

kit.installGateTrigger();
const world = chain.buildWorld();

const revoker = (kind, holdGate = null) =>
  kind === 'grant'
    ? chain.revokeGrantScript(world, 'rev1', SPECIALIST, holdGate)
    : chain.endTenureScript(world, 'rev1', holdGate);

const revokedState = (kind) =>
  kind === 'grant'
    ? kit.runValue(
        `select grant_row.state::text from platform_private.cms_capability_grants grant_row where grant_row.owner_id = ${sql(world.org)}::uuid and grant_row.subject_person_ref = ${sql(world.rev1.person)}::uuid and grant_row.capability_code = ${sql(SPECIALIST)};`,
      ) === 'revoked'
    : kit.runValue(
        `select count(*)::text from identity_private.membership_tenure where organization_id = ${sql(world.org)}::uuid and person_id = ${sql(world.rev1.person)}::uuid and state = 'confirmed';`,
      ) === '0';

const reviewState = (reviewId) =>
  kit.runValue(
    `select state::text from platform_private.cms_schema_reviews where id = ${sql(reviewId)}::uuid;`,
  );

const typed = (outcome) =>
  /^[A-Z][A-Z_]+$/u.test(kit.errorMessage(outcome) ?? '');
const refusalOf = (outcome) =>
  `${kit.errorMessage(outcome) ?? 'no error'}${
    chain.errorDetail(outcome) === null
      ? ''
      : ` / ${chain.errorDetail(outcome)}`
  }`;

/** A helper session holding the candidate's graph rows (its field definitions) until the gate opens. */
const holdGraphScript = (candidateVersionId, gate) =>
  `begin; select 1 from platform_private.cms_field_definition_versions where content_type_version_id = ${sql(candidateVersionId)}::uuid order by id for update; select pg_catalog.pg_advisory_xact_lock_shared(${gate}); commit;`;

/** One fresh protected candidate over a source with one entry (specialist re-granted first). */
const freshCandidate = (index) => {
  chain.ensureSpecialist();
  const sourceTag = `rs${index}x`;
  const candidateTag = `rc${index}x`;
  const source = chain.buildSources([sourceTag])[sourceTag];
  kit.makeEntry(chain.ownerIds(world, source), 'Seed entry');
  const candidate = chain.buildCandidates([
    { tag: candidateTag, source: sourceTag, protectedPolicy: true },
  ])[candidateTag];
  chain.bindOwner(world);
  return candidate;
};

let index = 0;
try {
  for (const kind of ['grant', 'tenure']) {
    for (const path of ['human', 'worker']) {
      // ---------------------------------------------------------- R1 ----
      {
        index += 1;
        const label = `${kind}/${path}`;
        const candidate = freshCandidate(index);
        check(
          reviewState(candidate.reviewId) === 'approved' &&
            chain.versionState(candidate.candidateVersionId) === 'approved',
          `R1 ${label}: fixture: the protected candidate is approved with its review approved`,
        );
        await kit.closeGate(HELPER_GATE);
        const helperApp = `s10race-helper-graph-${kind}-${path}`;
        const helper = kit.runAsync(
          helperApp,
          holdGraphScript(candidate.candidateVersionId, HELPER_GATE),
        );
        await kit.waitParked(helperApp);
        const activationApp = `s10race-act-pause-${kind}-${path}`;
        const activation = kit.runAsync(
          activationApp,
          chain.activationScript(world, path, candidate),
        );
        check(
          (await kit.blockedOrCompleted(activationApp, activation)) ===
            'blocked',
          `R1 ${label}: the ${path} activation is paused on a graph row of the candidate`,
        );
        const revokerApp = `s10race-revoke-${kind}-${path}`;
        const revocation = kit.runAsync(revokerApp, revoker(kind));
        check(
          (await kit.blockedOrCompleted(revokerApp, revocation)) === 'blocked',
          `R1 ${label}: the revocation of the counted approver's ${kind === 'grant' ? 'specialist grant' : 'membership'} blocks behind the paused activation`,
        );
        await kit.openGate(HELPER_GATE);
        const [helperOutcome, activationOutcome, revocationOutcome] =
          await Promise.all([helper.done, activation.done, revocation.done]);
        check(
          helperOutcome.code === 0 &&
            !chain.isDeadlock(activationOutcome) &&
            !chain.isDeadlock(revocationOutcome),
          `R1 ${label}: neither the ${path} activation nor the revocation is aborted by a deadlock (activation: ${refusalOf(activationOutcome)}; revocation: ${refusalOf(revocationOutcome)})`,
        );
        check(
          activationOutcome.code === 0 &&
            chain.versionState(candidate.candidateVersionId) === 'active' &&
            chain.versionState(candidate.sourceVersionId) === 'superseded',
          `R1 ${label}: the activation, which held the authority rows first, committed (candidate active, source superseded)`,
        );
        check(
          revocationOutcome.code === 0 && revokedState(kind),
          `R1 ${label}: the revocation then committed (${refusalOf(revocationOutcome)}) and the approver's ${kind === 'grant' ? 'specialist grant is revoked' : 'membership is ended'}`,
        );
      }

      // ---------------------------------------------------------- R2 ----
      {
        index += 1;
        const label = `${kind}/${path}`;
        const candidate = freshCandidate(index);
        await kit.closeGate(REVOKER_GATE);
        const revokerApp = `s10race-hold-revoke-${kind}-${path}`;
        const held = kit.runAsync(revokerApp, revoker(kind, REVOKER_GATE));
        await kit.waitParked(revokerApp);
        check(
          reviewState(candidate.reviewId) === 'approved',
          `R2 ${label}: the held revocation has not committed (its trigger's invalidation is invisible)`,
        );
        const activationApp = `s10race-act-after-${kind}-${path}`;
        const activation = kit.runAsync(
          activationApp,
          chain.activationScript(world, path, candidate),
        );
        check(
          (await kit.blockedOrCompleted(activationApp, activation)) ===
            'blocked',
          `R2 ${label}: the ${path} activation waits for the in-flight revocation`,
        );
        await kit.openGate(REVOKER_GATE);
        const [revocationOutcome, activationOutcome] = await Promise.all([
          held.done,
          activation.done,
        ]);
        check(
          !chain.isDeadlock(revocationOutcome) &&
            !chain.isDeadlock(activationOutcome),
          `R2 ${label}: no deadlock between the in-flight revocation and the waiting ${path} activation`,
        );
        check(
          revocationOutcome.code === 0 && revokedState(kind),
          `R2 ${label}: the revocation committed (${refusalOf(revocationOutcome)})`,
        );
        check(
          activationOutcome.code !== 0 && typed(activationOutcome),
          `R2 ${label}: the ${path} activation was refused with a typed error once the revocation committed (${refusalOf(activationOutcome)})`,
        );
        check(
          reviewState(candidate.reviewId) === 'invalidated' &&
            chain.versionState(candidate.candidateVersionId) === 'draft' &&
            chain.versionState(candidate.sourceVersionId) === 'active',
          `R2 ${label}: revocation won: the review is invalidated, the candidate is back to draft and the source is still active`,
        );
      }
    }
  }
  // -------------------------------------------------------------- R3 ----
  // Codex final review (HIGH): the activation must not RESCAN authority rows after it holds the
  // candidate and the active version.  A reviewer-class grant row of a counted approver committed
  // AFTER the activation's early scan is not one of its locks; its revocation holds the row and
  // waits (trigger) for the candidate the paused activation holds, so a late rescan of the
  // authority rows (the legacy composite helper in the human switch, the approval recheck in the
  // Worker switch) waits for the revocation: a deadlock cycle even though the wrappers would map
  // it to CONFLICT.  Neither side may be aborted: the activation commits and the revocation then
  // commits and finds nothing to invalidate.
  // a DIFFERENT capability per path: the row must not exist yet when the activation scans
  const lateCapability = {
    human: 'cms.reviewer.legal',
    worker: 'cms.reviewer.security',
  };
  for (const path of ['human', 'worker']) {
    index += 1;
    const label = `late-row/${path}`;
    const capability = lateCapability[path];
    const candidate = freshCandidate(index);
    await kit.closeGate(HELPER_GATE);
    const helperApp = `s10race-helper-graph-late-${path}`;
    const helper = kit.runAsync(
      helperApp,
      holdGraphScript(candidate.candidateVersionId, HELPER_GATE),
    );
    await kit.waitParked(helperApp);
    const activationApp = `s10race-act-pause-late-${path}`;
    const activation = kit.runAsync(
      activationApp,
      chain.activationScript(world, path, candidate),
    );
    check(
      (await kit.blockedOrCompleted(activationApp, activation)) === 'blocked',
      `R3 ${label}: the ${path} activation is paused on a graph row after it locked the authority rows and the candidate`,
    );
    check(
      chain.insertGrantRow(world, 'rev1', capability) === 'inserted',
      `R3 ${label}: a reviewer-class grant row of a counted approver is committed after the activation's early scan`,
    );
    const revokerApp = `s10race-revoke-late-${path}`;
    const revocation = kit.runAsync(
      revokerApp,
      chain.deactivateGrantScript(world, 'rev1', capability),
    );
    check(
      (await kit.blockedOrCompleted(revokerApp, revocation)) === 'blocked',
      `R3 ${label}: its revocation holds the row and waits (invalidation trigger) for the candidate the activation holds`,
    );
    await kit.openGate(HELPER_GATE);
    const [helperOutcome, activationOutcome, revocationOutcome] =
      await Promise.all([helper.done, activation.done, revocation.done]);
    check(
      helperOutcome.code === 0 &&
        !chain.isDeadlock(activationOutcome) &&
        !chain.isDeadlock(revocationOutcome),
      `R3 ${label}: no deadlock between the ${path} activation and the revocation (activation: ${refusalOf(activationOutcome)}; revocation: ${refusalOf(revocationOutcome)})`,
    );
    check(
      activationOutcome.code === 0 &&
        chain.versionState(candidate.candidateVersionId) === 'active',
      `R3 ${label}: the ${path} activation committed: it never waited for a row it did not already hold (${refusalOf(activationOutcome)})`,
    );
    check(
      revocationOutcome.code === 0 &&
        kit.runValue(
          `select count(*)::text from identity_private.organization_actor_grant where organization_id = ${sql(world.org)}::uuid and person_id = ${sql(world.rev1.person)}::uuid and capability_code = ${sql(capability)} and active;`,
        ) === '0',
      `R3 ${label}: the revocation then committed (${refusalOf(revocationOutcome)})`,
    );
  }
  console.log(
    '# all revocation-versus-activation race assertions passed; run `pnpm db:reset` before the pgTAP suite',
  );
} finally {
  await kit.openAllGates();
}
