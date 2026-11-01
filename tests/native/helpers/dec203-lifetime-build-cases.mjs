import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import {
  artifact,
  assertLifetimeMetadata,
  assertLive,
  headers,
  openLive,
  token,
} from './dec203-lifetime-harness.mjs';
import { bounded, unixPeers } from './dec203-lifetime-peers.mjs';

const options = (fixture) => ({
  runDirectory: fixture.run,
  ...fixture.options,
});

export function buildCases(check) {
  check('LB01 fixed builder and six-key independent metadata', async (f) => {
    const reader = await f.build();
    await assertLifetimeMetadata(reader, f, f.sourceDirectory);
    await reader.close();
    await reader.close();
    await assert.rejects(fs.lstat(join(f.run, 'peer-lifetime.node')), {
      code: 'ENOENT',
    });
    assert.deepEqual(await fs.readdir(f.run), []);
  });

  check(
    'LB02 explicit complete owned source/support copy builds independently',
    async (f) => {
      const copied = await f.copySubject();
      const reader = await f.build({}, copied.factory);
      await assertLifetimeMetadata(reader, f, copied.directory);
      assert.equal(
        reader.metadata.supportSources[0].path,
        join(copied.directory, 'peer-lifetime-state.h'),
      );
      assert.equal(
        reader.metadata.source.path,
        join(copied.directory, 'peer-lifetime.c'),
      );
    },
  );

  for (const key of [
    'sourcePath',
    'addonPath',
    'flags',
    'headers',
    'pidfd',
    'credentials',
  ]) {
    check(`LB03 rejects caller override ${key}`, async (f) => {
      await assert.rejects(
        f.factory({ ...options(f), [key]: '/not/accepted' }),
        token('DEC203_INVALID_BUILD'),
      );
      assert.deepEqual(await fs.readdir(f.run), []);
    });
  }
  for (const key of ['runDirectory', 'compilerPath', 'includeDirectory']) {
    check(`LB04 rejects nonstring ${key}`, async (f) => {
      await assert.rejects(
        f.factory({ ...options(f), [key]: 42 }),
        token('DEC203_INVALID_BUILD'),
      );
      assert.deepEqual(await fs.readdir(f.run), []);
    });
    check(`LB04 missing own ${key} refuses`, async (f) => {
      const value = options(f);
      Reflect.deleteProperty(value, key);
      await assert.rejects(f.factory(value), token('DEC203_INVALID_BUILD'));
      assert.deepEqual(await fs.readdir(f.run), []);
    });
  }
  for (const [label, value] of [
    ['null', null],
    ['undefined', undefined],
    ['array', []],
  ]) {
    check(`LB04 nonrecord options ${label} refuses`, async (f) => {
      await assert.rejects(f.factory(value), token('DEC203_INVALID_BUILD'));
      assert.deepEqual(await fs.readdir(f.run), []);
    });
  }
  check('LB04 symbol own option refuses', async (f) => {
    await assert.rejects(
      f.factory({ ...options(f), [Symbol('extra')]: 1 }),
      token('DEC203_INVALID_BUILD'),
    );
    assert.deepEqual(await fs.readdir(f.run), []);
  });

  check(
    'LB05 accessor options refuse without invoking the getter',
    async (f) => {
      let calls = 0;
      const value = options(f);
      Object.defineProperty(value, 'runDirectory', {
        get() {
          calls++;
          return f.run;
        },
      });
      await assert.rejects(f.factory(value), token('DEC203_INVALID_BUILD'));
      assert.equal(calls, 0);
      assert.deepEqual(await fs.readdir(f.run), []);
    },
  );
  check('LB06 proxy options refuse before traps', async (f) => {
    let calls = 0;
    const proxy = new Proxy(options(f), {
      get() {
        calls++;
        throw new Error('trap called');
      },
    });
    await assert.rejects(f.factory(proxy), token('DEC203_INVALID_BUILD'));
    assert.equal(calls, 0);
    assert.deepEqual(await fs.readdir(f.run), []);
  });
  check('LB07 hidden unknown option refuses', async (f) => {
    const value = options(f);
    Object.defineProperty(value, 'sourcePath', { value: '/not/accepted' });
    await assert.rejects(f.factory(value), token('DEC203_INVALID_BUILD'));
    assert.deepEqual(await fs.readdir(f.run), []);
  });
  check('LB08 nonprivate run directory refuses without output', async (f) => {
    const runDirectory = await f.directory('public-run', 0o755);
    await assert.rejects(
      f.factory({ ...options(f), runDirectory }),
      token('DEC203_INVALID_BUILD'),
    );
    assert.deepEqual(await fs.readdir(runDirectory), []);
  });
  check('LB09 existing run entry is preserved on refusal', async (f) => {
    const path = await f.file('run/existing', 'owned sentinel');
    const before = await artifact(path);
    await assert.rejects(f.factory(options(f)), token('DEC203_INVALID_BUILD'));
    assert.deepEqual(await artifact(path), before);
    assert.deepEqual(await fs.readdir(f.run), ['existing']);
  });
  check('LB10 symlink run directory refuses', async (f) => {
    const runDirectory = await f.link('run-alias', f.run);
    await assert.rejects(
      f.factory({ ...options(f), runDirectory }),
      token('DEC203_INVALID_BUILD'),
    );
    assert.deepEqual(await fs.readdir(f.run), []);
  });

  for (const file of ['peer-lifetime.c', 'peer-lifetime-state.h']) {
    check(`LB11 fixed local input ${file} is actually compiled`, async (f) => {
      const copy = await f.copySubject();
      const path = join(copy.directory, file);
      assert.ok(f.files.has(path));
      await fs.appendFile(path, '\n#error DEC203_owned_copy_compile_witness\n');
      let failure;
      try {
        await f.build({}, copy.factory);
      } catch (error) {
        failure = error;
      }
      token('DEC203_COMPILER_FAILED')(failure);
      assert.equal(failure.diagnostics.drainProven, true);
      assert.equal(failure.diagnostics.timedOut, false);
      await assert.rejects(fs.lstat(join(f.run, 'peer-lifetime.node')), {
        code: 'ENOENT',
      });
    });
  }

  const driftInputs = [
    'peer-lifetime.c',
    'peer-lifetime-state.h',
    ...headers,
    'peer-lifetime.node',
  ];
  for (const file of driftInputs) {
    check(
      `LB12 owned ${file} content drift blocks open and read`,
      async (f) => {
        const copy = await f.copySubject();
        f.options.includeDirectory = await f.copyHeaders();
        const reader = await f.build({}, copy.factory);
        const { peers } = await unixPeers(f);
        const handle = openLive(f, reader, peers[0]);
        const directory = headers.includes(file)
          ? f.options.includeDirectory
          : file.endsWith('.node')
            ? f.run
            : copy.directory;
        await f.drift(join(directory, file), false, async () => {
          assert.throws(
            () => reader.open(peers[0].socket),
            token('DEC203_IDENTITY_CHANGED'),
          );
          assert.throws(() => handle.read(), token('DEC203_IDENTITY_CHANGED'));
        });
        assertLive(handle, peers[0].child.pid);
      },
    );
  }

  check(
    'LB13 identity-only support replacement refuses and then recovers',
    async (f) => {
      const copy = await f.copySubject();
      const reader = await f.build({}, copy.factory);
      const { peers } = await unixPeers(f);
      const handle = openLive(f, reader, peers[0]);
      await f.drift(
        join(copy.directory, 'peer-lifetime-state.h'),
        true,
        async () => {
          assert.throws(() => handle.read(), token('DEC203_IDENTITY_CHANGED'));
          assert.throws(
            () => reader.open(peers[0].socket),
            token('DEC203_IDENTITY_CHANGED'),
          );
        },
      );
      assertLive(handle, peers[0].child.pid);
    },
  );
  for (const file of ['peer-lifetime.c', 'peer-lifetime-state.h']) {
    check(
      `LB14 reader revokes synchronously despite owned ${file} drift`,
      async (f) => {
        const copy = await f.copySubject();
        const reader = await f.build({}, copy.factory);
        const { peers } = await unixPeers(f, 2);
        const handles = peers.map((peer) => openLive(f, reader, peer));
        await f.drift(join(copy.directory, file), false, async () => {
          const closing = reader.close();
          for (const handle of handles) {
            assert.throws(
              () => handle.read(),
              token('DEC203_PIDFD_CAPABILITY_CLOSED'),
            );
            assert.equal(handle.close(), undefined);
          }
          assert.throws(
            () => reader.open(peers[0].socket),
            token('DEC203_PIDFD_CAPABILITY_CLOSED'),
          );
          await closing;
          await reader.close();
        });
      },
    );
  }
  check(
    'LB15 reader close preserves a foreign owned-test output replacement',
    async (f) => {
      const reader = await f.build();
      const { peers } = await unixPeers(f);
      const handle = openLive(f, reader, peers[0]);
      const path = reader.metadata.output.path;
      await f.drift(path, true, async () => {
        const replacement = await artifact(path);
        const closing = reader.close();
        assert.throws(
          () => handle.read(),
          token('DEC203_PIDFD_CAPABILITY_CLOSED'),
        );
        await closing;
        assert.deepEqual(await artifact(path), replacement);
      });
    },
  );

  check('LB16 latched peer exit still attests owned source', async (f) => {
    const copy = await f.copySubject();
    const reader = await f.build({}, copy.factory);
    const { peers } = await unixPeers(f);
    const peer = peers[0];
    const handle = openLive(f, reader, peer);
    const exited = token('DEC203_PIDFD_PEER_EXITED');
    const closed = token('DEC203_PIDFD_CAPABILITY_CLOSED');
    const source = join(copy.directory, 'peer-lifetime.c');
    await peer.stop();
    await bounded(peer.ended, 'owned peer EOF');
    assert.equal(peer.socket.readableEnded, true);
    assert.equal(peer.socket.destroyed, false);
    assert.throws(() => handle.read(), exited);
    await f.drift(source, false, async () => {
      assert.throws(() => handle.read(), token('DEC203_IDENTITY_CHANGED'));
    });
    assert.throws(() => handle.read(), exited);
    await f.drift(source, false, async () => {
      handle.close();
      assert.throws(() => handle.read(), closed);
    });
  });
}
