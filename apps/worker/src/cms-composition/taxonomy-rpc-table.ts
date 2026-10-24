export type TaxonomyOperation =
  | 'CMS-03C-03'
  | 'CMS-03C-16'
  | 'CMS-03C-17'
  | 'cmsTaxonomyVersionsRead'
  | 'cmsTaxonomyTermsRead';

/**
 * The named `platform_api` RPC of every taxonomy operation the Worker transports, with its transport class and ceiling
 * (BE03c 161, 166-167, 179, 1447; registry deadlines: commands 15,000 ms Tier 2, reads 8,000 ms Tier 1). A write
 * carries the idempotency key and the strong If-Match as headers; a read carries neither.
 */
export type TaxonomyRpcSpec = Readonly<{
  rpc: string;
  write: boolean;
  deadlineMs: 8_000 | 15_000;
}>;

export const TAXONOMY_RPC: Readonly<
  Record<TaxonomyOperation, TaxonomyRpcSpec>
> = {
  'CMS-03C-03': {
    rpc: 'cms_act_taxonomy_term',
    write: true,
    deadlineMs: 15_000,
  },
  'CMS-03C-16': {
    rpc: 'cms_create_taxonomy_version',
    write: true,
    deadlineMs: 15_000,
  },
  'CMS-03C-17': {
    rpc: 'cms_list_taxonomy_selector',
    write: false,
    deadlineMs: 8_000,
  },
  cmsTaxonomyVersionsRead: {
    rpc: 'cms_list_taxonomy_versions',
    write: false,
    deadlineMs: 8_000,
  },
  cmsTaxonomyTermsRead: {
    rpc: 'cms_list_taxonomy_terms',
    write: false,
    deadlineMs: 8_000,
  },
};

/**
 * Registry rate rows (`platform-registries.ts`; pinned by `taxonomy-registry.test.ts`): the class and the per-minute
 * user and party ceilings of every rate-limited taxonomy operation the definition module serves.
 */
export type TaxonomyRateOperation = Exclude<TaxonomyOperation, 'CMS-03C-03'>;
export type TaxonomyRateRow = Readonly<{
  rateClass:
    | 'cms-taxonomy-version-write'
    | 'cms-taxonomy-read'
    | 'cms-taxonomy-terms-read'
    | 'cms-taxonomy-selector-read';
  user: number;
  party: number;
}>;
export const TAXONOMY_RATES: Readonly<
  Record<TaxonomyRateOperation, TaxonomyRateRow>
> = {
  'CMS-03C-16': {
    rateClass: 'cms-taxonomy-version-write',
    user: 30,
    party: 60,
  },
  'CMS-03C-17': {
    rateClass: 'cms-taxonomy-selector-read',
    user: 300,
    party: 600,
  },
  cmsTaxonomyVersionsRead: {
    rateClass: 'cms-taxonomy-read',
    user: 60,
    party: 60,
  },
  cmsTaxonomyTermsRead: {
    rateClass: 'cms-taxonomy-terms-read',
    user: 120,
    party: 240,
  },
};
