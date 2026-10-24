import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export const nonce = `s12edtl-${randomUUID()}`;
export const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;

export async function bounded(promise, message, milliseconds = 10_000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function observeIdentity(session) {
  const live = JSON.parse(
    (
      await session.query(
        `select json_build_object(
    'pid', pid, 'backendStart', backend_start::text,
    'application', application_name, 'database', datname)
    from pg_stat_activity where pid = pg_backend_pid();`,
        5_000,
      )
    ).at(-1),
  );
  assert.deepEqual(
    [live.application, live.database],
    [session.name, 'postgres'],
  );
  session.pid = live.pid;
  session.backendStart = live.backendStart;
  session.database = live.database;
  assert.ok(
    Number.isInteger(session.pid) && session.pid > 0,
    'owned backend PID',
  );
  assert.ok(
    typeof session.backendStart === 'string' && session.backendStart.length > 0,
  );
}

export function identity(session) {
  assert.ok(Number.isInteger(session.pid) && session.pid > 0);
  assert.ok(session.name.startsWith(`${nonce}-`));
  assert.ok(
    typeof session.backendStart === 'string' && session.backendStart.length > 0,
  );
  assert.equal(session.database, 'postgres');
  return `pid = ${session.pid} and application_name = ${sql(session.name)}
    and backend_start = ${sql(session.backendStart)}::timestamptz
    and datname = ${sql(session.database)} and datname = current_database()`;
}

export function assertNormalClose(session) {
  assert.deepEqual(
    session.closeResult,
    { code: 0, signal: null, requested: true },
    `${session.name}: unexpected owned child exit cannot pass via auto-rollback`,
  );
}
