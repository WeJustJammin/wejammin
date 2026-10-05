import { describe, expect, it } from 'vitest';

import { createRpcDeadLetterPort } from './dead-letter';
import { fakeRpc, IDS } from './test-support';

const input = {
  consumer: 'cms.capability-grant-consumer',
  reasonCode: 'UNKNOWN_EVENT_VERSION',
  identity: {
    eventId: IDS.event,
    eventType: 'cms.capability.grant.changed.v2',
    schemaVersion: 2,
    aggregateType: 'cms_capability_grant',
    aggregateId: IDS.aggregate,
    aggregateVersion: '4',
  },
} as const;

describe('RPC dead-letter port', () => {
  it('[P2-S09-AC-689] sends identifiers and the reason code only to the protected RPC', async () => {
    const { calls, rpc } = fakeRpc({
      consumer_dead_letter_event: () => ({ accepted: true }),
    });
    await createRpcDeadLetterPort(rpc).record(
      input,
      new AbortController().signal,
    );
    expect(calls).toEqual([
      {
        operation: 'consumer_dead_letter_event',
        input: {
          p_request: {
            consumer: 'cms.capability-grant-consumer',
            eventId: IDS.event,
            eventType: 'cms.capability.grant.changed.v2',
            schemaVersion: 2,
            aggregateType: 'cms_capability_grant',
            aggregateId: IDS.aggregate,
            aggregateVersion: '4',
            reasonCode: 'UNKNOWN_EVENT_VERSION',
          },
        },
      },
    ]);
  });

  it.each([
    ['unaccepted', { accepted: false }],
    ['malformed', 'ok'],
    ['null', null],
    ['extra keys', { accepted: true, id: IDS.event }],
  ])(
    'rejects a %s acknowledgement so the message is retried',
    async (_, ack) => {
      const { rpc } = fakeRpc({ consumer_dead_letter_event: () => ack });
      await expect(
        createRpcDeadLetterPort(rpc).record(
          input,
          new AbortController().signal,
        ),
      ).rejects.toThrow('Dead-letter record was not acknowledged');
    },
  );

  it('propagates a transport failure', async () => {
    const { rpc } = fakeRpc({
      consumer_dead_letter_event: () => {
        throw new Error('timeout');
      },
    });
    await expect(
      createRpcDeadLetterPort(rpc).record(input, new AbortController().signal),
    ).rejects.toThrow('timeout');
  });
});
