import type {
  CitationReconciliationBinding,
  CitationReconciliationRecord,
} from './phase-02-slice-12-unit-citation-reconciliation-types';

// Slice 12 unit-citation identity reconciliation, moved records only.
//
// Each of these eight ledger citations names a test that still exists with the
// same full title but now runs from a different file. old.file is the file the
// ledger cites; fresh.file is the file the current unit report runs it from.
// Bindings keep the original criterion and clause text in baseline order.
//
// This file type-imports the record types from the independent type-only module,
// so the moved module no longer imports the primary fixture and there is no cycle.

type BindingTuple = readonly [criterion: string, clauseText: string];

const toBindings = (
  tuples: readonly BindingTuple[],
): readonly CitationReconciliationBinding[] =>
  tuples.map(([criterion, clauseText]) => ({ criterion, clauseText }));

const F_LOCALE = 'apps/worker/src/cms-composition/locale-routes.test.ts';
const F_LOCALE_REFUSALS =
  'apps/worker/src/cms-composition/locale-routes-refusals.test.ts';
const F_LOCALE_BINDING =
  'apps/worker/src/cms-composition/locale-routes-binding-and-order.test.ts';

const T_ACTIVE_CHAIN =
  'CMS-03C-04 locale authoring route returns the active chain on a fallback-chain mismatch and nothing else';
const T_BODY_CEILING =
  'BE00 step 2 body ceiling on the CMS locale route refuses a streamed body over the ceiling that declared no length';
const T_NO_SUCCESS =
  'CMS-03C-04 locale authoring route does not accept success for another state, entry, locale, source or fallback';
const T_RATE_BUCKETS =
  'CMS-03C-04 locale authoring route checks both rate buckets, validates decisions, and returns Retry-After';
const T_FENCED_PORTS =
  'CMS-03C-04 locale authoring route fences rejected ports, thrown ports, and a deadline without provider prose';
const T_BE00_429 =
  'CMS-03C-04 locale authoring route publishes the BE00 429 contract with second-granularity reset and matching headers';
const T_SCRUBBED_500 =
  'CMS-03C-04 locale authoring route normalizes unexpected execution exceptions to a scrubbed 500';
const T_PROVIDER_SCRUB =
  'CMS-03C-04 locale authoring route scrubs all provider status codes and unsafe details';

const CLAUSE_FALLBACK_CHAIN_MISMATCH =
  "`fallbackChain` ≤16 tags that equal the active version's chain for `locale` as an equality expectation (any difference 409 `FALLBACK_CHAIN_MISMATCH`)";
const CLAUSE_LOCALE_VERSION_CONFLICT =
  'a stale source hash or entry version or a duplicate locale (409 `LOCALE_VERSION_CONFLICT`)';
const CLAUSE_RAW_BODY_CEILING = 'raw body ≤256 KiB';
const CLAUSE_STRICT_LOCALE_VARIANT =
  'and returns the strict `LocaleVariantResource`';
const CLAUSE_RATE_BUCKETS = 'rate buckets of 60/min/user and 120/min/party';
const CLAUSE_LOCALE_LIMIT_429 = 'the locale limit (429)';
const CLAUSE_DEADLINE_15000 = 'a 15,000 ms deadline';
const CLAUSE_INTERNAL_FAILURE_500 = 'and an internal failure (500)';
const CLAUSE_TYPED_API_ERROR_LOCALE =
  'to typed ApiError of catalog `cms.03c.locale.v1`';

const moved = (
  freshFile: string,
  title: string,
  bindings: readonly CitationReconciliationBinding[],
): CitationReconciliationRecord => ({
  old: { tool: 'vitest', file: F_LOCALE, title },
  fresh: { tool: 'vitest', file: freshFile, title },
  kind: 'moved',
  bindings,
});

export const S12_MOVED_CITATION_RECONCILIATION: readonly CitationReconciliationRecord[] =
  [
    moved(
      F_LOCALE_REFUSALS,
      T_ACTIVE_CHAIN,
      toBindings([
        ['P2-S12-AC-034', CLAUSE_FALLBACK_CHAIN_MISMATCH],
        ['P2-S12-AC-057', CLAUSE_LOCALE_VERSION_CONFLICT],
      ]),
    ),
    moved(
      F_LOCALE_BINDING,
      T_BODY_CEILING,
      toBindings([['P2-S12-AC-039', CLAUSE_RAW_BODY_CEILING]]),
    ),
    moved(
      F_LOCALE_BINDING,
      T_NO_SUCCESS,
      toBindings([['P2-S12-AC-054', CLAUSE_STRICT_LOCALE_VARIANT]]),
    ),
    moved(
      F_LOCALE_REFUSALS,
      T_RATE_BUCKETS,
      toBindings([
        ['P2-S12-AC-056', CLAUSE_RATE_BUCKETS],
        ['P2-S12-AC-057', CLAUSE_LOCALE_LIMIT_429],
      ]),
    ),
    moved(
      F_LOCALE_BINDING,
      T_FENCED_PORTS,
      toBindings([['P2-S12-AC-056', CLAUSE_DEADLINE_15000]]),
    ),
    moved(
      F_LOCALE_BINDING,
      T_BE00_429,
      toBindings([['P2-S12-AC-057', CLAUSE_LOCALE_LIMIT_429]]),
    ),
    moved(
      F_LOCALE_BINDING,
      T_SCRUBBED_500,
      toBindings([['P2-S12-AC-057', CLAUSE_INTERNAL_FAILURE_500]]),
    ),
    moved(
      F_LOCALE_REFUSALS,
      T_PROVIDER_SCRUB,
      toBindings([['P2-S12-AC-057', CLAUSE_TYPED_API_ERROR_LOCALE]]),
    ),
  ];
