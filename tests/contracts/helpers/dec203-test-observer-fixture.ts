import assert from 'node:assert/strict';
import type { BigIntStats } from 'node:fs';
import type { Mock } from 'vitest';
import { join } from 'node:path';

export type RealFs = typeof import('node:fs');
export const repository = '/home/rob/.codex/worktrees/phase2-slice12/WeJammin';
export const native = join(
  repository,
  'infra/database-upgrades/native-tracing',
);
export const node =
  '/home/rob/.cache/chrome-gate-runtime/node-v22.23.1-linux-x64/bin/node';
export const gcc = '/usr/bin/gcc';
export const launcher = join(native, 'receiving-native-launch.mjs');
export const lockPaths = [
  '/tmp/wejammin-supabase-ci.lock',
  '/tmp/wejammin-quiet.lock',
  '/tmp/wejammin-altdb.lock',
  '/tmp/wejammin-reset.lock',
];
export type Artifact = {
  path: string;
  sha256: string;
  device: string;
  inode: string;
  size: number;
  mode: number;
  uid: number;
};
export type ArtifactCache = {
  readonly root: string | null;
  capture(path: string): Artifact;
  bindRoot(root: string): void;
  observed(path: string): Artifact;
};
export type ArtifactConstructor = new () => ArtifactCache;
export type Io = Record<
  'open' | 'read' | 'close' | 'lstat' | 'stat' | 'link' | 'names',
  Mock<(...args: unknown[]) => unknown>
>;
export type Raw = {
  pid: number;
  ppid: number;
  group: number;
  session: number;
  startTime: string;
  uid: number;
  image: string;
  namespace: string;
};
export const procMethods = {
  open: 'openSync',
  read: 'readSync',
  close: 'closeSync',
  lstat: 'lstatSync',
  stat: 'statSync',
  link: 'readlinkSync',
  names: 'readdirSync',
} as const;
const profiles = [
  {
    path: node,
    uid: 1000,
    mode: 0o100755,
    sha256: '93956de2e59480474a7b46571da1651180b1a050cdf32641ebec4ce6e478e068',
  },
  {
    path: gcc,
    uid: 0,
    mode: 0o100755,
    // The host's system compiler: re-pinned 2026-10-29 after the 2026-10-27 pacman upgrade gcc 16.2.1-1 -> 16.2.1-3.
    sha256: 'b0b49531b313e70aee0254fb5e69b050a781506184e16ebee6ebe68eee94a145',
  },
];

export function ownedFixture(fs: RealFs, Constructor: ArtifactConstructor) {
  assert.ok(typeof process.getuid === 'function');
  const uid = process.getuid();
  const root = fs.mkdtempSync('/tmp/dec203-observer-unit-');
  const owner = join(root, 'owner');
  const lease = join(root, 'lease');
  const ownerFile = join(owner, 'receiving-lease-owner');
  const births = new Map<string, BigIntStats>();
  const uncertain = new Set([root]);
  let cleaned = false;
  const remember = (path: string) => {
    births.set(path, fs.lstatSync(path, { bigint: true }));
    uncertain.delete(path);
  };
  const cleanup = () => {
    if (cleaned) return;
    assert.equal(uncertain.size, 0, 'retain uncertain fixture creation');
    assert.equal(fs.realpathSync(root), root);
    for (const [path, birth] of births) {
      const now = fs.lstatSync(path, { bigint: true });
      for (const key of ['dev', 'ino', 'uid', 'mode'] as const)
        assert.equal(now[key], birth[key], 'refuse replaced owned fixture');
      assert.equal(now.uid, BigInt(uid));
      assert.ok(!now.isSymbolicLink());
      assert.ok(path === ownerFile ? now.isFile() : now.isDirectory());
    }
    assert.deepEqual(
      fs.readdirSync(root).sort(),
      ['owner', 'lease'].filter((name) => births.has(join(root, name))).sort(),
    );
    if (births.has(owner))
      assert.deepEqual(
        fs.readdirSync(owner),
        births.has(ownerFile) ? ['receiving-lease-owner'] : [],
      );
    if (births.has(lease)) assert.deepEqual(fs.readdirSync(lease), []);
    if (births.has(ownerFile)) fs.unlinkSync(ownerFile);
    if (births.has(lease)) fs.rmdirSync(lease);
    if (births.has(owner)) fs.rmdirSync(owner);
    fs.rmdirSync(root);
    cleaned = true;
  };
  try {
    remember(root);
    for (const path of [owner, lease]) {
      uncertain.add(path);
      fs.mkdirSync(path, { mode: 0o700 });
      remember(path);
    }
    for (const path of [root, owner, lease])
      assert.equal(births.get(path)?.mode, 0o040700n);
    uncertain.add(ownerFile);
    // Captured fixture bytes only: never compiled or executed as an owner.
    fs.writeFileSync(ownerFile, 'observer unit artifact\n', {
      flag: 'wx',
      mode: 0o700,
    });
    remember(ownerFile);
    assert.equal(births.get(ownerFile)?.mode, 0o100700n);
    const artifacts = new Constructor();
    for (const expected of profiles) {
      const actual = fs.lstatSync(expected.path, { bigint: true });
      assert.ok(actual.isFile() && !actual.isSymbolicLink());
      assert.equal(actual.uid, BigInt(expected.uid));
      assert.equal(actual.mode, BigInt(expected.mode));
      assert.ok(actual.size > 0n && actual.size <= 134_217_728n);
      const captured = artifacts.capture(expected.path);
      assert.equal(captured.sha256, expected.sha256);
      assert.equal(captured.uid, expected.uid);
      assert.equal(captured.mode, expected.mode);
      assert.equal(captured.size, Number(actual.size));
    }
    return { root, ownerFile, uid, artifacts, cleanup };
  } catch (error) {
    let cleanupFailed = false;
    let cleanupFailure;
    try {
      cleanup();
    } catch (caught) {
      cleanupFailed = true;
      cleanupFailure = caught;
    }
    if (cleanupFailed) {
      throw new AggregateError(
        [error, cleanupFailure],
        'owned fixture retained',
        { cause: error },
      );
    }
    throw error;
  }
}
export type OwnedFixture = ReturnType<typeof ownedFixture>;
