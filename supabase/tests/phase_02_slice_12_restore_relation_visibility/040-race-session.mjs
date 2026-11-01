import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  assertCanonicalTarget,
  isCanonicalRace,
} from '../../../infra/database-races/canonical-mode.mjs';
import {
  container,
  runValue,
  sql,
} from '../../../infra/database-races/race-kit.mjs';

export const nonce = `s12rrv-${randomUUID()}`;
const sessions = new Set();

/**
 * Asserts the run is released, in either mode (the name predates canonical mode).
 * ALT mode: the explicit root release and the exact resettable ALT container.
 * Canonical mode (WEJAMMIN_CANONICAL_RACE=1, set by the db:verify race gate): no ALT release;
 * race-kit's `container` is already the Slice 10 and 11 container.
 */
export function requireAltRelease() {
  if (isCanonicalRace()) {
    assertCanonicalTarget({
      altEnvNames: [
        'RUN_S12_RESTORE_RELATION_RACE',
        'S12_RESTORE_RELATION_CONFIRM_CONTAINER',
      ],
    });
    return;
  }
  assert.equal(
    process.env.RUN_S12_RESTORE_RELATION_RACE,
    '1',
    'explicit race release required',
  );
  assert.equal(
    process.env.S10_RACE_DB_CONTAINER,
    container,
    'explicit ALT container required',
  );
  assert.equal(
    container,
    'supabase_db_wejammin_ev',
    'only the authorized ALT database container is in scope',
  );
  assert.equal(
    process.env.S12_RESTORE_RELATION_CONFIRM_CONTAINER,
    container,
    'confirm exact ALT target',
  );
}

export class Session {
  static async open(label) {
    requireAltRelease();
    const session = new Session(label);
    sessions.add(session);
    session.pid = Number(
      (await session.query('select pg_backend_pid();')).at(-1),
    );
    assert.ok(
      Number.isInteger(session.pid) && session.pid > 0,
      'owned backend PID observed',
    );
    await session.query(
      "set statement_timeout = '45s'; set idle_in_transaction_session_timeout = '75s';",
    );
    return session;
  }

  constructor(label) {
    this.name = `${nonce}-${label}`;
    this.buffer = '';
    this.stderr = '';
    this.serial = 0;
    this.child = spawn(
      'docker',
      [
        'exec',
        '-i',
        '-e',
        `PGAPPNAME=${this.name}`,
        container,
        'psql',
        '-X',
        '-qAt',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        'postgres',
        '-d',
        'postgres',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    this.child.stdin.on('error', (error) => this.reject(error));
    this.child.stdout.setEncoding('utf8');
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', (chunk) => {
      this.stderr += chunk;
    });
    this.child.stdout.on('data', (chunk) => this.receive(chunk));
    this.closed = new Promise((resolve) => {
      this.child.once('error', (error) => {
        this.reject(error);
        resolve();
      });
      this.child.once('close', (code) => {
        this.exited = true;
        this.reject(new Error(`${this.name} exited ${code}: ${this.stderr}`));
        resolve();
      });
    });
  }

  receive(chunk) {
    this.buffer += chunk;
    let end;
    while ((end = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, end).trim();
      this.buffer = this.buffer.slice(end + 1);
      if (!this.pending) continue;
      if (line === this.pending.marker) {
        const { resolve, rows, timer } = this.pending;
        clearTimeout(timer);
        this.pending = null;
        resolve(rows);
      } else if (line) this.pending.rows.push(line);
    }
  }

  reject(error) {
    if (!this.pending) return;
    clearTimeout(this.pending.timer);
    this.pending.reject(error);
    this.pending = null;
  }

  query(statement) {
    assert.ok(
      !this.pending && !this.exited,
      `${this.name}: one live command at a time`,
    );
    return new Promise((resolve, reject) => {
      const marker = `${this.name}-done-${++this.serial}`;
      const timer = setTimeout(
        () => this.reject(new Error(`${marker}: command deadline exceeded`)),
        55_000,
      );
      this.pending = { marker, rows: [], resolve, reject, timer };
      this.child.stdin.write(`${statement}\n\\echo ${marker}\n`);
    });
  }
}

async function cleanupWait(session, stage, promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(`${session.name}: cleanup ${stage} deadline exceeded`),
            ),
          5_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function drain(session) {
  let poll;
  let stopped = false;
  try {
    await cleanupWait(
      session,
      'cancel/drain',
      Promise.race([
        session.closed,
        new Promise((resolve) => {
          const check = () => {
            if (!session.pending || session.exited) resolve();
            else if (!stopped) poll = setTimeout(check, 20);
          };
          check();
        }),
      ]),
    );
  } finally {
    stopped = true;
    clearTimeout(poll);
  }
}

export async function cleanup() {
  const errors = [];
  // An observed PID AND this run's exact application name must match. Never kill
  // another fixture/user backend; cancel/drain first, then rollback own sessions.
  for (const session of sessions) {
    try {
      if (session.pending && session.pid) {
        assert.ok(
          Number.isInteger(session.pid) &&
            session.pid > 0 &&
            session.name.startsWith(`${nonce}-`),
          'owned backend identity required before cancellation',
        );
        runValue(`select pg_cancel_backend(pid) from pg_stat_activity where pid = ${session.pid}
          and application_name = ${sql(session.name)} and datname = current_database();`);
        await drain(session);
      }
      if (!session.exited) {
        await cleanupWait(session, 'rollback', session.query('rollback;'));
        session.child.stdin.end('\\q\n');
        await cleanupWait(session, 'child close', session.closed);
      }
    } catch (error) {
      errors.push(error);
      try {
        if (
          Number.isInteger(session.pid) &&
          session.pid > 0 &&
          session.name.startsWith(`${nonce}-`)
        ) {
          const terminated = runValue(`select pg_terminate_backend(pid, 5000)
            from pg_stat_activity where pid = ${session.pid}
              and application_name = ${sql(session.name)} and datname = current_database();`);
          assert.ok(
            terminated === '' || terminated === 't',
            'owned backend terminated or absent',
          );
        }
      } catch (terminationError) {
        errors.push(terminationError);
      }
      try {
        session.reject(
          new Error(`${session.name}: cleanup forced owned child shutdown`),
        );
        session.child.stdin.destroy();
        if (!session.exited) session.child.kill('SIGKILL');
        await cleanupWait(session, 'forced child close', session.closed);
      } catch (closeError) {
        errors.push(closeError);
      }
    }
  }
  sessions.clear();
  if (errors.length)
    throw new AggregateError(errors, 'owned session cleanup failed');
}
