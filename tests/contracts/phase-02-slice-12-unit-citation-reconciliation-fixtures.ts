import { S12_MOVED_CITATION_RECONCILIATION } from './phase-02-slice-12-unit-citation-reconciliation-moved';
import type {
  CitationReconciliationBinding,
  CitationReconciliationRecord,
} from './phase-02-slice-12-unit-citation-reconciliation-types';

export type {
  CitationReconciliationBinding,
  CitationReconciliationKind,
  CitationReconciliationRecord,
} from './phase-02-slice-12-unit-citation-reconciliation-types';

// Slice 12 unit-citation identity reconciliation fixture - bookkeeping only.
//
// Each record is one ledger citation whose tool+file+title no longer matches an
// exact report file/fullName pair. Generated once from the frozen baseline ledger
// and the current extended unit report. The aggregate keeps baseline order: the
// two retired records, the eight moved records, then the sixteen quoted records.
//
//   old      the stale identity the ledger cites (tool, file, title)
//   fresh    the current report identity, or null when retired
//   kind     moved   - the ledger cites a file the test no longer runs from; the
//                      same full title runs from the current file in fresh
//            quoted  - the test still runs from the same file, but its current
//                      title wraps an it.each parameter in single quotes, so
//                      fresh.title differs from old.title only by those quotes
//            retired - the cited test is a removed historical test with no current
//                      equivalent, so the citation is dropped
//   bindings every original {criterion, clauseText} that cited old, in baseline
//            order
//
// JSON.stringify(S12_UNIT_CITATION_RECONCILIATION) is pinned by
// phase-02-slice-12-unit-citation-reconciliation.test.ts to sha256
// f636d08c649ae75dc883549e1f5a3cb8bb7e05e12bd8881dfa12c6140313ad11
// (26 records / 39 binding occurrences).
//
// Citation bookkeeping only: it proves no acceptance, clause coverage, evidence
// depth, receipt validity or runtime behaviour, and is not a proof-by-source-token.
// The ledger stays the source of truth at
// tests/contracts/phase-02-slice-12-evidence-ledger.ts.

type BindingTuple = readonly [criterion: string, clauseText: string];

const toBindings = (
  tuples: readonly BindingTuple[],
): readonly CitationReconciliationBinding[] =>
  tuples.map(([criterion, clauseText]) => ({ criterion, clauseText }));

const F_PATTERN = 'apps/worker/src/cms-composition-production-pattern.test.ts';
const F_TAXONOMY =
  'apps/worker/src/cms-composition-production-taxonomy.test.ts';
const F_CONTEXT =
  'apps/worker/src/cms-composition/template-context-routes.test.ts';
const F_DETAIL =
  'apps/worker/src/cms-composition/template-detail-routes.test.ts';

const PREFIX_CONTEXT_REJECTS =
  'CMS-11 protected template context read rejects ';
const PREFIX_CONTEXT_FAILS_CLOSED =
  'CMS-11 protected template context read fails closed for ';
const PREFIX_DETAIL_REJECTS =
  'CMS-11 protected current-template detail HTTP route rejects ';
const PREFIX_DETAIL_FAILS_CLOSED =
  'CMS-11 protected current-template detail HTTP route fails closed when ';

const SUFFIX_BEFORE_AUTH = ' before authorization or the RPC';
const SUFFIX_ON_A_READ_BEFORE_AUTH =
  ' on a read before authorization or the RPC';
const SUFFIX_SESSION = ' session';
const SUFFIX_CONTEXT_PROVIDER = ' context provider';
const SUFFIX_DETAIL_READ = ' on a detail read before authorization or the RPC';
const SUFFIX_NONE = '';

const CLAUSE_EMPTY_REQUEST_ONLY =
  'cmsTemplateContextRead accepts an empty request only';
const CLAUSE_NO_OWNER_SELECTOR = 'no owner selector';
const CLAUSE_INVALID_QUERY_400 = 'an invalid query is 400.';
const CLAUSE_DENIED_READ_MATRIX =
  'cmsTemplateContextRead answers a denied read as 403, an invalid query as 400, a malformed provider projection as 502 and a dependency or deadline failure as 503 or 504 with a typed ApiError';
const CLAUSE_NO_REQUEST_BODY = 'no request body';
const CLAUSE_NO_IDEMPOTENCY_NO_IF_MATCH = 'no `Idempotency-Key`, no `If-Match`';
const CLAUSE_READ_ONLY_CALL =
  'read-only call that accepts neither `Idempotency-Key` nor `If-Match`';
const CLAUSE_SERVES_ONLY_AUTHENTICATED =
  'cmsTemplateContextRead serves only an authenticated human with confirmed acting-party membership and an active `cms.template_designer` grant';
const CLAUSE_REJECTS_BODY_IDEMPOTENCY_IF_MATCH =
  'rejects a body, `Idempotency-Key` and `If-Match`';
const CLAUSE_MALFORMED_PATH_400 =
  'cmsTemplateLatestRead maps a malformed path (400 `INVALID_REQUEST`)';
const CLAUSE_UNSUPPORTED_BODY_415 = 'an unsupported body (415)';
const CLAUSE_MISSING_SESSION_401 = 'a missing session (401)';
const CLAUSE_DEPENDENCY = 'dependency';

const RETIRED_PATTERN_TITLE =
  'CMS-03C-02 production pattern adapter treats a missing private RPC as unavailable rather than a hidden composition';
const RETIRED_TAXONOMY_TITLE =
  'CMS-03C-03 production taxonomy boundary admits a valid curator but refuses mutation while canonical source and RPC are absent';

const retired = (
  file: string,
  title: string,
  bindings: readonly CitationReconciliationBinding[],
): CitationReconciliationRecord => ({
  old: { tool: 'vitest', file, title },
  fresh: null,
  kind: 'retired',
  bindings,
});

const quoted = (
  file: string,
  prefix: string,
  parameter: string,
  suffix: string,
  bindings: readonly CitationReconciliationBinding[],
): CitationReconciliationRecord => ({
  old: { tool: 'vitest', file, title: prefix + parameter + suffix },
  fresh: {
    tool: 'vitest',
    file,
    title: prefix + "'" + parameter + "'" + suffix,
  },
  kind: 'quoted',
  bindings,
});

const RETIRED: readonly CitationReconciliationRecord[] = [
  retired(
    F_PATTERN,
    RETIRED_PATTERN_TITLE,
    toBindings([['P2-S12-AC-014', CLAUSE_DEPENDENCY]]),
  ),
  retired(
    F_TAXONOMY,
    RETIRED_TAXONOMY_TITLE,
    toBindings([['P2-S12-AC-020', CLAUSE_DEPENDENCY]]),
  ),
];

const QUOTED: readonly CitationReconciliationRecord[] = [
  quoted(
    F_CONTEXT,
    PREFIX_CONTEXT_REJECTS,
    'query selector',
    SUFFIX_BEFORE_AUTH,
    toBindings([
      ['P2-S12-AC-160', CLAUSE_EMPTY_REQUEST_ONLY],
      ['P2-S12-AC-160', CLAUSE_NO_OWNER_SELECTOR],
      ['P2-S12-AC-160', CLAUSE_INVALID_QUERY_400],
      ['P2-S12-AC-163', CLAUSE_DENIED_READ_MATRIX],
    ]),
  ),
  quoted(
    F_CONTEXT,
    PREFIX_CONTEXT_REJECTS,
    'nonempty body claim',
    SUFFIX_ON_A_READ_BEFORE_AUTH,
    toBindings([
      ['P2-S12-AC-160', CLAUSE_EMPTY_REQUEST_ONLY],
      ['P2-S12-AC-160', CLAUSE_NO_REQUEST_BODY],
    ]),
  ),
  quoted(
    F_CONTEXT,
    PREFIX_CONTEXT_REJECTS,
    'request media',
    SUFFIX_ON_A_READ_BEFORE_AUTH,
    toBindings([['P2-S12-AC-160', CLAUSE_NO_REQUEST_BODY]]),
  ),
  quoted(
    F_CONTEXT,
    PREFIX_CONTEXT_REJECTS,
    'transfer encoding',
    SUFFIX_ON_A_READ_BEFORE_AUTH,
    toBindings([['P2-S12-AC-160', CLAUSE_NO_REQUEST_BODY]]),
  ),
  quoted(
    F_CONTEXT,
    PREFIX_CONTEXT_REJECTS,
    'idempotency key',
    SUFFIX_ON_A_READ_BEFORE_AUTH,
    toBindings([
      ['P2-S12-AC-160', CLAUSE_NO_IDEMPOTENCY_NO_IF_MATCH],
      ['P2-S12-AC-162', CLAUSE_READ_ONLY_CALL],
    ]),
  ),
  quoted(
    F_CONTEXT,
    PREFIX_CONTEXT_REJECTS,
    'write precondition',
    SUFFIX_ON_A_READ_BEFORE_AUTH,
    toBindings([
      ['P2-S12-AC-160', CLAUSE_NO_IDEMPOTENCY_NO_IF_MATCH],
      ['P2-S12-AC-162', CLAUSE_READ_ONLY_CALL],
    ]),
  ),
  quoted(
    F_CONTEXT,
    PREFIX_CONTEXT_FAILS_CLOSED,
    'unauthenticated',
    SUFFIX_SESSION,
    toBindings([['P2-S12-AC-161', CLAUSE_SERVES_ONLY_AUTHENTICATED]]),
  ),
  quoted(
    F_CONTEXT,
    PREFIX_CONTEXT_FAILS_CLOSED,
    'malformed human',
    SUFFIX_SESSION,
    toBindings([['P2-S12-AC-161', CLAUSE_SERVES_ONLY_AUTHENTICATED]]),
  ),
  quoted(
    F_CONTEXT,
    PREFIX_CONTEXT_FAILS_CLOSED,
    'no acting party',
    SUFFIX_SESSION,
    toBindings([['P2-S12-AC-161', CLAUSE_SERVES_ONLY_AUTHENTICATED]]),
  ),
  quoted(
    F_CONTEXT,
    PREFIX_CONTEXT_FAILS_CLOSED,
    'throw',
    SUFFIX_CONTEXT_PROVIDER,
    toBindings([['P2-S12-AC-163', CLAUSE_DENIED_READ_MATRIX]]),
  ),
  quoted(
    F_DETAIL,
    PREFIX_DETAIL_REJECTS,
    'idempotency key',
    SUFFIX_DETAIL_READ,
    toBindings([
      ['P2-S12-AC-166', CLAUSE_REJECTS_BODY_IDEMPOTENCY_IF_MATCH],
      ['P2-S12-AC-168', CLAUSE_READ_ONLY_CALL],
      ['P2-S12-AC-169', CLAUSE_MALFORMED_PATH_400],
    ]),
  ),
  quoted(
    F_DETAIL,
    PREFIX_DETAIL_REJECTS,
    'write precondition',
    SUFFIX_DETAIL_READ,
    toBindings([
      ['P2-S12-AC-166', CLAUSE_REJECTS_BODY_IDEMPOTENCY_IF_MATCH],
      ['P2-S12-AC-168', CLAUSE_READ_ONLY_CALL],
      ['P2-S12-AC-169', CLAUSE_MALFORMED_PATH_400],
    ]),
  ),
  quoted(
    F_DETAIL,
    PREFIX_DETAIL_REJECTS,
    'request media',
    SUFFIX_DETAIL_READ,
    toBindings([
      ['P2-S12-AC-166', CLAUSE_REJECTS_BODY_IDEMPOTENCY_IF_MATCH],
      ['P2-S12-AC-169', CLAUSE_UNSUPPORTED_BODY_415],
    ]),
  ),
  quoted(
    F_DETAIL,
    PREFIX_DETAIL_REJECTS,
    'nonempty body claim',
    SUFFIX_DETAIL_READ,
    toBindings([['P2-S12-AC-166', CLAUSE_REJECTS_BODY_IDEMPOTENCY_IF_MATCH]]),
  ),
  quoted(
    F_DETAIL,
    PREFIX_DETAIL_REJECTS,
    'transfer encoding',
    SUFFIX_DETAIL_READ,
    toBindings([['P2-S12-AC-166', CLAUSE_REJECTS_BODY_IDEMPOTENCY_IF_MATCH]]),
  ),
  quoted(
    F_DETAIL,
    PREFIX_DETAIL_FAILS_CLOSED,
    'unauthenticated',
    SUFFIX_NONE,
    toBindings([['P2-S12-AC-169', CLAUSE_MISSING_SESSION_401]]),
  ),
];

export const S12_UNIT_CITATION_RECONCILIATION: readonly CitationReconciliationRecord[] =
  [...RETIRED, ...S12_MOVED_CITATION_RECONCILIATION, ...QUOTED];
