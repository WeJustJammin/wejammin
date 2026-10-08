/**
 * Shared kit of the Slice 10 independent-session race runners
 * (supabase/tests/phase_02_slice_10_races/*.mjs).  Every call is a fresh `psql`
 * process inside the disposable local Supabase database container, so a lock or
 * ordering guarantee is proven across real committed PostgreSQL sessions, which a
 * single-transaction pgTAP file cannot do.  Run only against the disposable local
 * database right after `pnpm db:reset` (the gate in infra/run-database-race-runners.mjs
 * resets before each runner and once more at the end).
 *
 * Deterministic pausing.  A writer is held between its validation and its first
 * revision insert by the gate trigger this kit installs (`installGateTrigger`): a
 * BEFORE INSERT trigger on cms_entry_revisions, named so it fires before the
 * Slice 09 version-lock guard, that blocks on a shared advisory lock when the
 * session's application_name is `s10race-gated-<gateKey>-<label>`.  A gate is
 * "closed" while a holder session owns the exclusive advisory lock of its key
 * (`closeGate`) and "opened" by terminating that holder (`openGate`).  The trigger
 * is a test probe only: it writes nothing and claims no producer path, exactly like
 * the explicit row-lock probes of the Slice 09 race runner.
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const container =
  process.env.S10_RACE_DB_CONTAINER ??
  process.env.AC217_DB_CONTAINER ??
  'supabase_db_wejammin';
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..',
);
export const testsDir = join(repositoryRoot, 'supabase/tests');

export const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
export const jsonb = (value) => `${sql(JSON.stringify(value))}::jsonb`;
export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export const check = (condition, message) => {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`ok - ${message}`);
};

const psqlArgs = (appName, args) => [
  'exec',
  '-i',
  '-e',
  `PGAPPNAME=${appName}`,
  container,
  'psql',
  '-X',
  '-v',
  'ON_ERROR_STOP=1',
  '-U',
  'postgres',
  '-d',
  'postgres',
  ...args,
];

/** Runs a whole script (stdin) in one session; returns the last `{`-prefixed output line. */
export const runScript = (script, appName = 's10race-setup') => {
  const result = spawnSync('docker', psqlArgs(appName, ['-At', '-f', '-']), {
    input: script,
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `setup failed: ${(result.stderr || result.error?.message || '').split('\n').slice(-12).join(' | ')}`,
    );
  }
  return result.stdout
    .trim()
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .at(-1);
};

/** One statement in a fresh session; returns its last output line. Throws on error. */
export const runValue = (statement, appName = 's10race-probe') => {
  const result = spawnSync(
    'docker',
    psqlArgs(appName, ['-At', '-c', statement]),
    {
      encoding: 'utf8',
      timeout: 60_000,
    },
  );
  if (result.error || result.status !== 0) {
    throw new Error(`probe failed: ${result.stderr || result.error?.message}`);
  }
  return result.stdout.trim().split('\n').filter(Boolean).at(-1) ?? '';
};

/** One statement in a fresh session; never throws: { code, stdout, stderr }. */
export const runCapture = (statement, appName = 's10race-probe') => {
  const result = spawnSync(
    'docker',
    psqlArgs(appName, ['-At', '-c', statement]),
    {
      encoding: 'utf8',
      timeout: 60_000,
    },
  );
  return {
    code: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
};

/** A session running in the background: `done` resolves { code, stdout, stderr }. */
export const runAsync = (appName, script) => {
  const child = spawn('docker', psqlArgs(appName, ['-At', '-c', script]));
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const state = { settled: false };
  const done = new Promise((resolveDone) => {
    child.on('close', (code) => {
      state.settled = true;
      resolveDone({ code, stdout, stderr });
    });
  });
  return { done, state };
};

export const waitFor = async (description, probe, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (probe()) return;
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${description}`);
};

/** `wait_event_type:wait_event` of the (single) active backend of an application, or 'none'. */
export const waitEvent = (appName) =>
  runValue(
    `select coalesce(wait_event_type || ':' || wait_event, 'none') from pg_stat_activity where application_name = ${sql(appName)} and state = 'active' and pid <> pg_backend_pid() limit 1;`,
  );

/** True once the application's backend is waiting on a heavyweight lock. */
export const isLockWaiting = (appName) =>
  waitEvent(appName).startsWith('Lock:');

/**
 * Resolves 'blocked' when the session is observed waiting on a lock, or 'completed'
 * when it finished first (never blocked), within the window.
 */
export const blockedOrCompleted = async (
  appName,
  session,
  windowMs = 6_000,
) => {
  const deadline = Date.now() + windowMs;
  while (Date.now() < deadline) {
    if (session.state.settled) return 'completed';
    if (isLockWaiting(appName)) return 'blocked';
    await sleep(150);
  }
  return session.state.settled ? 'completed' : 'running';
};

// ------------------------------------------------------------- gate probes ----
/**
 * Installs the gate triggers (see the file header): `s10race-gated-<key>-<label>`
 * sessions park before their first revision insert, `s10race-reserve-<key>-<label>`
 * sessions park before their idempotency reservation insert (right after the entry
 * lock and the capability check, before any value or relation work).
 */
export const installGateTrigger = () =>
  runScript(
    `
create or replace function public.s10race_gate() returns trigger
language plpgsql security definer set search_path = ''
as $f$
declare
  app text := pg_catalog.current_setting('application_name', true);
begin
  if (tg_table_name = 'cms_entry_revisions' and app like 's10race-gated-%')
     or (tg_table_name = 'idempotency_records' and app like 's10race-reserve-%') then
    perform pg_catalog.pg_advisory_xact_lock_shared(
      pg_catalog.split_part(app, '-', 3)::bigint);
  end if;
  return new;
end;
$f$;
revoke all on function public.s10race_gate() from public;
grant execute on function public.s10race_gate() to public;
drop trigger if exists cms_entry_revisions_0_s10race_gate on platform_private.cms_entry_revisions;
create trigger cms_entry_revisions_0_s10race_gate
  before insert on platform_private.cms_entry_revisions
  for each row execute function public.s10race_gate();
drop trigger if exists idempotency_records_0_s10race_gate on platform_private.idempotency_records;
create trigger idempotency_records_0_s10race_gate
  before insert on platform_private.idempotency_records
  for each row execute function public.s10race_gate();
select '{}';
`,
    's10race-gate-install',
  );

const gateHolders = new Map();
/** Closes the gate of one key: a holder session takes the exclusive advisory lock. */
export const closeGate = async (key) => {
  const holder = runAsync(
    `s10race-gateholder-${key}`,
    `select pg_catalog.pg_advisory_lock(${key}); select pg_catalog.pg_sleep(900);`,
  );
  gateHolders.set(key, holder);
  await waitFor(
    `gate ${key} to close`,
    () => waitEvent(`s10race-gateholder-${key}`) === 'Timeout:PgSleep',
  );
};
/** Opens the gate: terminates the holder so every waiting writer proceeds. */
export const openGate = async (key) => {
  runValue(
    `select count(pg_catalog.pg_terminate_backend(pid)) from pg_stat_activity where application_name = ${sql(`s10race-gateholder-${key}`)};`,
  );
  const holder = gateHolders.get(key);
  if (holder) await holder.done;
  gateHolders.delete(key);
};
/** Opens every gate still closed (cleanup in `finally`). */
export const openAllGates = async () => {
  for (const key of [...gateHolders.keys()]) await openGate(key);
};
/** Waits until the writer session is parked on the gate (advisory lock wait). */
export const waitParked = (appName) =>
  waitFor(
    `${appName} to park on its gate`,
    () => waitEvent(appName) === 'Lock:advisory',
  );

// --------------------------------------------------------------- fixtures ----
const fragment = (relative) => readFileSync(join(testsDir, relative), 'utf8');

/**
 * Builds the committed fixture every Slice 10 race uses, through the same fragments
 * the pgTAP suites include: the 001 identity/organization/article fixture (creator
 * with cms.author + cms.editor, editor with cms.editor, outsider with none), the
 * relation fixture (type s10relation, article targets T1..T4) and the restore policy
 * binding.  Returns the ids the runners need.
 */
export const buildFixture = () => {
  runScript(
    "create extension if not exists pgtap with schema extensions;\nselect '{}';",
    's10race-setup-ext',
  );
  const script = [
    '\\set ON_ERROR_STOP on',
    fragment('support/jwt-claims.sqlinc'),
    'begin;',
    'select no_plan();',
    fragment('phase_02_slice_10_rpc/000-helpers.sqlinc'),
    fragment('phase_02_slice_10_rpc/001-fixtures.sqlinc'),
    fragment(
      'phase_02_slice_10_relation_authoring/000-relation-fixture.sqlinc',
    ),
    fragment('phase_02_slice_10_rpc/009-restore-policy-binding.sqlinc'),
    `select jsonb_build_object(
       'organization', (select value from s10_ids where key = 'organization'),
       'creatorAuth', (select value from s10_ids where key = 'creatorAuth'),
       'creatorPerson', (select value from s10_ids where key = 'creatorPerson'),
       'editorAuth', (select value from s10_ids where key = 'editorAuth'),
       'editorPerson', (select value from s10_ids where key = 'editorPerson'),
       'articleTypeId', (select value from s10_ids where key = 'typeId'),
       'articleVersionId', (select value from s10_ids where key = 'draftVersionId'),
       'typeId', (select value from s10r_ids where key = 'typeId'),
       'versionId', (select value from s10r_ids where key = 'versionId'),
       'artifactId', (select value from s10r_ids where key = 'artifactId'),
       'artifactHash', (select value from s10r_ids where key = 'artifactHash'),
       'compiler', (select value from s10r_ids where key = 'compiler'),
       'zodRef', (select value from s10r_ids where key = 'zodRef'))::text;`,
    'commit;',
  ].join('\n');
  return JSON.parse(runScript(script));
};

/**
 * The stable id of the entry type's title field.  The 001 relation fixture pins
 * FIELD.title; a type built through the real Slice 09 producer chain (chain-kit.mjs)
 * has a server-generated one, carried on its ids as `titleField`.
 */
export const titleField = (ids) => ids.titleField ?? FIELD.title;

export const FIELD = {
  title: 'a9100000-0000-4000-8000-000000000d21',
  related: 'a9100000-0000-4000-8000-000000000d22',
  primary: 'a9100000-0000-4000-8000-000000000d23',
  people: 'a9100000-0000-4000-8000-000000000d24',
};
/** Article targets seeded by the relation fixture (T1 is the 001 fixture entry). */
export const TARGET = {
  t1: 'a9100000-0000-4000-8000-000000000301',
  t2: 'a9100000-0000-4000-8000-000000000321',
  t3: 'a9100000-0000-4000-8000-000000000331',
  t4: 'a9100000-0000-4000-8000-000000000341',
};

/** The session settings every command session runs under (what the Worker publishes). */
export const actorSettings = (ids, who = 'creator') => {
  const auth = who === 'creator' ? ids.creatorAuth : ids.editorAuth;
  const person = who === 'creator' ? ids.creatorPerson : ids.editorPerson;
  return `select
    set_config('request.jwt.claims', ${sql(JSON.stringify({ role: 'authenticated', sub: auth }))}, true),
    set_config('app.auth_user_id', ${sql(auth)}, true),
    set_config('app.actor_auth_user_id', ${sql(auth)}, true),
    set_config('app.actor_person_id', ${sql(person)}, true),
    set_config('app.acting_party_id', ${sql(ids.organization)}, true),
    set_config('app.acting_context_id', '', true);`;
};

const context = (ids) => ({
  actingPartyId: ids.organization,
  actingContextId: 'a9100000-0000-4000-8000-000000000094',
  correlationId: 'a9100000-0000-4000-8000-000000000095',
});

export const createRequest = (ids, values, key) => ({
  contentTypeId: ids.typeId,
  contentTypeVersionId: ids.versionId,
  locale: 'en-US',
  changedPaths: Object.keys(values).map((field) => `/fields/${field}`),
  values,
  schemaArtifact: {
    id: ids.artifactId,
    contentTypeVersionId: ids.versionId,
    artifactHash: ids.artifactHash,
    compilerVersion: ids.compiler,
    zodContractRef: ids.zodRef,
  },
  validatorRefs: [],
  // A real producer-chain type carries its own evidence; the relation fixture's
  // direct-write activation is matched by the forged evidence below.
  workflowPolicy: ids.workflowPolicy ?? {
    key: 'editorial',
    version: '1',
    policyHash: 'c'.repeat(64),
    riskClass: 'ordinary',
    requiredDecisionCount: 1,
    requiredCapabilities: ['cms.author'],
    approvalEvidenceHash: 'd'.repeat(64),
  },
  activationEvidence: ids.activationEvidence ?? {
    key: 'cms.entry.author',
    version: '1',
    policyHash: 'a'.repeat(64),
    riskClass: 'ordinary',
    requiredDecisionCount: 1,
    requiredCapabilities: ['cms.author'],
    approvalEvidenceHash: 'b'.repeat(64),
  },
  idempotencyKey: key,
  context: context(ids),
});

export const revisionRequest = (ids, entryId, values, base, expected, key) => ({
  entryId,
  baseRevision: String(base),
  changedPaths: Object.keys(values).map((field) => `/fields/${field}`),
  values,
  locale: 'en-US',
  expectedVersion: String(expected),
  ifMatch: String(expected),
  idempotencyKey: key,
  context: context(ids),
});

export const relation = (...targets) => ({
  targets: targets.map((target) =>
    typeof target === 'string'
      ? { targetId: target }
      : { targetId: target.id, expectedTargetVersion: target.pin },
  ),
});

/** `begin; <settings> select platform_api.<fn>(<request>); commit;` for one actor. */
export const commandScript = (ids, functionName, request, who = 'creator') =>
  `begin; ${actorSettings(ids, who)} select platform_api.${functionName}(${jsonb(request)}); commit;`;

/** Runs a command to completion in its own session; returns the parsed response or throws. */
export const callCommand = (ids, functionName, request, who = 'creator') => {
  const result = runCapture(
    commandScript(ids, functionName, request, who),
    's10race-direct',
  );
  if (result.code !== 0) {
    throw new Error(
      `${functionName} failed: ${result.stderr.trim().split('\n').slice(0, 2).join(' ')}`,
    );
  }
  const line = result.stdout
    .split('\n')
    .filter(
      (candidate) => candidate.startsWith('{') && !candidate.includes('|'),
    )
    .at(-1);
  return JSON.parse(line);
};

/** The contract message of a failed session (`ERROR:  <message>`), or null. */
export const errorMessage = (outcome) => {
  const match = /ERROR:\s+([^\n]*)/u.exec(outcome.stderr ?? '');
  return match ? match[1].trim() : null;
};

/** The migration-chain id of a zero-edge (same schema) restore of an entry's type. */
export const zeroEdgeChainId = (ids) =>
  runValue(
    `select platform_private.cms_restore_chain_manifest_id(platform_private.cms_restore_chain_derive(${sql(ids.typeId)}::uuid, ${sql(ids.versionId)}::uuid, ${sql(ids.versionId)}::uuid)->>'hash');`,
  );

export const restoreRequest = (ids, entryId, revisionId, expected, key) => ({
  entryId,
  revisionId,
  migrationChainId: zeroEdgeChainId(ids),
  expectedVersion: String(expected),
  idempotencyKey: key,
  context: context(ids),
});

let sequence = 0;
/** A fresh idempotency key. */
export const nextKey = (label) =>
  `s10race-${label}-${String((sequence += 1)).padStart(4, '0')}`;

/** Creates an entry (real cms_create_entry, committed) with a title; returns { entryId, revisionId }. */
export const makeEntry = (ids, title = 'Race entry', extraValues = {}) => {
  const response = callCommand(
    ids,
    'cms_create_entry',
    createRequest(
      ids,
      { [titleField(ids)]: title, ...extraValues },
      nextKey('create'),
    ),
  );
  return {
    entryId: response.entry.id,
    revisionId: response.revision.id,
    version: 1,
  };
};

/** Appends a title revision (real cms_create_revision); returns the new entry version. */
export const appendTitle = (ids, entry, title, base, expected) => {
  callCommand(
    ids,
    'cms_create_revision',
    revisionRequest(
      ids,
      entry.entryId,
      { [titleField(ids)]: title },
      base,
      expected,
      nextKey('append'),
    ),
  );
  return expected + 1;
};

/** The entry's (version, current draft revision number) read by a probe session. */
export const entryState = (entryId) => {
  const [version, revisions, current] = runValue(
    `select entry.version::text || ',' || (select count(*) from platform_private.cms_entry_revisions r where r.entry_id = entry.id)::text || ',' || coalesce(entry.current_draft_revision_id::text, '') from platform_private.cms_content_entries entry where entry.id = ${sql(entryId)}::uuid;`,
  ).split(',');
  return { version: Number(version), revisions: Number(revisions), current };
};

export const revisionCount = (entryId) => entryState(entryId).revisions;

/** Row-count fingerprint across every table a write command touches. */
export const counts = () =>
  runValue(`select (select count(*) from platform_private.cms_content_entries)::text || '/'
    || (select count(*) from platform_private.cms_entry_revisions)::text || '/'
    || (select count(*) from platform_private.cms_entry_field_values)::text || '/'
    || (select count(*) from platform_private.cms_entry_relations)::text || '/'
    || (select count(*) from platform_private.cms_conflict_records)::text || '/'
    || (select count(*) from platform_private.idempotency_records)::text || '/'
    || (select count(*) from platform_private.outbox_events)::text || '/'
    || (select count(*) from audit_private.audit_events)::text;`);

// ---------------------------------------------------------- write operations ----
/** The four editorial commands that create a revision. */
export const WRITE_OPS = ['create', 'append', 'resolve', 'restore'];

export const revisionTotal = () =>
  Number(
    runValue('select count(*) from platform_private.cms_entry_revisions;'),
  );

/** The id of the entry's open conflict (null when none). */
export const openConflictId = (entryId) =>
  runValue(
    `select coalesce((select id::text from platform_private.cms_conflict_records where entry_id = ${sql(entryId)}::uuid and state = 'open'), '');`,
  ) || null;

/**
 * Prepares one write of each kind against fresh committed state and returns
 * { op, fn, request, entryId, who } ready to run (nothing of the write is committed):
 *   create   a new entry of the relation type;
 *   append   a title revision on a fresh entry at version 1;
 *   resolve  an explicit `theirs` resolution of a real open conflict (a stale
 *            append over a moved title) at entry version 2;
 *   restore  a zero-edge restore of revision 1 of a fresh entry at version 2.
 * `extra` adds relation values to create / append (field id -> relation value);
 * `carried` seeds the entry with values (for example a relation) that the write then
 * CARRIES unchanged from the current draft.
 */
export const prepareWrite = (ids, op, extra = {}, carried = {}) => {
  if (op === 'create') {
    return {
      op,
      fn: 'cms_create_entry',
      request: createRequest(
        ids,
        { [titleField(ids)]: 'Gated create', ...extra },
        nextKey('gate-create'),
      ),
      entryId: null,
      who: 'creator',
    };
  }
  const entry = makeEntry(ids, 'Seed title', carried);
  if (op === 'append') {
    return {
      op,
      fn: 'cms_create_revision',
      request: revisionRequest(
        ids,
        entry.entryId,
        { [titleField(ids)]: 'Gated append', ...extra },
        1,
        1,
        nextKey('gate-append'),
      ),
      entryId: entry.entryId,
      who: 'creator',
    };
  }
  appendTitle(ids, entry, 'Theirs title', 1, 1);
  if (op === 'restore') {
    return {
      op,
      fn: 'cms_restore_revision',
      request: restoreRequest(
        ids,
        entry.entryId,
        entry.revisionId,
        2,
        nextKey('gate-restore'),
      ),
      entryId: entry.entryId,
      who: 'creator',
    };
  }
  // resolve: a stale append over the moved title records the open conflict.
  const stale = callCommand(
    ids,
    'cms_create_revision',
    revisionRequest(
      ids,
      entry.entryId,
      { [titleField(ids)]: 'Yours title' },
      1,
      2,
      nextKey('gate-stale'),
    ),
  );
  if (stale.kind !== 'conflict')
    throw new Error('expected a recorded conflict');
  return {
    op,
    fn: 'cms_resolve_conflict',
    request: {
      entryId: entry.entryId,
      conflictId: openConflictId(entry.entryId),
      baseRevision: '1',
      choices: [{ path: `/fields/${titleField(ids)}`, choice: 'theirs' }],
      expectedVersion: '2',
      ifMatch: '2',
      idempotencyKey: nextKey('gate-resolve'),
      context: context(ids),
    },
    entryId: entry.entryId,
    who: 'creator',
  };
};

/** The session of a prepared write, gated at its first revision insert (see header). */
export const startGatedWrite = (ids, write, gateKey) => {
  const app = `s10race-gated-${gateKey}-${write.op}`;
  return {
    app,
    session: runAsync(
      app,
      commandScript(ids, write.fn, write.request, write.who),
    ),
  };
};

/**
 * The session of a prepared write, gated at its idempotency reservation (see header):
 * it parks right after the entry lock and the authority locks and BEFORE the version
 * lock, the window in which a writer holds the authority rows a schema activation
 * also locks.
 */
export const startReserveGatedWrite = (ids, write, gateKey) => {
  const app = `s10race-reserve-${gateKey}-${write.op}`;
  return {
    app,
    session: runAsync(
      app,
      commandScript(ids, write.fn, write.request, write.who),
    ),
  };
};

// ------------------------------------------------------ authority revokers ----
/**
 * The committed ways authority is lost (the three revocation seams of
 * 20261005010600 / 20261005011300): the person's actor grant, the confirmed
 * membership tenure, and the entry assignment.  `apply` is the revoking SQL,
 * `restore` puts the authority back so the next scenario starts from it.
 */
export const REVOKERS = {
  grant: {
    appliesTo: () => true,
    apply: (ids) =>
      `update identity_private.organization_actor_grant set active = false, updated_at = clock_timestamp() where organization_id = ${sql(ids.organization)}::uuid and person_id = ${sql(ids.creatorPerson)}::uuid and capability_code in ('cms.author', 'cms.editor');`,
    restore: (ids) =>
      `update identity_private.organization_actor_grant set active = true, updated_at = clock_timestamp() where organization_id = ${sql(ids.organization)}::uuid and person_id = ${sql(ids.creatorPerson)}::uuid and capability_code in ('cms.author', 'cms.editor');`,
    revoked: (ids) =>
      `select count(*) = 0 from identity_private.organization_actor_grant where organization_id = ${sql(ids.organization)}::uuid and person_id = ${sql(ids.creatorPerson)}::uuid and capability_code = 'cms.author' and active;`,
  },
  tenure: {
    appliesTo: () => true,
    apply: (ids) =>
      `update identity_private.membership_tenure set state = 'ended', revoked_at = clock_timestamp(), updated_at = clock_timestamp() where organization_id = ${sql(ids.organization)}::uuid and person_id = ${sql(ids.creatorPerson)}::uuid;`,
    restore: (ids) =>
      `update identity_private.membership_tenure set state = 'confirmed', revoked_at = null, updated_at = clock_timestamp() where organization_id = ${sql(ids.organization)}::uuid and person_id = ${sql(ids.creatorPerson)}::uuid;`,
    revoked: (ids) =>
      `select count(*) = 0 from identity_private.membership_tenure where organization_id = ${sql(ids.organization)}::uuid and person_id = ${sql(ids.creatorPerson)}::uuid and state = 'confirmed';`,
  },
  assignment: {
    appliesTo: (write) => write.entryId !== null,
    apply: (ids, write) =>
      `update platform_private.cms_entry_assignments set state = 'revoked', version = version + 1, updated_at = clock_timestamp() where entry_id = ${sql(write.entryId)}::uuid and assignee_person_id = ${sql(ids.creatorPerson)}::uuid;`,
    restore: (ids, write) =>
      `update platform_private.cms_entry_assignments set state = 'active', updated_at = clock_timestamp() where entry_id = ${sql(write.entryId)}::uuid and assignee_person_id = ${sql(ids.creatorPerson)}::uuid;`,
    revoked: (ids, write) =>
      `select count(*) = 0 from platform_private.cms_entry_assignments where entry_id = ${sql(write.entryId)}::uuid and assignee_person_id = ${sql(ids.creatorPerson)}::uuid and state = 'active';`,
  },
};

/** The revoking transaction; `holdGate` keeps it open (row locks held) until that gate opens. */
export const revokerScript = (sqlText, holdGate = null) =>
  `begin; select set_config('app.cms_rpc', 'true', true); ${sqlText} ${
    holdGate === null
      ? ''
      : `select pg_catalog.pg_advisory_xact_lock_shared(${holdGate});`
  } commit;`;

/** Puts a revoked authority back (direct committed update in a probe session). */
export const restoreAuthority = (revoker, ids, write) =>
  runValue(
    `begin; select set_config('app.cms_rpc', 'true', true); ${revoker.restore(ids, write)} commit; select 'restored';`,
  );

// ------------------------------------------------------- relation fixtures ----
/**
 * Seeds one article entry (the relation target type) with a draft revision and, when
 * `assign`, the creator's cms.author assignment: the committed equivalent of the
 * relation fixture's `s10r_seed_article`.  Returns its id.
 */
export const seedArticleTarget = (ids, { assign = true } = {}) => {
  const entry = randomUUID();
  const revision = randomUUID();
  runValue(`begin; select set_config('app.cms_rpc', 'true', true);
    insert into platform_private.cms_content_entries(id, owner_id, content_type_id, owner_party_id, lifecycle, current_draft_revision_id, version, created_by, created_at, updated_at)
    values (${sql(entry)}::uuid, ${sql(ids.organization)}::uuid, ${sql(ids.articleTypeId)}::uuid, ${sql(ids.organization)}::uuid, 'active', null, 1, ${sql(ids.creatorAuth)}::uuid, now(), now());
    insert into platform_private.cms_entry_revisions(id, owner_id, entry_id, revision_number, schema_version_id, template_version_id, taxonomy_version_ids, parent_revision_ids, locale, payload_hash, author_person_id, acting_party_id, state, version, validation_state, validation_report, created_at, updated_at)
    values (${sql(revision)}::uuid, ${sql(ids.organization)}::uuid, ${sql(entry)}::uuid, 1, ${sql(ids.articleVersionId)}::uuid, null, '[]'::jsonb, '[]'::jsonb, 'en-US', platform_private.cms_jcs_sha256('{}'::jsonb)::char(64), ${sql(ids.creatorPerson)}::uuid, ${sql(ids.organization)}::uuid, 'draft', 1, 'valid', '{}'::jsonb, now(), now());
    update platform_private.cms_content_entries set current_draft_revision_id = ${sql(revision)}::uuid where id = ${sql(entry)}::uuid;
    ${
      assign
        ? `insert into platform_private.cms_entry_assignments(owner_id, entry_id, assignee_person_id, capability_key, state, version, created_at, updated_at) values (${sql(ids.organization)}::uuid, ${sql(entry)}::uuid, ${sql(ids.creatorPerson)}::uuid, 'cms.author', 'active', 1, now(), now());`
        : ''
    }
    commit; select 'seeded';`);
  return entry;
};

/** The entry's current version number (probe session). */
export const entryVersion = (entryId) => entryState(entryId).version;

/**
 * Target mutators of a relation target: what the target's own writers and lifecycle
 * and authority changes do to the rows a relation write depends on.
 */
export const TARGET_MUTATORS = {
  bump: {
    apply: (ids, target) =>
      `update platform_private.cms_content_entries set version = version + 1, updated_at = clock_timestamp() where id = ${sql(target)}::uuid;`,
  },
  archive: {
    apply: (ids, target) =>
      `update platform_private.cms_content_entries set lifecycle = 'archived', updated_at = clock_timestamp() where id = ${sql(target)}::uuid;`,
  },
  unassign: {
    apply: (ids, target) =>
      `update platform_private.cms_entry_assignments set state = 'revoked', version = version + 1, updated_at = clock_timestamp() where entry_id = ${sql(target)}::uuid and assignee_person_id = ${sql(ids.creatorPerson)}::uuid;`,
  },
};

/**
 * Like prepareWrite, but the write sets the relation field `related` to one external
 * article target pinned at its current version (`target`): create / append set it,
 * resolve resolves a real open conflict over it with an explicit relation value.
 */
export const prepareRelationWrite = (ids, op, target) => {
  const pinned = relation({ id: target, pin: String(entryVersion(target)) });
  if (op === 'create' || op === 'append') {
    return prepareWrite(ids, op, { [FIELD.related]: pinned });
  }
  throw new Error('relation resolve is prepared by prepareRelationResolve');
};

/** An open conflict over `related` (base [a], theirs [b], yours [c]) resolved to the pinned target. */
export const prepareRelationResolve = (ids, target) => {
  const [a, b, c] = [
    seedArticleTarget(ids),
    seedArticleTarget(ids),
    seedArticleTarget(ids),
  ];
  const entry = makeEntry(ids, 'Relation seed', {
    [FIELD.related]: relation(a),
  });
  callCommand(
    ids,
    'cms_create_revision',
    revisionRequest(
      ids,
      entry.entryId,
      { [FIELD.related]: relation(b) },
      1,
      1,
      nextKey('rel-theirs'),
    ),
  );
  const stale = callCommand(
    ids,
    'cms_create_revision',
    revisionRequest(
      ids,
      entry.entryId,
      { [FIELD.related]: relation(c) },
      1,
      2,
      nextKey('rel-stale'),
    ),
  );
  if (stale.kind !== 'conflict')
    throw new Error('expected a recorded relation conflict');
  return {
    op: 'resolve',
    fn: 'cms_resolve_conflict',
    request: {
      entryId: entry.entryId,
      conflictId: openConflictId(entry.entryId),
      baseRevision: '1',
      choices: [
        {
          path: `/fields/${FIELD.related}`,
          choice: 'explicit',
          value: relation({ id: target, pin: String(entryVersion(target)) }),
        },
      ],
      expectedVersion: '2',
      ifMatch: '2',
      idempotencyKey: nextKey('rel-resolve'),
      context: context(ids),
    },
    entryId: entry.entryId,
    who: 'creator',
  };
};
