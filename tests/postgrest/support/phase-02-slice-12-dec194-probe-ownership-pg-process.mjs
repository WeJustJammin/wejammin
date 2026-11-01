import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { literal } from './phase-02-slice-12-dec194-probe-ownership-pg-catalog.mjs';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function openOwnedProcesses({
  target,
  nonce,
  record,
  isFixtureTrigger,
}) {
  const children = new Set();
  const appPrefix = `dec194own_${nonce}_`;
  let sequence = 0;
  let closed = false;

  function start(sql, label, held = false) {
    assert.ok(!closed, 'No admission after close');
    const applicationName = `${appPrefix}${++sequence}`;
    const child = spawn(
      'docker',
      [
        'exec',
        '-i',
        '-e',
        `PGAPPNAME=${applicationName}`,
        '-e',
        'PGCONNECT_TIMEOUT=5',
        target,
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
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const client = {
      child,
      label,
      applicationName,
      rows: [],
      ended: false,
      settled: false,
      pid: null,
    };
    children.add(client);
    record({
      kind: 'owned-client',
      label,
      applicationName,
      localPid: child.pid ?? null,
    });
    let stdout = '',
      stderr = '',
      partial = '',
      overflow = false;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (data) => {
      if (stdout.length + data.length > 4_194_304) {
        overflow = true;
        return;
      }
      stdout += data;
      partial += data;
      const lines = partial.split('\n');
      partial = lines.pop() ?? '';
      for (const line of lines) {
        let row;
        try {
          row = JSON.parse(line);
        } catch {
          continue;
        }
        client.rows.push(row);
        if (row?.dec194Pid) client.pid = row.dec194Pid;
        const created = row?.createdTrigger;
        if (created && isFixtureTrigger(created.row?.tgname)) {
          record({
            kind: 'fixture-trigger-observed',
            applicationName,
            name: created.row.tgname,
            oid: created.row.oid,
            functionOid: created.row.tgfoid,
            transaction: 'outcome pending; inspect matching owned-client-close',
          });
        }
      }
    });
    child.stderr.on('data', (data) => {
      if (stderr.length < 65_536) stderr += data;
    });
    child.stdin.on('error', () => {
      /* close result, never an unhandled EPIPE */
    });
    client.done = new Promise((resolve) => {
      child.on('error', () => {
        client.spawnError = true;
      });
      child.on('close', (code) => {
        client.settled = true;
        children.delete(client);
        const state = client.spawnError
          ? 'SPAWN'
          : overflow
            ? 'OUTPUT_LIMIT'
            : (/ERROR:\s+([0-9A-Z]{5}):/.exec(stderr)?.[1] ?? null);
        record({
          kind: 'owned-client-close',
          applicationName,
          pid: client.pid,
          code,
          state,
          release: client.release,
        });
        resolve({
          code,
          rows: client.rows,
          state,
          ownershipRefusal: stderr.includes('DEC194_PROBE_OWNERSHIP_CHANGED'),
        });
      });
    });
    client.end = (tail = '') => {
      if (!client.ended) {
        client.ended = true;
        client.release = /^\s*commit\s*;/i.test(tail)
          ? 'COMMIT'
          : /^\s*rollback\s*;/i.test(tail)
            ? 'ROLLBACK'
            : 'SQL body completion';
        record({
          kind: 'owned-client-release',
          applicationName,
          release: client.release,
        });
        child.stdin.end(tail);
      }
    };
    child.stdin.write(`set statement_timeout='15s'; set lock_timeout='10s';
      set idle_in_transaction_session_timeout='20s';
      select jsonb_build_object('dec194Pid',pg_backend_pid());\n${sql}\n`);
    if (!held) client.end();
    return client;
  }
  const run = async (sql, label) => start(sql, label).done;
  const query = async (sql, label) => {
    const result = await run(sql, label);
    assert.equal(
      result.code,
      0,
      `${label}: SQL failed (${result.state ?? 'unknown'})`,
    );
    assert.equal(result.state, null, `${label}: transport/output failure`);
    return result.rows.filter((row) => !row?.dec194Pid).at(-1);
  };
  async function poll(check, label, milliseconds = 7000) {
    const deadline = Date.now() + milliseconds;
    do {
      const value = await check();
      if (value) return value;
      await pause(20); // cadence only; the returned SQL predicate is the barrier witness
    } while (Date.now() < deadline);
    throw new Error(`${label}: observed predicate deadline exceeded`);
  }
  async function drain() {
    for (const client of children) client.end('\nrollback;\n');
    let timer;
    let finished;
    try {
      finished = await Promise.race([
        Promise.all([...children].map((client) => client.done)).then(
          () => true,
        ),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve(false), 35_000);
          timer.unref();
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    if (!finished || children.size) return false;
    const active = await query(
      `select jsonb_build_object('count',count(*)) from pg_stat_activity
      where left(application_name,${appPrefix.length})=${literal(appPrefix)}
      and pid<>pg_backend_pid();`,
      'owned sessions drained',
    );
    const drained = active.count === 0 && children.size === 0;
    if (drained)
      record({
        kind: 'owned-clients-drained',
        activeBackends: 0,
        openChildren: 0,
      });
    return drained;
  }
  return {
    start,
    run,
    query,
    poll,
    drain,
    close() {
      assert.equal(children.size, 0, 'Cannot close with owned children');
      closed = true;
    },
  };
}
