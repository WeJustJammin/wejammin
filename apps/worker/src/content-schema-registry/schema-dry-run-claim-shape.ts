import { CmsVersionSchema, QueueEnvelopeSchema } from '@wejammin/contracts';
import { z } from 'zod';

import { MigrationPlanRecordSchema } from './migration-worker-plan-record-schema';
import { isRecord } from './migration-worker-schema-core';

/** Check the original object's own complete shape before any parser projects it. */
export const requireClaimOwnKeys = (keys: readonly string[]) =>
  z
    .unknown()
    .refine(
      (value) =>
        isRecord(value) &&
        Reflect.ownKeys(value).length === keys.length &&
        keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)),
      { message: 'Claim object keys are invalid', abort: true },
    );

export const ClaimRequestedEventSchema = requireClaimOwnKeys([
  'eventId',
  'eventType',
  'schemaVersion',
  'aggregateType',
  'aggregateId',
  'aggregateVersion',
  'correlationId',
  'causationId',
])
  .refine(
    (value) =>
      isRecord(value) &&
      CmsVersionSchema.safeParse(value.aggregateVersion).success,
    {
      message: 'Claim event aggregate version is invalid',
      path: ['aggregateVersion'],
      abort: true,
    },
  )
  .pipe(QueueEnvelopeSchema)
  .refine(
    (event) =>
      event.eventType === 'job.requested' &&
      event.schemaVersion === 1 &&
      event.aggregateType === 'job',
    'Claim event must be the original job.requested envelope',
  );

// Keep the existing 23-key plan parser and its validated output authoritative.
export const ClaimMigrationPlanSchema = requireClaimOwnKeys([
  'id',
  'contentTypeId',
  'fromVersionId',
  'toVersionId',
  'state',
  'version',
  'cursor',
  'progress',
  'sourceCount',
  'targetCount',
  'rowErrorCount',
  'migratedCount',
  'failedCount',
  'classification',
  'transformKey',
  'transformVersion',
  'compilerHash',
  'sourceHash',
  'targetHash',
  'activeVersionId',
  'leaseOwner',
  'leaseToken',
  'leaseExpiresAt',
])
  .transform((value, context) => {
    const parsed = MigrationPlanRecordSchema.safeParse(value);
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        context.addIssue({
          code: 'custom',
          path: [...issue.path],
          message: issue.message,
        });
      return z.NEVER;
    }
    return parsed.data;
  })
  .transform((value) => Object.freeze(value));
