import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  assertCanonicalTarget,
  canonicalContainer,
  isCanonicalRace,
} from '../../../infra/database-races/canonical-mode.mjs';
import {
  assertNormalClose,
  bounded,
  identity,
  nonce,
  observeIdentity,
  sql,
} from './050-race-session-support.mjs';

export { bounded, nonce, sql };
const sessions = new Set();
const administrators = new Set();
let closing = false;
let poisoned = false;

const ALT_CONTAINER = 'supabase_db_wejammin_ev';

/** The database container every session of this race uses, in either mode. */
export const targetContainer = () =>
  isCanonicalRace() ? canonicalContainer() : ALT_CONTAINER;

/**
 * Asserts the run is released, in either mode (the name predates canonical mode).
 * ALT mode: the explicit root release and the exact resettable ALT container.
 * Canonical mode (WEJAMMIN_CANONICAL_RACE=1, set by the db:verify race gate): no ALT release;
 * the container of the Slice 10 and 11 runners.
 */
export function requireAltRelease() {
  if (isCanonicalRace()) {
    assertCanonicalTarget({
      altEnvNames: [
        'RUN_S12_ENTRY_DEFAULT_TEMPLATE_LOCK_RACE',
        'S12_ENTRY_DEFAULT_TEMPLATE_LOCK_DB_CONTAINER',
        'S12_ENTRY_DEFAULT_TEMPLATE_LOCK_CONFIRM_CONTAINER',
      ],
    });
    return;
  }
  assert.equal(process.env.RUN_S12_ENTRY_DEFAULT_TEMPLATE_LOCK_RACE, '1');
  assert.equal(
    process.env.S12_ENTRY_DEFAULT_TEMPLATE_LOCK_DB_CONTAINER,
    'supabase_db_wejammin_ev',
    'explicit authorized ALT selection required; no default fallback',
  );
  assert.equal(
    process.env.S12_ENTRY_DEFAULT_TEMPLATE_LOCK_CONFIRM_CONTAINER,
    'supabase_db_wejammin_ev',
    'independent exact ALT confirmation required',
  );
}

function args(name) {
  requireAltRelease();
  return [
    'exec',
    '-i',
    '-e',
    `PGAPPNAME=${name}`,
    '-e',
    'PGOPTIONS=-c statement_timeout=45000 -c lock_timeout=0',
    targetContainer(),
    'psql',
    '-X',
    '-qAt',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'postgres',
    '-d',
    'postgres',
  ];
}

export class Session {
  static async open(label) {
    requireAltRelease();
    assert.ok(
      !closing && !poisoned,
      'no admission during/after failed cleanup',
    );
    const session = new Session(label);
    sessions.add(session);
    await observeIdentity(session);
    await session.query("set idle_in_transaction_session_timeout = '75s';");
    return session;
  }

  constructor(label) {
    this.name = `${nonce}-${label}`;
    assert.ok(
      Buffer.byteLength(this.name) <= 63,
      'untruncated application name',
    );
    this.buffer = '';
    this.stderr = '';
    this.serial = 0;
    this.failures = [];
    this.normalClose = false;
    this.child = spawn('docker', args(this.name), {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child.stdout.setEncoding('utf8');
    this.child.stderr.setEncoding('utf8');
    this.child.stdout.on('data', (chunk) => this.receive(chunk));
    this.child.stderr.on('data', (chunk) => {
      this.stderr += chunk;
    });
    this.child.stdin.on('error', (error) => this.fail(error));
    this.closed = new Promise((resolve) => {
      this.child.once('error', (error) => {
        this.fail(error);
      });
      this.child.once('close', (code, signal) => {
        this.exited = true;
        this.closeResult = { code, signal, requested: this.normalClose };
        if (
          code !== 0 ||
          signal !== null ||
          !this.normalClose ||
          this.pending
        ) {
          this.fail(
            new Error(
              `${this.name} unexpected close ${JSON.stringify(this.closeResult)}: ${this.stderr}`,
            ),
          );
        }
        this.command = null;
        resolve(this.closeResult);
      });
    });
  }

  get pending() {
    return Boolean(this.command);
  }

  fail(error) {
    this.failures.push(error);
    if (!this.command || this.command.settled) return;
    clearTimeout(this.command.timer);
    this.command.settled = true;
    this.command.reject(error);
    // Keep the underlying command tracked until its marker or child close.
  }

  receive(chunk) {
    this.buffer += chunk;
    let end;
    while ((end = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, end).trim();
      this.buffer = this.buffer.slice(end + 1);
      if (!this.command) continue;
      if (line === this.command.marker) {
        const command = this.command;
        clearTimeout(command.timer);
        this.command = null;
        if (!command.settled) command.resolve(command.rows);
      } else if (line) this.command.rows.push(line);
    }
  }

  query(statement, milliseconds = 55_000) {
    assert.ok(!this.pending && !this.exited, `${this.name}: one live command`);
    const promise = new Promise((resolve, reject) => {
      const marker = `${this.name}-done-${++this.serial}`;
      this.command = { marker, rows: [], resolve, reject, settled: false };
      this.command.timer = setTimeout(
        () => this.fail(new Error(`${marker}: command deadline exceeded`)),
        milliseconds,
      );
      this.child.stdin.write(`${statement}\n\\echo ${marker}\n`);
    });
    promise.catch(() => {});
    return promise;
  }
}

async function administrative(statement) {
  const child = spawn(
    'docker',
    [
      ...args(`${nonce}-admin`),
      '-c',
      `set statement_timeout = '6s'; ${statement}`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  administrators.add(child);
  let output = '';
  let errorOutput = '';
  let failure;
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    errorOutput += chunk;
  });
  const closed = new Promise((resolve) => {
    child.once('error', (error) => {
      failure = error;
    });
    child.once('close', (code) => {
      administrators.delete(child);
      resolve(code);
    });
  });
  const timer = setTimeout(() => {
    failure = new Error('owned administrative child deadline exceeded');
    child.kill('SIGKILL');
  }, 8_000);
  try {
    const code = await bounded(
      closed,
      'owned administrative child did not close',
      10_000,
    );
    if (failure) throw failure;
    assert.equal(code, 0, errorOutput);
    return output.trim().split('\n').filter(Boolean).at(-1);
  } finally {
    clearTimeout(timer);
    if (administrators.has(child)) {
      child.kill('SIGKILL');
      await bounded(closed, 'owned administrative forced close failed', 5_000);
    }
  }
}

async function drain(session) {
  const deadline = Date.now() + 5_000;
  while (session.pending && !session.exited) {
    assert.ok(Date.now() < deadline, `${session.name}: cancel/drain deadline`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

export async function cleanup() {
  requireAltRelease();
  closing = true;
  const errors = [];
  for (const session of sessions) {
    try {
      if (session.pending && session.pid) {
        await administrative(`select pg_cancel_backend(pid) from pg_stat_activity
          where ${identity(session)};`);
        await drain(session);
      }
      if (!session.exited) {
        assert.ok(
          !session.pending,
          'cannot enqueue rollback behind undrained work',
        );
        await bounded(
          session.query('rollback;', 5_000),
          'owned rollback deadline',
          6_000,
        );
        session.normalClose = true;
        session.child.stdin.end('\\q\n');
        await bounded(session.closed, 'owned child close deadline', 5_000);
      }
    } catch (error) {
      errors.push(error);
      try {
        if (session.pid) {
          await administrative(`select pg_terminate_backend(pid, 5000)
            from pg_stat_activity where ${identity(session)};`);
        }
        session.child.stdin.destroy();
        if (!session.exited) session.child.kill('SIGKILL');
        await bounded(
          session.closed,
          'owned forced child close deadline',
          6_000,
        );
      } catch (closeError) {
        errors.push(closeError);
      }
    }
    // An already-exited child still owes a normal requested exit receipt.
    errors.push(...session.failures);
    try {
      assertNormalClose(session);
    } catch (exitError) {
      errors.push(exitError);
    }
  }
  try {
    const remaining =
      await administrative(`select count(*) from pg_stat_activity
      where datname = current_database() and application_name like ${sql(`${nonce}-%`)}
        and pid <> pg_backend_pid();`);
    assert.equal(remaining, '0', 'no owned backend remains after child drain');
    assert.equal(
      administrators.size,
      0,
      'all owned administrative children closed',
    );
  } catch (error) {
    errors.push(error);
  } finally {
    poisoned ||= errors.length > 0;
    if (!poisoned) sessions.clear();
    closing = false;
  }
  if (errors.length) throw new AggregateError(errors, 'owned cleanup failed');
}
