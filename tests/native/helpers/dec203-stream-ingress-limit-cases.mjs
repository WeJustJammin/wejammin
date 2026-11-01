import {
  assert,
  raw,
  shape,
  writers,
  writerValue,
} from './dec203-stream-ingress-harness.mjs';

function acceptConnected(owner) {
  const stream = owner.accept();
  assert.notEqual(
    stream,
    undefined,
    'actual connected fixture must be accepted',
  );
  shape(stream, ['receive', 'close']);
  return stream;
}

async function connect(fixture, mirror) {
  const peer = await writers(fixture, mirror.endpoint);
  return {
    peer,
    stream: acceptConnected(mirror.owner),
    expected: Buffer.alloc(0),
    offset: 0,
    pid: peer.ready.a,
  };
}

function takeSegment(stream) {
  const segment = stream.receive();
  assert.notEqual(
    segment,
    undefined,
    'complete SEND ACK left real queued bytes',
  );
  assert.notEqual(
    segment,
    null,
    'queued literal bytes cannot become premature EOF',
  );
  return segment;
}

function validateBytes(record, segment) {
  const bytes = segment.copyBytes();
  assert.ok(Buffer.isBuffer(bytes));
  assert.ok(bytes.length > 0 && bytes.length <= 16 * 1024);
  assert.ok(bytes.length <= record.expected.length - record.offset);
  assert.deepEqual(
    bytes,
    record.expected.subarray(record.offset, record.offset + bytes.length),
  );
  writerValue(segment, record.pid);
  return record.offset + bytes.length;
}

function retainSegment(record, held) {
  const segment = takeSegment(record.stream);
  assert.ok(
    !held.includes(segment),
    'retained native segments must be distinct',
  );
  held.push(segment);
  record.offset = validateBytes(record, segment);
}

function drainLiteral(record) {
  while (record.offset < record.expected.length) {
    const segment = takeSegment(record.stream);
    try {
      record.offset = validateBytes(record, segment);
    } finally {
      segment.release();
    }
  }
  assert.equal(record.offset, record.expected.length);
}

async function endLiteral(record) {
  await record.peer.command('HALF_CLOSE');
  assert.equal(
    record.stream.receive(),
    null,
    'all literal bytes precede true EOF',
  );
  assert.equal(record.stream.receive(), null, 'cached EOF stays null');
  record.stream.close();
}

export function limitCases(check) {
  check(
    'NS21 native sixteen-stream cap survives EOF; close admits queued seventeenth',
    async (fixture) => {
      const ingress = await fixture.build();
      const mirror = await raw(fixture, ingress);
      assert.equal(mirror.owner.accept(), undefined);
      const records = [];
      for (let index = 0; index < 16; index++) {
        records.push(await connect(fixture, mirror));
      }
      assert.equal(records.length, 16);

      const seventeenth = await writers(fixture, mirror.endpoint);
      assert.equal(
        mirror.owner.accept(),
        undefined,
        'sixteen actual open streams leave the connected seventeenth queued',
      );
      const first = records[0];
      await first.peer.command('HALF_CLOSE');
      assert.equal(first.stream.receive(), null);
      assert.equal(first.stream.receive(), null);
      assert.equal(
        mirror.owner.accept(),
        undefined,
        'true EOF does not release the native open-stream credit',
      );
      first.stream.close();
      first.stream.close();

      const admitted = {
        peer: seventeenth,
        stream: acceptConnected(mirror.owner),
        expected: Buffer.from('bbbb'),
        offset: 0,
        pid: seventeenth.ready.b,
      };
      const sent = await seventeenth.command('SEND_B');
      assert.equal(sent.count, 4);
      drainLiteral(admitted);
      await endLiteral(admitted);
      for (const record of records.slice(1)) record.stream.close();
      mirror.owner.close();
      await ingress.close();
    },
  );

  check(
    'NS22 native owner thirty-two-segment cap returns one credit per release',
    async (fixture) => {
      const ingress = await fixture.build();
      const mirror = await raw(fixture, ingress);
      const records = [];
      for (let index = 0; index < 9; index++) {
        records.push(await connect(fixture, mirror));
      }
      const held = [];
      for (const record of records.slice(0, 8)) {
        for (let index = 0; index < 4; index++) {
          const sent = await record.peer.command('SEND_A');
          assert.equal(sent.count, 4);
          record.expected = Buffer.concat([
            record.expected,
            Buffer.from('AAAA'),
          ]);
          // One retained segment per turn, not one assumed receive per send.
          retainSegment(record, held);
        }
        assert.equal(record.expected.length, 16);
        assert.ok(record.offset > 0 && record.offset <= 16);
      }
      assert.equal(held.length, 32);

      const ninth = records[8];
      ninth.pid = ninth.peer.ready.b;
      const firstSend = await ninth.peer.command('SEND_B');
      assert.equal(firstSend.count, 4);
      ninth.expected = Buffer.from('bbbb');
      assert.equal(
        ninth.stream.receive(),
        undefined,
        'global thirty-two cap blocks a stream holding zero segments',
      );
      const released = held.shift();
      released.release();
      released.release();
      retainSegment(ninth, held);
      assert.equal(held.length, 32);

      const secondSend = await ninth.peer.command('SEND_B');
      assert.equal(secondSend.count, 4);
      ninth.expected = Buffer.from('bbbbbbbb');
      assert.equal(
        ninth.stream.receive(),
        undefined,
        'idempotent release must not return a second global credit',
      );
      const distinct = held.shift();
      assert.notEqual(distinct, released);
      distinct.release();
      retainSegment(ninth, held);
      assert.equal(held.length, 32);

      for (const segment of held) segment.release();
      for (const record of records) {
        drainLiteral(record);
        await endLiteral(record);
      }
      assert.equal(ninth.offset, 8);
      mirror.owner.close();
      await ingress.close();
    },
  );
}
