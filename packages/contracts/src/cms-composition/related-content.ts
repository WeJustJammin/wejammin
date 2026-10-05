import { z } from 'zod';

import {
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { resourceMetaShape } from '../content-schema-registry/resources-meta.ts';
import {
  IdempotencyKeySchema,
  QuotedVersionSchema,
} from '../request-navigation-security.ts';

const RuleKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_-]{1,63}$/u, 'rule_key_invalid');
const PinsSchema = z
  .array(CmsUuidSchema)
  .max(32)
  .refine(
    (ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length,
    'pin_duplicate',
  );
const ExclusionsSchema = z
  .array(CmsUuidSchema)
  .max(64)
  .refine(
    (ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length,
    'exclusion_duplicate',
  );

export const RelatedContentPathSchema = z.strictObject({
  entryId: CmsUuidSchema,
});

/** CMS-03C-05 accepts only bounded explicit targets and named rule versions. */
export const RelatedContentRuleRequestSchema = z
  .strictObject({
    entryId: CmsUuidSchema,
    pins: PinsSchema,
    exclusions: ExclusionsSchema,
    derivedRule: z
      .strictObject({
        key: RuleKeySchema,
        version: CmsVersionSchema,
        reasonCode: z
          .string()
          .regex(/^[a-z][a-z0-9._-]{0,63}$/u, 'reason_code_invalid'),
        maxCandidates: z.number().int().min(1).max(128),
      })
      .nullable(),
    expectedVersion: CmsVersionSchema,
  })
  .superRefine((value, context) => {
    const exclusions = new Set(value.exclusions.map((id) => id.toLowerCase()));
    if (value.pins.some((id) => exclusions.has(id.toLowerCase())))
      context.addIssue({
        code: 'custom',
        path: ['exclusions'],
        message: 'pin_exclusion_overlap',
      });
  });

export const RelatedContentHeadersSchema = z.strictObject({
  contentType: z.literal('application/json'),
  idempotencyKey: IdempotencyKeySchema,
  ifMatch: QuotedVersionSchema,
});

/** OpenAPI transport shape for the canonical CMS-03C-05 operation. */
export const RelatedContentApiRequestSchema = z.strictObject({
  entryId: CmsUuidSchema,
  headers: RelatedContentHeadersSchema,
  body: RelatedContentRuleRequestSchema,
});

/** A target remains subject to authorized public projection at read time. */
export const RelatedContentResourceSchema = z.strictObject({
  ...resourceMetaShape,
  state: z.enum(['active', 'revoked']),
  sourceEntryId: CmsUuidSchema,
  pins: PinsSchema,
  exclusions: ExclusionsSchema,
  derivedRule: z
    .strictObject({
      key: RuleKeySchema,
      version: CmsVersionSchema,
    })
    .nullable(),
  eligibleCount: z.number().int().nonnegative().max(128),
});

export type RelatedContentPath = z.infer<typeof RelatedContentPathSchema>;
export type RelatedContentRuleRequest = z.infer<
  typeof RelatedContentRuleRequestSchema
>;
export type RelatedContentHeaders = z.infer<typeof RelatedContentHeadersSchema>;
export type RelatedContentResource = z.infer<
  typeof RelatedContentResourceSchema
>;
