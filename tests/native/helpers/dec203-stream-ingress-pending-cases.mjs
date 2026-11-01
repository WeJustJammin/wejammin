import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assert,
  bounded,
  literal,
  token,
  writers,
} from './dec203-stream-ingress-harness.mjs';

function observe(promise) {
  return promise.then(
    (value) => ({ kind: 'fulfilled', value }),
    (error) => ({ kind: 'rejected', error }),
  );
}

async function finishPending(source, original, ingress, pending, peer) {
  const failures = [];
  let closing;
  try {
    // Revocation stops the real scheduler before this helper's first await.
    closing = observe(ingress.close());
  } catch (error) {
    failures.push(error);
  }
  try {
    const outcome = await bounded(pending);
    assert.equal(outcome.kind, 'rejected', 'first demand must not succeed');
    assert.ok(
      [
        'DEC203_STREAM_IDENTITY_CHANGED',
        'DEC203_STREAM_CAPABILITY_CLOSED',
      ].includes(outcome.error.code),
      'first demand must observe drift or explicit cleanup revocation',
    );
    assert.equal(outcome.error.message, outcome.error.code);
  } catch (error) {
    failures.push(error);
  }
  try {
    if (closing) {
      const outcome = await bounded(closing);
      if (outcome.kind === 'rejected') throw outcome.error;
      assert.equal(outcome.value, undefined, 'owned ingress must close');
    }
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      writeFileSync(source, original);
      assert.deepEqual(readFileSync(source), original);
    } catch (error) {
      failures.push(error);
    }
  }
  try {
    // Existing FINISH protocol awaits both actual children and all stdio.
    await peer.stop();
  } catch (error) {
    failures.push(error);
  }
  return failures;
}

function raiseFailures(primary, cleanup) {
  if (primary && cleanup.length)
    throw new AggregateError(
      [primary, ...cleanup],
      'pending drift and cleanup',
    );
  if (primary) throw primary;
  if (cleanup.length)
    throw new AggregateError(cleanup, 'owned pending drift cleanup');
}

export function pendingCases(check) {
  check(
    'NS23 pending accept duplicate attests owned source drift before LIMIT',
    async (fixture) => {
      const copy = await fixture.copySubject();
      const ingress = await fixture.build({}, copy.factory);
      const peer = await writers(fixture, ingress.endpoint);
      const stream = await bounded(ingress.accept());
      await peer.command('SEND_A');
      await literal(stream, [['AAAA', peer.ready.a]]);
      const source = join(copy.directory, 'stream-ingress.c');
      assert.ok(fixture.files.has(source), 'mutate only owned copied source');
      const original = readFileSync(source);
      const pending = observe(ingress.accept());
      let primary;
      let cleanup;
      try {
        // No await/timer turn between first demand, drift and duplicate admission.
        appendFileSync(source, '\n/* NS23 owned copied-source drift */\n');
        assert.notDeepEqual(readFileSync(source), original);
        const duplicate = ingress.accept();
        await bounded(
          assert.rejects(duplicate, token('DEC203_STREAM_IDENTITY_CHANGED')),
        );
      } catch (error) {
        primary = error;
      } finally {
        cleanup = await finishPending(source, original, ingress, pending, peer);
      }
      raiseFailures(primary, cleanup);
    },
  );

  check(
    'NS24 pending receive duplicate attests owned source drift before LIMIT',
    async (fixture) => {
      const copy = await fixture.copySubject();
      const ingress = await fixture.build({}, copy.factory);
      const peer = await writers(fixture, ingress.endpoint);
      const stream = await bounded(ingress.accept());
      await peer.command('SEND_B');
      await literal(stream, [['bbbb', peer.ready.b]]);
      const source = join(copy.directory, 'stream-ingress.c');
      assert.ok(fixture.files.has(source), 'mutate only owned copied source');
      const original = readFileSync(source);
      const pending = observe(stream.receive());
      let primary;
      let cleanup;
      try {
        // Held-live writers send nothing after the genuine byte/writer control.
        appendFileSync(source, '\n/* NS24 owned copied-source drift */\n');
        assert.notDeepEqual(readFileSync(source), original);
        const duplicate = stream.receive();
        await bounded(
          assert.rejects(duplicate, token('DEC203_STREAM_IDENTITY_CHANGED')),
        );
      } catch (error) {
        primary = error;
      } finally {
        cleanup = await finishPending(source, original, ingress, pending, peer);
      }
      raiseFailures(primary, cleanup);
    },
  );
}
