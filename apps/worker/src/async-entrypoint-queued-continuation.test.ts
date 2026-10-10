/** Controlled receiving composition, not SQL, production CMS wiring, or redelivery proof. */
import { describe, it } from 'vitest';

import {
  fixture,
  same,
} from './async-entrypoint-queued-continuation-test-support';

describe('queued continuation through the actual generic receiving composition', () => {
  it('retries an applied queued outcome without ACK or processed-event write', async () => {
    const f = fixture('queued');
    await f.run();
    f.assertFinished();
  });

  it('retries a queued outcome CAS conflict without recording the origin', async () => {
    const f = fixture('queued', false);
    await f.run();
    f.assertFinished();
  });

  it.each(['succeeded', 'failed', 'cancelled'] as const)(
    'ACKs %s only after actual apply and processed-event port responses',
    async (state) => {
      const f = fixture(state);
      await f.run();
      f.assertFinished();
    },
  );

  it('does not retry or ACK before the queued apply response resolves', async () => {
    const f = fixture('queued', true, 'apply');
    const pending = f.run();
    try {
      await Promise.race([
        f.gate.entered,
        pending.then(() => {
          throw new Error('Queue handler ended before apply barrier');
        }),
      ]);
      same(f.history, f.prefix);
      same(f.ack.mock.calls, []);
      same(f.retry.mock.calls, []);
    } finally {
      f.gate.release();
      await pending;
    }
    f.assertFinished();
  });

  it('does not ACK or retry before the terminal processed-write response resolves', async () => {
    const f = fixture('succeeded', true, 'processed');
    const pending = f.run();
    try {
      await Promise.race([
        f.gate.entered,
        pending.then(() => {
          throw new Error('Queue handler ended before processed-write barrier');
        }),
      ]);
      same(f.history, [
        ...f.prefix,
        ['apply-response', true],
        ['rpc', 'record_processed_event', f.recordArgs],
      ]);
      same(f.ack.mock.calls, []);
      same(f.retry.mock.calls, []);
    } finally {
      f.gate.release();
      await pending;
    }
    f.assertFinished();
  });
});
