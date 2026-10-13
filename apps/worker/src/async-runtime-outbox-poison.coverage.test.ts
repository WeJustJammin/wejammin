import { describe, expect, it } from 'vitest';

import { parsePoisonedOutboxRow } from './async-runtime-outbox-poison';

const LEASE = '44444444-4444-4444-8444-444444444444';
const OUTBOX_ID = '00000001-1111-4111-8111-111111111111';
const OTHER_ID = '00000002-1111-4111-8111-111111111111';

describe('parsePoisonedOutboxRow event id binding', () => {
  it('refuses a row whose eventId names a different event than its outbox id', () => {
    expect(
      parsePoisonedOutboxRow(
        { outboxId: OUTBOX_ID, eventId: OTHER_ID, leaseToken: LEASE },
        LEASE,
      ),
    ).toBeNull();
  });

  it('refuses a row whose eventId differs from its snake_case event_id', () => {
    expect(
      parsePoisonedOutboxRow(
        { event_id: OUTBOX_ID, eventId: OTHER_ID, lease_token: LEASE },
        LEASE,
      ),
    ).toBeNull();
  });

  it('accepts a row whose eventId repeats its outbox id', () => {
    expect(
      parsePoisonedOutboxRow(
        { outboxId: OUTBOX_ID, eventId: OUTBOX_ID, leaseToken: LEASE },
        LEASE,
      ),
    ).toEqual({
      outboxId: OUTBOX_ID,
      identity: {
        eventId: OUTBOX_ID,
        eventType: null,
        schemaVersion: null,
        aggregateType: null,
        aggregateId: null,
        aggregateVersion: null,
      },
    });
  });
});
