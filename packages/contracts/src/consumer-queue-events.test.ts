import { describe, expect, it } from 'vitest';

import {
  CmsCapabilityGrantChangedQueueEnvelopeSchema,
  CONSUMER_EVENT_TYPE,
  ConsumerQueueEnvelopeSchema,
  IdentityMfaFactorChangedQueueEnvelopeSchema,
  IdentitySecurityNotificationQueueEnvelopeSchema,
  isConsumerEventType,
} from './consumer-queue-events.ts';

const envelope = (patch: Record<string, unknown>) => ({
  eventId: '11111111-1111-4111-8111-111111111111',
  schemaVersion: 1,
  aggregateId: '22222222-2222-4222-8222-222222222222',
  aggregateVersion: '3',
  correlationId: '33333333-3333-4333-8333-333333333333',
  causationId: null,
  ...patch,
});

describe('consumer queue event envelopes', () => {
  it('[P2-S09-AC-689] accepts the identifier-only grant envelope and nothing else', () => {
    const valid = envelope({
      eventType: CONSUMER_EVENT_TYPE.capabilityGrantChanged,
      aggregateType: 'cms_capability_grant',
    });
    expect(CmsCapabilityGrantChangedQueueEnvelopeSchema.parse(valid)).toEqual(
      valid,
    );
    for (const patch of [
      { payload: { grantId: valid.aggregateId } },
      { schemaVersion: 2 },
      { aggregateType: 'job' },
      { aggregateVersion: '0' },
      { eventType: 'cms.capability.grant.changed.v2' },
    ]) {
      expect(
        CmsCapabilityGrantChangedQueueEnvelopeSchema.safeParse({
          ...valid,
          ...patch,
        }).success,
      ).toBe(false);
    }
  });

  it('[P2-S09-AC-913] accepts the factor-changed envelope bound to the mfa_factor aggregate', () => {
    const valid = envelope({
      eventType: CONSUMER_EVENT_TYPE.mfaFactorChanged,
      aggregateType: 'mfa_factor',
    });
    expect(
      IdentityMfaFactorChangedQueueEnvelopeSchema.safeParse(valid).success,
    ).toBe(true);
    expect(
      IdentityMfaFactorChangedQueueEnvelopeSchema.safeParse({
        ...valid,
        aggregateType: 'security_event',
      }).success,
    ).toBe(false);
  });

  it('[P2-S09-AC-916] accepts the notification envelope bound to the security_event aggregate', () => {
    const valid = envelope({
      eventType: CONSUMER_EVENT_TYPE.securityNotificationRequested,
      aggregateType: 'security_event',
    });
    expect(
      IdentitySecurityNotificationQueueEnvelopeSchema.safeParse(valid).success,
    ).toBe(true);
    expect(
      IdentitySecurityNotificationQueueEnvelopeSchema.safeParse({
        ...valid,
        causationId: 'not-a-uuid',
      }).success,
    ).toBe(false);
  });

  it('[P2-S09-AC-689] routes every version of a consumer family, so unknown versions reach the DLQ path', () => {
    expect(isConsumerEventType('cms.capability.grant.changed.v1')).toBe(true);
    expect(isConsumerEventType('cms.capability.grant.changed.v2')).toBe(true);
    expect(isConsumerEventType('identity.mfa-factor.changed.v9')).toBe(true);
    expect(
      isConsumerEventType('identity.security-notification.requested.v2'),
    ).toBe(true);
    expect(isConsumerEventType('job.requested')).toBe(false);
    expect(isConsumerEventType('cms.schema.activated.v1')).toBe(false);
    expect(isConsumerEventType(42)).toBe(false);
  });

  it('[P2-S09-AC-913] the relay envelope is exactly one of the three consumer envelopes', () => {
    const factor = envelope({
      eventType: CONSUMER_EVENT_TYPE.mfaFactorChanged,
      aggregateType: 'mfa_factor',
    });
    const notice = envelope({
      eventType: CONSUMER_EVENT_TYPE.securityNotificationRequested,
      aggregateType: 'security_event',
    });
    const grant = envelope({
      eventType: CONSUMER_EVENT_TYPE.capabilityGrantChanged,
      aggregateType: 'cms_capability_grant',
    });
    for (const valid of [factor, notice, grant])
      expect(ConsumerQueueEnvelopeSchema.parse(valid)).toEqual(valid);
    for (const invalid of [
      { ...factor, aggregateType: 'cms_capability_grant' },
      { ...grant, eventType: 'job.requested' },
      { ...notice, schemaVersion: 2 },
    ])
      expect(ConsumerQueueEnvelopeSchema.safeParse(invalid).success).toBe(
        false,
      );
  });
});
