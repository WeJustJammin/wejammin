import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Fixture, token } from './dec203-peer-harness.mjs';
import { artifact, sha256 } from './dec203-peer-metadata.mjs';
import { bounded, writers } from './dec203-stream-ingress-writers.mjs';

export { assert, fs, token, artifact, bounded, writers };
const subjectURL = new URL(
  '../../../infra/database-upgrades/native-tracing/stream-ingress.mjs',
  import.meta.url,
);
export const supportNames = [
  'stream-ingress-listener.h',
  'stream-ingress-receive.h',
  'stream-ingress-state.h',
  'stream-ingress-values.h',
  'stream-ingress-writer.h',
];
const headers = [
  'js_native_api.h',
  'js_native_api_types.h',
  'node_api.h',
  'node_api_types.h',
];
export const manifest = [
  'peer-artifacts.mjs',
  'stream-ingress.mjs',
  'stream-ingress-facades.mjs',
  'stream-ingress-ownership.mjs',
  'stream-ingress-build.mjs',
  'stream-ingress-compiler.mjs',
  'stream-ingress-output.mjs',
  'stream-ingress.c',
  ...supportNames,
];

export class StreamFixture extends Fixture {
  static async open(context) {
    // This happens inside EVERY case, before allocating any file/process/socket.
    const subject = await import(subjectURL.href);
    assert.equal(typeof subject.buildNativeStreamIngress, 'function');
    assert.equal(process.platform, 'linux');
    assert.equal(process.version, 'v22.23.1');
    const options = {};
    for (const [key, variable] of [
      ['compilerPath', 'DEC203_CC_PATH'],
      ['includeDirectory', 'DEC203_NODE_INCLUDE'],
    ]) {
      const path = process.env[variable];
      assert.ok(typeof path === 'string' && isAbsolute(path), variable);
      assert.equal(await fs.realpath(path), path);
      options[key] = path;
    }
    const root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'ds-')));
    const fixture = new StreamFixture(
      root,
      options,
      subject.buildNativeStreamIngress,
      await fs.lstat(root, { bigint: true }),
    );
    fixture.sourceDirectory = dirname(fileURLToPath(subjectURL));
    fixture.context = context;
    fixture.serial = 0;
    context.after(() => fixture.cleanup());
    fixture.run = await fixture.directory('run');
    return fixture;
  }

  async build(overrides = {}, factory = this.factory) {
    const options = { runDirectory: this.run, ...this.options, ...overrides };
    let ingress;
    const errors = [];
    try {
      ingress = await factory(options);
      this.readers.push(ingress);
    } catch (error) {
      errors.push(error);
    }
    if (errors.some((error) => error.diagnostics?.drainProven === false)) {
      this.defer(() => {
        throw errors[0];
      });
    } else if (this.directories.has(options.runDirectory)) {
      try {
        await this.remember(join(options.runDirectory, 'stream-ingress.node'));
      } catch (error) {
        if (error.code !== 'ENOENT') errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'stream build capture');
    return ingress;
  }

  async copySubject(name = 'subject') {
    const directory = await this.directory(name);
    for (const file of manifest) {
      const source = join(this.sourceDirectory, file);
      const before = await artifact(source);
      const target = await this.file(
        `${name}/${file}`,
        await fs.readFile(source),
      );
      assert.equal(sha256(await fs.readFile(target)), before.sha256);
      assert.deepEqual(await artifact(source), before);
    }
    const subject = await import(
      pathToFileURL(join(directory, 'stream-ingress.mjs'))
    );
    return { directory, factory: subject.buildNativeStreamIngress };
  }

  async cleanup() {
    const errors = [];
    for (const close of [...this.resources].reverse()) {
      try {
        await close();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(
        errors,
        'stream resources uncertain; artifacts retained',
      );
    this.resources = [];
    await super.cleanup();
  }
}

export function shape(value, keys) {
  assert.deepEqual(Reflect.ownKeys(value).sort(), [...keys].sort());
  assert.ok(Object.isFrozen(value));
  for (const descriptor of Object.values(
    Object.getOwnPropertyDescriptors(value),
  )) {
    assert.equal(
      descriptor.get,
      undefined,
      'diagnostics and handles are data properties',
    );
    assert.equal(descriptor.set, undefined);
  }
}

export async function metadata(
  ingress,
  fixture,
  directory = fixture.sourceDirectory,
) {
  shape(ingress, ['accept', 'close', 'endpoint', 'identity', 'metadata']);
  shape(ingress.metadata, [
    'node',
    'source',
    'compiler',
    'headers',
    'supportSources',
    'output',
  ]);
  shape(ingress.metadata.node, ['path', 'version', 'napi']);
  assert.deepEqual(ingress.metadata.node, {
    path: await fs.realpath(process.execPath),
    version: 'v22.23.1',
    napi: 8,
  });
  assert.deepEqual(
    ingress.metadata.source,
    await artifact(join(directory, 'stream-ingress.c')),
  );
  assert.deepEqual(
    ingress.metadata.compiler,
    await artifact(fixture.options.compilerPath),
  );
  assert.deepEqual(
    ingress.metadata.headers,
    await Promise.all(
      headers.map((name) =>
        artifact(join(fixture.options.includeDirectory, name)),
      ),
    ),
  );
  assert.deepEqual(
    ingress.metadata.supportSources,
    await Promise.all(
      supportNames.map((name) => artifact(join(directory, name))),
    ),
  );
  assert.deepEqual(
    ingress.metadata.output,
    await artifact(join(fixture.run, 'stream-ingress.node')),
  );
  for (const record of [
    ingress.metadata.source,
    ingress.metadata.compiler,
    ingress.metadata.output,
    ...ingress.metadata.headers,
    ...ingress.metadata.supportSources,
  ]) {
    shape(record, ['path', 'sha256', 'device', 'inode', 'size', 'mode', 'uid']);
  }
  assert.ok(Object.isFrozen(ingress.metadata.headers));
  assert.ok(Object.isFrozen(ingress.metadata.supportSources));
  shape(ingress.identity, ['parent', 'socket']);
  for (const [name, mode] of [
    ['parent', 0o040700],
    ['socket', 0o140600],
  ]) {
    const record = ingress.identity[name];
    shape(record, ['path', 'device', 'inode', 'mode', 'uid']);
    const path =
      name === 'parent' ? fixture.run : join(fixture.run, 'docker.sock');
    const stat = await fs.lstat(path, { bigint: true });
    assert.equal(await fs.realpath(path), path);
    assert.deepEqual(record, {
      path,
      device: String(stat.dev),
      inode: String(stat.ino),
      mode,
      uid: process.getuid(),
    });
    assert.equal(Number(stat.mode), mode);
  }
  assert.equal(ingress.endpoint, `unix://${fixture.run}/docker.sock`);
  assert.ok(Buffer.byteLength(ingress.identity.socket.path) < 108);
}

export function writerValue(segment, pid) {
  shape(segment, ['copyBytes', 'writer', 'release']);
  shape(segment.writer, ['read']);
  const value = segment.writer.read();
  shape(value, ['pid', 'uid', 'gid', 'fdInfoPid', 'alive']);
  assert.deepEqual(value, {
    pid,
    uid: process.getuid(),
    gid: process.getgid(),
    fdInfoPid: pid,
    alive: true,
  });
  return value;
}

export async function receive(stream) {
  shape(stream, ['receive', 'close']);
  const segment = await bounded(
    stream.receive(),
    'DEC203_STREAM_TEST_DEADLINE',
  );
  assert.notEqual(segment, null);
  assert.ok(Buffer.isBuffer(segment.copyBytes()));
  assert.ok(segment.copyBytes().length > 0);
  return segment;
}

export async function literal(stream, runs) {
  const expected = Buffer.from(runs.map(([bytes]) => bytes).join(''));
  let offset = 0;
  while (offset < expected.length) {
    const segment = await receive(stream);
    try {
      const bytes = segment.copyBytes();
      assert.ok(bytes.length <= expected.length - offset);
      assert.ok(bytes.equals(expected.subarray(offset, offset + bytes.length)));
      let boundary = 0;
      const run = runs.find(([value]) => {
        boundary += Buffer.byteLength(value);
        return offset < boundary;
      });
      assert.ok(
        offset + bytes.length <= boundary,
        'one segment cannot cross a different writer',
      );
      writerValue(segment, run[1]);
      offset += bytes.length;
    } finally {
      segment.release();
    }
  }
  assert.equal(offset, expected.length);
}

export async function raw(fixture, ingress) {
  const addon = createRequire(import.meta.url)(ingress.metadata.output.path);
  assert.deepEqual(Reflect.ownKeys(addon), ['createIngress']);
  const parent = await fixture.directory(`raw-${fixture.serial++}`);
  const owner = addon.createIngress(parent);
  shape(owner, ['accept', 'close']);
  fixture.defer(() => owner.close());
  return { addon, owner, endpoint: `unix://${parent}/docker.sock` };
}
