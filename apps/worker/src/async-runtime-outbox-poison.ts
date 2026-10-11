import { toVersion } from './async-runtime-parsing';

/**
 * The outbox relay (`platform.outbox.sweep`, BE00 "Event and Consumer Contracts") moves claimed
 * outbox rows onto the Queue as identifier-only envelopes. A claimed row the Worker cannot turn
 * into its envelope is POISON: it satisfies the claim's selector (event type, schema version and
 * aggregate type) but not the envelope grammar, for example a historical row whose correlation id
 * is not an RFC UUID. The relay must never let it stop the rows behind it (review B-05, P2-S11-AC-113):
 * a poison row that is only skipped stays first in `occurred_at` order, is claimed first again after
 * every lease expiry and starves `job.requested` and every other family.
 *
 * The rule is the one every Queue consumer already follows (event-consumers/admit.ts): what is not
 * exactly the envelope is recorded durably (`consumer_dead_letter_event`: identifiers and the closed
 * reason only), then acknowledged, which for the relay is completing the outbox claim. The outbox row
 * itself is never deleted or rewritten; if the record cannot be written the sweep retries, so a poison
 * row is never silently dropped.
 */

/** The relay's own name in the dead-letter record. */
export const OUTBOX_RELAY_CONSUMER = 'platform.outbox.sweep';

/**
 * Identifiers of a poison row in the shapes `platform_private.consumer_dead_letters` stores. Postgres
 * `uuid` accepts any hex UUID, so unlike the envelope this grammar does not require an RFC variant:
 * the event id and aggregate id of a row the envelope refuses may be exactly such a value.
 */
const HexUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const EventTypePattern = /^[a-z][a-z0-9._-]{0,159}$/u;
const AggregateTypePattern = /^[a-z][a-z0-9_]{0,63}$/u;
const SCHEMA_VERSION_MAX = 100;

export type PoisonedOutboxIdentity = Readonly<{
  eventId: string;
  eventType: string | null;
  schemaVersion: number | null;
  aggregateType: string | null;
  aggregateId: string | null;
  aggregateVersion: string | null;
}>;

export type PoisonedOutboxRow = Readonly<{
  /** The outbox row id, which is the claim's event id. */
  outboxId: string;
  identity: PoisonedOutboxIdentity;
}>;

const matching = (value: unknown, pattern: RegExp): string | null =>
  typeof value === 'string' && pattern.test(value) ? value : null;

/**
 * The recordable identity of a claimed row that `parseOutboxClaim` refused, or null when the row
 * cannot be addressed at all: it is not an object, its id is not a UUID, or it was not leased to
 * THIS sweep (`leaseToken`). Only identifiers that match their stored shape survive; anything else
 * becomes null, so a hostile or corrupt value can never reach the dead-letter record.
 */
export const parsePoisonedOutboxRow = (
  value: unknown,
  leaseToken: string,
): PoisonedOutboxRow | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null;
  const row = value as Record<string, unknown>;
  const outboxId = matching(row.outboxId ?? row.event_id, HexUuidPattern);
  if (outboxId === null) return null;
  if ((row.eventId ?? outboxId) !== outboxId) return null;
  if ((row.leaseToken ?? row.lease_token) !== leaseToken) return null;
  const schemaVersion = row.schemaVersion ?? row.schema_version;
  return {
    outboxId,
    identity: {
      eventId: outboxId,
      eventType: matching(row.eventType ?? row.event_type, EventTypePattern),
      schemaVersion:
        typeof schemaVersion === 'number' &&
        Number.isInteger(schemaVersion) &&
        schemaVersion >= 1 &&
        schemaVersion <= SCHEMA_VERSION_MAX
          ? schemaVersion
          : null,
      aggregateType: matching(
        row.aggregateType ?? row.aggregate_type,
        AggregateTypePattern,
      ),
      aggregateId: matching(
        row.aggregateId ?? row.aggregate_id,
        HexUuidPattern,
      ),
      aggregateVersion: toVersion(
        row.aggregateVersion ?? row.aggregate_version,
      ),
    },
  };
};
