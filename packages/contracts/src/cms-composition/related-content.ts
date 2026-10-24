import { z } from 'zod';

import { refineIfMatchEqualsExpectedVersion } from '../cms-editorial/if-match.ts';
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

/**
 * OpenAPI transport shape for the canonical CMS-03C-05 operation. The strong
 * `If-Match` is the source entry `version`, the body `expectedVersion`.
 */
export const RelatedContentApiRequestSchema = z
  .strictObject({
    entryId: CmsUuidSchema,
    headers: RelatedContentHeadersSchema,
    body: RelatedContentRuleRequestSchema,
  })
  .superRefine(refineIfMatchEqualsExpectedVersion);

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

/**
 * `cmsRelatedContentRead` addressing (DEC-195, BE03c "Route field validation"):
 * the source entry by path only. Strict: no query key, header-derived or body
 * member, so every caller context stays server-side.
 */
export const RelatedContentReadApiRequestSchema = z.strictObject({
  entryId: CmsUuidSchema,
});

/**
 * `cmsRelatedContentRead` answer (DEC-195): the source entry's current active
 * rule exactly as CMS-03C-05 returns it, with pins and exclusions as stored
 * (never target projections), or `null` when no rule is active.
 */
export const RelatedContentRuleReadSchema = z.strictObject({
  rule: RelatedContentResourceSchema.nullable(),
});

export type RelatedContentReadApiRequest = z.infer<
  typeof RelatedContentReadApiRequestSchema
>;
export type RelatedContentRuleRead = z.infer<
  typeof RelatedContentRuleReadSchema
>;

/**
 * DEC-195: whether a parsed `cmsRelatedContentRead` answer is the rule of THIS entry. `null` always is. A rule must be
 * `active` (a revoked set reads as `null`), name the entry as its source, and hold no pin that
 * is also an exclusion (CMS-03C-05 refuses `pin_exclusion_overlap`, so no stored rule can). Ids compare case-insensitively.
 * The Worker, the first-party proxy and the page loader all verify an answer through this one rule.
 */
export const relatedRuleReadAnswersEntry = (
  read: RelatedContentRuleRead,
  entryId: string,
): boolean => {
  const rule = read.rule;
  if (rule === null) return true;
  const entry = entryId.toLowerCase();
  const excluded = new Set(rule.exclusions.map((id) => id.toLowerCase()));
  return (
    rule.state === 'active' &&
    rule.sourceEntryId.toLowerCase() === entry &&
    !rule.pins.some((id) => excluded.has(id.toLowerCase()))
  );
};
