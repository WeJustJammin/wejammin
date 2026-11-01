import { Buffer } from 'node:buffer';

import { describe, expect, it, vi } from 'vitest';

import {
  exact,
  image,
  manifest,
  predecessor,
  realModule,
} from './phase-02-slice-11-delivery-receiving-upgrade-renewal-fixtures';

import {
  drift,
  harness,
  heldCompletion,
  request,
  type OwnedPort,
} from './phase-02-slice-11-delivery-receiving-upgrade-host-renewal-fixtures';

// Intended NEW private native bridge seam, not a public product API.
// Raw observeBoundary/readResetTrace/observeBackends belong to independently bound
// native ports. Tests provide OS/daemon observations only; no validator is mocked.
// Passing these mocks does NOT prove actual descendant attribution or DB drain.
const seam =
  'infra/database-upgrades/delivery-receiving-upgrade-host-reset.mjs';
async function bridge() {
  const module = await realModule(seam, ['createOwnedResetPort']);
  return module.createOwnedResetPort as (options: unknown) => OwnedPort;
}

describe('DEC-197 private native reset port owns attribution, drain and one-use handles', () => {
  it('DR-RN-H01 binds raw owned recreation to prior identity and exact source; status0 alone is insufficient', async () => {
    const create = await bridge();
    const h = await harness();
    const port = create(h.options);
    const input = request(h.mock.plan);
    const handle = port.beginOwnedReset(input);
    expect(h.process.spawn).not.toHaveBeenCalled();
    const result = await port.completeOwnedReset(handle);
    expect(result).toMatchObject({
      status: 0,
      before: image(0),
      after: image(1),
      inventorySha256: manifest([predecessor]),
    });
    expect(h.process.readResetTrace).toHaveBeenCalledWith(h.child);
    expect(h.process.observeBackends).toHaveBeenCalledWith(h.child);
    expect(h.process.observeProcessTree).toHaveBeenCalledWith(h.child);
    expect(h.process.observeDaemonWork).toHaveBeenCalledWith(h.child);
    expect(h.process.spawn.mock.calls[0]!.slice(0, 2)).toEqual([
      '/home/rob/.codex/worktrees/phase2-slice11/WeJammin/node_modules/.bin/supabase',
      ['db', 'reset', '--local', '--workdir', h.mock.plan.target.workdir],
    ]);
    expect(h.trace.child.executable.path).toBe('/unit/trusted/node');
    expect(h.trace.child.argv[0]).toBe('node');
    expect(h.trace.processes[0]!.proc.exe).toBe('/unit/trusted/node');
    expect(h.trace.processes[0]!.proc.cmdline.toString()).toMatch(/^node\0/);
    expect(h.trace.nativeChild.parentPid).toBe(h.child.pid);
    expect(h.trace.nativeChild.executable.path).toContain(
      '@supabase/cli-linux-x64/bin/supabase',
    );
    expect(h.trace.commands.map((command) => command.parentPid)).toEqual([
      9002, 9002, 9002,
    ]);
    expect(h.launcher.live()).toEqual([]);
    for (const pid of [9001, 9002, 9003, 9004, 9005])
      await expect(h.mock.fs.lstat(`/proc/${pid}/exe`)).rejects.toThrow();
    expect(h.launcher.daemonWork).toEqual({
      execs: [
        {
          Id: 'unit-kong-exec',
          ContainerID: 'd'.repeat(64),
          Running: false,
          ExitCode: 0,
          Pid: 0,
        },
      ],
      jobs: [],
    });
    expect(h.events.indexOf('child-close')).toBeLessThan(
      h.events.indexOf('backend-observed'),
    );
    expect(h.process.observeBoundary.mock.calls.length).toBeGreaterThanOrEqual(
      2,
    );
    exact(
      input.inventory[0]!.bytes,
      Buffer.from('select 0;\n'),
      'request not mutated',
    );
    await expect(port.completeOwnedReset(handle)).rejects.toThrow();
    expect(h.process.spawn).toHaveBeenCalledTimes(1);
  });

  for (const kind of [
    'plain DTO',
    'serialized handle',
    'other adapter',
  ] as const)
    it(`DR-RN-H02 ${kind} grants no native execution authority`, async () => {
      const create = await bridge();
      const h = await harness();
      const port = create(h.options);
      const owned = port.beginOwnedReset(request(h.mock.plan));
      let serialized: object = {};
      try {
        serialized = JSON.parse(JSON.stringify(owned)) as object;
      } catch {
        /* An intentionally unserializable capability grants no DTO authority. */
      }
      const forged =
        kind === 'plain DTO'
          ? {
              owned: true,
              status: 0,
              before: image(0),
              after: image(1),
              sequence: 1,
            }
          : kind === 'serialized handle'
            ? serialized
            : create(h.options).beginOwnedReset(request(h.mock.plan));
      await expect(port.completeOwnedReset(forged)).rejects.toThrow();
      await expect(port.proveRecoveryOwnership(forged)).rejects.toThrow();
      expect(h.process.spawn).not.toHaveBeenCalled();
    });

  it('DR-RN-H03 a pending owned operation refuses a concurrent registration', async () => {
    const create = await bridge();
    const h = await harness();
    const port = create(h.options);
    port.beginOwnedReset(request(h.mock.plan));
    expect(() => port.beginOwnedReset(request(h.mock.plan))).toThrow();
    expect(h.process.spawn).not.toHaveBeenCalled();
  });

  for (const fault of [
    'no trace',
    'foreign parent',
    'different daemon',
    'foreign old ID',
    'foreign created ID',
    'response actor',
    'response bytes',
    'executable bytes',
    'Docker bytes',
    'executable identity',
    'Docker identity',
  ] as const)
    it(`DR-RN-H04 status0 with ${fault} cannot authorize renewal or foreign recovery`, async () => {
      const create = await bridge();
      const h = await harness();
      const port = create(h.options);
      const handle = port.beginOwnedReset(request(h.mock.plan));
      const preflight = /^(executable|Docker) /.test(fault);
      if (preflight)
        await h.launcher.faultArtifact(
          fault.startsWith('Docker') ? 'docker' : 'supabase',
          fault.endsWith('bytes') ? 'bytes' : 'identity',
        );
      else if (fault === 'no trace')
        h.control.traceError = new Error('TRACE_UNAVAILABLE');
      else h.launcher.faultTrace(fault);
      await expect(port.completeOwnedReset(handle)).rejects.toThrow();
      await expect(port.proveRecoveryOwnership(handle)).rejects.toThrow();
      if (preflight) expect(h.process.spawn).not.toHaveBeenCalled();
      else expect(h.process.spawn.mock.calls.length).toBeLessThanOrEqual(1);
    });

  for (const fault of [
    'ambient selector',
    'native override',
    'Docker host',
    'Docker context',
    'daemon binding',
    'dotenv',
    'lease',
    'source',
    'unexpected pre-reset identity',
  ] as const)
    it(`DR-RN-H05 ${fault} refuses before launching the CLI`, async () => {
      const create = await bridge();
      const h = await harness();
      const original = h.process.observeBoundary;
      h.process.observeBoundary = vi.fn(async () => {
        const raw = await original();
        if (fault === 'ambient selector')
          Object.assign(raw.environment, { SUPABASE_PROJECT_ID: 'foreign' });
        if (fault === 'native override')
          Object.assign(raw.environment, {
            SUPABASE_CLI_BINARY_OVERRIDE: '/unit/foreign/native',
          });
        if (fault === 'Docker host')
          raw.environment.DOCKER_HOST = 'tcp://foreign.invalid:2375';
        if (fault === 'Docker context')
          Object.assign(raw.environment, { DOCKER_CONTEXT: 'foreign' });
        if (fault === 'daemon binding') raw.daemon.id = 'foreign-daemon';
        if (fault === 'dotenv') raw.dotenv.push('/unit/unapproved/.env');
        return raw;
      });
      const port = create({ ...h.options, process: h.process });
      const handle = port.beginOwnedReset(request(h.mock.plan));
      if (fault === 'lease')
        h.mock.fs.put('/proc/locks', { bytes: Buffer.alloc(0) });
      if (fault === 'source')
        h.mock.fs.put(predecessor.path, { bytes: Buffer.from('select 8;\n') });
      if (fault === 'unexpected pre-reset identity')
        h.mock.state.containerId = 'f'.repeat(64);
      await expect(port.completeOwnedReset(handle)).rejects.toThrow();
      expect(h.process.spawn).not.toHaveBeenCalled();
    });

  it('DR-RN-H06 completion cannot settle on client close before independent backend drain returns', async () => {
    const create = await bridge();
    const h = await harness();
    await heldCompletion(h, create(h.options), 'backend', true);
  });

  for (const [failure, applicationName] of [
    ['nonzero', 'owned-reset'],
    ['cancelled', 'owned-reset'],
    ['backend remains', 'owned-reset'],
    ['backend remains Effect', '@effect/sql-pg'],
    ['backend remains raw Pg', ''],
    ['backend remains unrelated', 'unrelated-client'],
  ] as const)
    it(`DR-RN-H07 ${failure} produces no success; recovery needs the same owned drained candidate`, async () => {
      const create = await bridge();
      const h = await harness();
      if (failure === 'nonzero') h.control.status = 1;
      if (failure === 'cancelled') h.control.signal = 'SIGTERM';
      if (failure.startsWith('backend remains'))
        h.control.backends = [
          {
            pid: 601,
            backendStart: 'unit-start-1',
            applicationName,
          },
        ];
      const port = create(h.options);
      const handle = port.beginOwnedReset(request(h.mock.plan));
      await expect(port.completeOwnedReset(handle)).rejects.toThrow();
      if (failure.startsWith('backend remains'))
        await expect(port.proveRecoveryOwnership(handle)).rejects.toThrow();
      else
        await expect(
          port.proveRecoveryOwnership(handle),
        ).resolves.toMatchObject({ before: image(0), after: image(1) });
      expect(h.process.spawn).toHaveBeenCalledTimes(1);
      h.mock.state.containerId = 'f'.repeat(64);
      await expect(port.proveRecoveryOwnership(handle)).rejects.toThrow();
      expect(h.process.spawn).toHaveBeenCalledTimes(1);
    });

  for (const failure of ['nonzero', 'cancelled'] as const)
    for (const fault of [
      'daemon',
      'lease',
      'foreign replacement',
      'source',
    ] as const)
      it(`DR-RN-H07-first ${failure}: ${fault} before FIRST recovery cannot adopt stale ownership`, async () => {
        const create = await bridge();
        const h = await harness();
        if (failure === 'nonzero') h.control.status = 1;
        else h.control.signal = 'SIGTERM';
        const port = create(h.options);
        const handle = port.beginOwnedReset(request(h.mock.plan));
        await expect(port.completeOwnedReset(handle)).rejects.toThrow();
        drift(h, fault);
        await expect(port.proveRecoveryOwnership(handle)).rejects.toThrow();
        expect(h.process.spawn).toHaveBeenCalledTimes(1);
      });

  it('DR-RN-H08 pending authority is a private copy, not mutable caller buffers/argv/identity', async () => {
    const create = await bridge();
    const h = await harness();
    const port = create(h.options);
    const input = request(h.mock.plan);
    const handle = port.beginOwnedReset(input);
    input.command.args.push('--linked');
    input.priorIdentity.containerId = 'f'.repeat(64);
    input.inventory[0]!.bytes.fill(120);
    const result = await port.completeOwnedReset(handle);
    expect(result).toMatchObject({
      before: image(0),
      after: image(1),
      inventorySha256: manifest([predecessor]),
    });
    expect(h.process.spawn).toHaveBeenCalledTimes(1);
    exact(
      await h.mock.fs.readFile(predecessor.path),
      Buffer.from('select 0;\n'),
      'actual source preserved',
    );
  });

  for (const fault of [
    'lease',
    'daemon',
    'owner',
    'OID',
    'foreign replacement',
    'source',
  ] as const)
    it(`DR-RN-H09 unexpected post-create ${fault} is not an owned renewal exception`, async () => {
      const create = await bridge();
      const h = await harness();
      h.control.afterCreate = () => drift(h, fault);
      const port = create(h.options);
      const handle = port.beginOwnedReset(request(h.mock.plan));
      await expect(port.completeOwnedReset(handle)).rejects.toThrow();
      await expect(port.proveRecoveryOwnership(handle)).rejects.toThrow();
      expect(h.process.spawn).toHaveBeenCalledTimes(1);
    });

  for (const channel of ['descendant', 'daemon'] as const)
    it(`DR-RN-H10 ${channel} observation independently gates completion after client close`, async () => {
      const create = await bridge();
      const h = await harness();
      await heldCompletion(h, create(h.options), channel);
    });

  for (const active of [
    'native descendant',
    'daemon exec',
    'daemon job',
  ] as const)
    it(`DR-RN-H10-active a live ${active} forbids completion and recovery until terminal raw facts`, async () => {
      const create = await bridge();
      const h = await harness();
      h.control.retainedNative = active === 'native descendant';
      h.control.daemonRunning = active === 'daemon exec';
      h.control.daemonJobRunning = active === 'daemon job';
      const port = create(h.options);
      const handle = port.beginOwnedReset(request(h.mock.plan));
      await expect(port.completeOwnedReset(handle)).rejects.toThrow();
      await expect(port.proveRecoveryOwnership(handle)).rejects.toThrow();
      if (active === 'native descendant') {
        expect(h.launcher.live()).toMatchObject([
          { pid: 9002, parentPid: 1, startTicks: '45002' },
        ]);
        h.launcher.close();
      } else if (active === 'daemon exec') {
        expect(h.launcher.daemonWork.execs[0]).toMatchObject({
          Running: true,
          Pid: 12001,
        });
        Object.assign(h.launcher.daemonWork.execs[0]!, {
          Running: false,
          Pid: 0,
        });
      } else {
        expect(h.launcher.daemonWork.jobs).toEqual([
          { Id: 'unit-owned-job', Running: true, ExitCode: null },
        ]);
        Object.assign(h.launcher.daemonWork.jobs[0]!, {
          Running: false,
          ExitCode: 0,
        });
      }
      await expect(port.proveRecoveryOwnership(handle)).resolves.toMatchObject({
        before: image(0),
        after: image(1),
      });
      expect(h.process.spawn).toHaveBeenCalledTimes(1);
    });

  for (const role of ['shell', 'node', 'launcher', 'native'] as const)
    for (const kind of ['bytes', 'identity'] as const)
      it(`DR-RN-H11 changed ${role} ${kind} refuses before any launch`, async () => {
        const create = await bridge();
        const h = await harness();
        const port = create(h.options);
        const handle = port.beginOwnedReset(request(h.mock.plan));
        await h.launcher.faultArtifact(role, kind);
        await expect(port.completeOwnedReset(handle)).rejects.toThrow();
        await expect(port.proveRecoveryOwnership(handle)).rejects.toThrow();
        expect(h.process.spawn).not.toHaveBeenCalled();
      });

  for (const command of ['direct native', 'alternate shim'] as const)
    it(`DR-RN-H12 ${command} cannot replace the fixed plan request command`, async () => {
      const create = await bridge();
      const h = await harness();
      const port = create(h.options);
      const input = request(h.mock.plan);
      input.command.command =
        command === 'direct native'
          ? h.binding.executables.native.path
          : '/unit/trusted/supabase';
      await expect(async () => {
        await port.completeOwnedReset(port.beginOwnedReset(input));
      }).rejects.toThrow();
      expect(h.process.spawn).not.toHaveBeenCalled();
    });
});
