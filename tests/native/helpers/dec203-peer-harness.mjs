import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cleanupDiagnostic } from './dec203-peer-client.mjs';
import { artifact, sha256 } from './dec203-peer-metadata.mjs';

const moduleURL = new URL(
  '../../../infra/database-upgrades/native-tracing/peer-credentials.mjs',
  import.meta.url,
);
const identity = (stat) => `${stat.dev}:${stat.ino}:${stat.uid}`;

export const token = (code) => (error) => {
  assert.equal(error.code, code);
  assert.equal(error.message, code);
  return true;
};

export async function directChildren() {
  return (await fs.readFile(`/proc/self/task/${process.pid}/children`, 'utf8'))
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort();
}

async function collect(errors, operation) {
  try {
    await operation();
  } catch (error) {
    errors.push(error);
  }
}

export class Fixture {
  static async open(context) {
    // Import inside EVERY test callback, before allocating fixture resources.
    const subject = await import(moduleURL.href);
    assert.equal(typeof subject.buildPeerCredentialReader, 'function');
    assert.equal(process.platform, 'linux');
    assert.equal(process.version, 'v22.23.1');
    const options = {};
    for (const [key, variable] of [
      ['compilerPath', 'DEC203_CC_PATH'],
      ['includeDirectory', 'DEC203_NODE_INCLUDE'],
    ]) {
      const path = process.env[variable];
      assert.ok(
        typeof path === 'string' && isAbsolute(path),
        `${variable} required`,
      );
      assert.equal(
        await fs.realpath(path),
        path,
        `${variable} must be canonical`,
      );
      options[key] = path;
    }
    const root = await fs.realpath(
      await fs.mkdtemp(join(tmpdir(), 'dec203-peer-')),
    );
    const stat = await fs.lstat(root, { bigint: true });
    const fixture = new Fixture(
      root,
      options,
      subject.buildPeerCredentialReader,
      stat,
    );
    fixture.context = context;
    context.after(() => fixture.cleanup());
    fixture.run = await fixture.directory('run');
    return fixture;
  }

  constructor(root, options, build, rootStat) {
    this.root = root;
    this.options = options;
    this.factory = build;
    this.sourceDirectory = dirname(fileURLToPath(moduleURL));
    this.files = new Map();
    this.directories = new Map([[root, identity(rootStat)]]);
    this.readers = [];
    this.resources = [];
    this.exits = [];
    this.retainedDirectories = new Set();
  }

  path(name) {
    const path = resolve(this.root, name);
    assert.ok(path.startsWith(`${this.root}/`), 'owned fixture path only');
    return path;
  }

  defer(close) {
    this.resources.push(close);
  }

  async directory(name, mode = 0o700) {
    const path = this.path(name);
    await fs.mkdir(path, { mode });
    this.directories.set(
      path,
      identity(await fs.lstat(path, { bigint: true })),
    );
    return path;
  }

  async remember(path) {
    const stat = await fs.lstat(path, { bigint: true });
    assert.equal(Number(stat.uid), process.getuid(), 'own fixture artifact');
    this.files.set(path, identity(stat));
  }

  async file(name, bytes, mode = 0o600) {
    const path = this.path(name);
    await fs.writeFile(path, bytes, { flag: 'wx', mode });
    await this.remember(path);
    return path;
  }

  async link(name, target) {
    const path = this.path(name);
    await fs.symlink(target, path);
    await this.remember(path);
    return path;
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
    if (this.directories.has(options.runDirectory)) {
      const output = join(options.runDirectory, 'peer-credentials.node');
      try {
        await this.remember(output);
      } catch (error) {
        if (error?.code !== 'ENOENT') errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
      throw new AggregateError(
        errors,
        'peer factory and artifact capture failed',
      );
    }
    return reader;
  }

  async copySubject() {
    const directory = await this.directory('subject');
    const pending = ['peer-credentials.mjs', 'peer-credentials.c'];
    const copied = new Set();
    while (pending.length) {
      const name = pending.shift();
      if (copied.has(name)) continue;
      const source = join(this.sourceDirectory, name);
      const record = await artifact(source);
      const bytes = await fs.readFile(source);
      const target = await this.file(`subject/${name}`, bytes);
      assert.equal(sha256(await fs.readFile(target)), record.sha256);
      copied.add(name);
      if (name.endsWith('.mjs')) {
        const imports = /\b(?:from\s*|import\s*\(?\s*)['"]([^'"]+)['"]/g;
        for (const [, specifier] of bytes.toString().matchAll(imports)) {
          if (specifier.startsWith('node:')) continue;
          assert.match(specifier, /^\.\/peer-[a-z0-9-]+\.mjs$/);
          pending.push(specifier.slice(2));
        }
      }
    }
    const subject = await import(
      pathToFileURL(join(directory, 'peer-credentials.mjs'))
    );
    return { directory, factory: subject.buildPeerCredentialReader };
  }

  async drift(path, atomic, check) {
    assert.ok(this.files.has(path), 'drift only an owned fixture artifact');
    const bytes = await fs.readFile(path);
    const backup = `${path}.dec203-original`;
    if (atomic) {
      await fs.rename(path, backup);
      this.files.delete(path);
      await this.remember(backup);
      await this.file(relative(this.root, path), bytes);
    } else {
      await fs.appendFile(path, '\n/* owned DEC203 source drift */\n');
    }
    try {
      await check();
    } finally {
      if (atomic) {
        await this.remove(path);
        await fs.rename(backup, path);
        this.files.delete(backup);
        await this.remember(path);
      } else {
        await fs.writeFile(path, bytes);
      }
    }
  }

  async remove(path) {
    try {
      const stat = await fs.lstat(path, { bigint: true });
      assert.equal(
        identity(stat),
        this.files.get(path),
        'no foreign replacement deletion',
      );
      await fs.unlink(path);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    this.files.delete(path);
  }

  async retainRunResidue() {
    assert.equal(this.run, join(this.root, 'run'));
    for (const path of [this.root, this.run]) {
      const stat = await fs.lstat(path, { bigint: true });
      assert.equal(identity(stat), this.directories.get(path));
      assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
      assert.equal(stat.uid, BigInt(process.getuid()));
      assert.equal(stat.mode, 0o040700n);
    }
    await assert.rejects(fs.lstat(join(this.run, 'peer-credentials.node')), {
      code: 'ENOENT',
    });
    for (const path of this.files.keys()) {
      assert.ok(path !== this.run && !path.startsWith(`${this.run}/`));
    }
    const entries = (await fs.readdir(this.run)).length;
    assert.ok(entries > 0, 'explicit unregistered residue required');
    this.retainedDirectories.add(this.run);
    this.retainedDirectories.add(this.root);
    this.context.diagnostic(
      JSON.stringify({
        reason: 'unregistered run residue retained without ownership claim',
        path: this.run,
        entries,
      }),
    );
  }

  async cleanup() {
    const errors = [];
    for (const close of [...this.resources].reverse()) {
      await collect(errors, close);
    }
    for (const reader of [...this.readers].reverse()) {
      await collect(errors, () => reader.close());
    }
    if (!errors.length) {
      const root = await fs.lstat(this.root, { bigint: true });
      assert.equal(identity(root), this.directories.get(this.root));
      assert.ok(root.isDirectory() && !root.isSymbolicLink());
      for (const path of [...this.files.keys()].reverse()) {
        await collect(errors, () => this.remove(path));
      }
      for (const [path, expected] of [...this.directories].reverse()) {
        await collect(errors, async () => {
          const stat = await fs.lstat(path, { bigint: true });
          assert.equal(identity(stat), expected);
          assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
          if (!this.retainedDirectories.has(path)) await fs.rmdir(path);
        });
      }
    }
    if (errors.length) {
      this.context.diagnostic(
        JSON.stringify(cleanupDiagnostic(errors, this.exits)),
      );
      throw new AggregateError(errors, `owned fixture cleanup: ${this.root}`);
    }
  }
}
