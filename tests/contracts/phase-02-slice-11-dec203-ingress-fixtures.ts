import { join } from 'node:path';
import { getuid } from 'node:process';

import { expect, vi } from 'vitest';

import { harness } from './phase-02-slice-11-delivery-receiving-upgrade-host-renewal-fixtures';
import { realModule } from './phase-02-slice-11-delivery-receiving-upgrade-renewal-fixtures';

export const parts = ['parent', 'socket'] as const;
export type Part = (typeof parts)[number];
type Observed = {
  device: bigint;
  inode: bigint;
  mode: number;
  uid: number;
  kind: 'directory' | 'socket' | 'file' | 'symlink';
  realpath: string;
};
type BindingApi = {
  assertBinding(binding: unknown): void;
  verifyExecutables(fs: unknown, binding: unknown): Promise<void>;
};

export async function bindingApi(): Promise<BindingApi> {
  const module = await realModule(
    'infra/database-upgrades/delivery-receiving-upgrade-host-executables.mjs',
    ['assertBinding', 'verifyExecutables'],
  );
  return module as unknown as BindingApi;
}

// Synthetic filesystem observations only. No listener, native process or authority.
export async function ingressFixture(
  parentPath = '/unit/dec203-private-01',
  sameInodeDifferentDevice = false,
) {
  const h = await harness();
  const uid = getuid!();
  const socketPath = `${parentPath}/docker.sock`;
  const legacy = structuredClone(h.binding);
  Reflect.deleteProperty(legacy, 'ingress');
  legacy.environment.DOCKER_HOST = 'unix:///run/docker.sock';
  const binding = {
    ...structuredClone(legacy),
    ingress: {
      parent: {
        path: parentPath,
        device: '9007199254740993',
        inode: '9007199254740997',
        mode: 0o040700,
        uid,
      },
      socket: {
        path: socketPath,
        device: '9007199254740993',
        inode: '9007199254741009',
        mode: 0o140600,
        uid,
      },
      endpoint: `unix://${socketPath}`,
      upstreamEndpoint: 'unix:///run/docker.sock',
    },
  };
  binding.environment.DOCKER_HOST = `unix://${socketPath}`;
  // Independent literal kernel-style facts; never generated from binding members.
  const raw: Record<Part, Observed> = {
    parent: {
      device: 9007199254740993n,
      inode: 9007199254740997n,
      mode: 0o040700,
      uid,
      kind: 'directory',
      realpath: parentPath,
    },
    socket: {
      device: 9007199254740993n,
      inode: 9007199254741009n,
      mode: 0o140600,
      uid,
      kind: 'socket',
      realpath: socketPath,
    },
  };
  if (sameInodeDifferentDevice) {
    binding.ingress.socket.device = '9007199254740995';
    binding.ingress.socket.inode = '9007199254740997';
    raw.socket.device = 9007199254740995n;
    raw.socket.inode = 9007199254740997n;
  }
  const missing = new Set<Part>();
  const artifactModes = new Map<string, number>();
  const originalLstat = h.mock.fs.lstat.bind(h.mock.fs);
  const originalRealpath = h.mock.fs.realpath.bind(h.mock.fs);
  const role = (path: string): Part | undefined =>
    path === parentPath ? 'parent' : path === socketPath ? 'socket' : undefined;
  function observe(part: Part, bigint = false) {
    if (missing.has(part)) throw new Error('ENOENT unit ingress');
    const value = raw[part];
    return {
      dev: bigint ? value.device : Number(value.device),
      ino: bigint ? value.inode : Number(value.inode),
      mode: bigint ? BigInt(value.mode) : value.mode,
      uid: bigint ? BigInt(value.uid) : value.uid,
      isDirectory: () => value.kind === 'directory',
      isSocket: () => value.kind === 'socket',
      isFile: () => value.kind === 'file',
      isSymbolicLink: () => value.kind === 'symlink',
    };
  }
  const fs = {
    lstat: vi.fn(async (path: string, options?: { bigint?: boolean }) => {
      const part = role(path);
      if (part) return observe(part, options?.bigint);
      const value = await originalLstat(path);
      return { ...value, mode: artifactModes.get(path) ?? value.mode };
    }),
    realpath: vi.fn(async (path: string) => {
      const part = role(path);
      if (part && missing.has(part)) throw new Error('ENOENT unit ingress');
      return part ? raw[part].realpath : originalRealpath(path);
    }),
    readFile: vi.fn(h.mock.fs.readFile.bind(h.mock.fs)),
    stat: vi.fn(async (path: string, options?: { bigint?: boolean }) => {
      const part = role(path);
      return part ? observe(part, options?.bigint) : h.mock.fs.stat(path);
    }),
  };
  return { h, uid, legacy, binding, raw, missing, artifactModes, fs };
}

export type IngressFixture = Awaited<ReturnType<typeof ingressFixture>>;
export function profilePremises(f: IngressFixture) {
  expect(Object.keys(f.binding).sort()).toEqual([
    'artifacts',
    'daemon',
    'derivedEnvironment',
    'dotenv',
    'environment',
    'executables',
    'ingress',
    'package',
  ]);
  expect(Object.keys(f.binding.ingress).sort()).toEqual([
    'endpoint',
    'parent',
    'socket',
    'upstreamEndpoint',
  ]);
  for (const part of parts) {
    expect(Object.keys(f.binding.ingress[part]).sort()).toEqual([
      'device',
      'inode',
      'mode',
      'path',
      'uid',
    ]);
    expect(f.binding.ingress[part].uid).toBe(f.uid);
  }
  expect(f.binding.ingress.parent.mode).toBe(0o040700);
  expect(f.binding.ingress.socket.mode).toBe(0o140600);
  expect(f.binding.ingress.socket.path).toBe(
    '/unit/dec203-private-01/docker.sock',
  );
  expect(f.binding.ingress.endpoint).toBe(
    'unix:///unit/dec203-private-01/docker.sock',
  );
  expect(f.binding.ingress.upstreamEndpoint).toBe('unix:///run/docker.sock');
  expect(f.binding.daemon.endpoint).toBe('unix:///run/docker.sock');
  expect(f.binding.environment.DOCKER_HOST).toBe(
    'unix:///unit/dec203-private-01/docker.sock',
  );
}

export function noProcess(fixture: IngressFixture) {
  expect(fixture.h.process.spawn).not.toHaveBeenCalled();
  expect(fixture.h.process.run).not.toHaveBeenCalled();
  expect(fixture.h.process.observeBoundary).not.toHaveBeenCalled();
}

export function changePath(f: IngressFixture, part: Part, path: unknown) {
  Object.assign(f.binding.ingress[part], { path });
  if (part !== 'parent' || typeof path !== 'string') return;
  const socket = join(path, 'docker.sock');
  f.binding.ingress.socket.path = socket;
  f.binding.ingress.endpoint = `unix://${socket}`;
  f.binding.environment.DOCKER_HOST = `unix://${socket}`;
}

export async function rejectsShape(change: (f: IngressFixture) => void) {
  const api = await bindingApi();
  const f = await ingressFixture();
  api.assertBinding(f.binding);
  change(f);
  let failure: unknown;
  try {
    api.assertBinding(f.binding);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  expect(String(failure)).not.toContain('DEC197_LOCAL_HOST_');
  for (const spy of Object.values(f.fs)) expect(spy).not.toHaveBeenCalled();
  noProcess(f);
}

export async function rejectsObservation(
  change: (f: IngressFixture) => void | Promise<void>,
) {
  const api = await bindingApi();
  const f = await ingressFixture();
  await api.verifyExecutables(f.fs, f.binding);
  for (const spy of Object.values(f.fs)) spy.mockClear();
  const pin = JSON.stringify(f.binding);
  await change(f);
  const failure = await api.verifyExecutables(f.fs, f.binding).then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(failure).toBeInstanceOf(Error);
  expect(String(failure)).not.toContain('DEC197_LOCAL_HOST_');
  expect(JSON.stringify(f.binding)).toBe(pin);
  noProcess(f);
  return f;
}

export const selectorFaults = [
  [
    'private endpoint fallback',
    'ingress',
    'endpoint',
    'unix:///run/docker.sock',
  ],
  ['remote private endpoint', 'ingress', 'endpoint', 'tcp://foreign:2375'],
  ['wrong private socket', 'ingress', 'endpoint', 'unix:///unit/other.sock'],
  [
    'private upstream',
    'ingress',
    'upstreamEndpoint',
    'unix:///unit/other.sock',
  ],
  ['remote upstream', 'ingress', 'upstreamEndpoint', 'tcp://foreign:2375'],
  ['remote daemon', 'daemon', 'endpoint', 'tcp://foreign:2375'],
  [
    'environment fallback',
    'environment',
    'DOCKER_HOST',
    'unix:///run/docker.sock',
  ],
  ['remote environment', 'environment', 'DOCKER_HOST', 'tcp://foreign:2375'],
  ['ambient context', 'environment', 'DOCKER_CONTEXT', 'foreign'],
  [
    'binary override',
    'environment',
    'SUPABASE_CLI_BINARY_OVERRIDE',
    '/unit/other',
  ],
  ['relative PATH', 'environment', 'PATH', '.:/usr/bin'],
  ['changed package', 'package', 'version', '2.117.0'],
  ['non-string endpoint', 'ingress', 'endpoint', false],
  ['absent child host value', 'environment', 'DOCKER_HOST', undefined],
  ['dotenv fallback', 'dotenv', '0', '/unit/forbidden.env'],
] as const;

export const decimalEdges = parts.flatMap((part) =>
  (['device', 'inode'] as const).flatMap((key) =>
    (key === 'device'
      ? ['1\n', '1\r\n', '1 ', '0 ']
      : ['1\n', '1\r\n', '1 ']
    ).map((value) => ({ part, key, value })),
  ),
);

export async function equalInodeControl() {
  const api = await bindingApi();
  const f = await ingressFixture(undefined, true);
  expect(f.binding.ingress.parent.device).toBe('9007199254740993');
  expect(f.binding.ingress.socket.device).toBe('9007199254740995');
  expect(f.binding.ingress.parent.inode).toBe('9007199254740997');
  expect(f.binding.ingress.socket.inode).toBe('9007199254740997');
  expect(f.raw.parent.device).toBe(9007199254740993n);
  expect(f.raw.socket.device).toBe(9007199254740995n);
  expect(f.raw.parent.inode).toBe(9007199254740997n);
  expect(f.raw.socket.inode).toBe(9007199254740997n);
  await expect(api.verifyExecutables(f.fs, f.binding)).resolves.toBeUndefined();
  noProcess(f);
}
