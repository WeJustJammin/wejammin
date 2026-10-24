import { join } from 'node:path';
import {
  assert,
  bounded,
  literal,
  raw,
  receive,
  token,
  writers,
  writerValue,
} from './dec203-stream-ingress-harness.mjs';

const closed = () => token('DEC203_STREAM_CAPABILITY_CLOSED');

export function streamCases(check) {
  check(
    'NS11 actual no-data demand, duplicate pending limits and send-caused progress',
    async (fixture) => {
      const ingress = await fixture.build();
      let accepted = 0;
      const pendingAccept = ingress.accept().then((value) => {
        accepted++;
        return value;
      });
      pendingAccept.catch(() => {}); // Cleanup rejection remains observed if fixture setup fails.
      await assert.rejects(
        () => ingress.accept(),
        token('DEC203_STREAM_LIMIT'),
      );
      assert.equal(accepted, 0, 'no fixture connector exists yet');
      const peer = await writers(fixture, ingress.endpoint);
      const stream = await bounded(pendingAccept);
      assert.equal(accepted, 1);
      let received = 0;
      const pending = stream.receive().then((value) => {
        received++;
        return value;
      });
      pending.catch(() => {});
      await assert.rejects(
        () => stream.receive(),
        token('DEC203_STREAM_LIMIT'),
      );
      assert.equal(received, 0, 'held fixture has not sent any bytes');
      await peer.command('SEND_A');
      const segment = await bounded(pending);
      writerValue(segment, peer.ready.a);
      const bytes = segment.copyBytes();
      assert.ok(bytes.equals(Buffer.from('AAAA').subarray(0, bytes.length)));
      segment.release();
      await literal(stream, [['AAAA'.slice(bytes.length), peer.ready.a]]);
      assert.equal(received, 1);
    },
  );

  check(
    'NS12 queued tail survives write shutdown; true and cached EOF are null',
    async (fixture) => {
      const ingress = await fixture.build();
      const peer = await writers(fixture, ingress.endpoint);
      const stream = await bounded(ingress.accept());
      await peer.command('SPLIT_A');
      await peer.command('SEND_B');
      await peer.command('HALF_CLOSE');
      await literal(stream, [
        ['s1s2s3', peer.ready.a],
        ['bbbb', peer.ready.b],
      ]);
      assert.equal(await bounded(stream.receive()), null);
      assert.equal(await bounded(stream.receive()), null);
      stream.close();
      await assert.rejects(() => stream.receive(), closed());
    },
  );

  check(
    'NS13 actual terminal writer and latched exit still attest owned source',
    async (fixture) => {
      const copy = await fixture.copySubject();
      const ingress = await fixture.build({}, copy.factory);
      const peer = await writers(fixture, ingress.endpoint);
      const stream = await bounded(ingress.accept());
      await peer.command('SEND_A');
      const segment = await receive(stream);
      writerValue(segment, peer.ready.a);
      await peer.command('EXIT_A');
      const bytes = segment.copyBytes();
      assert.ok(bytes.equals(Buffer.from('AAAA').subarray(0, bytes.length)));
      assert.throws(
        () => segment.writer.read(),
        token('DEC203_STREAM_WRITER_EXITED'),
      );
      assert.throws(
        () => segment.writer.read(),
        token('DEC203_STREAM_WRITER_EXITED'),
      );
      await fixture.drift(
        join(copy.directory, 'stream-ingress.c'),
        false,
        async () => {
          assert.throws(
            () => segment.writer.read(),
            token('DEC203_STREAM_IDENTITY_CHANGED'),
          );
        },
      );
      assert.throws(
        () => segment.writer.read(),
        token('DEC203_STREAM_WRITER_EXITED'),
      );
      segment.release();
      assert.throws(() => segment.writer.read(), closed());
    },
  );

  check(
    'NS14 copyBytes is fresh, independently mutable, and revoked on release',
    async (fixture) => {
      const ingress = await fixture.build();
      const peer = await writers(fixture, ingress.endpoint);
      const stream = await bounded(ingress.accept());
      await peer.command('SEND_A');
      const segment = await receive(stream);
      const first = segment.copyBytes();
      const original = Buffer.from(first);
      const second = segment.copyBytes();
      assert.notEqual(first, second);
      assert.ok(first.equals(second));
      first.fill(0);
      assert.ok(segment.copyBytes().equals(original));
      assert.ok(second.equals(original));
      writerValue(segment, peer.ready.a);
      segment.release();
      segment.release();
      assert.throws(() => segment.copyBytes(), closed());
      assert.throws(() => segment.writer.read(), closed());
      await literal(stream, [['AAAA'.slice(original.length), peer.ready.a]]);
    },
  );

  check(
    'NS15 public four-segment credit release resumes the already queued next bytes',
    async (fixture) => {
      const ingress = await fixture.build();
      const peer = await writers(fixture, ingress.endpoint);
      const stream = await bounded(ingress.accept());
      const held = [];
      let consumed = 0;
      for (let index = 0; index < 4; index++) {
        await peer.command('SEND_A');
        const segment = await receive(stream);
        writerValue(segment, peer.ready.a);
        assert.ok(segment.copyBytes().every((byte) => byte === 65));
        consumed += segment.copyBytes().length;
        held.push(segment);
      }
      let settlements = 0;
      const pending = stream.receive().then((value) => {
        settlements++;
        return value;
      });
      pending.catch(() => {});
      await peer.command('SEND_B');
      await assert.rejects(
        () => stream.receive(),
        token('DEC203_STREAM_LIMIT'),
      );
      assert.equal(
        settlements,
        0,
        'actual SEND_B ACK while four segments remain retained',
      );
      held.shift().release();
      const next = await bounded(pending);
      const bytes = next.copyBytes();
      const expected = Buffer.from('AAAAAAAAAAAAAAAAbbbb').subarray(consumed);
      assert.ok(bytes.length > 0 && bytes.length <= expected.length);
      assert.ok(bytes.equals(expected.subarray(0, bytes.length)));
      writerValue(next, consumed < 16 ? peer.ready.a : peer.ready.b);
      assert.ok(consumed >= 16 || consumed + bytes.length <= 16);
      consumed += bytes.length;
      next.release();
      for (const segment of held) segment.release();
      await literal(stream, [
        ['AAAAAAAAAAAAAAAA'.slice(Math.min(consumed, 16)), peer.ready.a],
        ['bbbb'.slice(Math.max(0, consumed - 16)), peer.ready.b],
      ]);
      assert.equal(settlements, 1);
    },
  );

  check(
    'NS16 synchronous native credit discriminator never consumes/discards queued bytes',
    async (fixture) => {
      const ingress = await fixture.build();
      const mirror = await raw(fixture, ingress);
      assert.equal(mirror.owner.accept(), undefined);
      const peer = await writers(fixture, mirror.endpoint);
      const stream = mirror.owner.accept();
      assert.equal(
        stream.receive(),
        undefined,
        'actual native EAGAIN is not EOF',
      );
      const held = [];
      let offset = 0;
      for (let index = 0; index < 4; index++) {
        await peer.command('SEND_A');
        const segment = stream.receive();
        writerValue(segment, peer.ready.a);
        const bytes = segment.copyBytes();
        assert.ok(bytes.length > 0 && bytes.every((byte) => byte === 65));
        offset += bytes.length;
        held.push(segment);
      }
      await peer.command('SEND_B');
      assert.equal(
        stream.receive(),
        undefined,
        'credit exhausted with real queued bytes',
      );
      held.shift().release();
      for (const segment of held) segment.release();
      const expected = Buffer.from('AAAAAAAAAAAAAAAAbbbb');
      assert.ok(offset <= 16);
      while (offset < expected.length) {
        const segment = stream.receive();
        const bytes = segment.copyBytes();
        assert.ok(bytes.length > 0 && bytes.length <= expected.length - offset);
        assert.ok(
          bytes.equals(expected.subarray(offset, offset + bytes.length)),
        );
        writerValue(segment, offset < 16 ? peer.ready.a : peer.ready.b);
        assert.ok(offset >= 16 || offset + bytes.length <= 16);
        offset += bytes.length;
        segment.release();
      }
      await peer.command('HALF_CLOSE');
      assert.equal(stream.receive(), null);
      assert.equal(stream.receive(), null);
    },
  );

  check(
    'NS17 ingress close synchronously revokes and settles pending accept exactly once',
    async (fixture) => {
      const ingress = await fixture.build();
      let settlements = 0;
      const pending = ingress.accept().catch((error) => {
        settlements++;
        throw error;
      });
      const rejected = assert.rejects(() => pending, closed());
      const closing = ingress.close();
      await rejected;
      await closing;
      await ingress.close();
      assert.equal(settlements, 1);
      await assert.rejects(() => ingress.accept(), closed());
    },
  );

  check(
    'NS18 stream/owner close settle pending receive and revoke retained descendants',
    async (fixture) => {
      const ingress = await fixture.build();
      const peer = await writers(fixture, ingress.endpoint);
      const stream = await bounded(ingress.accept());
      await peer.command('SEND_A');
      const segment = await receive(stream);
      await literal(stream, [
        ['AAAA'.slice(segment.copyBytes().length), peer.ready.a],
      ]);
      let settlements = 0;
      const pending = stream.receive().catch((error) => {
        settlements++;
        throw error;
      });
      const rejected = assert.rejects(() => pending, closed());
      stream.close();
      stream.close();
      assert.throws(() => segment.copyBytes(), closed());
      assert.throws(() => segment.writer.read(), closed());
      segment.release();
      await rejected;
      assert.equal(settlements, 1);
      await ingress.close();
      await ingress.close();
      await assert.rejects(() => stream.receive(), closed());
    },
  );
}
