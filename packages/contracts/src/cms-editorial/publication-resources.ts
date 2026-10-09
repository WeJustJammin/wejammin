import { z } from 'zod';

import {
  CmsHashSchema,
  CmsInstantSchema,
  CmsUuidSchema,
} from '../content-schema-registry/primitives.ts';
import { entryRevisionResourceMetaShape } from './models.ts';
import { Bcp47Schema } from './primitives.ts';
import { VersionSetSchema } from './publication-contracts.ts';
import {
  CmsPreviewRouteSchema,
  CmsPublicationAudienceSchema,
  CmsScheduleLocalDateTimeSchema,
  CmsScheduleTimezoneSchema,
} from './publication-schedule-contracts.ts';
import {
  PublicationActionSchema,
  PublicationProjectionStateSchema,
  PublicationScheduleStateSchema,
  PublicationStateSchema,
  ScheduleDisambiguationSchema,
  ScheduleReasonCodeSchema,
} from './workflow-models.ts';

/*
 * BE03b schedule, preview and publication browser resources (CMS-03B-07,
 * CMS-03B-08, CMS-03B-09). `ResourceMeta` carries only id, version and
 * timestamps; ownership and the publisher stay server-side.
 */

/** BE03b tz release tag (`CMS_TZDB_VERSION` grammar, Time authority E8). */
export const CmsTzdbVersionSchema = z.string().regex(/^[A-Za-z0-9._-]{1,32}$/u);

/**
 * BE03b `PublicationScheduleResource`: the CMS-03B-07 202 body. `202` means
 * scheduled, never published. `actualUtc` and `deviationSeconds` are recorded
 * together when the executor completes the schedule; `reasonCode` is present
 * exactly for a `blocked` or `cancelled` schedule.
 */
export const PublicationScheduleResourceSchema = z
  .strictObject({
    ...entryRevisionResourceMetaShape,
    state: PublicationScheduleStateSchema,
    entryId: CmsUuidSchema,
    revisionId: CmsUuidSchema,
    action: PublicationActionSchema,
    localDateTime: CmsScheduleLocalDateTimeSchema,
    timezone: CmsScheduleTimezoneSchema,
    resolvedUtc: CmsInstantSchema,
    tzdbVersion: CmsTzdbVersionSchema,
    disambiguation: ScheduleDisambiguationSchema,
    /** E9: the target lineage is (entry of the revision, revision locale, audience). */
    audience: CmsPublicationAudienceSchema,
    jobId: CmsUuidSchema.nullable(),
    actualUtc: CmsInstantSchema.nullable(),
    deviationSeconds: z.number().int().nullable(),
    reasonCode: ScheduleReasonCodeSchema.nullable(),
    attemptCount: z.number().int().min(0).max(3),
  })
  .superRefine((value, context) => {
    const reasonExpected =
      value.state === 'blocked' || value.state === 'cancelled';
    if (reasonExpected !== (value.reasonCode !== null))
      context.addIssue({
        code: 'custom',
        path: ['reasonCode'],
        message:
          'reasonCode exists exactly when the schedule is blocked or cancelled',
      });
    const completed = value.state === 'completed';
    if (completed !== (value.actualUtc !== null))
      context.addIssue({
        code: 'custom',
        path: ['actualUtc'],
        message: 'actualUtc exists exactly when the schedule is completed',
      });
    if (completed !== (value.deviationSeconds !== null))
      context.addIssue({
        code: 'custom',
        path: ['deviationSeconds'],
        message:
          'deviationSeconds exists exactly when the schedule is completed',
      });
  })
  .readonly();

/**
 * BE03b preview token: a derived HMAC-SHA-256 rendered as 43 unpadded
 * base64url characters (`Preview token and verification`). The plaintext
 * appears once, in the 201 body or an exact replay; it is never persisted.
 */
export const CmsPreviewTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/u, 'preview_token_invalid');

/** BE03b `PreviewTokenResource`: the CMS-03B-08 201 body, exact binding included. */
export const PreviewTokenResourceSchema = z
  .strictObject({
    token: CmsPreviewTokenSchema,
    expiresAt: CmsInstantSchema,
    entryId: CmsUuidSchema,
    revisionId: CmsUuidSchema,
    locale: Bcp47Schema,
    audience: CmsPublicationAudienceSchema,
    route: CmsPreviewRouteSchema,
    versionSet: VersionSetSchema,
    revoked: z.boolean(),
  })
  .readonly();

/**
 * BE03b `PublicationResource` (E3): `id` is the stable lineage id of
 * (entry, locale, audience), `version` the lineage sequence of the returned row
 * and `publicationVersionId` that row's own id (the event payload id). A
 * `publish` row is `active` (the head) or derived `superseded`; every other
 * action is a `revoked` tombstone. `202`/`pending` is not public visibility.
 */
export const PublicationResourceSchema = z
  .strictObject({
    ...entryRevisionResourceMetaShape,
    state: PublicationStateSchema,
    action: PublicationActionSchema,
    publicationVersionId: CmsUuidSchema,
    entryId: CmsUuidSchema,
    revisionId: CmsUuidSchema,
    locale: Bcp47Schema,
    audience: CmsPublicationAudienceSchema,
    publicationHash: CmsHashSchema,
    projectionState: PublicationProjectionStateSchema,
    eventType: z.literal('cms.publication.changed.v1'),
  })
  .superRefine((value, context) => {
    if ((value.action === 'publish') !== (value.state !== 'revoked'))
      context.addIssue({
        code: 'custom',
        path: ['state'],
        message:
          'a publish row is active or superseded and every other action is a revoked tombstone',
      });
  })
  .readonly();

export type PublicationScheduleResource = z.infer<
  typeof PublicationScheduleResourceSchema
>;
export type PreviewTokenResource = z.infer<typeof PreviewTokenResourceSchema>;
export type PublicationResource = z.infer<typeof PublicationResourceSchema>;
