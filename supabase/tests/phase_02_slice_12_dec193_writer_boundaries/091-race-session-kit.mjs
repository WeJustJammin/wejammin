/** TEST ONLY: owned independent psql clients; no top-level database work. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertCanonicalTarget,
  assertRaceCheckout,
  canonicalContainer,
  isCanonicalRace,
} from '../../../infra/database-races/canonical-mode.mjs';

export const root = realpathSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../..'),
);
export const testsDir = join(root, 'supabase/tests');
// ALT mode (root release): the resettable ALT container. Canonical mode
// (WEJAMMIN_CANONICAL_RACE=1, set by the db:verify race gate): the container the Slice 10
// and 11 runners use.
export const container = isCanonicalRace()
  ? canonicalContainer()
  : 'supabase_db_wejammin_ev';
export const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
export const jsonb = (value) => `${sql(JSON.stringify(value))}::jsonb`;
const prefix = `s12wr-${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const sessions = [];
const cadence = () => new Promise((done) => setTimeout(done, 100));

export function assertTarget() {
  // DEC-225: the primary checkout is refused in ALT mode only (one rule, in the helper).
  assertRaceCheckout({ root });
  if (isCanonicalRace()) {
    assertCanonicalTarget({
      altEnvNames: [
        'S12_DEC193_WRITER_RACE_ROOT_RELEASE',
        'S12_DEC193_WRITER_RACE_ALT_CONTAINER',
      ],
    });
    return;
  }
  assert.equal(
    process.env.S12_DEC193_WRITER_RACE_ROOT_RELEASE,
    '2026-10-16-native-writer-red',
    'explicit root writer-race release required',
  );
  assert.equal(
    process.env.S12_DEC193_WRITER_RACE_ALT_CONTAINER,
    container,
    'only the explicit resettable ALT container is permitted',
  );
  if (process.env.S10_RACE_DB_CONTAINER !== undefined) {
    assert.equal(
      process.env.S10_RACE_DB_CONTAINER,
      container,
      'no target drift',
    );
  }
}

export function start(label, body, held = false, setup = false) {
  const app = `${prefix}-${sessions.length}-${label}`.slice(0, 63);
  const options = `-c statement_timeout=${setup ? 120000 : 20000} -c lock_timeout=15000 -c idle_in_transaction_session_timeout=30000`;
  const child = spawn('docker', [
    'exec',
    '-i',
    '-e',
    `PGAPPNAME=${app}`,
    '-e',
    'PGCONNECT_TIMEOUT=5',
    '-e',
    `PGOPTIONS=${options}`,
    container,
    'psql',
    '-X',
    '-q',
    '-At',
    '-v',
    'ON_ERROR_STOP=1',
    '-v',
    'VERBOSITY=verbose',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-f',
    '-',
  ]);
  const session = {
    app,
    child,
    held,
    pid: null,
    stdout: '',
    stderr: '',
    settled: false,
  };
  sessions.push(session);
  child.stdout.on('data', (chunk) => {
    session.stdout += chunk;
    const match = /owned-pid:(\d+)/u.exec(session.stdout);
    if (match) session.pid = Number(match[1]);
  });
  child.stderr.on('data', (chunk) => {
    session.stderr += chunk;
  });
  child.on('error', (error) => {
    session.stderr += error.message;
  });
  child.stdin.on('error', (error) => {
    session.stderr += error.message;
  });
  session.done = new Promise((done) =>
    child.once('close', (code) => {
      session.settled = true;
      done({ code, stdout: session.stdout, stderr: session.stderr });
    }),
  );
  child.stdin.write(
    `select 'owned-pid:' || pg_backend_pid();\n${body}\nselect 'ready:${app}';\n`,
  );
  if (!held) child.stdin.end();
  return session;
}

export async function until(label, predicate, participants = [], ms = 8000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    assert.ok(
      !participants.some((session) => session.settled),
      `${label}: owned participant completed before the required barrier`,
    );
    await cadence(); // Polling cadence, never the evidence for an ordering.
  }
  throw new Error(
    `ASSERTION FAILED: ${label}: database condition not observed`,
  );
}

export async function outcome(session, ms = 25000) {
  await until(`${session.app} completion`, () => session.settled, [], ms);
  return session.done;
}

export async function complete(session, ms) {
  const result = await outcome(session, ms);
  assert.equal(result.code, 0, result.stderr);
  assert.ok(
    !/^not ok\b/mu.test(result.stdout),
    'all fixture TAP prerequisites',
  );
  return result;
}

export async function ready(session) {
  await until(
    `${session.app} readiness`,
    () => session.stdout.includes(`ready:${session.app}`),
    [session],
  );
}

export const answer = (session) =>
  JSON.parse(
    session.stdout
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .at(-1),
  );

export async function query(body, setup = false) {
  const session = start('probe', body, false, setup);
  const result = await complete(session, setup ? 125000 : 25000);
  return result.stdout.trim().split('\n').at(-2);
}

export async function commit(session) {
  assert.ok(
    session.held && !session.settled,
    'release a live owned transaction',
  );
  session.child.stdin.write(`commit;\n\\echo committed:${session.app}\n`);
  try {
    await until(
      'same-backend explicit COMMIT acknowledgment',
      () => session.stdout.includes(`committed:${session.app}`),
      [session],
    );
    assert.equal(
      await query(`select exists (select 1 from pg_stat_activity
      where pid = ${session.pid} and application_name = ${sql(session.app)}
        and datname = 'postgres' and state = 'idle' and xact_start is null);`),
      't',
      'same backend proves the transaction ended before it disconnects',
    );
  } finally {
    session.held = false;
    session.child.stdin.end();
  }
  await complete(session);
}

/** Exact B tuple and holder-XID wait, not merely some heavyweight lock. */
export async function definitionWait(writer, holder, tuple) {
  if (!writer.pid || !holder.pid) return false;
  return (
    (await query(`select exists (
    select 1 from pg_stat_activity w join pg_stat_activity h
      on h.pid = any(pg_catalog.pg_blocking_pids(w.pid))
    where w.pid = ${writer.pid} and h.pid = ${holder.pid}
      and w.application_name = ${sql(writer.app)} and h.application_name = ${sql(holder.app)}
      and w.datname = 'postgres' and h.datname = 'postgres'
      and w.state = 'active' and w.wait_event_type = 'Lock' and w.wait_event = 'transactionid'
      and h.state = 'idle in transaction'
      and exists (select 1 from pg_locks waiting join pg_locks owning
        on owning.transactionid = waiting.transactionid and owning.locktype = 'transactionid'
        where waiting.pid = w.pid and owning.pid = h.pid
          and waiting.locktype = 'transactionid' and not waiting.granted
          and waiting.mode = 'ShareLock' and owning.granted and owning.mode = 'ExclusiveLock'
          and waiting.transactionid::text = ${sql(tuple.xid)})
      and exists (select 1 from pg_locks row_lock where row_lock.pid = w.pid
        and row_lock.locktype = 'tuple' and row_lock.granted and row_lock.mode = 'RowShareLock'
        and row_lock.relation = 'platform_private.cms_pattern_versions'::regclass
        and row_lock.page = ${tuple.page} and row_lock.tuple = ${tuple.offset})
      and exists (select 1 from pg_locks relation_lock where relation_lock.pid = w.pid
        and relation_lock.relation = 'platform_private.cms_pattern_versions'::regclass
        and relation_lock.granted and relation_lock.mode = 'RowShareLock'));`)) ===
    't'
  );
}

export async function waitDefinition(writer, holder, tuple) {
  await until(
    'writer waits at the exact B definition tuple after candidate collection',
    () => definitionWait(writer, holder, tuple),
    [writer, holder],
  );
  console.log(
    `ok - exact B tuple/TXID boundary; writer PID ${writer.pid}, holder PID ${holder.pid}`,
  );
}

export async function cleanup(ownedMetadata) {
  const errors = [];
  for (const session of sessions) {
    if (session.held && !session.settled) {
      session.child.stdin.end('rollback;\n\\q\n');
      session.held = false;
    }
  }
  await Promise.all(
    sessions
      .filter((session) => !session.settled)
      .map(async (session) => {
        try {
          await outcome(session, 2000);
        } catch {
          try {
            await query(`select pg_terminate_backend(pid) from pg_stat_activity
          where application_name = ${sql(session.app)} and datname = 'postgres'
            and usename = 'postgres' and (${session.pid ?? -1} = -1 or pid = ${session.pid});`);
          } catch (error) {
            errors.push(error);
          }
          session.child.kill('SIGTERM');
          try {
            await outcome(session, 2000);
          } catch {
            session.child.kill('SIGKILL');
            try {
              await outcome(session, 2000);
            } catch (error) {
              errors.push(error);
            }
          }
        }
      }),
  );
  try {
    assert.equal(
      await query(`select count(*) from pg_stat_activity
      where application_name like ${sql(prefix + '-%')} and pid <> pg_backend_pid();`),
      '0',
      'every owned backend is gone before fixture-metadata cleanup',
    );
    assert.ok(
      sessions.every((session) => session.settled),
      'every owned Docker child reaped',
    );
    if (ownedMetadata) {
      await query(`begin;
        lock table public.s12wr_world, public.s12wr_base, public.s12wr_actor in access exclusive mode;
        do $owned$ begin
          if 'public.s12wr_actor'::regclass::oid <> ${ownedMetadata.actor}
            or 'public.s12wr_base'::regclass::oid <> ${ownedMetadata.base}
            or 'public.s12wr_world'::regclass::oid <> ${ownedMetadata.world} then
            raise exception 'writer race metadata ownership changed';
          end if;
        end $owned$;
        drop table public.s12wr_world, public.s12wr_base, public.s12wr_actor restrict;
        commit;`);
    }
  } catch (error) {
    errors.push(error);
  }
  return errors;
}
