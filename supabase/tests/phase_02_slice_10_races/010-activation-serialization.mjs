#!/usr/bin/env node

/**
 * Slice 10 two-session race evidence (BE03b "Entry and revision writes serialize with
 * schema activation"; Codex adversarial review H2 and review 3 finding 1 and 4;
 * P2-S10-AC-005/AC-056).  Every command that creates a revision (cms_create_entry, the
 * CMS-03B-01 append, cms_resolve_conflict, cms_restore_revision) and BOTH schema
 * activation commands (the human CMS-03A-04 switch, platform_api.cms_activate_schema,
 * and the Worker's second switch, platform_api.cms_activate_schema_migration) share
 * ONE lock order, so a writer and an activation never deadlock and the loser is refused
 * with a typed error:
 *
 *   authority rows (binding, tenure, grants)  ->  candidate, graph, active version  ->
 *   review rows;   writers take  entry row -> authority rows (shared) -> version (shared).
 *
 * The earlier version of this runner stood the switch in for by an explicit
 * `FOR UPDATE` on the version row, which never proceeds to the authority locks the real
 * switch takes, so it passed while writers and the real switch deadlocked (SQLSTATE
 * 40P01).  Every scenario here runs the REAL activation RPC against the REAL writer, over
 * a type and an approved candidate produced only through the named commands
 * (infra/database-races/chain-kit.mjs), for each of the four writers and both activation
 * paths:
 *
 *   S1  the writer is parked (gate) right after its entry and authority locks, before its
 *       idempotency reservation and its version lock; the activation starts and blocks
 *       behind the writer's authority locks; the gate opens.  The writer commits exactly
 *       one revision; the activation is refused with CONFLICT / MIGRATION_SOURCE_DRIFT
 *       (the writer's revision was never scanned) and switches nothing; neither session
 *       sees SQLSTATE 40P01.  Under the old lock order the activation held the version
 *       rows and the writer then waited for them while the activation waited for the
 *       authority rows: PostgreSQL aborted one of them with 40P01.
 *   S2  the activation is in flight (every lock held, parked after its call) when the
 *       writer starts: the writer BLOCKS, and once the activation commits it is refused
 *       with a typed CONFLICT, VALIDATION_FAILED, DEPENDENCY_UNAVAILABLE or
 *       migration_chain_mismatch having written
 *       nothing (no entry, revision, value, relation, conflict, outbox or audit row).
 *   S3  the Slice 09 insert-time guard (cms_entry_version_lock_guard) stays the backstop for
 *       every producer path that does not take the early lock: a bare revision insert on
 *       the version while a real activation is in flight BLOCKS on the version row and,
 *       once the activation committed, is refused with CONFLICT by the guard.
 *
 *   S4  defense in depth (20261005013100): a deadlock that the lock order does not prevent
 *       (a helper session that takes the locks in the LEGACY order, version row before
 *       authority rows for a "legacy activation", authority rows after the version row for
 *       a "legacy writer") is answered by every command wrapper with the typed retryable
 *       CONFLICT, never a raw 40P01; nothing is committed and the same command, retried,
 *       succeeds.  The helper's deadlock_timeout is raised so the command under test is
 *       the one PostgreSQL aborts.
 *
 * Run only against the disposable local database right after `pnpm db:reset`
 * (the gate in infra/run-database-race-runners.mjs does); it commits rows.
 */
import * as kit from '../../../infra/database-races/race-kit.mjs';
import * as chain from '../../../infra/database-races/chain-kit.mjs';

const { check, sql } = kit;

const PATHS = ['human', 'worker'];
const WRITER_GATE = 7101;
const ACTIVATION_GATE = 7102;

kit.installGateTrigger();
const world = chain.buildWorld();

// ------------------------------------------------------------ the matrix ----
const scenarios = [];
for (const direction of ['gate', 'hold']) {
  for (const op of kit.WRITE_OPS) {
    for (const path of PATHS) {
      scenarios.push({
        direction,
        op,
        path,
        label: `${direction}-${op}-${path}`,
        sourceTag: `s${scenarios.length}x`,
        candidateTag: `c${scenarios.length}x`,
      });
    }
  }
}
for (const op of kit.WRITE_OPS) {
  scenarios.push({
    direction: 'legacy-writer',
    op,
    path: 'none',
    label: `legacy-writer-${op}`,
    sourceTag: `s${scenarios.length}x`,
    candidateTag: null,
  });
}
for (const path of PATHS) {
  scenarios.push({
    direction: 'legacy-activation',
    op: 'activate',
    path,
    label: `legacy-activation-${path}`,
    sourceTag: `s${scenarios.length}x`,
    candidateTag: `c${scenarios.length}x`,
  });
}
scenarios.push({
  direction: 'guard',
  op: 'insert',
  path: 'human',
  label: 'guard-insert-human',
  sourceTag: `s${scenarios.length}x`,
  candidateTag: `c${scenarios.length}x`,
});

const sources = chain.buildSources(scenarios.map((s) => s.sourceTag));
for (const scenario of scenarios) {
  scenario.ids = chain.ownerIds(world, sources[scenario.sourceTag]);
  // The writer's committed state exists BEFORE the candidate's scan, so the scan
  // covers it and only the raced write can drift the source.
  if (scenario.op === 'insert' || scenario.op === 'create') {
    kit.makeEntry(scenario.ids, 'Seed entry');
  }
  scenario.write =
    scenario.op === 'insert' || scenario.op === 'activate'
      ? null
      : kit.prepareWrite(scenario.ids, scenario.op);
  if (scenario.op === 'activate') {
    kit.makeEntry(scenario.ids, 'Seed entry');
  }
}
const candidates = chain.buildCandidates(
  scenarios
    .filter((s) => s.candidateTag !== null)
    .map((s) => ({ tag: s.candidateTag, source: s.sourceTag })),
);
for (const scenario of scenarios) {
  scenario.candidate =
    scenario.candidateTag === null ? null : candidates[scenario.candidateTag];
  scenario.sourceVersionId = sources[scenario.sourceTag].versionId;
}

const versionState = chain.versionState;
/**
 * Row fingerprint of everything a writer commits: entries, revisions, field values,
 * relations, conflicts and the non-schema outbox and audit rows (the activation's own
 * schema events are excluded, it commits in the same window).
 */
const writerRows = () =>
  kit.runValue(`select (select count(*) from platform_private.cms_content_entries)::text || '/'
    || (select count(*) from platform_private.cms_entry_revisions)::text || '/'
    || (select count(*) from platform_private.cms_entry_field_values)::text || '/'
    || (select count(*) from platform_private.cms_entry_relations)::text || '/'
    || (select count(*) from platform_private.cms_conflict_records)::text || '/'
    || (select count(*) from platform_private.outbox_events where event_type not like 'cms.schema.%')::text || '/'
    || (select count(*) from audit_private.audit_events where action not like 'cms.schema.%')::text;`);
const noDeadlock = (outcome) => !chain.isDeadlock(outcome);
const refusalOf = (outcome) =>
  `${kit.errorMessage(outcome) ?? 'no error'}${
    chain.errorDetail(outcome) === null
      ? ''
      : ` / ${chain.errorDetail(outcome)}`
  }`;

try {
  for (const scenario of scenarios.filter((s) => s.direction === 'gate')) {
    // ---------------------------------------------------------- S1 ----
    const { op, path, candidate, write, ids } = scenario;
    const before = kit.revisionTotal();
    chain.bindOwner(world);
    await kit.closeGate(WRITER_GATE);
    const writer = kit.startReserveGatedWrite(ids, write, WRITER_GATE);
    await kit.waitParked(writer.app);
    const activationApp = `s10race-act-gate-${op}-${path}`;
    const activation = kit.runAsync(
      activationApp,
      chain.activationScript(world, path, candidate),
    );
    check(
      (await kit.blockedOrCompleted(activationApp, activation)) === 'blocked',
      `S1 ${op}/${path}: the real ${path} activation blocks behind the authority locks of a writer parked between its authority locks and its version lock`,
    );
    await kit.openGate(WRITER_GATE);
    const [writerOutcome, activationOutcome] = await Promise.all([
      writer.session.done,
      activation.done,
    ]);
    check(
      noDeadlock(writerOutcome) && noDeadlock(activationOutcome),
      `S1 ${op}/${path}: neither the writer nor the ${path} activation is aborted by a deadlock (writer: ${refusalOf(writerOutcome)}; activation: ${refusalOf(activationOutcome)})`,
    );
    check(
      writerOutcome.code === 0 && kit.revisionTotal() === before + 1,
      `S1 ${op}/${path}: the parked writer committed exactly one revision (${kit.errorMessage(writerOutcome) ?? 'no error'})`,
    );
    check(
      activationOutcome.code !== 0 &&
        kit.errorMessage(activationOutcome) === 'CONFLICT' &&
        chain.errorDetail(activationOutcome) === 'MIGRATION_SOURCE_DRIFT',
      `S1 ${op}/${path}: the ${path} activation was refused with CONFLICT / MIGRATION_SOURCE_DRIFT because the writer's revision was never scanned (${refusalOf(activationOutcome)})`,
    );
    check(
      versionState(candidate.sourceVersionId) === 'active' &&
        versionState(candidate.candidateVersionId) === 'approved',
      `S1 ${op}/${path}: nothing was switched over the unscanned revision (source active, candidate approved)`,
    );
  }

  for (const scenario of scenarios.filter((s) => s.direction === 'hold')) {
    // ---------------------------------------------------------- S2 ----
    const { op, path, candidate, write, ids } = scenario;
    chain.bindOwner(world);
    await kit.closeGate(ACTIVATION_GATE);
    const activationApp = `s10race-hold-act-${op}-${path}`;
    const activation = kit.runAsync(
      activationApp,
      chain.activationScript(world, path, candidate, ACTIVATION_GATE),
    );
    await kit.waitParked(activationApp);
    const snapshot = writerRows();
    const writerApp = `s10race-w-hold-${op}-${path}`;
    const writer = kit.runAsync(
      writerApp,
      kit.commandScript(ids, write.fn, write.request, write.who),
    );
    check(
      (await kit.blockedOrCompleted(writerApp, writer)) === 'blocked',
      `S2 ${op}/${path}: a ${op} that starts while the real ${path} activation is in flight blocks behind it`,
    );
    await kit.openGate(ACTIVATION_GATE);
    const [activationOutcome, writerOutcome] = await Promise.all([
      activation.done,
      writer.done,
    ]);
    check(
      noDeadlock(writerOutcome) && noDeadlock(activationOutcome),
      `S2 ${op}/${path}: no deadlock between the in-flight activation and the waiting writer`,
    );
    check(
      activationOutcome.code === 0 &&
        versionState(candidate.candidateVersionId) === 'active' &&
        versionState(candidate.sourceVersionId) === 'superseded',
      `S2 ${op}/${path}: the in-flight ${path} activation committed (candidate active, source superseded) (${kit.errorMessage(activationOutcome) ?? 'no error'})`,
    );
    // The writer queued behind the activation's authority locks, then re-read the type's
    // (now successor) active version: the version-lock CONFLICT, the stale-version
    // VALIDATION_FAILED (create) and the unmigrated-entry DEPENDENCY_UNAVAILABLE (a
    // revision of the superseded version must not be reinterpreted against the successor,
    // BE03b "schema migration needs its own immutable chain") and, for a restore, the typed
    // migration_chain_mismatch (the supplied chain no longer matches the successor) are the
    // typed refusals.
    const refusal = kit.errorMessage(writerOutcome);
    check(
      writerOutcome.code !== 0 &&
        [
          'CONFLICT',
          'VALIDATION_FAILED',
          'DEPENDENCY_UNAVAILABLE',
          'migration_chain_mismatch',
        ].includes(refusal),
      `S2 ${op}/${path}: once the activation committed the writer was refused with a typed error and committed nothing (${refusalOf(writerOutcome)})`,
    );
    check(
      writerRows() === snapshot,
      `S2 ${op}/${path}: the refused writer committed no entry, revision, value, relation, conflict, outbox or audit row of its own`,
    );
  }

  // ------------------------------------------------------------- S4 ----
  const helperGuards =
    "set deadlock_timeout = '600s'; set lock_timeout = '30s';";
  for (const scenario of scenarios.filter(
    (s) => s.direction === 'legacy-writer',
  )) {
    const { op, write, ids } = scenario;
    const before = kit.revisionTotal();
    await kit.closeGate(WRITER_GATE);
    const writer = kit.startReserveGatedWrite(ids, write, WRITER_GATE);
    await kit.waitParked(writer.app);
    const helperApp = `s10race-legacy-activation-${op}`;
    const helper = kit.runAsync(
      helperApp,
      `${helperGuards} begin; select 1 from platform_private.cms_content_type_versions where id = ${sql(scenario.sourceVersionId)}::uuid for update; select 1 from identity_private.membership_tenure where organization_id = ${sql(world.org)}::uuid order by id for update; commit;`,
    );
    check(
      (await kit.blockedOrCompleted(helperApp, helper)) === 'blocked',
      `S4 ${op}: the legacy-order helper holds the version row and blocks on the authority rows behind the parked writer`,
    );
    await kit.openGate(WRITER_GATE);
    const [writerOutcome, helperOutcome] = await Promise.all([
      writer.session.done,
      helper.done,
    ]);
    check(
      writerOutcome.code !== 0 &&
        kit.errorMessage(writerOutcome) === 'CONFLICT' &&
        !chain.isDeadlock(writerOutcome),
      `S4 ${op}: the writer the deadlock detector aborted answers the typed retryable CONFLICT, not a raw 40P01 (${refusalOf(writerOutcome)})`,
    );
    check(
      helperOutcome.code === 0 && kit.revisionTotal() === before,
      'S4 ' +
        op +
        ': the helper completed and the aborted writer committed nothing',
    );
    const retry = await kit.runAsync(
      `s10race-retry-${op}`,
      kit.commandScript(ids, write.fn, write.request, write.who),
    ).done;
    check(
      retry.code === 0 && kit.revisionTotal() === before + 1,
      `S4 ${op}: the same command retried with the same idempotency key commits exactly one revision (${kit.errorMessage(retry) ?? 'no error'})`,
    );
  }
  for (const scenario of scenarios.filter(
    (s) => s.direction === 'legacy-activation',
  )) {
    const { path, candidate } = scenario;
    chain.bindOwner(world);
    await kit.closeGate(ACTIVATION_GATE);
    const helperApp = `s10race-legacy-writer-${path}`;
    const helper = kit.runAsync(
      helperApp,
      `${helperGuards} begin; select 1 from platform_private.cms_content_type_versions where id = ${sql(candidate.sourceVersionId)}::uuid for share; select pg_catalog.pg_advisory_xact_lock_shared(${ACTIVATION_GATE}); select 1 from identity_private.membership_tenure where organization_id = ${sql(world.org)}::uuid order by id for share; commit;`,
    );
    await kit.waitParked(helperApp);
    const activationApp = `s10race-act-legacy-${path}`;
    // The victim's own detector must fire after the cycle forms: its timeout is longer
    // than the harness needs to open the gate.
    const activation = kit.runAsync(
      activationApp,
      `set deadlock_timeout = '3s'; ${chain.activationScript(world, path, candidate)}`,
    );
    check(
      (await kit.blockedOrCompleted(activationApp, activation)) === 'blocked',
      `S4 ${path}: the ${path} activation blocks on the active version row held shared by the legacy-order helper`,
    );
    await kit.openGate(ACTIVATION_GATE);
    const [activationOutcome, helperOutcome] = await Promise.all([
      activation.done,
      helper.done,
    ]);
    check(
      activationOutcome.code !== 0 &&
        kit.errorMessage(activationOutcome) === 'CONFLICT' &&
        !chain.isDeadlock(activationOutcome),
      `S4 ${path}: the ${path} activation the deadlock detector aborted answers the typed retryable CONFLICT, not a raw 40P01 (${refusalOf(activationOutcome)})`,
    );
    check(
      helperOutcome.code === 0 &&
        versionState(candidate.sourceVersionId) === 'active' &&
        versionState(candidate.candidateVersionId) === 'approved',
      `S4 ${path}: the helper completed and the aborted activation switched nothing`,
    );
    chain.bindOwner(world);
    const retry = await kit.runAsync(
      `s10race-act-retry-${path}`,
      chain.activationScript(world, path, candidate),
    ).done;
    check(
      retry.code === 0 &&
        versionState(candidate.candidateVersionId) === 'active',
      `S4 ${path}: the ${path} activation retried commits (${kit.errorMessage(retry) ?? 'no error'})`,
    );
  }

  // ------------------------------------------------------------- S3 ----
  {
    const scenario = scenarios.find((s) => s.direction === 'guard');
    const { candidate } = scenario;
    chain.bindOwner(world);
    await kit.closeGate(ACTIVATION_GATE);
    const activationApp = 's10race-hold-act-guard';
    const activation = kit.runAsync(
      activationApp,
      chain.activationScript(world, 'human', candidate, ACTIVATION_GATE),
    );
    await kit.waitParked(activationApp);
    const guardApp = 's10race-guard-probe';
    const guardProbe = kit.runAsync(
      guardApp,
      `begin; select set_config('app.cms_rpc', 'true', true); insert into platform_private.cms_entry_revisions(id, owner_id, entry_id, revision_number, schema_version_id, template_version_id, taxonomy_version_ids, parent_revision_ids, locale, payload_hash, author_person_id, acting_party_id, state, version, validation_state, validation_report, created_at, updated_at) select extensions.gen_random_uuid(), source.owner_id, source.entry_id, 9999, source.schema_version_id, source.template_version_id, source.taxonomy_version_ids, source.parent_revision_ids, source.locale, source.payload_hash, source.author_person_id, source.acting_party_id, source.state, 1, source.validation_state, source.validation_report, now(), now() from platform_private.cms_entry_revisions source where source.schema_version_id = ${sql(candidate.sourceVersionId)}::uuid limit 1; commit;`,
    );
    check(
      (await kit.blockedOrCompleted(guardApp, guardProbe)) === 'blocked',
      'S3: a bare revision insert on the version blocks behind the in-flight real activation at the insert-time guard',
    );
    await kit.openGate(ACTIVATION_GATE);
    const [activationOutcome, guardOutcome] = await Promise.all([
      activation.done,
      guardProbe.done,
    ]);
    check(
      activationOutcome.code === 0 &&
        versionState(candidate.candidateVersionId) === 'active',
      `S3: the in-flight activation committed (${kit.errorMessage(activationOutcome) ?? 'no error'})`,
    );
    check(
      guardOutcome.code !== 0 &&
        kit.errorMessage(guardOutcome) === 'CONFLICT' &&
        /cms_entry_version_lock_guard/u.test(guardOutcome.stderr),
      `S3: once the activation committed the waiting insert was refused with CONFLICT by the version-lock guard (${kit.errorMessage(guardOutcome) ?? 'no error'})`,
    );
  }
  console.log(
    '# all activation-serialization race assertions passed; run `pnpm db:reset` before the pgTAP suite',
  );
} finally {
  await kit.openAllGates();
}
