import { Buffer } from 'node:buffer';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  fixture,
  expectStaged,
  localAdapter,
  noClient,
  noMutationProcess,
  noReset,
  receiving,
  targetName,
} from './phase-02-slice-11-delivery-receiving-upgrade-local-fixtures';
import { expectedInvocation } from './phase-02-slice-11-delivery-receiving-upgrade-target-fixtures';

// Raw-boundary decisions only; no process/SQL execution or DDL proof.
describe('DEC-197 local adapter fail-closed safety', () => {
  for (const name of [
    'missing inherited fdinfo',
    'replaced path',
    'wrong mode',
    'unrelated owner',
    'same inode without OFD lock',
    'wrong reset lock',
  ]) {
    it(`DR-UL-P06 ${name} is not a four-lock lease`, async () => {
      const mock = await fixture();
      const lock = mock.attested.lease.locks[0]!;
      const fdinfo = `/proc/4002/fdinfo/${lock.fd}`;
      if (name === 'missing inherited fdinfo') mock.fs.entries.delete(fdinfo);
      if (name === 'replaced path')
        mock.fs.put(lock.path, { bytes: Buffer.alloc(0) });
      if (name === 'wrong mode') {
        const text = String(await mock.fs.readFile('/proc/locks', 'utf8'));
        mock.fs.put('/proc/locks', {
          bytes: Buffer.from(text.replace('WRITE', 'READ')),
        });
      }
      if (name === 'unrelated owner')
        mock.fs.put('/proc/4002/status', {
          bytes: Buffer.from('Pid:\t4002\nPPid:\t3000\n'),
        });
      if (name === 'same inode without OFD lock')
        mock.fs.put(fdinfo, {
          bytes: Buffer.from(`pos:\t0\nflags:\t0100002\nino:\t${lock.inode}\n`),
        });
      if (name === 'wrong reset lock')
        mock.attested.lease.locks[3]!.path =
          '/tmp/wejammin-supabase-reset.lock';
      const adapter = await localAdapter('prefix', mock);
      await expect(adapter.preparePrefix(mock.plan)).rejects.toThrow();
      noReset(mock);
    });
  }

  for (const name of ['escape', 'cycle', 'symlink']) {
    it(`DR-UL-S08 include ${name} refuses without executing a client`, async () => {
      const mock = await fixture();
      const path = join(receiving, '060-upgrade-world.sqlinc');
      if (name === 'escape')
        mock.fs.put(path, { bytes: Buffer.from('\\ir /etc/passwd\n') });
      if (name === 'cycle')
        mock.fs.put(path, {
          bytes: Buffer.from('\\ir 060-upgrade-world.sqlinc\n'),
        });
      if (name === 'symlink') {
        const sameBytes = join(receiving, 'unit-linked-world.sqlinc');
        mock.fs.put(sameBytes, {
          bytes: Buffer.from(await mock.fs.readFile(path)),
        });
        mock.fs.put(path, { link: sameBytes });
      }
      const adapter = await localAdapter('session', mock);
      await expect(adapter.setupWorld(mock.plan, mock.reset)).rejects.toThrow();
      noClient(mock);
    });
  }

  for (const phase of ['setup', 'migration'] as const) {
    it(`DR-UL-S12 ${phase} refuses a lost lease before client creation`, async () => {
      const mock = await fixture();
      mock.fs.put('/proc/locks', { bytes: Buffer.alloc(0) });
      const adapter = await localAdapter('session', mock);
      const pending =
        phase === 'setup'
          ? adapter.setupWorld(mock.plan, mock.reset)
          : adapter.executeMigration(
              expectedInvocation(mock.plan),
              mock.plan,
              mock.reset,
            );
      await expect(pending).rejects.toThrow();
      noClient(mock);
    });
  }

  for (const phase of ['migration', 'setup'] as const) {
    const title =
      phase === 'migration'
        ? 'DR-UL-S15 replacement container with same cluster/OID cannot execute migration'
        : 'DR-UL-S15 replacement container with same cluster/OID cannot execute setup';
    it(title, async () => {
      const mock = await fixture();
      mock.state.containerId = 'b'.repeat(64);
      const adapter = await localAdapter('session', mock);
      const pending =
        phase === 'setup'
          ? adapter.setupWorld(mock.plan, mock.reset)
          : adapter.executeMigration(
              expectedInvocation(mock.plan),
              mock.plan,
              mock.reset,
            );
      await expect(pending).rejects.toThrow();
      noClient(mock);
    });
  }

  it('DR-UL-B01 rejected spawn arguments still count as attempted client creation', async () => {
    const mock = await fixture();
    const invocation = expectedInvocation(mock.plan);
    expect(() =>
      mock.process.spawn('docker', invocation.args, { shell: true }),
    ).toThrow();
    expect(mock.children).toEqual([]);
    expect(mock.process.spawn.mock.calls).toHaveLength(1);
    expect(() => noClient(mock)).toThrow();
  });
  for (const args of [
    ['db', 'reset', '--linked'],
    ['projects', 'create'],
  ]) {
    it(`DR-UL-B02 rejected ${args.join(' ')} still counts as attempted mutation`, async () => {
      const mock = await fixture();
      await expect(
        mock.process.run({ command: 'unrecognized', args }),
      ).rejects.toThrow();
      expect(mock.process.run.mock.calls).toHaveLength(1);
      expect(mock.readOnlyCalls).toEqual([]);
      expect(() => noReset(mock)).toThrow();
    });
  }

  for (const alteration of ['unchanged', 'empty', 'corrupt'] as const) {
    it(`DR-UL-P18 ${alteration} staged bytes are checked before the reset process`, async () => {
      const mock = await fixture();
      const adapter = await localAdapter('prefix', mock);
      const attested = await adapter.preparePrefix(mock.plan);
      const first = mock.entries[0]!;
      const name = first.path.split('/').at(-1)!;
      const write = mock.fs.writeFile.bind(mock.fs);
      let intercepted = false;
      mock.fs.writeFile = vi.fn(async (path, bytes) => {
        if (path !== first.path && path.endsWith(`/${name}`)) {
          intercepted = true;
          if (alteration !== 'unchanged')
            bytes = Buffer.from(
              alteration === 'empty' ? '' : '-- corrupted staged SQL\n',
            );
        }
        await write(path, bytes);
      });
      const pending = adapter.resetBefore(mock.plan, attested);
      if (alteration === 'unchanged') {
        await expect(pending).resolves.toMatchObject({
          prefixSha256: attested.prefixSha256,
        });
        expectStaged(
          mock,
          0,
          mock.entries.filter(
            (entry) => entry.path.split('/').at(-1)! < targetName,
          ),
        );
      } else {
        await expect(pending).rejects.toThrow();
        noMutationProcess(mock);
      }
      expect(intercepted).toBe(true);
    });
  }
});
