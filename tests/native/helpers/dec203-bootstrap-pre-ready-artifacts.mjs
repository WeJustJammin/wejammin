import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repository = fileURLToPath(new URL('../../../', import.meta.url));
export const native = join(
  repository,
  'infra/database-upgrades/native-tracing',
);
export const launcher = join(native, 'receiving-native-launch.mjs');
export const coordinator = join(native, 'receiving-native-coordinator.mjs');
export const node =
  '/home/rob/.cache/chrome-gate-runtime/node-v22.23.1-linux-x64/bin/node';
export const gcc = '/usr/bin/gcc';
export const input = 'DEC203_PRE_READY_CLOSE_V1\n';
export const lockPaths = [
  '/tmp/wejammin-supabase-ci.lock',
  '/tmp/wejammin-quiet.lock',
  '/tmp/wejammin-altdb.lock',
  '/tmp/wejammin-reset.lock',
];
export const sourceNames = [
  'receiving-bootstrap-profile.mjs',
  'receiving-bootstrap-profile.h',
  'receiving-bootstrap-resources.mjs',
  'receiving-bootstrap-build.mjs',
  'receiving-bootstrap-compiler.mjs',
  'receiving-bootstrap-artifacts.mjs',
  'receiving-bootstrap-processes.mjs',
  'receiving-bootstrap-workspaces.mjs',
  'receiving-bootstrap-files.mjs',
  'receiving-bootstrap-protocol.mjs',
  'receiving-bootstrap-diagnostic-values.mjs',
  'receiving-bootstrap-diagnostics.mjs',
  'receiving-bootstrap-observe.mjs',
  'receiving-bootstrap-owner.mjs',
  'receiving-native-launch.mjs',
  'receiving-lease.mjs',
  'receiving-native-bootstrap.mjs',
  'receiving-native-coordinator.mjs',
  'receiving-lease-owner.c',
  'receiving-lease.c',
  'receiving-bootstrap-json.h',
  'receiving-bootstrap-frame-values.h',
  'receiving-bootstrap-frame.h',
  'receiving-bootstrap-wire.h',
  'receiving-bootstrap-sha256.h',
  'receiving-bootstrap-process.h',
  'receiving-bootstrap-entry.h',
  'receiving-bootstrap-locks.h',
  'receiving-lease-owner-state.h',
  'receiving-lease-owner-ledger.h',
  'receiving-lease-state.h',
  'receiving-lease-reader.h',
];
export const headers = [
  'js_native_api.h',
  'js_native_api_types.h',
  'node_api.h',
  'node_api_types.h',
].map((name) => join('/usr/include/node', name));

const profile = [
  [
    node,
    '93956de2e59480474a7b46571da1651180b1a050cdf32641ebec4ce6e478e068',
    1000,
    0o100755,
  ],
  [
    gcc,
    '4063c2a4919a7531523a61397052b6582386df1cbe0e558c3ffb045c0717d3bc',
    0,
    0o100755,
  ],
  [
    headers[0],
    '82d3708ce120f8000ec34d72e1aa70b0d7d8a43027986293681374a71b2cb840',
    0,
    0o100644,
  ],
  [
    headers[1],
    'c12406a8c0036aefdb66b98065fc88e2e7a053c1f274deef33af6c26c099b933',
    0,
    0o100644,
  ],
  [
    headers[2],
    '2d4560831e525b47b060ec8a0864ab73993df9e20215ce9f0fe7b24cd31af32a',
    0,
    0o100644,
  ],
  [
    headers[3],
    'a25356630d3058f0a0c8937d9f297e9471e037fda58c2696d8a505c2bd99cb00',
    0,
    0o100644,
  ],
];

export const fileIdentity = (stat) => `${stat.dev}:${stat.ino}`;
const stamp = (stat) =>
  [
    stat.dev,
    stat.ino,
    stat.mode,
    stat.uid,
    stat.gid,
    stat.size,
    stat.mtimeNs,
    stat.ctimeNs,
  ]
    .map(String)
    .join(':');

function readArtifact(path) {
  const named = lstatSync(path, { bigint: true });
  assert.ok(named.isFile() && !named.isSymbolicLink());
  assert.equal(realpathSync(path), path);
  let primary;
  let primaryFailed = false;
  let result;
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const held = fstatSync(fd, { bigint: true });
    assert.equal(stamp(held), stamp(named));
    const hash = createHash('sha256');
    const buffer = Buffer.alloc(65_536);
    let size = 0;
    for (;;) {
      const count = readSync(fd, buffer, 0, buffer.length, null);
      if (!count) break;
      size += count;
      assert.ok(Number.isSafeInteger(size) && BigInt(size) <= held.size);
      hash.update(buffer.subarray(0, count));
    }
    assert.equal(BigInt(size), held.size);
    assert.equal(stamp(fstatSync(fd, { bigint: true })), stamp(held));
    assert.equal(stamp(lstatSync(path, { bigint: true })), stamp(held));
    result = {
      path,
      sha256: hash.digest('hex'),
      device: String(held.dev),
      inode: String(held.ino),
      size,
      mode: Number(held.mode),
      uid: Number(held.uid),
    };
  } catch (error) {
    primary = error;
    primaryFailed = true;
  }
  let closeFailure;
  let closeFailed = false;
  try {
    closeSync(fd);
  } catch (error) {
    closeFailure = error;
    closeFailed = true;
  }
  if (closeFailed) {
    if (primaryFailed)
      throw new AggregateError([primary, closeFailure], 'artifact close', {
        cause: primary,
      });
    throw closeFailure;
  }
  if (primaryFailed) throw primary;
  return { value: result, stamp: stamp(named) };
}

export class Artifacts {
  constructor() {
    this.allowed = new Set([
      node,
      gcc,
      ...headers,
      ...sourceNames.map((name) => join(native, name)),
    ]);
    this.records = new Map();
    this.root = null;
    this.kernelMetadata = null;
  }

  preflight() {
    assert.equal(process.platform, 'linux');
    assert.equal(process.version, 'v22.23.1');
    assert.equal(process.getuid(), 1000);
    assert.equal(realpathSync(process.execPath), node);
    for (const [path, sha256, uid, mode] of profile) {
      const actual = this.capture(path);
      assert.equal(actual.sha256, sha256);
      assert.equal(actual.uid, uid);
      assert.equal(actual.mode, mode);
    }
    for (const name of sourceNames) this.capture(join(native, name));
    this.metadata();
  }

  bindRoot(root) {
    assert.equal(realpathSync(root), root);
    if (this.root !== null) assert.equal(root, this.root);
    for (const path of [root, join(root, 'owner'), join(root, 'lease')]) {
      const stat = lstatSync(path, { bigint: true });
      assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
      assert.equal(stat.mode, 0o040700n);
      assert.equal(stat.uid, BigInt(process.getuid()));
    }
    this.root = root;
    this.allowed.add(join(root, 'owner/receiving-lease-owner'));
    this.allowed.add(join(root, 'lease/receiving-lease.node'));
  }

  capture(path) {
    assert.ok(
      this.allowed.has(path),
      'only fixed inputs and independently derived outputs',
    );
    const previous = this.records.get(path);
    const named = lstatSync(path, { bigint: true });
    if (previous) {
      assert.equal(stamp(named), previous.stamp, 'bound artifact drift');
      return previous.value;
    }
    const actual = readArtifact(path);
    this.records.set(path, actual);
    return actual.value;
  }

  metadata() {
    const target = '/proc/locks';
    const named = lstatSync(target, { bigint: true });
    assert.ok(named.isFile() && !named.isSymbolicLink());
    assert.equal(named.mode, 0o100444n);
    assert.equal(named.uid, 0n);
    assert.equal(named.gid, 0n);
    const value = Object.freeze({
      target,
      device: String(named.dev),
      inode: String(named.ino),
      mode: Number(named.mode),
      uid: Number(named.uid),
      gid: Number(named.gid),
    });
    if (this.kernelMetadata !== null)
      assert.deepEqual(value, this.kernelMetadata, 'bound /proc/locks drift');
    this.kernelMetadata = value;
    return value;
  }

  allowsProcLocks(target, row) {
    if (target !== '/proc/locks') return false;
    const expected = this.metadata();
    assert.equal(row.target, expected.target);
    for (const key of ['device', 'inode', 'mode', 'uid', 'gid'])
      assert.equal(row[key], expected[key]);
    assert.ok(['02400000', '02500000'].includes(row.flags));
    assert.equal(row.pidfd, null);
    return true;
  }

  observed(path) {
    const actual = this.records.get(path);
    assert.ok(
      actual,
      'artifact must have been independently captured while available',
    );
    return actual.value;
  }

  recheckInputs() {
    for (const path of this.allowed) {
      if (this.root && path.startsWith(`${this.root}/`)) continue;
      const before = this.observed(path);
      assert.deepEqual(readArtifact(path).value, before);
    }
    this.metadata();
  }
}
