/** Test-only owned psql sessions and observable lock barriers. No top-level DB work. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  container,
  jsonb,
  sql,
  testsDir,
} from '../../../infra/database-races/race-kit.mjs';

export { container, jsonb, sql, testsDir };
const prefix = `s12dcr-${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const sessions = [];
const pause = () => new Promise((done) => setTimeout(done, 100));
let fixtureTx;
export const configureFixture = (build) => { fixtureTx = build; };

export function start(label, body, held = false, setup = false) {
  const app = `${prefix}-${sessions.length}-${label}`.slice(0, 63);
  const options = `-c statement_timeout=${setup ? 120000 : 20000} -c lock_timeout=15000 -c idle_in_transaction_session_timeout=30000`;
  const child = spawn('docker', [
    'exec', '-i', '-e', `PGAPPNAME=${app}`, '-e', 'PGCONNECT_TIMEOUT=5',
    '-e', `PGOPTIONS=${options}`, container, 'psql', '-X', '-q', '-At',
    '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose',
    '-U', 'postgres', '-d', 'postgres', '-f', '-',
  ]);
  const session = {
    app, child, held, pid: null, stdout: '', stderr: '', settled: false,
  };
  sessions.push(session);
  child.stdout.on('data', (chunk) => {
    session.stdout += chunk;
    const match = /owned-pid:(\d+)/u.exec(session.stdout);
    if (match) session.pid = Number(match[1]);
  });
  child.stderr.on('data', (chunk) => { session.stderr += chunk; });
  child.on('error', (error) => { session.stderr += error.message; });
  child.stdin.on('error', (error) => { session.stderr += error.message; });
  session.done = new Promise((done) => child.once('close', (code) => {
    session.settled = true;
    done({ code, stdout: session.stdout, stderr: session.stderr });
  }));
  child.stdin.write(`select 'owned-pid:' || pg_backend_pid();\n${body}\nselect 'ready:${app}';\n`);
  if (!held) child.stdin.end();
  return session;
}

export async function until(label, predicate, participants = [], ms = 8000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    assert.ok(
      !participants.some((s) => s.settled),
      `${label}: participant completed before required barrier; ${participants.map((s) => s.stderr).join(' ')}`,
    );
    await pause(); // polling cadence only; the database predicate is the proof
  }
  throw new Error(`ASSERTION FAILED: ${label}: required database condition was not observed`);
}

export async function outcome(session, ms = 25000) {
  await until(`${session.app} completion`, () => session.settled, [], ms);
  return session.done;
}

export async function ready(session) {
  await until(
    `${session.app} ready`,
    () => session.stdout.includes(`ready:${session.app}`),
    [session],
    125000,
  );
}

export async function commit(session) {
  assert.ok(session.held && !session.settled, 'release targets a live owned transaction');
  session.child.stdin.write(`commit;\n\\echo committed:${session.app}\n`);
  try {
    await until(
      'explicit COMMIT acknowledgment',
      () => session.stdout.includes(`committed:${session.app}`),
      [session],
    );
    assert.equal(
      await query(`select exists (select 1 from pg_stat_activity where pid = ${session.pid}
        and application_name = ${sql(session.app)} and state = 'idle' and xact_start is null)
        and not exists (select 1 from pg_locks where pid = ${session.pid} and locktype = 'advisory');`),
      't',
      'COMMIT releases transaction advisory locks while the same backend remains connected',
    );
  } finally {
    session.held = false;
    session.child.stdin.end();
  }
  const result = await outcome(session);
  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.stdout.includes(`committed:${session.app}`), 'explicit COMMIT acknowledged');
  return result;
}

export const answer = (s) => JSON.parse(
  s.stdout.split('\n').filter((line) => line.startsWith('{') && !line.includes('|')).at(-1),
);

export async function query(body, fixture = false, setup = false) {
  const session = start(
    'probe',
    fixture ? `${fixtureTx(body)}\ncommit;` : body,
    false,
    setup,
  );
  const result = await outcome(session, setup ? 125000 : 25000);
  assert.equal(result.code, 0, result.stderr);
  assert.ok(!/^not ok\b/mu.test(result.stdout), 'fixture pgTAP prerequisites pass');
  return result.stdout.trim().split('\n').at(-2);
}

export async function holdReceipt(id) {
  const holder = start('receipt-holder', `begin isolation level read committed;
    do $hold$ begin
      perform 1 from platform_private.idempotency_records
        where id = ${sql(id)}::uuid and state = 'reserved' for update;
      if not found then raise exception 'reserved barrier receipt missing'; end if;
    end $hold$;`, true);
  await ready(holder);
  return holder;
}

async function edge(waiter, blocker, advisory) {
  if (!waiter.pid || !blocker.pid) return false;
  const mode = advisory
    ? "and wl.mode = 'ExclusiveLock' and bl.mode = 'ExclusiveLock'"
    : '';
  const boundary = advisory
    ? "and w.wait_event = 'advisory'"
    : `and b.state = 'idle in transaction' and exists (
        select 1 from pg_locks where pid = w.pid
          and relation = 'platform_private.idempotency_records'::regclass
          and granted and mode = 'RowShareLock')`;
  return (await query(`select exists (
    select 1 from pg_stat_activity w join pg_stat_activity b
      on b.pid = any(pg_blocking_pids(w.pid))
    where w.pid = ${waiter.pid} and b.pid = ${blocker.pid}
      and w.application_name = ${sql(waiter.app)} and b.application_name = ${sql(blocker.app)}
      and w.wait_event_type = 'Lock' and exists (
        select 1 from pg_locks wl join pg_locks bl
          on wl.locktype = bl.locktype and wl.database is not distinct from bl.database
            and wl.classid is not distinct from bl.classid and wl.objid is not distinct from bl.objid
            and wl.objsubid is not distinct from bl.objsubid and wl.transactionid is not distinct from bl.transactionid
        where wl.pid = w.pid and bl.pid = b.pid and not wl.granted and bl.granted
          and wl.locktype = ${sql(advisory ? 'advisory' : 'transactionid')} ${mode})
      ${boundary});`)) === 't';
}

export async function blocked(label, waiter, blocker, advisory) {
  await until(label, async () => {
    if (await edge(waiter, blocker, advisory)) return true;
    assert.ok(
      !waiter.stdout.includes(`ready:${waiter.app}`),
      `${label}: producer statement completed while the required blocker still held its transaction`,
    );
    return false;
  }, [waiter, blocker]);
  console.log(`ok - ${label}; waiter PID ${waiter.pid}, blocker PID ${blocker.pid}`);
}

export function delta(before, after, count, { receiptCount = count, mutable = [], stores = true } = {}) {
  const allowed = new Set(mutable);
  const expectedCounts = { jobs: count, events: count, audit: count, receipts: receiptCount };
  for (const [name, expected] of Object.entries(expectedCounts)) {
    assert.equal(after[name].length - before[name].length, expected, `exact ${name} delta`);
    for (const row of before[name]) {
      if (allowed.has(row.id)) continue;
      assert.deepEqual(
        after[name].find((r) => r.id === row.id),
        row,
        `existing ${name}/${row.id} byte-equivalent`,
      );
    }
  }
  if (stores) assert.equal(after.stores, before.stores, 'taxonomy stores unchanged');
  return after.jobs.filter((j) => !before.jobs.some((old) => old.id === j.id));
}

export async function cleanupSessions(teardownSql) {
  for (const session of sessions) {
    if (session.held && !session.settled) {
      session.child.stdin.end('rollback;\n');
      session.held = false;
    }
  }
  const errors = [];
  for (const session of sessions.filter((s) => !s.settled)) {
    try {
      await outcome(session, 2000);
    } catch {
      try {
        await query(`select pg_terminate_backend(pid) from pg_stat_activity
          where pid = ${session.pid ?? -1} and application_name = ${sql(session.app)};`);
      } catch (error) { errors.push(error); }
      session.child.kill('SIGTERM');
      try {
        await outcome(session, 2000);
      } catch (error) {
        session.child.kill('SIGKILL');
        errors.push(error);
      }
    }
  }
  try {
    assert.equal(
      await query(`select count(*) from pg_stat_activity
        where application_name like ${sql(`${prefix}-%`)} and pid <> pg_backend_pid();`),
      '0',
      'all owned backends absent',
    );
    if (teardownSql) await query(teardownSql);
  } catch (error) { errors.push(error); }
  return errors;
}
