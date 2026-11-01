// Data tables for recite/apply.mjs: every decision that a refutation states only in prose.
// Each table names the refutation text it comes from. apply.mjs validates every entry (tiling,
// identity) and reports a mismatch instead of guessing.

/** Key helper: criterion + the first 50 characters of a test title. */
export const titleKey = (criterion, title) =>
  `${criterion}|${title.slice(0, 50)}`;

/**
 * Missed tests the apply rules deliberately do not add.
 *  - DEC-226(4): a Worker mapping test with a stubbed token proves a route clause only if the database
 *    really raises that token on that operation (review b: activation_conflict needs two sessions,
 *    canonical_source_unavailable is Worker-mapping only).
 *  - review c AC-189: the table CHECK test proves one of four reserved pattern keys, "does not make P1 verified".
 */
export const MISSED_SKIP = {
  [titleKey(
    'P2-S12-AC-086',
    "'CMS-03C-09' SQL refusal transport maps activation_conflict (a lost race on the lineage)",
  )]:
    'DEC-226(4): HTTP half of an activation_conflict the database never raises in a test',
  [titleKey(
    'P2-S12-AC-086',
    "'CMS-03C-09' SQL refusal transport maps canonical_source_unavailable {domain}",
  )]:
    'DEC-226(4): HTTP half of canonical_source_unavailable; the SQL half is a gap',
  [titleKey(
    'P2-S12-AC-189',
    'the table rejects a reserved route key [P2-S12-AC-100]',
  )]:
    'review c: proves one of four reserved pattern keys, so it does not make the part verified',
};

/* ---- lane b ---------------------------------------------------------------------------------- */

/**
 * New or corrected splits of a lane b clause (review b). `anchors` give the parts verbatim; with a lane split the
 * lane's part k becomes part k; without one, `addsTo` is the part that takes the clause's adds and existing citations.
 */
export const B_NEW_SPLITS = {
  // REJECTed split: part 0 must start at the clause start (review b, Requests to root 3).
  'P2-S12-AC-107#0': {
    anchors: [
      'CMS-03C-13 accepts only a UUID `contentTypeId`',
      "of a content type in the caller's owner scope",
      ', a signed `cursor` of at most 512 characters and a `limit` of 1-50 (default 25)',
    ],
  },
  // Review b, finding 3 and Requests to root 4: the subject-kind owner capability has no wrong-kind negative.
  'P2-S12-AC-084#1': {
    anchors: [
      'then serves only the holder of',
      "the subject kind's owner capability as for CMS-03C-06",
    ],
    addsTo: 0,
    gaps: [
      null,
      "that the owner capability is the SUBJECT KIND's own (BE03c 173 and 1644: cms.template_designer for a template or pattern version, cms.taxonomy_curator for a taxonomy version): no pgTAP shows a template designer refused on a taxonomy review or a taxonomy curator refused on a template or pattern review",
    ],
  },
  // Review b, finding 8 and Requests to root 5 (record partial).
  'P2-S12-AC-108#2': {
    anchors: [
      'so a draft, non-compatible',
      'or other-owner version is never listed',
    ],
    addsTo: 0,
    gaps: [
      null,
      "that an OTHER owner's pattern version is never listed: every pattern in the pattern_selector fixtures belongs to the caller's owner party, so the owner filter has no data-backed assertion",
    ],
  },
};

/** Missed test on a split lane b clause -> part index, key titleKey(criterion + '#' + clause). */
export const B_PART_OVERRIDES = {
  [titleKey(
    'P2-S12-AC-115#3',
    'the three registry rows CMS-03C-14: GET update-diff, 300/600 per minute, 8,000 ms',
  )]: 0,
  [titleKey(
    'P2-S12-AC-122#0',
    'CMS-03C-15 specifics IDEMPOTENCY_MISMATCH (a lock timeout or deadlock, a reused key) is a 409 with no member',
  )]: 1,
  [titleKey(
    'P2-S12-AC-122#0',
    'CMS-03C-15 specifics a stale entry or instance version is a 409 with the version pair only',
  )]: 0,
};

/* ---- lane c ---------------------------------------------------------------------------------- */

/** OK splits of review c that name parts in prose only: part index -> indices of the lane's add list. */
export const C_PART_CITATIONS = {
  // 126#2: 'a hidden owner or taxonomy' is the database refusal (cited); 'is 404' is the uncited HTTP mapping.
  'P2-S12-AC-126#2': { 0: [0, 1, 2, 3] },
  // 127#3: part A proven by ADD#0-4, part B 'Tier 2' only a registry class label (DEC-226(1)).
  'P2-S12-AC-127#3': { 0: [0, 1, 2, 3, 4] },
  // 132#2: 'a hidden' cited by ADD#0/1; 'absent vocabulary is 404' contradicted by the implementation.
  'P2-S12-AC-132#2': { 0: [0, 1] },
  // 133#4: part A (buckets and deadline) by ADD#0/1 plus the existing transport-table citation.
  'P2-S12-AC-133#4': { 0: [0, 1] },
  // 134#0: parts A (400/401/403) by ADD#0,2,3,5; 'a hidden' by ADD#1,4; (415) by the existing content-type test.
  'P2-S12-AC-134#0': { 0: [0, 2, 3, 5], 1: [1, 4] },
  // 134#2: only part 3 (500 scrub) is cited by ADD#1/ADD#2; ADD#0 (503 relay) belongs to the uncited dependency part.
  'P2-S12-AC-134#2': { 2: [1, 2] },
  // 137#0: NFKC <- ADD#2; lowercase <- ADD#0; trim <- ADD#1; whitespace collapse uncited (ADD#3 DROP); exact equality <- ADD#4.
  'P2-S12-AC-137#0': { 0: [2], 1: [0], 2: [1], 4: [4] },
  // 138#0: only 'PUBLIC, anon, authenticated' is cited (ADD#0); caller set and 'every other role' are uncited.
  'P2-S12-AC-138#0': { 1: [0] },
};

/** Existing ledger citations on a split lane c clause -> part index (null: withheld). */
export const C_EXISTING_PARTS = {
  'P2-S12-AC-133#4': [0],
  // 134#0 existing: 0 malformed query, 1 foreign origin/content-type/body (415), 2 capability 403, 3 typed 401,
  // 4 no query 400, 5 unknown key 400, 6 relays the port refusal 404.
  'P2-S12-AC-134#0': [0, 3, 0, 0, 0, 0, 1],
  // 161#0 existing: three fail-closed sessions, the missing designer authority, the authorized and revoked pgTAP
  // belong to the human-session and grant parts; the not-yet-started tenure is one membership failure mode of
  // several and the reviewer leaves 'confirmed acting-party membership' uncited.
  'P2-S12-AC-161#0': [0, 0, 0, 2, 2, 2, null],
};

/** Missed tests of a split lane c clause -> part (key crit#clause, or crit#clause|title50). */
export const C_MISSED = {
  'P2-S12-AC-147#0': 5,
  'P2-S12-AC-180#0': 0,
  'P2-S12-AC-186#0': 0,
  'P2-S12-AC-187#0': 2,
  'P2-S12-AC-190#0': 0,
  'P2-S12-AC-191#0': 0,
  'P2-S12-AC-195#0': 0,
  'P2-S12-AC-199#0': 3,
  'P2-S12-AC-205#0': 0,
  'P2-S12-AC-211#0': 0,
};

/* ---- lane d ---------------------------------------------------------------------------------- */

/**
 * Re-splits stated in prose by review d (REJECTed splits and the new splits of AC-240, AC-241, AC-286).
 *  anchors   the final parts (verbatim); {until} / {rest} span to a marker / the end of the clause.
 *  map       lane part (or, with unitsFor 'clause', lane add index) -> final parts
 *  addMap    lane tag -> final parts (overrides map)
 *  gapTo     lane part -> final parts that take that lane gap text
 *  gaps      final part -> gap text
 *  missedMap lane part -> final parts for missed tests
 */
export const D_RESPLITS = {
  // Review d, splits: AC-224 part 3 re-split into 3a (cited) and 3b "not newly assignable" (uncited).
  'P2-S12-AC-224#0': {
    anchors: [
      'Term actions: `create` inserts a term with lifecycle `active` and its first labels,',
      '`rename` appends a new label version and never changes the key,',
      '`alias` appends an alias,',
      '`deprecate` moves the term to `deprecated` (still resolvable,',
      'not newly assignable),',
    ],
    map: [[0], [1], [2], [3]],
    gapTo: { 3: [4] },
  },
  // Review d, splits: AC-240 missing-outranks-stale precedence isolated as an uncited part.
  'P2-S12-AC-240#0': {
    anchors: [
      { until: '(never at `submit`;' },
      'a missing value outranks a stale one,',
      { rest: true },
    ],
    unitsFor: 'clause',
    map: [[0], [0], [0], [0], [0], [0], [0], [0], [2], [2], [2], [2], [2], [0]],
    gaps: {
      1: 'a missing value outranks a stale one is asserted nowhere: no test builds a revision with both a missing and a stale no_fallback field; each is only shown to outrank the approval check',
    },
  },
  // Review d, splits: AC-241 isolates the unbuilt taxonomy provider (AC-239).
  'P2-S12-AC-241#0': {
    anchors: [
      { until: 'DEC-199),' },
      '`cms.taxonomy.assignment_integrity`',
      { rest: true },
    ],
    unitsFor: 'clause',
    map: [[0, 2], [0, 2], [], [0], [0, 2], [0], [2], [0]],
    missedMap: { 0: [0] },
    gaps: {
      1: 'cms.taxonomy.assignment_integrity is neither implemented nor registered (AC-239), and the contracts register the taxonomy category as the reference gate (preflight.ts referenceGateRow, reason provider_unbuilt_reference only), so the fixed reason copy does not accept its reasons',
    },
  },
  // Review d, splits: AC-261 part 2 split so the unproven PUBLIC/named-grant/grant-test half is not counted proven.
  'P2-S12-AC-261#0': {
    anchors: [
      { until: 'for `authenticated` and `anon`;' },
      { until: '(a BE00 jobs row);' },
      'every SECURITY DEFINER function is schema-qualified with an empty `search_path`,',
      { rest: true },
    ],
    map: [[0], [1], [2]],
    gapTo: { 2: [3] },
  },
  // Review d, splits: AC-265 parts 1 and 5 bundle a proven half with an unproven one.
  'P2-S12-AC-265#0': {
    anchors: [
      { until: 'with the bounded `CmsGovernedReviewPanel`:' },
      'the server verifies the Supabase session, expiry and acting context',
      '(a missing or expired session uses the allowlisted 303 sign-in redirect),',
      'malformed ids or keys are 400,',
      'a concealed or absent target is a disclosure-safe 404,',
      'a visible target without `cms.template_designer` in the owner scope is 403,',
      '`context`, `versions`',
      '`new` never resolve as `:templateKey`,',
      "`:templateKey` addresses the owner's latest definition,",
      'and Back restores the form without serializing a definition.',
    ],
    map: [[0], [1], [3], [4], [5], [6], [9]],
    addMap: { '0.1.1': [1], '0.5.0': [6], '0.5.1': [6], '0.5.2': [8] },
    gapTo: { 5: [7] },
    gaps: {
      2: 'no behavioural test drives the allowlisted 303 sign-in redirect for a missing or expired session (the only citation, a source-text page test, was refuted)',
    },
  },
  // Review d, splits: AC-278 part 2 "a log or a cache." split; the cache half is cited only by the no-store tests.
  'P2-S12-AC-278#0': {
    anchors: [
      'No leakage: no private locale text, draft composition, unauthorized target, capability or canonical-domain authority enters a public projection,',
      'an event payload,',
      'a log',
      'a cache.',
    ],
    map: [[0], [1], [2]],
    missedMap: { 2: [3] },
  },
  // Review d, splits: AC-286 clause 2, "first binding" has no test.
  'P2-S12-AC-286#2': {
    anchors: [
      'Do not select the latest template',
      'first binding',
      'a client-supplied template operand.',
    ],
    unitsFor: 'clause',
    map: [[], [0], [2]],
    gaps: {
      1: 'the first-binding exclusion has no test: every fixture is built with an empty bindings list, so a server that picked the first binding would pass identically',
    },
  },
};

/* ---- FIX prose, limitations -------------------------------------------------------------------- */

/**
 * FIX verdicts whose replacement the refutation states in prose. cits: [] drops the original; 'ORIGINAL' re-homes
 * it (toClause: index of the final unit). Matched by criterion and the start of the original title.
 */
export const FIX_OVERRIDES = [
  {
    criterion: 'P2-S12-AC-029',
    titlePrefix:
      'digest-mismatch: exact SQL message token block_registry_digest_mismatch',
    toClause: 3,
    cits: [
      {
        tool: 'vitest',
        file: 'apps/worker/src/cms-composition/pattern-instance-reasons.test.ts',
        title:
          'CMS-03C-02 route typed Slice 12 refusals publishes block_registry_digest_mismatch as 409 COMPOSITION_VERSION_CONFLICT with exactly its reasonCode',
      },
    ],
  },
  {
    criterion: 'P2-S12-AC-065',
    titlePrefix: 'a malformed null subjectKind is refused 400 INVALID_REQUEST',
    cits: [
      {
        tool: 'vitest',
        file: 'apps/worker/src/cms-composition/governed-review-submit.test.ts',
        title:
          'CMS-03C-06 submit contract (BE03c row 168, field matrix 389) refuses subjectKind=navigation_version with a 422 at /subjectKind before rate admission',
      },
      {
        tool: 'vitest',
        file: 'apps/worker/src/cms-composition/governed-review-submit.test.ts',
        title:
          'CMS-03C-06 submit contract (BE03c row 168, field matrix 389) refuses subjectKind=Template_Version with a 422 at /subjectKind before rate admission',
      },
    ],
  },
  {
    criterion: 'P2-S12-AC-066',
    titlePrefix:
      'policy of CMS-03C-06 matches its registry row agrees on method, path, quota',
    cits: [
      {
        tool: 'vitest',
        file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
        title:
          'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-064] CMS-03C-06 registers POST /api/v1/cms/governed-reviews with its auth, step-up, concurrency, rate and SLO policy',
      },
      {
        tool: 'vitest',
        file: 'apps/worker/src/cms-composition/governed-review-submit.test.ts',
        title:
          'CMS-03C-06 submit contract (BE03c row 168, field matrix 389) answers 201 with a strict template_version review',
      },
    ],
  },
  {
    criterion: 'P2-S12-AC-067',
    titlePrefix:
      'the review is open at version 1 and freezes the subject definition hash',
    cits: [
      {
        tool: 'pgtap',
        file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
        title:
          'the GovernedReview row stores the server-derived submitter, the frozen basis, the recomputed digest and the content hash [P2-S12-AC-197]',
      },
      {
        tool: 'pgtap',
        file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
        title:
          'the frozen policy-basis hash and review content hash equal the server recomputation from the fixture [P2-S12-AC-064]',
      },
    ],
  },
  {
    criterion: 'P2-S12-AC-068',
    titlePrefix: 'the state refusal leaves exactly one live review',
    cits: [
      {
        tool: 'pgtap',
        file: 'supabase/tests/phase_02_slice_12_governed_submit.sql',
        title:
          'the duplicate refusal leaves the review, dependency, subject, audit and outbox stores identical [P2-S12-AC-251]',
      },
    ],
  },
  {
    criterion: 'P2-S12-AC-068',
    titlePrefix:
      'the dependency refusal commits no review for the unresolvable subject',
    toClause: 11,
    cits: 'ORIGINAL',
  },
  {
    criterion: 'P2-S12-AC-073',
    titlePrefix:
      'every structure, concealment, 403 and CAS refusal leaves the covered stores identical',
    cits: [
      {
        tool: 'pgtap',
        file: 'supabase/tests/phase_02_slice_12_governed_decision.sql',
        title:
          'a body capability or stepUpAt is an unknown key; a malformed review id, a missing key or If-Match disagreeing with expectedVersion is INVALID_REQUEST; a bad decision, version or an empty, over-long, non-NFC, control, markup or brace reason is VALIDATION_FAILED at its pointer [P2-S12-AC-071]',
      },
      {
        tool: 'pgtap',
        file: 'supabase/tests/phase_02_slice_12_governed_decision.sql',
        title:
          'an absent, cross-owner, non-member or scope-less caller meets one concealed NOT_FOUND; the readable submitter without an assignment is 403 capability_missing [P2-S12-AC-072]',
      },
    ],
  },
  {
    criterion: 'P2-S12-AC-113',
    titlePrefix: 'a malformed instanceId carries no DETAIL pointer',
    cits: ['g-bad-id', 'g-null-id', 'g-number-id'].map((label) => ({
      tool: 'pgtap',
      file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
      title: `${label}: exact SQL message token INVALID_REQUEST`,
    })),
  },
];

/* ---- DEC-226 (root evidence policy, 2026-10-24) applied to clauses the reviewers left cited -------- */

const TIER =
  'DEC-226(1): a declared Tier class never proves a p95 target (BE00:655 defines Tier 2 as an API p95 < 1,200 ms); the end-to-end p95 needs a measurement and AC-279 (the benchmark) is unverified';
const PAGE =
  'DEC-226(3): "consumed by <island> at /app/..." needs page-level behaviour (an Astro render test or a real-route Playwright spec); the cited loader, component, composed React and source-text tests do not prove that the page mounts the island';

/**
 * Rules applied after the lane plans: DEC-226 on clauses the reviewers left cited, and review a's AC-069 (the
 * cited real-route spec drives only the vocabulary page).
 * uncite: the whole clause loses its citations; split: anchors give the parts, citeParts the part(s) that keep them.
 */
export const POST_RULES = [
  {
    criterion: 'P2-S12-AC-085',
    clauseStarts: 'enforces rate buckets of 20/min/user and 40/min/party',
    split: {
      anchors: [
        'enforces rate buckets of 20/min/user and 40/min/party, a 15,000 ms deadline, no-store',
        'Tier 2',
      ],
      citeParts: [0],
      gaps: { 1: TIER },
    },
  },
  { criterion: 'P2-S12-AC-121', clauseStarts: 'and Tier 2', uncite: TIER },
  {
    criterion: 'P2-S12-AC-058',
    clauseStarts: 'CMS-03C-04 is consumed by the protected',
    uncite: PAGE,
  },
  {
    criterion: 'P2-S12-AC-093',
    clauseStarts: 'CMS-03C-10 is consumed by the protected',
    uncite: PAGE,
  },
  {
    criterion: 'P2-S12-AC-105',
    clauseStarts: 'CMS-03C-12 is consumed by the protected',
    uncite: PAGE,
  },
  {
    criterion: 'P2-S12-AC-111',
    clauseStarts: 'CMS-03C-13 is consumed by the protected',
    uncite: PAGE,
  },
  {
    // Review a, finding 1: after the source-text DROPs the panel is shown on the vocabulary page only (Playwright T2).
    criterion: 'P2-S12-AC-069',
    clauseStarts:
      'CMS-03C-06 is consumed by the protected `CmsGovernedReviewPanel`',
    split: {
      anchors: [
        'CMS-03C-06 is consumed by the protected `CmsGovernedReviewPanel` on the template, pattern',
        'vocabulary pages',
      ],
      citeParts: [1],
      gaps: {
        0: 'the hosting of the panel on the template and pattern pages is proven by no behavioural test: the three page-mount tests of the lane read the .astro sources as text (refuted); only the real-route spec T2 drives the panel, on the vocabulary page',
      },
    },
  },
];

/**
 * pgTAP description renames (description text only: no assertion, setup or SQL logic changes) that make every
 * duplicated description inside a cited pgTAP file unique (guard rule: a cited file may not hide a duplicate).
 *  edits  exact source edits { file, find, replace, nth } (nth: 0-based occurrence of `find`, original text)
 *  rows   the identity change they cause in the pgTAP run: { file (owner), from, to, nth (0-based among the
 *         assertions of that file with that title, in run order) }. A row with nth 0 also re-points citations.
 */
const T = 'supabase/tests/';
const act = `${T}phase_02_slice_12_governed_activation/095-retire.sqlinc`;
const scan = `${T}phase_02_slice_12_linked_scan/030-scan.sqlinc`;
const proj = `${T}phase_02_slice_12_related_public_targets/001-projection.sqlinc`;
const tt94 = `${T}phase_02_slice_12_taxonomy_terms/094-continuation-authority.sqlinc`;
const tt97 = `${T}phase_02_slice_12_taxonomy_terms/097-bulk-continuation.sqlinc`;
const br40 = `${T}phase_02_slice_12_block_rules/040-legacy-setup.sqlinc`;
const br70 = `${T}phase_02_slice_12_block_rules/070-provider.sqlinc`;
const pcFix = `${T}phase_02_slice_12_dec193_pattern_currentness/000-fixture.sqlinc`;
const cs10 = `${T}phase_02_slice_12_dec193_consumers/010-comparison.sqlinc`;
const lit = (text) => `'${text.replaceAll("'", "''")}'`;
// tapNth: 0-based occurrence of the description among the run's assertions of one entrypoint (differs from nth
// when the twin literal sits in another file that runs first).
const literalRename = (file, from, to, nth = 0, tapNth = nth) => ({
  edits: [{ file, find: lit(from), replace: lit(to), nth }],
  rows: [{ file, from, to, nth, tapNth }],
});

export const RENAMES = [
  // governed_activation: the 095-retire members of the pairs whose twins are in 030-activate.
  literalRename(
    act,
    'the completed idempotency record stores status 200 [P2-S12-AC-086]',
    'the completed idempotency record stores status 200 for the retire [P2-S12-AC-086]',
    0,
    1,
  ),
  literalRename(
    act,
    'an exact same-key replay returns the original response and writes no second event, audit record or state change [P2-S12-AC-086]',
    'an exact same-key replay of the retire returns the original response and writes no second event, audit record or state change [P2-S12-AC-086]',
    0,
    1,
  ),
  // linked_scan: five generic fragment descriptions; the later occurrences name their scan.
  literalRename(
    scan,
    'and changes nothing',
    'and changes nothing (scan r5)',
    1,
  ),
  literalRename(scan, 'and changes no row', 'and changes no row (scan r4c)', 1),
  literalRename(scan, 'and changes no row', 'and changes no row (scan r4e)', 2),
  // related_public_targets: the second [P2-S12-AC-231] projection check names its source.
  literalRename(
    proj,
    'the projection satisfies the list contract [P2-S12-AC-231]',
    'the projection satisfies the list contract for the curated shared-terms source srcp [P2-S12-AC-231]',
    1,
  ),
  // taxonomy_terms: the 094 twins of 050/096 and the second Seq Scan check of 097.
  literalRename(
    tt94,
    'SETUP the original curator authority is restored',
    'SETUP the original curator authority is restored for the continuation run',
    0,
    1,
  ),
  literalRename(
    tt94,
    'fixture: the retired term is merged while it holds no assignment',
    'fixture: the retired term is merged while it holds no assignment (continuation authority)',
  ),
  literalRename(
    tt97,
    'and never by a Seq Scan of the assignment store [P2-S12-AC-226]',
    'and the whole-party lookup is never a Seq Scan of the assignment store [P2-S12-AC-226]',
    1,
  ),
  // block_rules: brt_restore takes an optional step label that ends the description; the first call of each name keeps its text.
  {
    edits: [
      {
        file: br40,
        find: 'create or replace function pg_temp.brt_restore(p_name text) returns setof text language plpgsql as $body$',
        replace:
          "create or replace function pg_temp.brt_restore(p_name text, p_step text default '') returns setof text language plpgsql as $body$",
        nth: 0,
      },
      {
        file: br40,
        find: "'BR-L: ' || p_name || ' enforcement is restored with a pg_proc image identical to the installed function');",
        replace:
          "'BR-L: ' || p_name || ' enforcement is restored with a pg_proc image identical to the installed function'\n      || case when p_step = '' then '' else ' (' || p_step || ')' end);",
        nth: 0,
      },
      {
        file: br40,
        find: "select * from pg_temp.brt_restore('save');",
        replace: "select * from pg_temp.brt_restore('save', 'after brm-v2');",
        nth: 1,
      },
      {
        file: br70,
        find: "select * from pg_temp.brt_restore('save');",
        replace:
          "select * from pg_temp.brt_restore('save', 'after the provider fixtures');",
        nth: 0,
      },
      ...['case 3a', 'case 3b', 'case 5a', 'case 5b', 'case 6a', 'case 6b'].map(
        (step, nth) => ({
          file: br70,
          find: "select * from pg_temp.brt_restore('plan');",
          replace: `select * from pg_temp.brt_restore('plan', '${step}');`,
          nth,
        }),
      ),
    ],
    rows: [
      {
        file: `${T}phase_02_slice_12_block_rules_legacy.sql`,
        from: 'BR-L: save enforcement is restored with a pg_proc image identical to the installed function',
        to: 'BR-L: save enforcement is restored with a pg_proc image identical to the installed function (after brm-v2)',
        nth: 1,
      },
      {
        file: `${T}phase_02_slice_12_block_rules_legacy.sql`,
        from: 'BR-L: save enforcement is restored with a pg_proc image identical to the installed function',
        to: 'BR-L: save enforcement is restored with a pg_proc image identical to the installed function (after the provider fixtures)',
        nth: 2,
      },
      ...['case 3a', 'case 3b', 'case 5a', 'case 5b', 'case 6a', 'case 6b'].map(
        (step, k) => ({
          file: `${T}phase_02_slice_12_block_rules_legacy.sql`,
          from: 'BR-L: plan enforcement is restored with a pg_proc image identical to the installed function',
          to: `BR-L: plan enforcement is restored with a pg_proc image identical to the installed function (${step})`,
          nth: k + 1,
        }),
      ),
    ],
  },
  // dec193_pattern_currentness: the refused-call check of s12pc_acl names the called function.
  {
    edits: [
      {
        file: pcFix,
        find: "'PC-ACL: actual '||called||' private call refused before payload semantics'",
        replace:
          "'PC-ACL: actual '||called||' private call of '||p_identity||' refused before payload semantics'",
        nth: 0,
      },
    ],
    rows: ['anon', 'authenticated', 'service_role'].flatMap((role) =>
      [
        'platform_private.cms_evaluate_preflight(jsonb)',
        'platform_private.cms_frozen_dependencies_status(uuid,jsonb)',
      ].map((identity, nth) => ({
        file: `${T}phase_02_slice_12_dec193_pattern_currentness.sql`,
        from: `PC-ACL: actual ${role} private call refused before payload semantics`,
        to: `PC-ACL: actual ${role} private call of ${identity} refused before payload semantics`,
        nth,
      })),
    ),
  },
  // dec193_consumers: s12cs_seed_current takes a label (the pair side) that ends the four fixture descriptions.
  {
    edits: [
      {
        file: cs10,
        find: 'create or replace function pg_temp.s12cs_seed_current(p_source uuid,p_target uuid) returns setof text',
        replace:
          "create or replace function pg_temp.s12cs_seed_current(p_source uuid,p_target uuid,p_label text default '') returns setof text",
        nth: 0,
      },
      ...[
        "'CS-D5-FIXTURE: every donor history semantic field is copied unchanged, including state/version/pin/tree/position'",
        "'CS-D5-FIXTURE: complete donor history remains byte-identical'",
        "'CS-D5-FIXTURE: fresh copy timestamps follow the real target revision timestamp'",
        "'CS-D5-FIXTURE: insertion occurred only while target is current'",
      ].map((literal) => ({
        file: cs10,
        find: `${literal})`,
        replace: `${literal}||' ('||p_label||')')`,
        nth: 0,
      })),
      {
        file: cs10,
        find: 'pg_temp.s12cs_seed_current(left_source,v_left_id);',
        replace:
          'pg_temp.s12cs_seed_current(left_source,v_left_id,v_left_tag);',
        nth: 0,
      },
      {
        file: cs10,
        find: 'pg_temp.s12cs_seed_current(right_source,v_right_id);',
        replace:
          'pg_temp.s12cs_seed_current(right_source,v_right_id,v_right_tag);',
        nth: 0,
      },
    ],
    rows: [
      'CS-D5-FIXTURE: every donor history semantic field is copied unchanged, including state/version/pin/tree/position',
      'CS-D5-FIXTURE: complete donor history remains byte-identical',
      'CS-D5-FIXTURE: fresh copy timestamps follow the real target revision timestamp',
      'CS-D5-FIXTURE: insertion occurred only while target is current',
    ].flatMap((from) =>
      [
        'cs-equal-d5-left',
        'cs-equal-d5-right',
        'cs-delta-d5-left',
        'cs-delta-d5-right',
        'cs-legacy-d5-d5-left',
        'cs-legacy-d5-d5-right',
        'cs-retired-d5-left',
        'cs-retired-d5-right',
        'cs-b-pending-d5-left',
        'cs-b-pending-d5-right',
        'cs-b-pending-only-d5-left',
        'cs-b-pending-only-d5-right',
      ].map((label, nth) => ({
        file: cs10,
        from,
        to: `${from} (${label})`,
        nth,
      })),
    ),
  },
  // dec193_pattern_currentness: the two remaining s12pc_acl descriptions name the role and the called function.
  {
    edits: [
      {
        file: pcFix,
        find: "'PC-ACL: refusal leaves all captured rows unchanged'",
        replace:
          "'PC-ACL: refusal leaves all captured rows unchanged ('||p_role||' '||p_identity||')'",
        nth: 0,
      },
      {
        file: pcFix,
        find: "'PC-ACL: caller role/context restored'",
        replace:
          "'PC-ACL: caller role/context restored ('||p_role||' '||p_identity||')'",
        nth: 0,
      },
    ],
    rows: [
      'PC-ACL: refusal leaves all captured rows unchanged',
      'PC-ACL: caller role/context restored',
    ].flatMap((from) =>
      [
        'platform_private.cms_evaluate_preflight(jsonb)',
        'platform_private.cms_frozen_dependencies_status(uuid,jsonb)',
      ].flatMap((identity, s) =>
        ['anon', 'authenticated', 'service_role'].map((role, r) => ({
          file: pcFix,
          from,
          to: `${from} (${role} ${identity})`,
          nth: s * 3 + r,
        })),
      ),
    ),
  },
];

const TIER_REASON = TIER.replace('DEC-226(1): ', 'DEC-226(1): ');
const TIER1_REASON = TIER.replace(
  'Tier 2 as an API p95 < 1,200 ms',
  'Tier 1 as an API p95 < 750 ms',
);

/**
 * Reason a clause is unproven where the lane recorded no gap text for it (criterion + clause start -> reason).
 * Each comes from the refutation entry of the criterion (missedGaps / statusNote).
 */
export const CLAUSE_REASONS = [
  ['P2-S12-AC-127', 'Tier 2', TIER_REASON],
  ['P2-S12-AC-162', 'the Tier 2 target.', TIER_REASON],
  ['P2-S12-AC-168', 'the Tier 2 target.', TIER_REASON],
  ['P2-S12-AC-174', 'the Tier 2 target.', TIER_REASON],
  ['P2-S12-AC-180', 'the Tier 1 p95 < 750 ms target.', TIER1_REASON],
  [
    'P2-S12-AC-137',
    'whitespace collapse',
    'the normalization step is unobservable in Phase 2 (facet codes contain no space), so no test can prove it; the only candidate, the "per former" case, passes without any collapse and was refuted',
  ],
  [
    'P2-S12-AC-150',
    'CMS-03C-20 is executable only by the registered non-browser callers',
    'the registered-callers inventory is unproven: no callers inventory over pg_proc.prosrc exists, and the Shard 04 delivery projection, one of the named callers, is not built',
  ],
  [
    'P2-S12-AC-150',
    'and every other role have EXECUTE revoked)',
    'DEC-226(2): PUBLIC, anon and authenticated are checked by name, which does not prove that every other role has EXECUTE revoked; an owner-only ACL assertion (proacl / aclexplode) is missing',
  ],
  [
    'P2-S12-AC-173',
    'resolves the key only within that scope',
    'no pgTAP or apispec case has a member of owner B, acting for B, read a pattern key held only by owner A (equal to an unused key), and no shared-key case lets each owner read its own lineage; only the hidden-owner non-member case exists',
  ],
  [
    'P2-S12-AC-176',
    'cmsPatternLatestRead is consumed by the protected',
    `${PAGE}; no route-level (real-route Playwright or Astro render) test of /app/cms-content-modeling/patterns/:patternKey exists, and the saved-pattern 403 notice has no case of its own`,
  ],
  [
    'P2-S12-AC-182',
    'cmsTaxonomyVersionsRead is consumed by the protected',
    `${PAGE}; no real-route or render test of the taxonomy pages exists (the source-text page test was refuted)`,
  ],
  [
    'P2-S12-AC-179',
    'a caller without the capability is 403',
    'no Worker test answers 403 for cmsTaxonomyVersionsRead: a session without cms.taxonomy_curator and the raised capability_missing token on the versions-read path are untested at the Worker (the same gap as AC-181)',
  ],
  [
    'P2-S12-AC-061',
    '(it consumes `cms.publication.changed.v1` for invalidation).',
    'BE03c 1734 says 03c consumes cms.publication.changed.v1 to invalidate related eligibility, but the implementation recomputes at read time and no event consumer exists; the two recompute-on-read tests were refuted as proof of consumption, so the clause needs an owner decision (amend it to recompute-on-read, or build the consumer)',
  ],
];

/**
 * Caveats on clauses that ARE cited, taken from the refutations (confirmed real, or correcting a lane statement);
 * appended to the limitation of the entry. criterion -> text.
 */
export const CAVEATS = {
  'P2-S12-AC-044':
    'The concurrency clause is cited by a one-session stale-operand case and the dec193_writer race (the CMS-03C-15 writer against a governed activation: typed refusal with no effects), not by two competing expected revisions; placement (CMS-03C-02) has no race module.',
  'P2-S12-AC-048':
    'The announce-status clause is half covered: the alert role of a refusal is asserted (CmsTaxonomyTermForm.refusals.test.tsx), the role and aria-live of the pending and done states of CmsTaxonomyTermStatus are not.',
  'P2-S12-AC-065':
    'The partial unique index named in the last clause is asserted by no test (every duplicate-submit test is refused earlier by the non-draft state guard, and the draft-with-a-live-review arm is unreachable through the producers); only the outcome of at most one live review is covered.',
  'P2-S12-AC-066':
    'The per-kind capability map (cms.template_designer for template and pattern versions, cms.taxonomy_curator for taxonomy versions) and the owner-party scope have no database test: the Worker gate is any-of and leaves the kind to SQL, and no pgTAP refuses a curator on a template, a designer on a taxonomy or a cross-party caller.',
  'P2-S12-AC-067':
    'In one transaction is not asserted by fault injection (every no-effect refusal fires before the first write), and the block digest is asserted only for a template with an empty block tree (the digest of "[]").',
  'P2-S12-AC-072':
    'The separation_of_duties branch of the decision RPC is raised by no pgTAP (defense in depth with no public path); the submitter case is asserted by outcome only (the assignment gate refuses with capability_missing).',
  'P2-S12-AC-073':
    'Only step-up before concealment pins an order among the ten checks; separation_of_duties is unreachable (see AC-072), and the review CAS and the unique reviewer are proven sequentially, with no race.',
  'P2-S12-AC-075':
    'The real-route Playwright spec (T1, T3, T6) drives the ordinary decision path against the real stack and is not cited here.',
  'P2-S12-AC-079':
    'Leaves the review version unchanged holds for create and for the revoke of an assignment that authorized no counted approval; revoking one that authorized a counted approval invalidates the review (reviewer_authority_changed, version 3, subject back to draft). Atomically and emits no event are asserted on the create path only.',
};

/** Whole-limitation overrides where the composed text would be wrong or too thin (criterion -> text). */
export const LIMITATION_OVERRIDES = {};
