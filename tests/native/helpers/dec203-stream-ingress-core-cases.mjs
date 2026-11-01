import { join } from 'node:path';
import {
  assert,
  bounded,
  literal,
  metadata,
  receive,
  shape,
  token,
  writers,
  writerValue,
} from './dec203-stream-ingress-harness.mjs';

export function coreCases(check) {
  check(
    'NS03 both held writers queue before accept; connector is not either writer',
    async (fixture) => {
      const ingress = await fixture.build();
      const peer = await writers(fixture, ingress.endpoint);
      await peer.command('SEND_A');
      await peer.command('SEND_B');
      const stream = await bounded(ingress.accept());
      await literal(stream, [
        ['AAAA', peer.ready.a],
        ['bbbb', peer.ready.b],
      ]);
      await peer.command('HALF_CLOSE');
      assert.equal(await bounded(stream.receive()), null);
    },
  );

  check(
    'NS04 actual postaccept writer changes preserve split/coalesced literal bytes',
    async (fixture) => {
      const ingress = await fixture.build();
      const peer = await writers(fixture, ingress.endpoint);
      const stream = await bounded(ingress.accept());
      await peer.command('SPLIT_A');
      await peer.command('SEND_B');
      await literal(stream, [
        ['s1s2s3', peer.ready.a],
        ['bbbb', peer.ready.b],
      ]);
    },
  );

  for (const [id, command, preaccept] of [
    ['NS05', 'TRY_RIGHTS_A', true],
    ['NS06', 'TRY_RIGHTS_B', false],
  ]) {
    check(
      `${id} actual rights EPERM ${preaccept ? 'before' : 'after'} accept, separate transfer already proved`,
      async (fixture) => {
        const ingress = await fixture.build();
        const peer = await writers(fixture, ingress.endpoint);
        let stream;
        if (!preaccept) stream = await bounded(ingress.accept());
        const refused = await peer.command(command);
        assert.equal(
          refused.errno,
          1,
          'literal Linux EPERM from actual sendmsg',
        );
        assert.equal(refused.count, -1);
        assert.equal(refused.unrelated, true);
        await peer.command('SEND_B');
        stream ??= await bounded(ingress.accept());
        await literal(stream, [['bbbb', peer.ready.b]]);
        await peer.command('HALF_CLOSE');
        assert.equal(
          await bounded(stream.receive()),
          null,
          'no R payload entered ingress',
        );
      },
    );
  }

  check(
    'NS07 owned source drift brackets copy/read/pending entry; revocation ignores drift',
    async (fixture) => {
      const copy = await fixture.copySubject();
      const ingress = await fixture.build({}, copy.factory);
      await metadata(ingress, fixture, copy.directory);
      const diagnostics = ingress.identity;
      const peer = await writers(fixture, ingress.endpoint);
      const stream = await bounded(ingress.accept());
      await peer.command('SEND_A');
      const segment = await receive(stream);
      writerValue(segment, peer.ready.a);
      await fixture.drift(
        join(copy.directory, 'stream-ingress.c'),
        false,
        async () => {
          assert.throws(
            () => segment.copyBytes(),
            token('DEC203_STREAM_IDENTITY_CHANGED'),
          );
          assert.throws(
            () => segment.writer.read(),
            token('DEC203_STREAM_IDENTITY_CHANGED'),
          );
          await assert.rejects(
            () => stream.receive(),
            token('DEC203_STREAM_IDENTITY_CHANGED'),
          );
          await assert.rejects(
            () => ingress.accept(),
            token('DEC203_STREAM_IDENTITY_CHANGED'),
          );
          assert.equal(ingress.identity, diagnostics);
          segment.release();
          segment.release();
          assert.throws(
            () => segment.writer.read(),
            token('DEC203_STREAM_CAPABILITY_CLOSED'),
          );
          stream.close();
          await ingress.close();
          await assert.rejects(
            () => ingress.accept(),
            token('DEC203_STREAM_CAPABILITY_CLOSED'),
          );
        },
      );
    },
  );

  check(
    'NS08 borrowed accept/receive/writer methods attest actual receiver owner',
    async (fixture) => {
      const first = await fixture.build();
      const second = await fixture.build({
        runDirectory: await fixture.directory('second'),
      });
      const firstPeer = await writers(fixture, first.endpoint);
      const firstStream = await bounded(first.accept());
      await firstPeer.command('SEND_A');
      const firstSegment = await receive(firstStream);
      const secondPeer = await writers(fixture, second.endpoint);
      const secondStream = await bounded(first.accept.call(second));
      await secondPeer.command('SEND_B');
      const secondSegment = await bounded(
        firstStream.receive.call(secondStream),
      );
      const borrowedRead = firstSegment.writer.read;
      await first.close();
      assert.throws(
        () => firstSegment.copyBytes(),
        token('DEC203_STREAM_CAPABILITY_CLOSED'),
      );
      await assert.rejects(
        () => firstStream.receive(),
        token('DEC203_STREAM_CAPABILITY_CLOSED'),
      );
      assert.deepEqual(borrowedRead.call(secondSegment.writer), {
        pid: secondPeer.ready.b,
        uid: process.getuid(),
        gid: process.getgid(),
        fdInfoPid: secondPeer.ready.b,
        alive: true,
      });
      const copied = firstSegment.copyBytes.call(secondSegment);
      assert.ok(copied.length > 0 && copied.length <= 4);
      assert.ok(copied.equals(Buffer.from('bbbb').subarray(0, copied.length)));
      firstSegment.release.call(secondSegment);
      assert.throws(
        () => borrowedRead.call(secondSegment.writer),
        token('DEC203_STREAM_CAPABILITY_CLOSED'),
      );
      await literal(secondStream, [
        ['bbbb'.slice(copied.length), secondPeer.ready.b],
      ]);
    },
  );

  check(
    'NS10 separate module registries reject foreign ingress without DTO adoption',
    async (fixture) => {
      const first = await fixture.build();
      const copy = await fixture.copySubject();
      const foreignRun = await fixture.directory('foreign');
      const foreign = await fixture.build(
        { runDirectory: foreignRun },
        copy.factory,
      );
      shape(foreign, ['accept', 'close', 'endpoint', 'identity', 'metadata']);
      await assert.rejects(
        async () => first.accept.call(foreign),
        token('DEC203_STREAM_INVALID_CAPABILITY'),
      );
      await assert.rejects(
        async () => foreign.accept.call(first),
        token('DEC203_STREAM_INVALID_CAPABILITY'),
      );
      await assert.rejects(
        async () => first.accept(1),
        token('DEC203_STREAM_PROTOCOL'),
      );
      await foreign.close();
      await first.close();
    },
  );
}
