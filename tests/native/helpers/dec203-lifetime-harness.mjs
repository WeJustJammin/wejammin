import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Fixture, token } from './dec203-peer-harness.mjs';
import { artifact, sha256 } from './dec203-peer-metadata.mjs';
import { cleanupDiagnostic } from './dec203-peer-client.mjs';
import { driftLoadedOutput } from './dec203-lifetime-output-drift.mjs';

export { token, artifact, sha256 };
export const subjectURL = new URL(
  '../../../infra/database-upgrades/native-tracing/peer-lifetime.mjs',
  import.meta.url,
);
export const headers = [
  'js_native_api.h',
  'js_native_api_types.h',
  'node_api.h',
  'node_api_types.h',
];
export const copyManifest = [
  'peer-artifacts.mjs',
  'peer-lifetime-build.mjs',
  'peer-lifetime-compiler.mjs',
  'peer-lifetime-output.mjs',
  'peer-lifetime-state.h',
  'peer-lifetime.c',
  'peer-lifetime.mjs',
];

export class LifetimeFixture extends Fixture {
  static async open(context) {
    // Missing API fails inside each case, before any fixture allocation.
    const subject = await import(subjectURL.href);
    assert.equal(typeof subject.buildPeerLifetimeReader, 'function');
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
    const root = await fs.realpath(
      await fs.mkdtemp(join(tmpdir(), 'dec203-life-')),
    );
    const fixture = new LifetimeFixture(
      root,
      options,
      subject.buildPeerLifetimeReader,
      await fs.lstat(root, { bigint: true }),
    );
    fixture.sourceDirectory = dirname(fileURLToPath(subjectURL));
    fixture.context = context;
    context.after(() => fixture.cleanup());
    fixture.run = await fixture.directory('run');
    return fixture;
  }

  async build(overrides = {}, factory = this.factory) {
    const options = { runDirectory: this.run, ...this.options, ...overrides };
    const errors = [];
    let reader;
    try {
      reader = await factory(options);
      this.readers.push(reader);
    } catch (error) {
      errors.push(error);
    }
    if (errors.some((error) => error.diagnostics?.drainProven === false)) {
      this.defer(() => {
        throw errors[0];
      });
    } else if (this.directories.has(options.runDirectory)) {
      try {
        await this.remember(join(options.runDirectory, 'peer-lifetime.node'));
      } catch (error) {
        if (error.code !== 'ENOENT') errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length)
      throw new AggregateError(errors, 'lifetime build capture');
    return reader;
  }

  async copySubject(name = 'subject') {
    const directory = await this.directory(name);
    for (const file of copyManifest) {
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
      pathToFileURL(join(directory, 'peer-lifetime.mjs'))
    );
    return { directory, factory: subject.buildPeerLifetimeReader };
  }

  async copyHeaders(name = 'headers') {
    const directory = await this.directory(name);
    for (const file of headers) {
      const source = join(this.options.includeDirectory, file);
      const before = await artifact(source);
      const target = await this.file(
        `${name}/${file}`,
        await fs.readFile(source),
      );
      assert.equal(sha256(await fs.readFile(target)), before.sha256);
      assert.deepEqual(await artifact(source), before);
    }
    return directory;
  }

  async drift(path, atomic, check) {
    if (
      atomic ||
      typeof path !== 'string' ||
      basename(path) !== 'peer-lifetime.node'
    ) {
      return super.drift(path, atomic, check);
    }
    return driftLoadedOutput(this, path, check);
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
    if (errors.length) {
      this.context.diagnostic(
        JSON.stringify(cleanupDiagnostic(errors, this.exits)),
      );
      throw new AggregateError(
        errors,
        'lifetime resources not proved drained; artifacts retained',
      );
    }
    // Only proved-settled resources permit reader/artifact cleanup below.
    this.resources = [];
    await super.cleanup();
  }
}

function frozen(value) {
  assert.ok(Object.isFrozen(value));
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === 'object') frozen(child);
  }
}

export async function assertLifetimeMetadata(reader, fixture, directory) {
  assert.deepEqual(Reflect.ownKeys(reader).sort(), [
    'close',
    'metadata',
    'open',
  ]);
  frozen(reader);
  assert.equal(typeof reader.open, 'function');
  assert.equal(typeof reader.close, 'function');
  const metadata = reader.metadata;
  assert.deepEqual(Reflect.ownKeys(metadata).sort(), [
    'compiler',
    'headers',
    'node',
    'output',
    'source',
    'supportSources',
  ]);
  assert.deepEqual(metadata.node, {
    path: await fs.realpath(process.execPath),
    version: 'v22.23.1',
    napi: 8,
  });
  assert.deepEqual(
    metadata.source,
    await artifact(join(directory, 'peer-lifetime.c')),
  );
  assert.deepEqual(
    metadata.compiler,
    await artifact(fixture.options.compilerPath),
  );
  assert.deepEqual(metadata.supportSources, [
    await artifact(join(directory, 'peer-lifetime-state.h')),
  ]);
  assert.deepEqual(
    metadata.headers,
    await Promise.all(
      headers.map((file) =>
        artifact(join(fixture.options.includeDirectory, file)),
      ),
    ),
  );
  assert.deepEqual(
    metadata.output,
    await artifact(join(fixture.run, 'peer-lifetime.node')),
  );
  for (const record of [
    metadata.source,
    metadata.compiler,
    metadata.output,
    ...metadata.headers,
    ...metadata.supportSources,
  ]) {
    assert.deepEqual(Reflect.ownKeys(record).sort(), [
      'device',
      'inode',
      'mode',
      'path',
      'sha256',
      'size',
      'uid',
    ]);
  }
}

export function assertLive(handle, pid) {
  assert.deepEqual(Reflect.ownKeys(handle).sort(), ['close', 'read']);
  assert.ok(Object.isFrozen(handle));
  const value = handle.read();
  assert.deepEqual(value, { pid, fdInfoPid: pid, alive: true });
  assert.ok(Object.isFrozen(value));
}

export function openLive(fixture, reader, peer) {
  assert.ok(Number.isInteger(peer.child.pid) && peer.child.pid > 0);
  assert.notEqual(peer.message.declaredPid, peer.child.pid);
  try {
    const handle = reader.open(peer.socket);
    assertLive(handle, peer.child.pid);
    return handle;
  } catch (error) {
    if (error.code === 'DEC203_PIDFD_UNAVAILABLE') {
      token('DEC203_PIDFD_UNAVAILABLE')(error);
      fixture.context.diagnostic(
        'actual SO_PEERPIDFD unavailable; positive contract NOT satisfied',
      );
    }
    throw error;
  }
}
