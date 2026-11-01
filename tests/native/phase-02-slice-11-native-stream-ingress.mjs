import test from 'node:test';
import { join } from 'node:path';
import {
  StreamFixture,
  assert,
  bounded,
  metadata,
  raw,
  receive,
  shape,
  token,
  writers,
  writerValue,
} from './helpers/dec203-stream-ingress-harness.mjs';
import { coreCases } from './helpers/dec203-stream-ingress-core-cases.mjs';
import { streamCases } from './helpers/dec203-stream-ingress-stream-cases.mjs';
import { limitCases } from './helpers/dec203-stream-ingress-limit-cases.mjs';
import { pendingCases } from './helpers/dec203-stream-ingress-pending-cases.mjs';

const check = (name, body) =>
  test(name, { concurrency: false }, async (context) => {
    const fixture = await StreamFixture.open(context);
    await body(fixture, context);
  });

check(
  'NS01 exact frozen public surface, metadata and private path identities',
  async (fixture) => {
    const ingress = await fixture.build();
    await metadata(ingress, fixture);
    await ingress.close();
    await ingress.close();
    await assert.rejects(
      () => ingress.accept(),
      token('DEC203_STREAM_CAPABILITY_CLOSED'),
    );
    assert.equal(ingress.endpoint, `unix://${fixture.run}/docker.sock`);
  },
);

check(
  'NS02 closed factory options after a genuine successful build',
  async (fixture) => {
    const valid = await fixture.build();
    await valid.close();
    const mutations = [
      (options) => {
        delete options.compilerPath;
      },
      (options) => {
        delete options.includeDirectory;
      },
      (options) => {
        options.extra = true;
      },
      (options) => {
        options.sourcePath = '/not-an-override';
      },
      (options) => {
        options.addonPath = '/not-an-override';
      },
      (options) => {
        options.scheduler = () => {};
      },
      (options) => {
        options.compilerPath = null;
      },
    ];
    for (const [index, mutate] of mutations.entries()) {
      const options = {
        ...fixture.options,
        runDirectory: await fixture.directory(`invalid-${index}`),
      };
      mutate(options);
      await assert.rejects(async () => {
        const result = await fixture.factory(options);
        fixture.readers.push(result);
      }, token('DEC203_INVALID_BUILD'));
    }
  },
);

check(
  'NS09 public and exact raw native receiver/type/argument guards',
  async (fixture) => {
    const ingress = await fixture.build();
    const peer = await writers(fixture, ingress.endpoint);
    const stream = await bounded(ingress.accept());
    await peer.command('SEND_A');
    const segment = await receive(stream);
    for (const receiver of [{}, new Proxy(ingress, {}), stream, segment]) {
      await assert.rejects(
        async () => ingress.accept.call(receiver),
        token('DEC203_STREAM_INVALID_CAPABILITY'),
      );
    }
    for (const receiver of [
      {},
      new Proxy(segment.writer, {}),
      stream,
      segment,
    ]) {
      assert.throws(
        () => segment.writer.read.call(receiver),
        token('DEC203_STREAM_INVALID_CAPABILITY'),
      );
    }
    assert.throws(() => segment.copyBytes(1), token('DEC203_STREAM_PROTOCOL'));
    assert.throws(
      () => segment.writer.read(1),
      token('DEC203_STREAM_PROTOCOL'),
    );
    for (const [receiver, names] of [
      [stream, ['receive', 'close']],
      [segment, ['copyBytes', 'release']],
      [segment.writer, ['read']],
    ]) {
      for (const name of names) {
        for (const foreign of [{}, new Proxy(receiver, {}), ingress]) {
          await assert.rejects(
            async () => receiver[name].call(foreign),
            token('DEC203_STREAM_INVALID_CAPABILITY'),
          );
        }
      }
    }
    const mirror = await raw(fixture, ingress);
    assert.equal(mirror.owner.accept(), undefined);
    const rawPeer = await writers(fixture, mirror.endpoint);
    const nativeStream = mirror.owner.accept();
    shape(nativeStream, ['receive', 'close']);
    assert.equal(nativeStream.receive(), undefined);
    await rawPeer.command('SEND_A');
    const nativeSegment = nativeStream.receive();
    writerValue(nativeSegment, rawPeer.ready.a);
    for (const receiver of [
      {},
      new Proxy(mirror.owner, {}),
      nativeStream,
      nativeSegment,
    ]) {
      assert.throws(
        () => mirror.owner.accept.call(receiver),
        token('DEC203_STREAM_INVALID_CAPABILITY'),
      );
    }
    assert.throws(
      () => nativeSegment.writer.read.call(nativeSegment),
      token('DEC203_STREAM_INVALID_CAPABILITY'),
    );
    assert.throws(
      () => nativeStream.receive(1),
      token('DEC203_STREAM_PROTOCOL'),
    );
    for (const [receiver, names] of [
      [mirror.owner, ['accept', 'close']],
      [nativeStream, ['receive', 'close']],
      [nativeSegment, ['copyBytes', 'release']],
      [nativeSegment.writer, ['read']],
    ]) {
      for (const name of names) {
        const wrongType =
          receiver === mirror.owner ? nativeStream : mirror.owner;
        for (const foreign of [{}, new Proxy(receiver, {}), wrongType]) {
          assert.throws(
            () => receiver[name].call(foreign),
            token('DEC203_STREAM_INVALID_CAPABILITY'),
          );
        }
        assert.throws(
          () => receiver[name].call(receiver, 1),
          token('DEC203_STREAM_PROTOCOL'),
        );
      }
    }
    writerValue(nativeSegment, rawPeer.ready.a);
    nativeSegment.release();
    nativeSegment.release();
    nativeStream.close();
    nativeStream.close();
    assert.throws(
      () => nativeSegment.copyBytes(),
      token('DEC203_STREAM_CAPABILITY_CLOSED'),
    );
    assert.throws(
      () => nativeStream.receive(1),
      token('DEC203_STREAM_CAPABILITY_CLOSED'),
    );
    mirror.owner.close();
    mirror.owner.close();
    assert.throws(
      () => mirror.owner.accept(1),
      token('DEC203_STREAM_CAPABILITY_CLOSED'),
    );
    segment.release();
  },
);

coreCases(check);
streamCases(check);
limitCases(check);
pendingCases(check);

check(
  'NS19 actual cached EOF still brackets source; closed priority ignores drift',
  async (fixture) => {
    const copy = await fixture.copySubject();
    const ingress = await fixture.build({}, copy.factory);
    const peer = await writers(fixture, ingress.endpoint);
    const stream = await bounded(ingress.accept());
    await peer.command('HALF_CLOSE');
    assert.equal(await bounded(stream.receive()), null);
    await fixture.drift(
      join(copy.directory, 'stream-ingress.c'),
      false,
      async () => {
        await assert.rejects(
          () => stream.receive(),
          token('DEC203_STREAM_IDENTITY_CHANGED'),
        );
        stream.close();
        await assert.rejects(
          () => stream.receive(),
          token('DEC203_STREAM_CAPABILITY_CLOSED'),
        );
      },
    );
  },
);

check(
  'NS20 actual all-client terminal close drains queued tail before EOF, never alive writer',
  async (fixture) => {
    const ingress = await fixture.build();
    const peer = await writers(fixture, ingress.endpoint);
    const stream = await bounded(ingress.accept());
    await peer.command('SEND_A');
    await peer.command('SEND_B');
    await peer.command('EXIT_A');
    await peer.command('EXIT_B');
    const expected = Buffer.from('AAAAbbbb');
    let offset = 0;
    while (offset < expected.length) {
      const segment = await receive(stream);
      try {
        const bytes = segment.copyBytes();
        assert.ok(bytes.length > 0 && bytes.length <= expected.length - offset);
        assert.ok(
          bytes.equals(expected.subarray(offset, offset + bytes.length)),
        );
        assert.ok(offset >= 4 || offset + bytes.length <= 4);
        assert.throws(
          () => segment.writer.read(),
          token('DEC203_STREAM_WRITER_EXITED'),
        );
        offset += bytes.length;
      } finally {
        segment.release();
      }
    }
    assert.equal(await bounded(stream.receive()), null);
  },
);
