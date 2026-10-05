import { describe, expect, it, vi } from 'vitest';

import { createEventConsumerRegistry } from './registry';
import { queueBody } from './test-support';

const build = () => {
  const reconciler = {
    process: vi.fn(async () => ({ outcome: 'ack' as const })),
  };
  const notifier = {
    process: vi.fn(async () => ({
      outcome: 'retry' as const,
      delaySeconds: 15,
    })),
  };
  const capabilityGrant = {
    process: vi.fn(async () => ({ outcome: 'ack' as const })),
  };
  return {
    reconciler,
    notifier,
    capabilityGrant,
    registry: createEventConsumerRegistry({
      reconciler,
      notifier,
      capabilityGrant,
    }),
  };
};

describe('event consumer registry', () => {
  it('[P2-S09-AC-913] routes identity.mfa-factor.changed to the auth-state-reconciler', async () => {
    const { registry, reconciler, notifier, capabilityGrant } = build();
    const message = {
      body: queueBody('identity.mfa-factor.changed.v1', 'mfa_factor'),
      attempts: 2,
    };
    await expect(registry.process(message)).resolves.toEqual({
      outcome: 'ack',
    });
    expect(reconciler.process).toHaveBeenCalledWith(message);
    expect(notifier.process).not.toHaveBeenCalled();
    expect(capabilityGrant.process).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-916] routes identity.security-notification.requested to the security-notifier', async () => {
    const { registry, notifier } = build();
    await expect(
      registry.process({
        body: queueBody(
          'identity.security-notification.requested.v1',
          'security_event',
        ),
        attempts: 1,
      }),
    ).resolves.toEqual({ outcome: 'retry', delaySeconds: 15 });
    expect(notifier.process).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['cms.capability.grant.changed.v1', 'capabilityGrant'],
    ['cms.capability.grant.changed.v2', 'capabilityGrant'],
    ['identity.mfa-factor.changed.v7', 'reconciler'],
    ['identity.security-notification.requested.v3', 'notifier'],
  ] as const)(
    '[P2-S09-AC-689] routes %s by family so unknown versions reach their consumer DLQ path',
    async (eventType, target) => {
      const consumers = build();
      await consumers.registry.process({
        body: queueBody(eventType, 'x', { schemaVersion: 2 }),
        attempts: 1,
      });
      expect(consumers[target].process).toHaveBeenCalledTimes(1);
    },
  );

  it('retries a body that names no registered consumer family', async () => {
    const { registry } = build();
    for (const body of [null, 'x', {}, queueBody('job.requested', 'job')]) {
      await expect(registry.process({ body, attempts: 1 })).resolves.toEqual({
        outcome: 'retry',
      });
    }
  });
});
