import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { basename, join } from 'node:path';
import { directChildren, token } from './dec203-peer-harness.mjs';
import { assertMetadata } from './dec203-peer-metadata.mjs';
import { unixPeers } from './dec203-peer-client.mjs';

async function image(directory) {
  return Promise.all(
    (await fs.readdir(directory)).sort().map(async (name) => {
      const path = join(directory, name);
      const stat = await fs.lstat(path, { bigint: true });
      return {
        name,
        device: String(stat.dev),
        inode: String(stat.ino),
        mode: String(stat.mode),
        bytes: stat.isFile()
          ? (await fs.readFile(path)).toString('base64')
          : null,
        link: stat.isSymbolicLink() ? await fs.readlink(path) : null,
      };
    }),
  );
}

export function registerBuildCases(native) {
  const pathFaults = [
    [
      'P001 unknown source option',
      async () => ({ sourcePath: '/not-an-authorized-source.c' }),
    ],
    ['P002 missing compiler', async () => ({ compilerPath: undefined })],
    [
      'P003 relative compiler',
      async (f) => ({ compilerPath: basename(f.options.compilerPath) }),
    ],
    ['P004 relative headers', async () => ({ includeDirectory: 'node' })],
    ['P005 relative run directory', async () => ({ runDirectory: 'run' })],
    [
      'P006 noncanonical run directory',
      async (f) => ({ runDirectory: `${f.run}/../run` }),
    ],
    [
      'P007 nonprivate run mode',
      async (f) => {
        await fs.chmod(f.run, 0o755);
        return {};
      },
    ],
    [
      'P008 symlink run directory',
      async (f) => ({ runDirectory: await f.link('run-link', f.run) }),
    ],
    [
      'P009 symlink compiler',
      async (f) => ({
        compilerPath: await f.link('cc-link', f.options.compilerPath),
      }),
    ],
    [
      'P010 symlink headers',
      async (f) => ({
        includeDirectory: await f.link('sdk-link', f.options.includeDirectory),
      }),
    ],
    [
      'P011 nonexecutable compiler',
      async (f) => ({
        compilerPath: await f.file(
          'cc-copy',
          await fs.readFile(f.options.compilerPath),
        ),
      }),
    ],
    [
      'P012 nondirectory headers',
      async (f) => ({
        includeDirectory: await f.file('sdk-file', 'not a directory'),
      }),
    ],
    [
      'P013 preexisting output',
      async (f) => {
        await f.file('run/peer-credentials.node', 'preserve output');
        return {};
      },
    ],
    [
      'P014 nonempty run directory',
      async (f) => {
        await f.file('run/unrelated', 'preserve unrelated');
        return {};
      },
    ],
    [
      'P015 preexisting output symlink',
      async (f) => {
        const path = await f.file('sentinel', 'preserve target');
        await f.link('run/peer-credentials.node', path);
        return {};
      },
    ],
  ];
  for (const [name, mutate] of pathFaults) {
    native(
      `DEC203-${name} refuses without overwrite or remaining direct child`,
      async (f) => {
        const options = await mutate(f);
        const before = await image(f.run);
        const children = await directChildren();
        await assert.rejects(f.build(options), token('DEC203_INVALID_BUILD'));
        assert.deepEqual(await image(f.run), before);
        assert.deepEqual(await directChildren(), children);
      },
    );
  }

  native(
    'DEC203-B001 real compiler failure uses an owned invalid SDK copy and drains',
    async (f) => {
      const sdk = await f.directory('invalid-sdk');
      for (const name of [
        'js_native_api.h',
        'js_native_api_types.h',
        'node_api.h',
        'node_api_types.h',
      ]) {
        const bytes = await fs.readFile(join(f.options.includeDirectory, name));
        const target = await f.file(`invalid-sdk/${name}`, bytes);
        assert.deepEqual(await fs.readFile(target), bytes);
      }
      await fs.appendFile(
        join(sdk, 'node_api.h'),
        '\n#error owned_DEC203_invalid_SDK\n',
      );
      const children = await directChildren();
      await assert.rejects(
        f.build({ includeDirectory: sdk }),
        token('DEC203_COMPILER_FAILED'),
      );
      assert.deepEqual(await directChildren(), children);
      assert.deepEqual(await fs.readdir(f.run), []);
    },
  );

  native(
    'DEC203-B002 close revokes synchronously and preserves caller-owned data',
    async (f) => {
      const reader = await f.build();
      const {
        peers: [peer],
      } = await unixPeers(f);
      const path = await f.file(
        'run/unrelated-after-build',
        'retain caller bytes',
      );
      const closing = reader.close();
      assert.throws(
        () => reader.read(peer.socket),
        token('DEC203_CAPABILITY_CLOSED'),
      );
      await closing;
      await reader.close();
      assert.throws(() => reader.read({}), token('DEC203_CAPABILITY_CLOSED'));
      assert.equal(await fs.readFile(path, 'utf8'), 'retain caller bytes');
      assert.ok((await fs.stat(f.run)).isDirectory());
      assert.deepEqual(await fs.readdir(f.run), ['unrelated-after-build']);
    },
  );

  native(
    'DEC203-B005 serialized matching metadata is not a factory capability',
    async (f) => {
      const reader = await f.build();
      const metadata = JSON.parse(JSON.stringify(reader.metadata));
      await reader.close();
      assert.deepEqual(await fs.readdir(f.run), []);
      await assert.rejects(
        f.build({ metadata }),
        token('DEC203_INVALID_BUILD'),
      );
    },
  );

  for (const atomic of [false, true]) {
    native(
      `DEC203-B00${atomic ? 4 : 3} owned-copy ${atomic ? 'output identity' : 'source byte'} drift refuses`,
      async (f) => {
        const copy = await f.copySubject();
        const reader = await f.build({}, copy.factory);
        const {
          peers: [peer],
        } = await unixPeers(f);
        await assertMetadata(reader, f, copy.directory);
        const path = atomic
          ? reader.metadata.output.path
          : reader.metadata.source.path;
        await f.drift(path, atomic, async () => {
          assert.throws(
            () => reader.read(peer.socket),
            token('DEC203_IDENTITY_CHANGED'),
          );
          assert.ok((await fs.lstat(path)).isFile());
        });
      },
    );
  }

  native(
    'DEC203-B006 close revokes while preserving an actual output replacement',
    async (f) => {
      const copy = await f.copySubject();
      const reader = await f.build({}, copy.factory);
      const {
        peers: [peer],
      } = await unixPeers(f);
      const output = reader.metadata.output.path;
      const bytes = await fs.readFile(output);
      const original = await fs.lstat(output, { bigint: true });
      const backup = f.path('run/original-generated.node');
      assert.deepEqual(await fs.readdir(f.run), ['peer-credentials.node']);
      await fs.rename(output, backup);
      f.files.delete(output);
      await f.remember(backup);
      await f.file('run/peer-credentials.node', bytes);
      const replacement = await fs.lstat(output, { bigint: true });
      assert.notEqual(replacement.ino, original.ino);
      const closing = reader.close();
      assert.throws(
        () => reader.read(peer.socket),
        token('DEC203_CAPABILITY_CLOSED'),
      );
      await closing;
      await reader.close();
      const after = await fs.lstat(output, { bigint: true });
      assert.deepEqual(
        [after.dev, after.ino],
        [replacement.dev, replacement.ino],
      );
      assert.deepEqual(await fs.readFile(output), bytes);
      const retained = await fs.lstat(backup, { bigint: true });
      assert.deepEqual(
        [retained.dev, retained.ino],
        [original.dev, original.ino],
      );
      assert.deepEqual(await fs.readFile(backup), bytes);
    },
  );

  native(
    'DEC203-B007 real build and metadata do not depend on Date.now',
    async (f) => {
      const now = Date.now;
      try {
        Date.now = () => NaN;
        const reader = await f.build();
        await assertMetadata(reader, f, f.sourceDirectory);
        assert.deepEqual(await fs.readdir(f.run), ['peer-credentials.node']);
      } finally {
        Date.now = now;
      }
      assert.equal(Date.now, now);
    },
  );
}
