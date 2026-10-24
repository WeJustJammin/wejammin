import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import { labels } from './phase-02-slice-11-delivery-receiving-upgrade-fixtures';
import {
  fixture,
  localAdapter,
  noClient,
  turn,
  type Fixture,
} from './phase-02-slice-11-delivery-receiving-upgrade-local-fixtures';
import { before } from './phase-02-slice-11-delivery-receiving-upgrade-snapshot-fixtures';
import {
  envelope,
  expectedInvocation,
  marker,
  session,
  SESSION_SQL,
} from './phase-02-slice-11-delivery-receiving-upgrade-target-fixtures';

type Phase = 'setup' | 'before' | 'after' | 'migration';
const phaseApp = (mock: Fixture, phase: Phase) =>
  phase === 'migration'
    ? mock.plan.applicationName
    : `${mock.plan.applicationName}-${phase}`;
const phasePid = (phase: Phase) =>
  ({ setup: 101, before: 201, after: 202, migration: 301 })[phase];
const sessionLine = (mock: Fixture, phase: Phase) =>
  marker(session(phaseApp(mock, phase), phasePid(phase)));
const worldLine = (mock: Fixture) =>
  JSON.stringify({
    witness: 'DEC197_UPGRADE_WORLD',
    database: 'postgres',
    backendPid: 101,
    publications: mock.plan.mode === 'negative' ? labels : [],
    consumerCount: mock.plan.mode === 'negative' ? '2' : '0',
  }) + '\n';
const ready = 'DEC197_SETUP_READY_V1\n';

async function start(mock: Fixture, phase: Phase) {
  const adapter = await localAdapter('session', mock);
  const invocation = expectedInvocation(mock.plan);
  const pending =
    phase === 'setup'
      ? adapter.setupWorld(mock.plan, mock.reset)
      : phase === 'migration'
        ? adapter.executeMigration(invocation, mock.plan, mock.reset)
        : adapter.observe(phase, mock.plan, mock.reset);
  void pending.catch(() => {});
  const child = await Promise.race([
    mock.spawned,
    pending.then(() => {
      throw new Error('session completed without a real process boundary');
    }),
  ]);
  return { adapter, pending, child, invocation };
}

describe('DEC-197 local streaming session adapter decisions', () => {
  for (const mode of ['negative', 'positive'] as const) {
    it(`DR-UL-S01 ${mode} exact marker argv and full unchanged 080 stdin`, async () => {
      const mock = await fixture(mode);
      const { pending, child, invocation } = await start(mock, 'migration');
      const [command, args, options] = mock.process.spawn.mock.calls[0]!;
      expect(command).toBe('docker');
      expect(args).toEqual(invocation.args);
      expect(options).toMatchObject({
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      expect(args.slice(-6)).toEqual([
        '-A',
        '-t',
        '-c',
        SESSION_SQL,
        '-f',
        '-',
      ]);
      expect(Buffer.concat(child.chunks)).toEqual(mock.plan.witness);
      expect(child.ended).toBe(true);
      expect(child.input).not.toContain('SAVEPOINT');
      const stdout =
        sessionLine(mock, 'migration') +
        'BEGIN\nCREATE TABLE\n' +
        (mode === 'negative' ? 'ROLLBACK\n' : 'COMMIT\n');
      const stderr =
        mode === 'negative'
          ? 'ERROR:  23503: violates foreign key constraint "projection_consumer_state_projection_fk"\n' +
            'CONSTRAINT NAME: projection_consumer_state_projection_fk\n' +
            'ERROR:  25P02: current transaction is aborted\n'
          : '';
      child.output(stdout.slice(0, 19));
      child.output(stdout.slice(19));
      child.errorOutput(stderr);
      child.close();
      await expect(pending).resolves.toEqual({
        ...envelope(mock.reset),
        status: 0,
        stdout,
        stderr,
      });
      expect(mock.children).toHaveLength(1);
      expect(mock.timers.size).toBe(0);
    });
  }

  for (const name of [
    'extra argv',
    'altered stdin',
    'wrong container',
    'outer transaction',
  ]) {
    it(`DR-UL-S02 ${name} refuses before a process can execute`, async () => {
      const mock = await fixture();
      const adapter = await localAdapter('session', mock);
      const invocation = expectedInvocation(mock.plan);
      if (name === 'extra argv') invocation.args.push('-c', 'select 1');
      if (name === 'altered stdin')
        invocation.input = Buffer.concat([invocation.input, Buffer.from('\n')]);
      if (name === 'wrong container')
        invocation.args[4] = 'supabase_db_wejammin';
      if (name === 'outer transaction')
        invocation.args.push('--single-transaction');
      await expect(
        adapter.executeMigration(invocation, mock.plan, mock.reset),
      ).rejects.toThrow();
      noClient(mock);
    });
  }

  for (const mode of ['negative', 'positive'] as const) {
    it(`DR-UL-S03 ${mode} validates complete TAP before sending setup COMMIT`, async () => {
      const mock = await fixture(mode);
      const { pending, child } = await start(mock, 'setup');
      expect(child.input).toMatch(/^begin;$/im);
      expect(child.input).not.toMatch(/^commit;$/im);
      expect(child.ended).toBe(false);
      expect(child.input).not.toMatch(/^\s*\\ir\s/m);
      if (mode === 'negative') {
        expect(child.input).toContain(
          'DEC197_UPGRADE_SETUP: two real publication VERSION parents required',
        );
        expect(child.input).toContain('cms_append_publication_lineage');
      } else {
        expect(child.input).toContain('DR-UP-P02');
        expect(child.input).not.toContain('upgrade-consumer-');
        expect(child.input).not.toMatch(/\bdelete\s+from\b/i);
      }
      child.output(
        sessionLine(mock, 'setup') + 'BEGIN\nok 1 - first premise\n',
      );
      await turn();
      expect(child.input).not.toMatch(/^commit;$/im);
      child.output('ok 2 - second premise\n1..2\n' + worldLine(mock));
      await turn();
      expect(child.input).not.toMatch(/^commit;$/im);
      const commitInput = new Promise<void>((resolveInput) => {
        child.stdin.once('input', () => resolveInput());
      });
      child.output(ready);
      await commitInput;
      expect(child.input).toMatch(/^commit;$/im);
      expect(child.ended).toBe(true);
      child.output('COMMIT\n');
      child.close();
      await expect(pending).resolves.toMatchObject({
        ...envelope(mock.reset),
        committed: true,
        tapPassed: true,
        database: 'postgres',
        backendPid: 101,
        consumerCount: mode === 'negative' ? '2' : '0',
      });
    });
  }

  const badTap = [
    ['assertion failed', 'not ok 1 - actual prerequisite failed\n1..1\n'],
    ['bailout', 'Bail out! genuine fixture failure\n'],
    ['missing plan', 'ok 1 - no finish output\n'],
    ['truncated plan', 'ok 1 - only one\n1..2\n'],
    ['duplicate number', 'ok 1 - first\nok 1 - duplicate\n1..2\n'],
    ['multiple plans', 'ok 1 - first\n1..1\n1..1\n'],
    ['skipped premise', 'ok 1 - absent # SKIP unavailable\n1..1\n'],
    ['TODO premise', 'not ok 1 - absent # TODO later\n1..1\n'],
  ];
  for (const [name, tap] of badTap) {
    it(`DR-UL-S04 ${name} never commits setup`, async () => {
      const mock = await fixture();
      const { pending, child } = await start(mock, 'setup');
      child.output(
        sessionLine(mock, 'setup') + 'BEGIN\n' + tap + worldLine(mock) + ready,
      );
      await turn();
      expect(child.input).not.toMatch(/^commit;$/im);
      child.close(3);
      await expect(pending).rejects.toThrow();
      expect(mock.children).toHaveLength(1);
    });
  }

  for (const name of [
    'missing COMMIT',
    'ROLLBACK',
    'SQL error',
    'world PID mismatch',
  ]) {
    it(`DR-UL-S05 setup ${name} cannot claim committed visibility`, async () => {
      const mock = await fixture();
      const { pending, child } = await start(mock, 'setup');
      const world =
        name === 'world PID mismatch'
          ? worldLine(mock).replace('"backendPid":101', '"backendPid":999')
          : worldLine(mock);
      child.output(
        sessionLine(mock, 'setup') +
          'BEGIN\nok 1 - premise\n1..1\n' +
          world +
          ready,
      );
      await turn();
      if (name === 'world PID mismatch')
        expect(child.input).not.toMatch(/^commit;$/im);
      if (name === 'SQL error')
        child.errorOutput('ERROR:  23514: setup constraint failed\n');
      if (name === 'ROLLBACK') child.output('ROLLBACK\n');
      if (name === 'world PID mismatch') child.output('COMMIT\n');
      child.close(name === 'SQL error' ? 3 : 0);
      await expect(pending).rejects.toThrow();
      if (name === 'world PID mismatch')
        expect(child.input).not.toMatch(/^commit;$/im);
    });
  }

  for (const phase of ['before', 'after'] as const) {
    it(`DR-UL-S06 ${phase} uses a fresh read-only observer and preserves raw 070 values`, async () => {
      const mock = await fixture();
      const { pending, child } = await start(mock, phase);
      const document = before('negative', phasePid(phase));
      document.observer.database = 'postgres';
      expect(child.input).toMatch(/^begin read only;$/im);
      expect(child.input).toMatch(/^rollback;$/im);
      expect(child.input).toContain('DEC197_UPGRADE_SNAPSHOT_V1');
      expect(child.input).not.toMatch(/^\s*\\ir\s/m);
      child.output(
        sessionLine(mock, phase) +
          'BEGIN\n' +
          JSON.stringify(document) +
          '\nROLLBACK\n',
      );
      child.close();
      await expect(pending).resolves.toEqual({
        ...envelope(mock.reset),
        document,
      });
      expect(
        document.snapshot.publicationVersionRows.some((row) =>
          row.includes('9007199254740993'),
        ),
      ).toBe(true);
      expect(mock.children).toHaveLength(1);
    });
  }

  for (const name of [
    'wrong observer PID',
    'duplicate snapshot',
    'missing rollback',
    'wrong database',
  ]) {
    it(`DR-UL-S07 ${name} is not an independent observer receipt`, async () => {
      const mock = await fixture();
      const { pending, child } = await start(mock, 'before');
      const document = before(
        'negative',
        name === 'wrong observer PID' ? 301 : 201,
      );
      document.observer.database =
        name === 'wrong database' ? 'other' : 'postgres';
      const line = JSON.stringify(document) + '\n';
      child.output(
        sessionLine(mock, 'before') +
          'BEGIN\n' +
          line +
          (name === 'duplicate snapshot' ? line : '') +
          (name === 'missing rollback' ? '' : 'ROLLBACK\n'),
      );
      child.close();
      await expect(pending).rejects.toThrow();
    });
  }

  it('DR-UL-S09 transport error waits for child close before rejection/cleanup can begin', async () => {
    const mock = await fixture();
    const { pending, child } = await start(mock, 'migration');
    let settled = false;
    void pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    child.emit(
      'error',
      Object.assign(new Error('spawn transport failed'), { code: 'EPIPE' }),
    );
    await turn();
    expect(settled).toBe(false);
    expect(child.killed.length).toBeGreaterThan(0);
    child.close(null, 'SIGTERM');
    await expect(pending).rejects.toThrow('spawn transport failed');
    expect(mock.timers.size).toBe(0);
  });

  it('DR-UL-S10 timeout kills only the owned child and drains close before returning failure', async () => {
    const mock = await fixture();
    const { pending, child } = await start(mock, 'migration');
    expect(mock.timers.size).toBeGreaterThan(0);
    for (const callback of [...mock.timers.values()]) callback();
    let settled = false;
    void pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await turn();
    expect(child.killed.length).toBeGreaterThan(0);
    expect(settled).toBe(false);
    child.close(null, 'SIGTERM');
    await expect(pending).rejects.toThrow();
    expect(mock.children).toHaveLength(1);
    expect(mock.timers.size).toBe(0);
  });

  it('DR-UL-S11 nonzero process and unexpected SQLSTATE remain failure evidence, not a fake refusal', async () => {
    const mock = await fixture();
    const { pending, child } = await start(mock, 'migration');
    const stdout = sessionLine(mock, 'migration') + 'BEGIN\nROLLBACK\n';
    const stderr = 'ERROR:  42501: permission denied\n';
    child.output(stdout);
    child.errorOutput(stderr);
    child.close(3);
    await expect(pending).resolves.toEqual({
      ...envelope(mock.reset),
      status: 3,
      stdout,
      stderr,
    });
  });

  it('DR-UL-S13 lost lease between setup TAP and COMMIT never authorizes commit', async () => {
    const mock = await fixture();
    const { pending, child } = await start(mock, 'setup');
    child.output(
      sessionLine(mock, 'setup') +
        'BEGIN\nok 1 - premise\n1..1\n' +
        worldLine(mock),
    );
    mock.fs.put('/proc/locks', { bytes: Buffer.alloc(0) });
    child.output(ready);
    await turn();
    expect(child.input).not.toMatch(/^commit;$/im);
    child.close(3);
    await expect(pending).rejects.toThrow();
    expect(child.input).not.toMatch(/^commit;$/im);
  });

  it('DR-UL-S14 process exit without pipe close cannot release restoration', async () => {
    const mock = await fixture();
    const { pending, child } = await start(mock, 'migration');
    let settled = false;
    void pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    child.output(sessionLine(mock, 'migration') + 'BEGIN\nCOMMIT\n');
    child.emit('exit', 0, null);
    await turn();
    expect(settled).toBe(false);
    child.close();
    await expect(pending).resolves.toMatchObject({ status: 0 });
  });
});
