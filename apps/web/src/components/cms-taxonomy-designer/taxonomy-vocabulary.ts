/**
 * The closed vocabularies of the vocabulary pages, written out so the browser reads a
 * request, a lifecycle or a refusal without loading zod (FE03 AC261).
 * `taxonomy-vocabulary.test.ts` proves each table equals the generated contract. The copy
 * is fixed in the components and never taken from a response.
 */
export {
  TAXONOMY_KEY_REGEX,
  TAXONOMY_SHAPES,
  type TaxonomyShape,
} from './taxonomy-vocabulary-core';

/** The closed canonical overlap domains a vocabulary may declare (DEC-135). */
export const CANONICAL_DOMAINS = [
  'role',
  'instrument',
  'gear',
  'place',
  'rights',
  'jurisdiction',
] as const;
export type CanonicalDomain = (typeof CANONICAL_DOMAINS)[number];

export const isCanonicalDomain = (value: unknown): value is CanonicalDomain =>
  typeof value === 'string' &&
  (CANONICAL_DOMAINS as readonly string[]).includes(value);

export const CANONICAL_DOMAIN_LABEL: Readonly<Record<CanonicalDomain, string>> =
  {
    role: 'Role',
    instrument: 'Instrument',
    gear: 'Gear',
    place: 'Place',
    rights: 'Rights',
    jurisdiction: 'Jurisdiction',
  };

/**
 * Whether the owning shard has registered a canonical provider for the domain (BE03c 1373:
 * in Phase 2 only `role` is built). No read serves this fact, so it is a code-owned mirror
 * of the release seed; `taxonomy-vocabulary.test.ts` fails when a newer registry row
 * exists. The server stays the authority: submission, activation and term actions refuse a
 * declared unbuilt domain with `canonical_source_unavailable`.
 */
export const CANONICAL_DOMAIN_PROVIDER_BUILT: Readonly<
  Record<CanonicalDomain, boolean>
> = {
  role: true,
  instrument: false,
  gear: false,
  place: false,
  rights: false,
  jurisdiction: false,
};

/** The definition lifecycle (`CMS_DEFINITION_VERSION_STATES`; the test is the drift guard). */
export const TAXONOMY_DEFINITION_STATES = [
  'draft',
  'review',
  'approved',
  'scheduled',
  'active',
  'superseded',
  'retired',
  'blocked',
] as const;
export type TaxonomyDefinitionState =
  (typeof TAXONOMY_DEFINITION_STATES)[number];

export const isDefinitionState = (
  value: unknown,
): value is TaxonomyDefinitionState =>
  typeof value === 'string' &&
  (TAXONOMY_DEFINITION_STATES as readonly string[]).includes(value);

/** BE03c catalog `cms.03c.taxonomy.v1`: the one application code of each status. */
export const TAXONOMY_CATALOG_CODES: Readonly<Record<number, string>> = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'TAXONOMY_FORBIDDEN',
  404: 'TAXONOMY_NOT_FOUND',
  409: 'TAXONOMY_VERSION_CONFLICT',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'TAXONOMY_VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'DEPENDENCY_UNAVAILABLE',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'DEPENDENCY_UNAVAILABLE',
};

/** The typed reasons of CMS-03C-16 and CMS-03C-03 (BE03c "Slice 12 typed refusals") and their one status. */
export type TaxonomyReason =
  | 'capability_missing'
  | 'taxonomy_not_active'
  | 'canonical_overlap'
  | 'canonical_source_unavailable';

export const TAXONOMY_REASON_STATUS: Readonly<
  Record<TaxonomyReason, 403 | 409 | 422>
> = {
  capability_missing: 403,
  taxonomy_not_active: 409,
  canonical_overlap: 422,
  canonical_source_unavailable: 422,
};

const OPERATION_REASONS: Readonly<
  Record<'CMS-03C-16' | 'CMS-03C-03', readonly TaxonomyReason[]>
> = {
  'CMS-03C-16': ['capability_missing'],
  'CMS-03C-03': [
    'capability_missing',
    'taxonomy_not_active',
    'canonical_overlap',
    'canonical_source_unavailable',
  ],
};

/** The token if `value` is a token of `operation` that belongs to `status`, else null. */
export const taxonomyReason = (
  operation: 'CMS-03C-16' | 'CMS-03C-03',
  value: unknown,
  status: number,
): TaxonomyReason | null =>
  typeof value === 'string' &&
  Object.hasOwn(TAXONOMY_REASON_STATUS, value) &&
  OPERATION_REASONS[operation].includes(value as TaxonomyReason) &&
  TAXONOMY_REASON_STATUS[value as TaxonomyReason] === status
    ? (value as TaxonomyReason)
    : null;
