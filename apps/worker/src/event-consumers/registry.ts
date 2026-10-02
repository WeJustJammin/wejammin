import type { EventConsumerMessage, EventConsumerOutcome } from './types';

type Consumer = Readonly<{
  process: (message: EventConsumerMessage) => Promise<EventConsumerOutcome>;
}>;

export type EventConsumerRegistryDependencies = Readonly<{
  reconciler: Consumer;
  notifier: Consumer;
  capabilityGrant: Consumer;
}>;

const FAMILIES: ReadonlyArray<
  readonly [pattern: RegExp, consumer: keyof EventConsumerRegistryDependencies]
> = [
  [/^identity\.mfa-factor\.changed\.v[0-9]+$/u, 'reconciler'],
  [/^identity\.security-notification\.requested\.v[0-9]+$/u, 'notifier'],
  [/^cms\.capability\.grant\.changed\.v[0-9]+$/u, 'capabilityGrant'],
];

/**
 * Routes a queue message to its registered consumer by event family, not by
 * exact version, so a version this build does not know still reaches its
 * consumer's durable dead-letter path instead of retrying forever.
 */
export const createEventConsumerRegistry = (
  dependencies: EventConsumerRegistryDependencies,
) => ({
  process: async (
    message: EventConsumerMessage,
  ): Promise<EventConsumerOutcome> => {
    const body = message.body;
    const eventType =
      typeof body === 'object' && body !== null && !Array.isArray(body)
        ? (body as { eventType?: unknown }).eventType
        : undefined;
    const family =
      typeof eventType === 'string'
        ? FAMILIES.find(([pattern]) => pattern.test(eventType))
        : undefined;
    if (family === undefined) return { outcome: 'retry' };
    return dependencies[family[1]].process(message);
  },
});

export type EventConsumerRegistry = ReturnType<
  typeof createEventConsumerRegistry
>;
