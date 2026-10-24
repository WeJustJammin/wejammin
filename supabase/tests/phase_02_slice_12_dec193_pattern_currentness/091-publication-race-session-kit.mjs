/** TEST ONLY. No database work until the explicitly released driver calls start. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
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
export const nonce = randomUUID();
// ALT mode (root release): the resettable ALT container. Canonical mode
// (WEJAMMIN_CANONICAL_RACE=1, set by the db:verify race gate): the container the Slice 10
// and 11 runners use.
export const container = isCanonicalRace()
  ? canonicalContainer()
  : 'supabase_db_wejammin_ev';
export const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
export const jsonb = (value) => `${sql(JSON.stringify(value))}::jsonb`;
const prefix = `s12pr-${nonce.replaceAll('-', '').slice(0, 16)}`;
const clients = [];
const cadence = () => new Promise((done) => setTimeout(done, 100));

export function assertTarget() {
  // DEC-225: the primary checkout is refused in ALT mode only (one rule, in the helper).
  assertRaceCheckout({ root });
  if (isCanonicalRace()) {
    // The ALT worktree pin below is a root-run lane claim; canonical runs execute from
    // whichever checkout runs db:verify (the primary checkout included, DEC-225).
    assertCanonicalTarget({
      altEnvNames: [
        'S12_DEC199_PUBLICATION_RACE_ROOT_RELEASE',
        'S12_DEC199_PUBLICATION_RACE_ALT_CONTAINER',
      ],
    });
    return;
  }
  assert.equal(
    root,
    '/home/rob/.codex/worktrees/phase2-slice12/WeJammin',
    'claimed source worktree only',
  );
  assert.equal(
    process.env.S12_DEC199_PUBLICATION_RACE_ROOT_RELEASE,
    '2026-10-16-native-publication-red',
    'explicit root release required',
  );
  assert.equal(
    process.env.S12_DEC199_PUBLICATION_RACE_ALT_CONTAINER,
    container,
    'explicit resettable ALT only; no default fallback',
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
  const app = `${prefix}-${clients.length}-${label}`.slice(0, 63);
  const child = spawn('docker', [
    'exec',
    '-i',
    '-e',
    `PGAPPNAME=${app}`,
    '-e',
    'PGCONNECT_TIMEOUT=5',
    '-e',
    `PGOPTIONS=-c statement_timeout=${setup ? 120000 : 20000} -c lock_timeout=15000 -c idle_in_transaction_session_timeout=30000`,
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
  const client = {
    app,
    child,
    held,
    pid: null,
    stdout: '',
    stderr: '',
    settled: false,
  };
  clients.push(client);
  child.stdout.on('data', (chunk) => {
    client.stdout += chunk;
    const found = /owned-pid:(\d+)/u.exec(client.stdout);
    if (found) client.pid = Number(found[1]);
  });
  child.stderr.on('data', (chunk) => {
    client.stderr += chunk;
  });
  child.on('error', (error) => {
    client.stderr += error.message;
  });
  child.stdin.on('error', (error) => {
    client.stderr += error.message;
  });
  client.done = new Promise((done) =>
    child.once('close', (code) => {
      client.settled = true;
      done({ code, stdout: client.stdout, stderr: client.stderr });
    }),
  );
  child.stdin.write(
    `select 'owned-pid:' || pg_backend_pid();\n${body}\n\\echo ready:${app}\n`,
  );
  if (!held) child.stdin.end();
  return client;
}

export const frame = (client, name) => {
  const line = client.stdout
    .split('\n')
    .filter((item) => item.startsWith(`${name}:`))
    .at(-1);
  return line === undefined ? null : JSON.parse(line.slice(name.length + 1));
};
export const isReady = (client) =>
  client.stdout.includes(`ready:${client.app}`);

export async function until(label, predicate, participants = [], ms = 8000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    assert.ok(
      !participants.some((client) => client.settled),
      `${label}: client exited early`,
    );
    await cadence(); // Poll cadence is never ordering evidence.
  }
  throw new Error(`ASSERTION FAILED: ${label}: database witness not observed`);
}

export async function complete(client, ms = 25000) {
  await until(`${client.app} completion`, () => client.settled, [], ms);
  const result = await client.done;
  assert.equal(result.code, 0, result.stderr);
  assert.ok(
    !/^not ok\b/mu.test(result.stdout),
    'all inherited fixture TAP prerequisites',
  );
  return result;
}

export async function ready(client) {
  await until(`${client.app} held readiness`, () => isReady(client), [client]);
  assert.ok(
    Number.isSafeInteger(client.pid) && client.pid > 0,
    'observed actual backend PID',
  );
}

export async function query(body, setup = false) {
  const client = start('probe', body, false, setup);
  const result = await complete(client, setup ? 125000 : 25000);
  return result.stdout
    .split('\n')
    .filter(
      (line) =>
        line && !line.startsWith('owned-pid:') && !line.startsWith('ready:'),
    )
    .at(-1);
}

export async function commit(client) {
  assert.ok(
    client.held && isReady(client) && !client.settled,
    'commit live owned held transaction',
  );
  client.child.stdin.write(`commit;\n\\echo committed:${client.app}\n`);
  await until(
    'explicit same-backend COMMIT acknowledgement',
    () => client.stdout.includes(`committed:${client.app}`),
    [client],
  );
  assert.equal(
    await query(`select exists(select 1 from pg_stat_activity
    where pid=${client.pid} and application_name=${sql(client.app)} and datname='postgres'
      and usename='postgres' and state='idle' and xact_start is null);`),
    't',
  );
  client.held = false;
  client.child.stdin.end();
  await complete(client);
}

export async function cleanup(ownership) {
  const errors = [];
  for (const client of clients.filter((item) => item.held && !item.settled)) {
    client.child.stdin.end('rollback;\n\\q\n');
    client.held = false;
  }
  for (const client of clients.filter((item) => !item.settled)) {
    try {
      await until('owned client drain', () => client.settled, [], 2000);
    } catch {
      try {
        assert.ok(
          Number.isSafeInteger(client.pid),
          'unknown backend PID: no blind termination',
        );
        await query(`select pg_terminate_backend(pid) from pg_stat_activity
          where pid=${client.pid} and application_name=${sql(client.app)}
            and datname='postgres' and usename='postgres';`);
      } catch (error) {
        errors.push(error);
      }
      client.child.kill('SIGTERM');
      try {
        await until('owned child reap', () => client.settled, [], 2000);
      } catch {
        client.child.kill('SIGKILL');
        try {
          await until(
            'owned child forced reap',
            () => client.settled,
            [],
            2000,
          );
        } catch (error) {
          errors.push(error);
        }
      }
    }
  }
  try {
    assert.equal(
      await query(`select count(*) from pg_stat_activity
      where application_name like ${sql(prefix + '-%')} and pid<>pg_backend_pid();`),
      '0',
    );
    assert.ok(
      clients.every((client) => client.settled),
      'every owned child reaped',
    );
    const present =
      await query(`select to_regclass('public.s12pr_world') is not null
      or to_regclass('public.s12pr_actor') is not null or to_regclass('public.s12pr_base') is not null;`);
    if (present === 't') {
      assert.ok(
        ownership && ownership.nonce === nonce,
        'no adoption of unknown metadata',
      );
      await query(`begin;
        lock table public.s12pr_world, public.s12pr_actor, public.s12pr_base in access exclusive mode;
        do $owned$ begin
          if 'public.s12pr_world'::regclass::oid<>${ownership.world}
            or 'public.s12pr_actor'::regclass::oid<>${ownership.actor}
            or 'public.s12pr_base'::regclass::oid<>${ownership.base}
            or (select count(*)<>1 or bool_or(nonce<>${sql(nonce)}::uuid) from public.s12pr_world) then
            raise exception 'publication race metadata ownership changed';
          end if;
        end $owned$;
        drop table public.s12pr_world, public.s12pr_actor, public.s12pr_base restrict;
        commit;`);
    }
  } catch (error) {
    errors.push(error);
  }
  return errors;
}
