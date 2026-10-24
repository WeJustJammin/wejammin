import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs, fstatSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const headerNames = [
  'js_native_api.h',
  'js_native_api_types.h',
  'node_api.h',
  'node_api_types.h',
];
export const sha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');

export async function artifact(path) {
  const stat = await fs.lstat(path, { bigint: true });
  assert.ok(stat.isFile() && !stat.isSymbolicLink());
  assert.equal(await fs.realpath(path), path);
  return {
    path,
    sha256: sha256(await fs.readFile(path)),
    device: String(stat.dev),
    inode: String(stat.ino),
    size: Number(stat.size),
    mode: Number(stat.mode),
    uid: Number(stat.uid),
  };
}

function deepFrozen(value) {
  assert.ok(Object.isFrozen(value));
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === 'object') deepFrozen(child);
  }
}

export async function assertMetadata(reader, fixture, sourceDirectory) {
  assert.deepEqual(Object.keys(reader).sort(), ['close', 'metadata', 'read']);
  assert.ok(Object.isFrozen(reader));
  assert.equal(typeof reader.read, 'function');
  assert.equal(typeof reader.close, 'function');
  const metadata = reader.metadata;
  deepFrozen(metadata);
  assert.deepEqual(Object.keys(metadata).sort(), [
    'compiler',
    'headers',
    'node',
    'output',
    'source',
  ]);
  assert.deepEqual(metadata.node, {
    path: await fs.realpath(process.execPath),
    version: 'v22.23.1',
    napi: 8,
  });
  assert.deepEqual(
    metadata.source,
    await artifact(join(sourceDirectory, 'peer-credentials.c')),
  );
  assert.deepEqual(
    metadata.compiler,
    await artifact(fixture.options.compilerPath),
  );
  assert.deepEqual(
    metadata.headers,
    await Promise.all(
      headerNames.map((name) =>
        artifact(join(fixture.options.includeDirectory, name)),
      ),
    ),
  );
  assert.deepEqual(
    metadata.output,
    await artifact(join(fixture.run, 'peer-credentials.node')),
  );
}

export function assertPeer(value, socket, pid) {
  const stat = fstatSync(socket._handle.fd, { bigint: true });
  assert.deepEqual(value, {
    pid,
    uid: process.getuid(),
    gid: process.getgid(),
    device: String(stat.dev),
    inode: String(stat.ino),
  });
  assert.ok(Object.isFrozen(value));
  assert.ok(Number.isInteger(value.pid));
  assert.match(value.device, /^(0|[1-9][0-9]*)$/);
  assert.match(value.inode, /^[1-9][0-9]*$/);
}

export function addonOf(reader) {
  return createRequire(import.meta.url)(reader.metadata.output.path);
}
