import { CmsCapabilityGrantChangedQueueEnvelopeSchema } from '@wejammin/contracts';

import { admitConsumerEvent, recordEnvelopeDeadLetter } from './admit';
import { EVENT_CONSUMER_RPC } from './rpc-names';
import { runWithDeadline } from './deadline';
import { retryAfterAttempt } from './retry-schedule';
import {
  defaultConsumerClock,
  type ConsumerClock,
  type ConsumerTelemetry,
  type DeadLetterPort,
  type EventConsumerMessage,
  type EventConsumerOutcome,
  type EventConsumerRpc,
} from './types';

export const CAPABILITY_GRANT_CONSUMER =
  'cms.capability-grant-consumer' as const;
const EVENT_NAME = 'cms.capability_grant_consumer' as const;

export type CapabilityGrantState = 'active' | 'lapsed' | 'revoked';

/** The authoritative current grant, as the database derives it now. */
export type CurrentCapabilityGrant = Readonly<{
  grantId: string;
  subjectPersonId: string;
  version: string;
  state: CapabilityGrantState;
  capabilityCode: string;
}>;

export type CapabilityGrantSource = Readonly<{
  read: (
    grantId: string,
    signal: AbortSignal,
  ) => Promise<CurrentCapabilityGrant | null>;
}>;

/**
 * Where an authorization consumer applies a refetched grant (for example to
 * drop a cached capability set). It only ever receives the authoritative
 * current grant, never the event.
 */
export type AuthorizationRefreshSink = Readonly<{
  refresh: (
    grant: CurrentCapabilityGrant,
    signal: AbortSignal,
  ) => Promise<void>;
}>;

export type CapabilityGrantConsumerDependencies = Readonly<{
  grants: CapabilityGrantSource;
  authorization: AuthorizationRefreshSink;
  deadLetter: DeadLetterPort;
  telemetry: ConsumerTelemetry;
  clock?: ConsumerClock;
}>;

/**
 * BE03a `cms.capability.grant.changed.v1` consumer. The event is a hint that
 * a grant aggregate changed: it is never permission proof. The consumer
 * rereads the grant by id, refuses to apply a read older than the committed
 * version the event announces (the read retries instead), and hands only the
 * re-read state onward. An event of any other version is durably dead-lettered.
 */
export const createCapabilityGrantConsumer = (
  dependencies: CapabilityGrantConsumerDependencies,
) => {
  const clock = dependencies.clock ?? defaultConsumerClock;
  const { telemetry } = dependencies;

  const process = async (
    message: EventConsumerMessage,
  ): Promise<EventConsumerOutcome> => {
    const startedAt = clock.now();
    return runWithDeadline(async (signal) => {
      const admitted = await admitConsumerEvent({
        consumer: CAPABILITY_GRANT_CONSUMER,
        schema: CmsCapabilityGrantChangedQueueEnvelopeSchema,
        message,
        deadLetter: dependencies.deadLetter,
        telemetry,
        signal,
      });
      if (!admitted.ok) return admitted.outcome;
      const { envelope } = admitted;
      const emit = (
        outcome: 'success' | 'retry' | 'failure',
        errorCode: string | null,
        grantState: CapabilityGrantState | null,
        version: string,
      ): void => {
        const details = {
          eventName: EVENT_NAME,
          operation: 'refetch',
          consumer: CAPABILITY_GRANT_CONSUMER,
          outcome,
          attempt: Math.max(1, message.attempts),
          correlationId: envelope.correlationId,
          traceId: envelope.eventId,
          entityType: 'cms_capability_grant',
          entityVersion: version,
          dependency: 'supabase-postgres',
          durationMs: Math.max(0, clock.now() - startedAt),
          retryable: outcome === 'retry',
          ...(errorCode === null ? {} : { errorCode }),
          ...(grantState === null ? {} : { attributes: { grantState } }),
          metrics: { 'cms.capability_grant.refetch.total': 1 },
        } as const;
        const options = {
          samplingClass: 'always',
          highRisk: outcome !== 'success',
        } as const;
        if (outcome === 'success') telemetry.info(details, options);
        else telemetry.warn(details, options);
      };
      const retry = (code: string): EventConsumerOutcome => {
        emit('retry', code, null, envelope.aggregateVersion);
        return retryAfterAttempt(message.attempts);
      };

      let current: CurrentCapabilityGrant | null;
      try {
        current = await dependencies.grants.read(envelope.aggregateId, signal);
      } catch {
        return retry('GRANT_READ_FAILED');
      }
      if (current === null) {
        const recorded = await recordEnvelopeDeadLetter({
          consumer: CAPABILITY_GRANT_CONSUMER,
          envelope,
          reasonCode: 'SOURCE_RECORD_NOT_FOUND',
          deadLetter: dependencies.deadLetter,
          signal,
        });
        if (!recorded) return retry('DEAD_LETTER_UNAVAILABLE');
        emit(
          'failure',
          'SOURCE_RECORD_NOT_FOUND',
          null,
          envelope.aggregateVersion,
        );
        return { outcome: 'ack' };
      }
      // The announced version is committed, so a lower version is a stale read.
      if (BigInt(current.version) < BigInt(envelope.aggregateVersion))
        return retry('GRANT_READ_STALE');

      try {
        await dependencies.authorization.refresh(current, signal);
      } catch {
        return retry('AUTHORIZATION_REFRESH_FAILED');
      }
      emit('success', null, current.state, current.version);
      return { outcome: 'ack' };
    });
  };

  return { process };
};

export type CapabilityGrantConsumer = ReturnType<
  typeof createCapabilityGrantConsumer
>;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const VERSION = /^[1-9][0-9]{0,18}$/u;
const CAPABILITY = /^[a-z][a-z0-9_.-]{0,127}$/u;
const STATES: ReadonlySet<string> = new Set<CapabilityGrantState>([
  'active',
  'lapsed',
  'revoked',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseGrant = (value: unknown): CurrentCapabilityGrant | null => {
  if (!isRecord(value) || typeof value.found !== 'boolean')
    throw new Error('Malformed capability grant response');
  if (!value.found) {
    if (Object.keys(value).length !== 1)
      throw new Error('Malformed capability grant response');
    return null;
  }
  if (
    Object.keys(value).sort().join(',') !==
      'capabilityCode,found,grantId,state,subjectPersonId,version' ||
    typeof value.grantId !== 'string' ||
    !UUID.test(value.grantId) ||
    typeof value.subjectPersonId !== 'string' ||
    !UUID.test(value.subjectPersonId) ||
    typeof value.version !== 'string' ||
    !VERSION.test(value.version) ||
    typeof value.state !== 'string' ||
    !STATES.has(value.state) ||
    typeof value.capabilityCode !== 'string' ||
    !CAPABILITY.test(value.capabilityCode)
  )
    throw new Error('Malformed capability grant response');
  return {
    grantId: value.grantId,
    subjectPersonId: value.subjectPersonId,
    version: value.version,
    state: value.state as CapabilityGrantState,
    capabilityCode: value.capabilityCode,
  };
};

export const createRpcCapabilityGrantSource = (
  rpc: EventConsumerRpc,
): CapabilityGrantSource => ({
  read: async (grantId, signal) =>
    parseGrant(
      await rpc<unknown>(
        EVENT_CONSUMER_RPC.readCapabilityGrant,
        { p_grant_id: grantId },
        signal,
      ),
    ),
});
