import {
  failure,
  hasExactKeys,
  isHash,
  isInstant,
  isRecord,
  isSafeToken,
  isUuid,
  isVersion,
  schema,
  validateNullableUuid,
  withinJsonBudget,
  type RuntimeSchema,
} from './migration-worker-schema-core';
import {
  parseSchemaActivationEvidence,
  type SchemaActivationEvidence,
} from './migration-worker-activation-evidence';

export type SchemaMigrationQueueEnvelope = Readonly<{
  eventId: string;
  eventType: 'cms.schema.activated.v1';
  schemaVersion: 1;
  occurredAt: string;
  producer: string;
  correlationId: string;
  causationId: string | null;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: string;
  payload: Readonly<{
    contentTypeId: string;
    schemaVersionId: string;
    migrationPlanId: string | null;
    localeConfigHash: string;
    activationEvidence: SchemaActivationEvidence;
  }>;
}>;

export const SchemaMigrationQueueEnvelopeSchema: RuntimeSchema<SchemaMigrationQueueEnvelope> =
  schema<SchemaMigrationQueueEnvelope>((value) => {
    if (!isRecord(value)) return failure([], 'event must be an object');
    if (
      !hasExactKeys(value, [
        'eventId',
        'eventType',
        'schemaVersion',
        'occurredAt',
        'producer',
        'correlationId',
        'causationId',
        'aggregateType',
        'aggregateId',
        'aggregateVersion',
        'payload',
      ])
    )
      return failure([], 'event keys are not allowed');
    if (!withinJsonBudget(value))
      return failure([], 'event exceeds size limit');
    if (!isUuid(value.eventId))
      return failure(['eventId'], 'eventId is invalid');
    if (value.eventType !== 'cms.schema.activated.v1')
      return failure(['eventType'], 'eventType is invalid');
    if (value.schemaVersion !== 1)
      return failure(['schemaVersion'], 'schemaVersion is unsupported');
    if (!isInstant(value.occurredAt))
      return failure(['occurredAt'], 'occurredAt is invalid');
    if (!isSafeToken(value.producer))
      return failure(['producer'], 'producer is invalid');
    if (!isUuid(value.correlationId))
      return failure(['correlationId'], 'correlationId is invalid');
    if (!validateNullableUuid(value.causationId))
      return failure(['causationId'], 'causationId is invalid');
    if (!isSafeToken(value.aggregateType))
      return failure(['aggregateType'], 'aggregateType is invalid');
    if (!isUuid(value.aggregateId))
      return failure(['aggregateId'], 'aggregateId is invalid');
    if (!isVersion(value.aggregateVersion))
      return failure(['aggregateVersion'], 'aggregateVersion is invalid');
    if (!isRecord(value.payload))
      return failure(['payload'], 'payload is invalid');
    if (
      !hasExactKeys(value.payload, [
        'contentTypeId',
        'schemaVersionId',
        'migrationPlanId',
        'localeConfigHash',
        'activationEvidence',
      ])
    )
      return failure(['payload'], 'payload keys are not allowed');
    if (!isUuid(value.payload.contentTypeId))
      return failure(['payload', 'contentTypeId'], 'contentTypeId is invalid');
    if (!isUuid(value.payload.schemaVersionId))
      return failure(
        ['payload', 'schemaVersionId'],
        'schemaVersionId is invalid',
      );
    if (!validateNullableUuid(value.payload.migrationPlanId))
      return failure(
        ['payload', 'migrationPlanId'],
        'migrationPlanId is invalid',
      );
    if (!isHash(value.payload.localeConfigHash))
      return failure(
        ['payload', 'localeConfigHash'],
        'localeConfigHash is invalid',
      );
    const evidence = parseSchemaActivationEvidence(
      value.payload.activationEvidence,
    );
    if (!evidence.success) return evidence;
    return {
      success: true,
      data: {
        eventId: value.eventId,
        eventType: value.eventType,
        schemaVersion: 1,
        occurredAt: value.occurredAt,
        producer: value.producer,
        correlationId: value.correlationId,
        causationId: value.causationId,
        aggregateType: value.aggregateType,
        aggregateId: value.aggregateId,
        aggregateVersion: value.aggregateVersion,
        payload: {
          contentTypeId: value.payload.contentTypeId,
          schemaVersionId: value.payload.schemaVersionId,
          migrationPlanId: value.payload.migrationPlanId,
          localeConfigHash: value.payload.localeConfigHash,
          activationEvidence: evidence.data,
        },
      },
    };
  });
