import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import {
  harness,
  request,
  type OwnedPort,
} from './phase-02-slice-11-delivery-receiving-upgrade-host-renewal-fixtures';
import {
  exact,
  image,
  realModule,
} from './phase-02-slice-11-delivery-receiving-upgrade-renewal-fixtures';

async function bridge() {
  const module = await realModule(
    'infra/database-upgrades/delivery-receiving-upgrade-host-reset.mjs',
    ['createOwnedResetPort'],
  );
  return module.createOwnedResetPort as (options: unknown) => OwnedPort;
}

describe('DEC-197 host observed-mode and raw-selector regressions', () => {
  it('DR-HB-01 attested full raw artifact modes succeed with closed descriptors', async () => {
    const create = await bridge();
    const h = await harness();
    for (const artifact of Object.values(h.binding.executables)) {
      expect(Object.keys(artifact).sort()).toEqual([
        'dev',
        'inode',
        'mode',
        'path',
        'sha256',
      ]);
      expect(artifact.mode).toBe(0o100755);
    }
    expect(Object.keys(h.binding.artifacts.launcher).sort()).toEqual([
      'dev',
      'inode',
      'invokedPath',
      'mode',
      'path',
      'sha256',
    ]);
    expect(h.binding.artifacts.launcher.mode).toBe(0o100600);
    const port = create(h.options);
    const handle = port.beginOwnedReset(request(h.mock.plan));
    await expect(port.completeOwnedReset(handle)).resolves.toMatchObject({
      status: 0,
      before: image(0),
      after: image(1),
    });
    expect(h.process.spawn).toHaveBeenCalledTimes(1);
  });

  for (const role of [
    'supabase',
    'shell',
    'node',
    'native',
    'docker',
    'launcher',
  ] as const)
    it(`DR-HB-02 stable ${role} mode-only drift refuses before launch`, async () => {
      const create = await bridge();
      const h = await harness();
      const artifact =
        role === 'launcher'
          ? h.binding.artifacts.launcher
          : h.binding.executables[role];
      const original = await h.mock.fs.lstat(artifact.path);
      const bytes = await h.mock.fs.readFile(artifact.path);
      const binding = JSON.stringify(h.binding);
      const port = create(h.options);
      const handle = port.beginOwnedReset(request(h.mock.plan));
      const lstat = h.mock.fs.lstat.bind(h.mock.fs);
      const alteredMode = role === 'launcher' ? 0o100644 : 0o100775;
      h.mock.fs.lstat = async (path: string) => {
        const observed = await lstat(path);
        return path === artifact.path
          ? { ...observed, mode: alteredMode }
          : observed;
      };
      for (let reading = 0; reading < 2; reading++) {
        const observed = await h.mock.fs.lstat(artifact.path);
        expect(observed.mode).toBe(alteredMode);
        expect(observed.mode).not.toBe(original.mode);
        expect([observed.dev, observed.ino]).toEqual([
          original.dev,
          original.ino,
        ]);
        exact(
          await h.mock.fs.readFile(artifact.path),
          bytes,
          'mode-only bytes',
        );
      }
      expect(JSON.stringify(h.binding)).toBe(binding);
      // No mode member is added: current baseline must reach the actual attack.
      await expect(port.completeOwnedReset(handle)).rejects.toThrow();
      await expect(port.proveRecoveryOwnership(handle)).rejects.toThrow();
      expect(h.process.spawn).not.toHaveBeenCalled();
    });

  for (const selector of [
    ['-Htcp://foreign:2375'],
    ['-H', 'tcp://foreign:2375'],
    ['-H=tcp://foreign:2375'],
    ['--host', 'tcp://foreign:2375'],
    ['--host=tcp://foreign:2375'],
    ['--context', 'foreign'],
    ['--context=foreign'],
  ])
    it(`DR-HB-03 consistent raw Docker selector ${selector.join(' ')} refuses`, async () => {
      const create = await bridge();
      const h = await harness();
      const port = create(h.options);
      const handle = port.beginOwnedReset(request(h.mock.plan));
      const created = h.trace.commands[1]!;
      const captured = h.trace.processes.find(
        (item) => item.pid === created.pid,
      )!;
      created.argv = [created.argv[0]!, ...selector, ...created.argv.slice(1)];
      captured.argv = [...created.argv];
      captured.proc.cmdline = Buffer.from(
        [created.executable.path, ...created.argv].join('\0') + '\0',
      );
      expect(created.argv[0]).toBe('create');
      expect(captured.argv).toEqual(created.argv);
      expect(captured.proc.cmdline).toEqual(
        Buffer.from(
          [captured.executable.path, ...captured.argv].join('\0') + '\0',
        ),
      );
      expect(captured.executable).toEqual(h.binding.executables.docker);
      expect([captured.parentPid, captured.startTicks]).toEqual([
        created.parentPid,
        created.startTicks,
      ]);
      await expect(port.completeOwnedReset(handle)).rejects.toThrow();
      await expect(port.proveRecoveryOwnership(handle)).rejects.toThrow();
      expect(h.process.spawn).toHaveBeenCalledTimes(1);
    });

  it('DR-HB-04 artifact constructors require closed full raw-mode descriptors', async () => {
    const create = await bridge();
    const h = await harness();
    const artifacts = (binding: typeof h.binding) =>
      [
        ...Object.values(binding.executables),
        binding.artifacts.launcher,
      ] as Array<Record<string, unknown>>;
    const options = (binding: typeof h.binding) => ({
      ...h.options,
      process: { ...h.process, nativeBinding: binding },
    });
    const missing = structuredClone(h.binding);
    for (const descriptor of artifacts(missing)) delete descriptor.mode;
    expect(
      artifacts(missing).map((descriptor) => Object.hasOwn(descriptor, 'mode')),
    ).toEqual(Array(6).fill(false));
    // First RED must be acceptance of this existing four-field profile, not
    // rejection of a newly added mode member by the old unknown-field guard.
    expect(() => create(options(missing)), 'missing attested modes').toThrow();
    expect(h.process.spawn).not.toHaveBeenCalled();

    const full = structuredClone(h.binding);
    const descriptors = artifacts(full);
    for (const [index, descriptor] of descriptors.entries()) {
      const observed = await h.mock.fs.lstat(String(descriptor.path));
      const literal = index === 5 ? 0o100600 : 0o100755;
      expect(observed.mode).toBe(literal);
      descriptor.mode = observed.mode;
    }
    expect(() => create(options(full)), 'valid full raw modes').not.toThrow();

    const invalid: unknown[] = [
      undefined,
      null,
      false,
      '33188',
      -1,
      0o100755 + 0.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      0x1_0000_0000 + 0o100755,
      Number.MAX_SAFE_INTEGER + 1,
      0o040755,
    ];
    for (let index = 0; index < descriptors.length; index++) {
      const absent = structuredClone(full);
      delete artifacts(absent)[index]!.mode;
      expect(
        () => create(options(absent)),
        `artifact ${index} missing mode`,
      ).toThrow();
      for (const mode of invalid) {
        const malformed = structuredClone(full);
        artifacts(malformed)[index]!.mode = mode;
        expect(
          () => create(options(malformed)),
          `artifact ${index} invalid mode ${String(mode)}`,
        ).toThrow();
      }
      const extra = structuredClone(full);
      artifacts(extra)[index]!.unattested = true;
      expect(
        () => create(options(extra)),
        `artifact ${index} extra field`,
      ).toThrow();
    }
    expect(h.process.spawn).not.toHaveBeenCalled();
    expect(h.mock.readOnlyCalls).toEqual([]);
  });
});
