import { z } from 'zod';

import { CmsPublicationAudienceSchema } from '../cms-editorial/publication-schedule-contracts.ts';
import {
  CmsLocaleSchema,
  CmsUuidSchema,
} from '../content-schema-registry/primitives.ts';

/*
 * CMS-03C-21 `platform_private.cms_related_content_public_targets(source,
 * locale, audience)` (D11, OD-5): the ordered, bounded public projection of a
 * related-content rule. It is read-only, recomputed at every projection,
 * preview and publication, never stored, and has no browser route. Eligible
 * pins come first in `position` order, then derived candidates in rank order,
 * with exclusions always removed.
 */

export const CMS_RELATED_MAX_TARGETS = 128;

/**
 * The code-owned derived-rule registry `CMS_RELATED_RULES` (OD-5). A rule row
 * selects exactly one member; `derivedRule.reasonCode` is an equality
 * expectation of the registry value. An unknown key or version is the server's
 * 422 `derived_rule_unknown`; the request schema checks only the grammar so
 * that refusal keeps its token.
 */
export const CMS_RELATED_RULES = {
  'shared-terms': { version: '1', reasonCode: 'shared_terms' },
  'same-type-recent': { version: '1', reasonCode: 'same_type_recent' },
} as const;

export type CmsRelatedRuleKey = keyof typeof CMS_RELATED_RULES;

/** The registry member for `key` at exactly `version`, or null when either is unknown. */
export const findRelatedRule = (
  key: string,
  version: string,
): { key: CmsRelatedRuleKey; version: string; reasonCode: string } | null => {
  if (!Object.hasOwn(CMS_RELATED_RULES, key)) return null;
  const member = CMS_RELATED_RULES[key as CmsRelatedRuleKey];
  return member.version === version
    ? { key: key as CmsRelatedRuleKey, ...member }
    : null;
};

export const RelatedPublicTargetsRequestSchema = z.strictObject({
  sourceEntryId: CmsUuidSchema,
  locale: CmsLocaleSchema,
  audience: CmsPublicationAudienceSchema,
});

export const RelatedPublicTargetSchema = z.strictObject({
  entryId: CmsUuidSchema,
  source: z.enum(['pin', 'derived']),
  reasonCode: z
    .string()
    .regex(/^[a-z][a-z0-9._-]{0,63}$/u)
    .nullable(),
  position: z
    .number()
    .int()
    .min(0)
    .max(CMS_RELATED_MAX_TARGETS - 1),
});

/** At most 128 targets: pins first in position order, then derived in rank order, each entry once. */
export const RelatedPublicTargetsSchema = z
  .array(RelatedPublicTargetSchema)
  .max(CMS_RELATED_MAX_TARGETS)
  .superRefine((targets, context) => {
    const seen = new Set<string>();
    targets.forEach((target, index) => {
      const id = target.entryId.toLowerCase();
      if (seen.has(id))
        context.addIssue({
          code: 'custom',
          path: [index, 'entryId'],
          message: 'a target is listed once',
        });
      seen.add(id);
      const previous = targets[index - 1];
      if (previous === undefined) return;
      if (previous.source === 'derived' && target.source === 'pin')
        context.addIssue({
          code: 'custom',
          path: [index],
          message: 'eligible pins come before derived candidates',
        });
      else if (
        previous.source === target.source &&
        target.position <= previous.position
      )
        context.addIssue({
          code: 'custom',
          path: [index, 'position'],
          message: 'targets follow position order within their source',
        });
    });
  });

export type RelatedPublicTarget = z.infer<typeof RelatedPublicTargetSchema>;
export type RelatedPublicTargets = z.infer<typeof RelatedPublicTargetsSchema>;
