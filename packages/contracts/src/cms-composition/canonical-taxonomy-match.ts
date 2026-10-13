import { z } from 'zod';

import { CmsUuidSchema } from '../content-schema-registry/primitives.ts';

/*
 * CMS-03C-18 `platform_private.cms_canonical_taxonomy_match` (D10, DEC-135). It
 * is database-internal: no browser route, proxy or client type exists for it,
 * so these schemas are exported for the Worker and SQL tests only.
 */

/** The closed canonical domains a vocabulary may declare it overlaps (DEC-135). */
export const CMS_CANONICAL_DOMAINS = [
  'role',
  'instrument',
  'gear',
  'place',
  'rights',
  'jurisdiction',
] as const;

export const CanonicalDomainSchema = z.enum(CMS_CANONICAL_DOMAINS);

/**
 * One domain and at most 64 candidates per call. Candidates are the term key,
 * label or alias strings; the provider normalizes (NFKC, lowercase, trim,
 * whitespace collapse) and compares by exact equality, never by fuzzy match.
 */
export const CanonicalTaxonomyMatchRequestSchema = z.strictObject({
  domain: CanonicalDomainSchema,
  candidates: z.array(z.string().min(1).max(160)).min(1).max(64),
});

/**
 * `source_unavailable` is the typed outcome of a domain whose provider is
 * `unbuilt`; a provider fault or timeout is a 503 for the calling command and
 * never a result.
 */
export const CanonicalTaxonomyMatchResultSchema = z.discriminatedUnion(
  'outcome',
  [
    z.strictObject({ outcome: z.literal('no_match') }),
    z.strictObject({
      outcome: z.literal('match'),
      domain: CanonicalDomainSchema,
      canonicalId: CmsUuidSchema,
      canonicalKind: z.string().regex(/^[a-z][a-z0-9._-]{0,95}$/u),
    }),
    z.strictObject({
      outcome: z.literal('source_unavailable'),
      domain: CanonicalDomainSchema,
    }),
  ],
);

export type CanonicalDomain = z.infer<typeof CanonicalDomainSchema>;
export type CanonicalTaxonomyMatchRequest = z.infer<
  typeof CanonicalTaxonomyMatchRequestSchema
>;
export type CanonicalTaxonomyMatchResult = z.infer<
  typeof CanonicalTaxonomyMatchResultSchema
>;
