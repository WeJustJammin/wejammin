import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import {
  bindingApi,
  changePath,
  decimalEdges,
  equalInodeControl,
  ingressFixture,
  noProcess,
  parts,
  profilePremises,
  rejectsObservation,
  rejectsShape,
  selectorFaults,
} from './phase-02-slice-11-dec203-ingress-fixtures';

describe('DEC203 closed private ingress binding, injected observations only', () => {
  it('IB01 accepts the exact eight-key profile without granting I/O authority', async () => {
    const api = await bindingApi();
    const f = await ingressFixture();
    profilePremises(f);
    expect(api.assertBinding(f.binding)).toBeUndefined();
    for (const spy of Object.values(f.fs)) expect(spy).not.toHaveBeenCalled();
    noProcess(f);
  });

  it('IB02 refuses the otherwise valid legacy seven-key binding', async () => {
    const api = await bindingApi();
    const f = await ingressFixture();
    expect(Object.keys(f.legacy)).toHaveLength(7);
    expect(f.legacy.environment.DOCKER_HOST).toBe('unix:///run/docker.sock');
    expect(() => api.assertBinding(f.legacy)).toThrow();
    noProcess(f);
  });

  it('IB03 verifies independent lossless observations and retains all artifact reads', async () => {
    const api = await bindingApi();
    const f = await ingressFixture();
    expect(Number(f.raw.parent.device)).toBe(9007199254740992);
    expect(f.binding.ingress.parent.device).toBe('9007199254740993');
    await expect(
      api.verifyExecutables(f.fs, f.binding),
    ).resolves.toBeUndefined();
    for (const part of parts) {
      const path = f.binding.ingress[part].path;
      expect(f.fs.lstat.mock.calls.some(([seen]) => seen === path)).toBe(true);
      expect(f.fs.realpath.mock.calls.some(([seen]) => seen === path)).toBe(
        true,
      );
    }
    const artifacts = [
      ...Object.values(f.binding.executables),
      f.binding.artifacts.launcher,
    ];
    for (const { path } of artifacts)
      expect(f.fs.readFile.mock.calls.some(([seen]) => seen === path)).toBe(
        true,
      );
    noProcess(f);
  });

  for (const part of parts)
    it(`IB04 canonical zero device is valid for ${part}`, async () => {
      const api = await bindingApi();
      const f = await ingressFixture();
      f.binding.ingress[part].device = '0';
      f.raw[part].device = 0n;
      await expect(
        api.verifyExecutables(f.fs, f.binding),
      ).resolves.toBeUndefined();
      noProcess(f);
    });

  it('IB05 accepts a 107-byte UTF-8 socket path, not just short ASCII', async () => {
    const api = await bindingApi();
    const f = await ingressFixture('/' + 'é'.repeat(47));
    expect(Buffer.byteLength(f.binding.ingress.socket.path, 'utf8')).toBe(107);
    await expect(
      api.verifyExecutables(f.fs, f.binding),
    ).resolves.toBeUndefined();
    noProcess(f);
  });

  for (const key of [
    'daemon',
    'executables',
    'artifacts',
    'package',
    'environment',
    'derivedEnvironment',
    'dotenv',
    'ingress',
  ])
    it(`IB06 refuses missing mandatory key ${key} after a valid profile`, async () => {
      await rejectsShape((f) => {
        Reflect.deleteProperty(f.binding, key);
      });
    });

  for (const location of ['root', 'ingress', ...parts] as const)
    it(`IB07 refuses unknown ${location} fields after a valid profile`, async () => {
      await rejectsShape((f) => {
        const value =
          location === 'root'
            ? f.binding
            : location === 'ingress'
              ? f.binding.ingress
              : f.binding.ingress[location];
        Object.assign(value, { unexpected: true });
      });
    });

  for (const key of ['parent', 'socket', 'endpoint', 'upstreamEndpoint'])
    it(`IB08 refuses missing ingress ${key} after a valid profile`, async () => {
      await rejectsShape((f) => {
        Reflect.deleteProperty(f.binding.ingress, key);
      });
    });

  for (const part of parts) {
    for (const value of [null, []])
      it(`IB20 refuses non-record ${part} ${JSON.stringify(value)}`, async () => {
        await rejectsShape((f) => {
          Object.assign(f.binding.ingress, { [part]: value });
        });
      });

    for (const key of ['path', 'device', 'inode', 'mode', 'uid'])
      it(`IB09 refuses missing ${part}.${key} after a valid profile`, async () => {
        await rejectsShape((f) => {
          Reflect.deleteProperty(f.binding.ingress[part], key);
        });
      });

    for (const key of ['device', 'inode'])
      for (const value of ['', '01', '-1', '1.0', '1e3', ' 1', 1, null])
        it(`IB10 rejects ${part}.${key} ${typeof value}:${value}`, async () => {
          await rejectsShape((f) => {
            Object.assign(f.binding.ingress[part], { [key]: value });
          });
        });

    it(`IB11 refuses zero ${part} inode`, async () => {
      await rejectsShape((f) => {
        f.binding.ingress[part].inode = '0';
      });
    });

    for (const value of [-1, 0.5, 'same-as-text', 'foreign', 'next-uid'])
      it(`IB12 refuses ${part} UID ${typeof value}:${value}`, async () => {
        await rejectsShape((f) => {
          const uid =
            value === 'same-as-text'
              ? String(f.uid)
              : value === 'next-uid'
                ? f.uid + 1
                : value;
          Object.assign(f.binding.ingress[part], { uid });
        });
      });

    for (const path of [
      false,
      'relative',
      '/unit//private',
      '/unit/../private',
      '/unit/a\0b',
      '/unit/a\rb',
      '/unit/a\nb',
    ])
      it(`IB13 refuses malformed ${part} path ${JSON.stringify(path)}`, async () => {
        await rejectsShape((f) => {
          changePath(f, part, path);
        });
      });

    for (const mode of part === 'parent'
      ? [0o700, 0o100700, 0o040755, String(0o040700)]
      : [0o600, 0o100600, 0o140666, String(0o140600)])
      it(`IB14 refuses wrong full ${part} mode ${typeof mode}:${mode}`, async () => {
        await rejectsShape((f) => {
          Object.assign(f.binding.ingress[part], { mode });
        });
      });
  }

  for (const [label, member, key, value] of selectorFaults)
    it(`IB15 refuses ${label} after a valid profile`, async () => {
      await rejectsShape((f) => {
        Object.assign(f.binding[member], { [key]: value });
      });
    });

  for (const parent of ['/' + 'a'.repeat(95), '/' + 'é'.repeat(48)])
    it(`IB16 refuses ${Buffer.byteLength(parent)}-byte parent/socket overflow`, async () => {
      const api = await bindingApi();
      const f = await ingressFixture(parent);
      expect(f.binding.ingress.socket.path.length).toBeLessThan(109);
      expect(
        Buffer.byteLength(f.binding.ingress.socket.path),
      ).toBeGreaterThanOrEqual(108);
      expect(() => api.assertBinding(f.binding)).toThrow();
      noProcess(f);
    });

  it('IB17 refuses duplicate parent/socket device-inode identity', async () => {
    await rejectsShape((f) => {
      f.binding.ingress.socket.inode = f.binding.ingress.parent.inode;
    });
  });

  it('IB21 refuses a coherent socket/endpoint alias of the upstream daemon', async () => {
    const api = await bindingApi();
    const f = await ingressFixture('/run');
    expect(f.binding.ingress.socket.path).toBe('/run/docker.sock');
    expect(f.binding.ingress.endpoint).toBe(f.binding.daemon.endpoint);
    expect(() => api.assertBinding(f.binding)).toThrow();
    noProcess(f);
  });

  for (const value of [null, [], true])
    it(`IB22 refuses non-record ingress ${JSON.stringify(value)}`, async () => {
      await rejectsShape((f) => {
        Object.assign(f.binding, { ingress: value });
      });
    });

  for (const part of parts)
    for (const fault of [
      'missing',
      'realpath',
      'symlink',
      'kind',
      'mode',
      'uid',
      'device',
      'inode',
    ])
      it(`IB18 observes ${part} ${fault}, not DTO echo`, async () => {
        const f = await rejectsObservation((f) => {
          const raw = f.raw[part];
          if (fault === 'missing') f.missing.add(part);
          if (fault === 'realpath') raw.realpath = '/unit/foreign';
          if (fault === 'symlink') {
            raw.kind = 'symlink';
            raw.mode = 0o120777;
          }
          if (fault === 'kind') {
            raw.kind = 'file';
            raw.mode = 0o100600;
          }
          if (fault === 'mode') raw.mode += 0o004;
          if (fault === 'uid') raw.uid += 1;
          if (fault === 'device') raw.device -= 1n;
          if (fault === 'inode') raw.inode -= 1n;
        });
        const calls =
          fault === 'realpath'
            ? f.fs.realpath.mock.calls
            : fault === 'missing'
              ? [...f.fs.lstat.mock.calls, ...f.fs.realpath.mock.calls]
              : f.fs.lstat.mock.calls;
        expect(
          calls.some(([path]) => path === f.binding.ingress[part].path),
        ).toBe(true);
      });

  for (const role of [
    'supabase',
    'shell',
    'node',
    'native',
    'docker',
    'launcher',
  ] as const)
    for (const fault of ['bytes', 'mode'] as const)
      it(`IB19 retains ${role} ${fault} refusal with private ingress`, async () => {
        await rejectsObservation(async (f) => {
          const file =
            role === 'launcher'
              ? f.binding.artifacts.launcher
              : f.binding.executables[role];
          if (fault === 'bytes')
            await f.h.launcher.faultArtifact(role, 'bytes');
          else f.artifactModes.set(file.path, file.mode + 0o004);
        });
      });

  for (const { part, key, value } of decimalEdges)
    it(`IB23 rejects ${part}.${key} ${JSON.stringify(value)}`, async () => {
      await rejectsShape((f) => {
        Object.assign(f.binding.ingress[part], { [key]: value });
      });
    });

  it('IB24 accepts equal inode on different devices', equalInodeControl);
});
