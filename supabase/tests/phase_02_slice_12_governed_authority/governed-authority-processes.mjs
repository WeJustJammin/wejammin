/** Sole process boundary: every database client, including cleanup, is registered here. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const container =
  process.env.S10_RACE_DB_CONTAINER ??
  process.env.AC217_DB_CONTAINER ??
  'supabase_db_wejammin';
const runId = randomUUID().replaceAll('-', '');
const sessions = new Set();
let sequence = 0;
let closing = false;

export const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
export const jsonb = (value) => `${sql(JSON.stringify(value))}::jsonb`;
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const check = (condition, message) => {
  assert.ok(condition, message);
  console.log(`ok - ${message}`);
};
export const trackedSessions = () => [...sessions];
export const beginCleanup = () => {
  closing = true;
};
export const requireOwned = (session) => {
  if (!sessions.has(session)) throw new Error('refusing an unowned session');
};

export const startSession = (label, script, { control = false } = {}) => {
  if (closing && !control)
    throw new Error('database execution is closed for cleanup');
  const app = `s12gov-${runId}-${(++sequence).toString(36)}-${label.slice(0, 16)}`;
  if (app.length > 63)
    throw new Error('race application name exceeds PostgreSQL limit');
  const timeoutMs = control ? 8_000 : 45_000;
  const options = control
    ? '-c statement_timeout=5000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=5000 -c idle_session_timeout=5000'
    : '-c statement_timeout=60000 -c lock_timeout=30000 -c idle_in_transaction_session_timeout=60000 -c idle_session_timeout=60000';
  const child = spawn('docker', [
    'exec',
    '-i',
    '-e',
    `PGAPPNAME=${app}`,
    '-e',
    `PGOPTIONS=${options}`,
    '-e',
    'PGCONNECT_TIMEOUT=5',
    container,
    'psql',
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-v',
    'VERBOSITY=verbose',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-At',
    '-f',
    '-',
  ]);
  const session = {
    app,
    child,
    control,
    timeoutMs,
    startedAt: Date.now(),
    settled: false,
  };
  sessions.add(session);
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  child.on('error', (error) => {
    stderr += `\nspawn error: ${error.message}`;
  });
  child.stdin.on('error', (error) => {
    stderr += `\nstdin error: ${error.message}`;
  });
  session.done = new Promise((resolve) => {
    child.once('close', (code, signal) => {
      session.settled = true;
      resolve({ code, signal, stdout, stderr });
    });
  });
  child.stdin.end(`select 'owned-backend:' || pg_backend_pid();\n${script}\n`);
  return session;
};

export const settledWithin = async (session, ms) => {
  requireOwned(session);
  let timer;
  try {
    return await Promise.race([
      session.done.then(() => true),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), Math.max(0, ms));
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

export const outcomeOf = async (session) => {
  if (
    !(await settledWithin(
      session,
      session.timeoutMs - (Date.now() - session.startedAt),
    ))
  ) {
    throw new Error(
      `${session.app}: client exceeded its ${session.timeoutMs}ms deadline`,
    );
  }
  return session.done;
};

/** Client-only fallback; database teardown belongs to the exact-name cleanup controller. */
export const reapChild = async (session) => {
  requireOwned(session);
  if (!(await settledWithin(session, 500))) session.child.kill('SIGTERM');
  if (!(await settledWithin(session, 1_000))) session.child.kill('SIGKILL');
  if (!(await settledWithin(session, 1_000)))
    throw new Error(`${session.app}: child could not be reaped`);
};
