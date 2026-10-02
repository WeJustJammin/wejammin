import { z } from 'zod';

import { ApiErrorSchema } from './api-error.ts';
import {
  InfrastructureRecordSchema,
  SafeFieldMapSchema,
} from './infrastructure-record.ts';
import { RequestIdSchema } from './identifiers.ts';
import { CapabilitySchema } from './request-context.ts';
import {
  QuotedVersionSchema,
  SafeReturnPathSchema,
} from './request-navigation-security.ts';

const EmptyStateSchema = z
  .object({
    status: z.literal('empty'),
    reason: z.enum(['no_records', 'filter_miss', 'non_disclosure']),
  })
  .strict()
  .readonly();

const LastKnownGoodSchema = z
  .object({
    record: InfrastructureRecordSchema,
    verifiedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .readonly();

export const InfrastructureViewStateSchema = z.discriminatedUnion('status', [
  z
    .object({ status: z.literal('idle') })
    .strict()
    .readonly(),
  z
    .object({
      status: z.literal('loading'),
      startedAt: z.iso.datetime({ offset: true }),
      preserveSafePriorContent: z.boolean(),
    })
    .strict()
    .readonly(),
  z
    .object({
      status: z.literal('validation_error'),
      httpStatus: z.union([z.literal(400), z.literal(422)]),
      error: ApiErrorSchema,
      retainedInput: SafeFieldMapSchema,
    })
    .strict()
    .readonly(),
  z
    .object({
      status: z.literal('unauthenticated'),
      returnTo: SafeReturnPathSchema,
    })
    .strict()
    .readonly(),
  z
    .object({
      status: z.literal('capability_gate'),
      recovery: z.literal('request_capability'),
      requiredCapability: CapabilitySchema,
    })
    .strict()
    .readonly(),
  // BE00/FE00 (DEC-111): a 401 STEP_UP_REQUIRED is a recovery that navigates
  // to /step-up?returnTo=<relative path>. It is never a 403 capability gate.
  z
    .object({
      status: z.literal('step_up_required'),
      returnTo: SafeReturnPathSchema,
      allowedMethods: z.array(z.string().min(1).max(64)).max(8).readonly(),
    })
    .strict()
    .readonly(),
  z
    .object({ status: z.literal('not_found') })
    .strict()
    .readonly(),
  z
    .object({
      status: z.literal('conflict'),
      currentVersion: QuotedVersionSchema,
      retainedInput: SafeFieldMapSchema,
    })
    .strict()
    .readonly(),
  z
    .object({
      status: z.literal('rate_wait'),
      retryAt: z.iso.datetime({ offset: true }),
      retainedInput: SafeFieldMapSchema,
    })
    .strict()
    .readonly(),
  z
    .object({
      status: z.literal('dependency_error'),
      httpStatus: z.union([z.literal(502), z.literal(503), z.literal(504)]),
      requestId: RequestIdSchema,
      safeRetryDelaysMs: z.tuple([z.literal(250), z.literal(750)]),
    })
    .strict()
    .readonly(),
  EmptyStateSchema,
  z
    .object({
      status: z.literal('success'),
      record: InfrastructureRecordSchema,
    })
    .strict()
    .readonly(),
  z
    .object({
      status: z.literal('optimistic_pending'),
      operationId: z.uuid(),
      canonicalPreimage: InfrastructureRecordSchema,
    })
    .strict()
    .readonly(),
  z
    .object({
      status: z.literal('optimistic_rollback'),
      operationId: z.uuid(),
      canonicalPreimage: InfrastructureRecordSchema,
      error: ApiErrorSchema,
    })
    .strict()
    .readonly(),
  z
    .object({
      status: z.literal('disabled'),
      prerequisite: z.string().min(1).max(160),
    })
    .strict()
    .readonly(),
  z
    .object({
      status: z.literal('degraded'),
      requestId: RequestIdSchema,
      scope: z.string().min(1).max(160),
      lastKnownGood: LastKnownGoodSchema.nullable(),
    })
    .strict()
    .readonly(),
]);

export type InfrastructureViewState = z.infer<
  typeof InfrastructureViewStateSchema
>;
