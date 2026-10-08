# Phase 2 / Slice 10: Entry authoring, conflict resolution, and revision restore

**Status**: in-progress  
**Complexity**: M  
**Surface scope**: web  
**Depends on**: Slice 09  
**Implementation gate**: the amended Slice 09 criteria (the 17 reopened activation-chain criteria, AC019, AC039, AC043, AC054, AC100, AC143, AC181, AC196, AC215, AC222, AC259, AC264, AC273 and the 956 DEC-108/109/110/111/119/120 criteria AC284-AC1239) gate Slice 10 completion (the separately reopened AC250 was Chrome-verified and closed 2026-10-01; Slice 09 is 1234/1235 active); DEC-105 still keeps AC265 and AC266 as separate mandatory pre-release gates, not implementation prerequisites.  
**Spec depth floor**: 105  
**Acceptance criteria**: 105  
**Plan source**: [Phase 2 plan](../../../wiki/specs/phases/phase-2.md)

**Continuation (2026-10-07/08, Claude orchestration — implementation and identity-receipt evidence)**: The handoff repair streams were completed, an independent gap audit found Slice 10 far from closable, and the missing work was built: the CMS-05/06/07 and entry-list UI, Worker error mapping/metrics/deadlines, hardened proxies, relation authoring, typed reasons with violation pointers, one global lock order for writers/activation/revocation, the per-actor write cap, keyset epoch cursors, the rich_text.v1 hashed descriptor (DEC-146) and the CI browser gate under the shared DB lock. Four Codex adversarial reviews and three Codex refutation rounds over the evidence ledger were fixed RED→GREEN. Local verification 2026-10-08: `pnpm db:verify` PASS (pgTAP 273 files / 10,710; PostgREST 27 / 456; races; types), contract suite 170/170 with fresh Slice 09 marker receipts and 1,990 Slice 10 identity receipts. Evidence ledger (tests/contracts/phase-02-slice-10-evidence-ledger*.ts): 88 verified + 3 contract-only = 91 checked; 14 partial — AC030, AC038, AC040, AC042, AC044, AC045, AC046, AC047, AC048, AC079, AC080, AC089 await the owner's DEC-147 forward-scope ruling, AC056's taxonomy-version clause belongs to Slice 12 under DEC-141, AC059 is verified (canonical `pnpm validate` exit 0 recorded 2026-10-08), AC060's "in the same change" clause closes with the Slice 10 commit/PR. No hosted or production acceptance is claimed; AC209/AC211/AC265/AC266 remain external gates.

**Continuation (2026-09-30, draft-detail malformed locale and local browser stability)**:
CMS-03B-11 now returns the locked structural 400 `INVALID_REQUEST` for an
empty or syntactically invalid `locale` query instead of 422; a separate
dependency-relayed semantic 422 remains covered. The malformed-locale test was
RED 1/26, GREEN 26/26, and RED again when the old status was temporarily
restored. Adjacent editorial Worker tests passed 27 files / 316 tests. The
production-built Chrome history test now waits for its page network to settle
between rapid navigations, after two local Wrangler ProxyWorker exits; the
complete twelve-test real-route suite then passed ten consecutive runs and
fresh pinned `pnpm validate` passed 767 Vitest files / 6,618 tests plus one
skip, configured 100% coverage, 105 functional and twelve production-built
Chrome checks, builds, bundle budgets, and local smoke. This is local status
fidelity and test-harness evidence, not a completed authoring workflow or
hosted acceptance. AC-068 and Slice 10 remain unchecked at 0/75; Slice 09's
activation gate remains open at 262/279 (AC250 closed 2026-10-01). [Local checkpoint](../verification/2026-09-30-phase2-local-contract-and-scope-checkpoint.md).

**Continuation (2026-09-30, Worker admission and canonical API inventory)**:
The Worker now refuses undeclared query parameters on CMS-03B-01/02/04/10
POSTs before session, rate, or persistence work. Four query cases were RED
while five controls passed; the corrected editorial Worker suite is GREEN
26 files / 311 tests. The four already-served CMS-03B-01/02/03/04 operations
are now registered in the canonical platform inventory and generated OpenAPI;
the new contract suite was RED 5/5 before registration and GREEN 5/5 after.
The generated contract check passes, and the document now has 77 operations
instead of 73. Fresh pinned `pnpm validate` exits 0 with 765 Vitest files /
6,583 passes plus one skip, configured 100% coverage, Slice 09 evidence
checks, 105 functional Chrome tests, twelve production-built real-route tests,
build, bundle budgets, and local performance smoke. These are local,
uncommitted, unpromoted increments, not hosted acceptance. Slice 10 remains
0/75, and Slice 09's open activation gate (262/279) still blocks completion.

**Continuation (2026-09-30, strict editorial write query admission)**:
Three first-party CMS-03B-01/02/10 protected write proxies silently accepted
undeclared URL query parameters and returned 201. Six new tests were RED
3 failed / 3 passed before the guards, then GREEN 6/6; the full web-server
proxy suite passed 22 files / 149 tests. Each proxy now returns a no-store
400 `INVALID_REQUEST` before upstream fetch for a query-bearing write.
The authoritative Worker query boundary is a separate open increment.
Fresh pinned `pnpm validate` exits 0 with 762 Vitest files / 6,566 passes
plus one skip, 100% configured coverage, Slice 09 evidence checks, 105
functional Chrome checks, the production-built real-route checks (one
bounded local Wrangler-disconnect retry), build, bundle budgets, and local
performance smoke. This is local, uncommitted, unpromoted work; Slice 10
remains 0/75 and Slice 09 activation closure is still required.

**Continuation (2026-09-30, entry-create lost-response replay)**:
CMS-03B-10 also received fresh Worker trace IDs inside the body passed to
shared `cms_reserve`. New transaction-only pgTAP proves that a same-key retry
returns the original entry and revision without another revision or outbox
event. The focused RPC suite passes 232/232, and the combined template and
entry-create suites pass 302/302. Shared forward-only migration
`20260930150000` binds the effective acting party and refuses an unsafe
legacy-reservation cutover. Clean-reset `pnpm db:verify` passes 88 files/3,001
assertions, lint, and type parity; fresh pinned `pnpm validate` exits 0 with
761 Vitest files/6,560 passes plus one skip, configured 100% coverage, 105
functional and twelve production-built Chrome checks, builds, bundle budgets,
and local smoke. No hosted proof, deployment, promotion, or acceptance-count
change occurred; Slice 10 stays 0/75.

**Continuation (2026-09-30, CMS editorial error relay)**:
The first-party editorial proxy relayed syntactically valid upstream errors even
when their codes contradicted the locked BE03b operation/status matrix, and it
forwarded statuses an operation never declared. A focused proxy regression was
RED 6/8 before the guard, GREEN 40/40 across related suites, RED 6/8 when
only the guard was removed, then GREEN 40/40 after restoration. All six
create/revision/conflict/restore/draft/history proxy call sites now supply
their operation-specific closed error map. Mismatched known statuses retain
their HTTP status but use a safe local error; undeclared statuses fail as 502.
Fresh pinned `pnpm validate` exits 0: 761 Vitest files/6,559 passes plus one
skip, configured 100% coverage, Slice 09 evidence checks, 105 functional and
twelve production-built Chrome checks, builds, bundle budgets, and local smoke.
No database change, hosted proof, deployment, or promotion occurred. The full
CMS-05/06/07 workflows and owner decisions remain open; Slice 10 stays 0/75.

**Continuation (2026-09-30, CMS-03B-03 read admission and query errors)**:
The protected history Worker returned 422 for malformed limit, comparison ID,
and locale despite BE03b's locked 400 matrix, and several bad query paths had
no field violation. It also accepted request media/body claims on a read. The
first-party history proxy repeated the status mismatch and silently dropped
read-body/media claims; the draft-detail proxy silently dropped mutation
headers and read-body/media claims. Focused route/proxy tests were RED 9/24 and
RED 3/32, respectively. Both boundaries now reject write-only headers and
body/media claims before forwarding or session access; malformed history
cursor/limit/compare/locale values return 400, with stable field violations at
the Worker boundary. A protected read's 415 message now correctly says it has
no request media. Focused GREEN is 57/57 across the three suites. Fresh pinned
`pnpm validate` exits 0: 760 Vitest files/6,551 passes plus one skip,
configured 100% coverage, Slice 09 evidence checks, 105 functional and twelve
production-built Chrome checks, builds, bundle budgets, and local smoke. No
database change, hosted proof, deployment, or promotion occurred. The full
CMS-05/06/07 workflows and owner decisions remain open; Slice 10 stays 0/75.

**Continuation (2026-09-30, CMS-05/06 bounded enum authoring)**:
The active 03a schema permits an `enum` field, but the 03b revision and
conflict RPCs refused it even when immutable `enumValues` supplied a bounded
choice set. The shared draft validator also treated an enum with no choices
as arbitrary free-form text. A rolled-back create→autosave→durable conflict→
explicit resolution→protected read pgTAP case was RED 9/225, including the
unbounded-choice admission. Forward-only migration
`20260930140000_cms_enum_field_authoring.sql` requires a nonempty immutable
choice set and admits only listed values through the private revision and
resolver allowlists. The focused suite is GREEN 228/228, including unchanged
field retention, rejected undeclared choices, resolved-record state, and the
authorized draft read. Clean-reset `pnpm db:verify` passes 88 files/2,985
assertions, SQL lint, and generated-type parity. Fresh pinned `pnpm validate`
exits 0: 760 Vitest files/6,541 passes plus one skip, configured 100%
coverage, Slice 09 evidence checks, 105 functional and twelve production-built
Chrome checks, builds, bundle budgets, and local smoke. This is local,
uncommitted, and unpromoted; the complete CMS-05/06 UI, editorial policy
source, and hosted proof remain open. Slice 10 stays 0/75.

**Continuation (2026-09-30, CMS-07 signed cursor comparison binding)**:
The private history reader's `queryHash` omitted `compareRevisionId`, so a
valid signed cursor could be replayed into a different comparison context on
the same entry. A rolled-back pgTAP regression was RED 2/213: the replay was
accepted and did not return `CONFLICT`. Forward-only migration
`20260930130000_cms_history_compare_cursor_binding.sql` adds only the
normalized comparison selector to the private query hash; the outer HMAC
already signs that hash. Focused GREEN is 213/213. Fresh clean-reset
`pnpm db:verify` passes 88 files/2,970 assertions, SQL lint, and generated-type
parity. Fresh pinned `pnpm validate` exits 0: 760 Vitest files/6,541 passes
plus one skip, configured 100% coverage, Slice 09 evidence checks, 105
functional Chrome and twelve production-built Chrome checks, builds, bundle
budgets, and local smoke. The real-route harness used its single permitted
retry after an exact local Wrangler ProxyWorker disconnect; the retry passed
12/12. No hosted proof, deployment, or promotion occurred. This does not
close the CMS-07 comparison contract gap, restore workflow, or Slice 10's
composite criteria; Slice 10 remains 0/75.

**Continuation (2026-09-30, CMS-07 pagination and comparison gap)**: A
production-built Chrome test now exercises a one-row, locale-filtered
history window through the protected Astro→Worker route, follows the native
`Next page` link, preserves limit/locale/cursor in the URL, restores focus to
the list, and confirms the exhausted link disappears. It was RED 1/1 while
the test-owned history port had no second page, GREEN 4/4 after a bounded
context-matched fixture cursor, RED again when only that cursor was withheld,
and GREEN 4/4 after restoration. The fixture is not evidence of the private
RPC's signed-cursor behavior; pgTAP owns that proof. A separate
[CMS-07 comparison scan](../../../wiki/specs/audits/propagation-scan-2026-09-30-cms-revision-comparison.md)
records that IA03 requires field/block/relation comparison while BE03b and
the private producer currently define only safe field diffs. The owner was
asked to approve a privacy-safe, stable block/relation diff contract before
locked-spec propagation; no shape was invented. Fresh pinned `pnpm validate`
exits 0: 760 Vitest files/6,541 passes plus one skip, configured 100%
coverage, Slice 09 evidence checks, 105 functional and twelve
production-built Chrome checks, builds, bundle budgets, and local smoke.
This is local, uncommitted, and unpromoted; no composite CMS-07 criterion or
hosted acceptance is claimed. Slice 10 remains 0/75.

**Continuation (2026-09-30, CMS-07 safe history evidence)**: The protected
`RevisionHistoryPage` contains locale and content/diff hashes, but its SSR
history page omitted those safe contract fields. The production-built Chrome
regression was RED 1/3 on the missing locale; after rendering the validated
summary locale/content hash and nullable before/after diff hashes, it passed
3/3. Removing only the diff-hash rendering reproduced RED 1/3 at the
comparison assertion; restoring it returned GREEN 3/3. Fresh pinned
`pnpm validate` exits 0: 760 Vitest files/6,541 passes plus one skip,
configured 100% coverage, Slice 09 evidence checks, 105 functional and
eleven production-built Chrome checks, builds, bundle budgets, and local
smoke. This remains local, uncommitted, and unpromoted; the complete CMS-07
restore workflow and hosted acceptance remain open. Slice 10 stays 0/75.

**Continuation (2026-09-30, CMS-07 history focus)**: The protected,
production-built Chrome history test demonstrated that a native filter GET
returned focus to neither the revision list nor a named result (RED 1/3).
The read-only SSR page now uses native fragment destinations and focusable
headings for filtered/paginated lists and comparison results. The same Chrome
test confirms list focus after filtering and result focus after comparison;
focused GREEN is 3/3, and the structural route suite is 3/3. Fresh pinned
`pnpm validate` exits 0: 759 Vitest files/6,537 passes plus one skip,
configured 100% coverage, Slice 09 evidence checks, 105 functional and
eleven production-built Chrome checks, builds, bundle budgets, and local
smoke. This is local, unpromoted CMS-07 read-flow progress; restore's
approved migration chain, the complete editor, hosted acceptance, and all
75 composite Slice 10 criteria remain open.

**Continuation (2026-09-30, verified editorial mutation errors)**: CMS-03B-10
create, CMS-03B-01 revision save, and CMS-03B-02 conflict resolve previously
treated HTTP 409 as a definite conflict even when its body was malformed or
contradicted the BE00 error code. Create could then rotate its idempotency key
after an uncertain outcome, risking a second logical create. Five focused
regressions were RED across the three clients. They now accept only a strict
status-matched ApiError as a definite refusal; verified 429 also requires
matching bounded `Retry-After` header/body seconds. An unverifiable response
stays unknown, with create/resolve keys and unsent values preserved. Focused
GREEN is 71/71; the adjacent editorial suite is 242/242. Fresh pinned
`pnpm validate` exits 0: 759 Vitest files/6,537 passes plus one skip,
configured 100% coverage, Slice 09 evidence checks, 105 functional and
eleven production-built Chrome checks, builds, bundle budgets, and local
smoke. The create page remains unavailable pending a real workflow-policy
source; no hosted acceptance, deployment, or promotion occurred. All 75
composite criteria remain unchecked.

**Continuation (2026-09-30, assignment/acting-owner scope)**: The shared
entry-authority resolver combined an active assignment on owner A's entry
with a `cms.author` grant held only in acting organization B. A rolled-back
two-organization CMS-03B-11 pgTAP regression was RED 2/211: the resolver
returned `assignment` and the protected draft read disclosed the foreign
entry. Forward-only migration `20260928000000` binds the assignment owner to
the acting party, so the same request is concealed as `NOT_FOUND`. GREEN was
211/211; removing only the new predicate from a disposable local reset
reproduced the same RED 2/211, then restoring it returned GREEN. Fresh
clean-reset `pnpm db:verify` passes 88 files/2,968 assertions, SQL lint, and
generated-type parity. Fresh pinned `pnpm validate` exits 0: 759 Vitest
files/6,504 passes plus one skip, configured 100% coverage, 105 functional
and eleven production-built Chrome checks, builds, bundle budgets, and local
smoke.
No policy source, hosted workflow, or deployment was added; all 75 composite
criteria remain unchecked.

**Continuation (2026-09-30, create owner concealment)**: A two-organization
CMS-03B-10 regression demonstrated that a foreign active version returned
`VALIDATION_FAILED` during artifact comparison, while an absent version would
return `NOT_FOUND`. RED was 1/209. Forward-only migration `20260927590000`
binds the private version lookup to the acting owner before artifact or
editorial-policy evidence; the function body is otherwise unchanged. Focused
GREEN is 209/209, RED recurred when only the migration was excluded from a
disposable local reset, and GREEN returned after restoration. Fresh
`pnpm db:verify` passes 88 files/2,966 assertions, lint, and type parity;
fresh `pnpm validate` exits 0 with 759 Vitest files/6,504 passes plus one
skip, 100% configured coverage, functional and production-built Chrome
suites, build, bundle, and local smoke. The policy source and complete
hosted CMS-05 flow remain open; all 75 composite criteria stay unchecked.

**Continuation (2026-09-30, initial create proof)**: Eighteen new
transaction-rolled-back pgTAP assertions exercise CMS-03B-10 with a test-only
editorial policy projection distinct from the active-schema activation
envelope. They prove the existing private RPC's atomic first entry/revision,
normalized value, creator assignment, single audit/outbox effect, exact-key
replay, and changed-body `IDEMPOTENCY_MISMATCH` (Worker-mapped HTTP 409). The
first run exposed an assertion at the wrong boundary, not a code defect; after
matching the raw RPC token, focused pgTAP passes 205/205. Fresh clean-reset
`pnpm db:verify` passes 88 files/2,962 assertions, lint, and type parity;
fresh `pnpm validate` exits 0 with 759 Vitest files/6,504 passes plus one
skip, 100% coverage, 105 functional Chrome checks, and the complete
production-built route suite after one exact-signature Wrangler disconnect
retry, followed by build, bundle, and local smoke. The policy fixture is
rolled back and establishes no production policy authority or hosted proof;
all 75 composite criteria remain unchecked.

**Continuation (2026-09-30, SSR authorization status)**: The CMS-03B-11
draft-detail and CMS-03B-03 history Astro pages incorrectly converted an
upstream visible-but-unassigned `403` into `404`, despite the locked BE03b
and FE03 separation from concealed/absent entries. Focused Vitest was RED
2/13 and a production-built Chrome route returned `404` where the contract
requires `403`. The SSR pages now preserve `403` with non-disclosing copy
and retain `404` for hidden or absent entries. Focused GREEN is 13/13;
Chrome proves both states through the built Astro, first-party proxy, and
Worker routes without rendering draft values or revision summaries. Fresh
pinned `pnpm validate` exits 0: 759 Vitest files/6,504 passes plus one
skip, configured 100% coverage, 105 functional and eleven production-built
Chrome checks, build, bundle, and local smoke. This aligns a served access
boundary but does not supply the create/edit form, protected conflict-detail
read, restore workflow, or hosted proof. All 75 composite criteria remain
unchecked.

**Continuation (2026-09-30, calendar conflict resolution)**: A rolled-back
pgTAP regression now creates a real same-field date/datetime conflict through
CMS-03B-01 and exercises explicit resolution through CMS-03B-02. RED failed
13/33 because the resolver refused calendar field kinds before reaching active
value validation. Forward-only `20260927570000` replaces only the private
resolver and widens its three kind allowlists to the already-validated
`date`/`datetime` fields. GREEN 33/33 covers invalid calendar choices,
two-parent immutable revision, exact complete-snapshot hash, conflict and
entry CAS, one outbox event, and exact-key replay. A separate Slice 12
backfill fixture used two volatile timestamps for columns constrained equal;
statement-stable timestamps removed its intermittent failure. Clean-reset
`pnpm db:verify` passes 88 files/2,930 assertions and generated-type
parity. Fresh pinned `pnpm validate` exits 0: 759 Vitest files/6,504
passes plus one skip, configured 100% coverage, 105 functional and ten
production-built Chrome checks, build, bundle, and local smoke. The
real-route harness now retries a complete suite once only after the exact
Wrangler proxy-disconnect signature; this successful full run needed no
retry. No hosted proof, promotion, or complete CMS-05/06/07 workflow is
claimed; all 75 composite criteria remain unchecked.

**Earlier checkpoint (2026-09-30, calendar authoring; superseded above)**:
Extended the active 03a fixture with optional date/datetime fields and wrote a separate 15-assertion
CMS-03B-01 pgTAP suite. RED proved that revision write refused both valid and
invalid calendar values with `DEPENDENCY_UNAVAILABLE`. Forward-only
`20260927550000` admits only the already-validated date/datetime kinds; the
test then exposed a pre-existing JSONB operator-precedence bug that froze a
partial-patch hash while copying the complete field snapshot. Forward-only
`20260927560000` parenthesizes the `values` operand for both the frozen
content hash and conflict candidate hash. Focused suites are GREEN (15/15
calendar, 187/187 existing RPC); clean-reset `pnpm db:verify` passes 88
files/2,912 assertions, lint, and generated-type parity. At that checkpoint,
pinned `pnpm validate` had not passed: 758 Vitest files/6,497 tests plus
one skip and 100% coverage, evidence checks, and 105 functional
Chrome checks passed, but the following real-route Wrangler proxy lost its
network connection after 7–8 of 10 tests on two full-chain attempts and one
back-to-back E2E attempt. The isolated ten-test real-route run passed 10/10;
build/bundle/smoke did not run in the failed full chains. No hosted proof,
commitment, promotion, or complete CMS-05/06/07 workflow was claimed; all 75
composite criteria remained unchecked.

**Continuation (2026-09-30, 06:29 UTC)**: Closed the local raw-rich-text
admission gap without claiming rich-text authoring. BE03b requires an approved
structured AST, but the shared private draft-value helper accepted any
string, including executable HTML, and no approved rich-text validator exists
in the protected registry. A real second type draft in pgTAP made two of
eleven assertions RED. Forward-only migration `20260927540000` preflights
existing non-null rich-text values and refuses non-null rich text until an
approved AST validator is registered; missing/explicit-null provenance and
ordinary short text remain unchanged. Focused GREEN is 11/11; fresh pinned
`pnpm db:verify` passes 87 files/2,897 assertions with generated-type parity.
Fresh pinned `pnpm validate` exits 0: 758 Vitest files, 6,497 passing plus
one skip, 100% coverage, 105 functional and ten real-route Chrome tests,
build, bundle, and local smoke. The
[rich-text AST scan](../../../wiki/specs/audits/propagation-scan-2026-09-30-cms-rich-text-ast.md)
records the format/registry decision needed for full authoring; the
[conflict-detail scan](../../../wiki/specs/audits/propagation-scan-2026-09-30-cms-conflict-detail-read.md)
records the missing protected three-way-value read required by CMS-06. Owner
questions were sent; neither locked contract changed. This work is local,
uncommitted, and unpromoted. All 75 composite criteria remain unchecked.

**Continuation (2026-09-30, 06:02 UTC)**: Closed a separate BE03a/BE03b
owner-lineage gap locally. RED pgTAP proved that an entry or assignment could
claim an owner different from its parent, and that four corresponding
owner-linked foreign keys were absent (6/10 assertions failed). A forward-only
migration preflights existing rows and validates the type-to-version,
type-to-entry, schema-version-to-revision, and entry-to-assignment composite
keys. The Slice 09 organization-move fixture now uses a separate tenant-two
type, preserving both sides of its invalidation proof without a cross-owner
parent. Focused pgTAP is GREEN 10/10; fresh pinned `pnpm db:verify` passes
86 files and 2,886 assertions, and generated types match. Fresh pinned
`pnpm validate` exits 0 (758 Vitest files, 6,497 passing plus one skip, 100%
coverage, 105 functional and ten real-route Google Chrome tests, build,
bundle, and local smoke). This remains uncommitted, unpromoted local evidence.
The governed editorial policy source, native authoring/conflict flow,
restore authority, and hosted acceptance remain open. All 75 composite
criteria remain unchecked.

**Continuation (2026-09-30, 05:26 UTC)**: Closed one BE03b snapshot-owner
integrity gap locally without crediting a composite criterion. A RED pgTAP
suite proved that field values and relations could claim another owner while
linking a valid revision and field definition (6/10 assertions failed). A
forward-only migration now rejects existing cross-owner rows, then adds and
validates four composite owner-linked foreign keys for those two immutable
snapshot tables. The final focused suite passes 10/10; fresh pinned
`pnpm db:verify` passes from a clean local reset (85 files, 2,876 assertions),
the final full `pnpm db:test` also passes 85/2,876, generated database types
match, and pinned `pnpm validate` exits 0 (758 Vitest files, 6,497 passing
tests plus one skip, 100% coverage, 105 functional and ten production-built
real-route Chrome tests, build, bundle, and local smoke). This work remains
uncommitted and unpromoted. The native conflict form, owner-approved editorial
policy, restore migration-chain authority, hosted acceptance, and complete
CMS-05/06/07 flows remain open; all 75 composite criteria stay unchecked.

**Continuation (2026-09-28, 13:33 UTC)**: Advanced local CMS-06 and CMS-07
boundaries without claiming workflow completion. The first-party conflict
resolution transport now retains explicit caller choices and mutation headers;
the restore route requires typed verification of the requested revision before
it returns a public success resource. The production editorial session adapter
was split into focused configuration, capability, resolver, and RPC-body
modules while preserving its server-derived authority. Focused Worker
production/session suites pass 74/74. Fresh pinned `pnpm db:verify` exits 0;
fresh pinned `pnpm validate` exits 0 with 752 Vitest files, 6,466 passing
tests and one skip, 100% coverage on all four axes, Slice 09 evidence checks,
105 functional and ten production-built real-route Google Chrome tests, build,
bundle budget, and local performance smoke. The native conflict form, durable
owner-approved editorial policy, migration-chain authority, hosted acceptance,
and complete CMS-05/06/07 flows remain open. All 75 composite criteria stay
unchecked; Slice 11 remains dependency-locked.

**Continuation (2026-09-28, 09:18 UTC)**: Closed two owner-independent
CMS-03B response-contract gaps. First, all six served editorial routes
shared a 429 path that stripped the BE00-required `limit` and `resetAt`
details; it also subtracted a millisecond clock from an epoch-seconds reset,
clamping real retry windows to one second. RED tests exposed the missing
details, temporal error, and party-bucket header/body limit disagreement.
The shared response now publishes `retryAfterSeconds`, the denied bucket's
`limit`, and a string `resetAt` matching `RateLimit-Reset`; Retry-After uses
the same seconds-based clock. Second, CMS-03B-01 returned a revisions
collection Location for a new revision. Worker and first-party proxy RED
tests now require `/revisions/{createdRevisionId}` and reject a forged
collection Location; both are GREEN. The focused editorial/proxy suite is
GREEN (25 files, 294 tests). Fresh pinned Node 22.23.1/pnpm 11.24.0
`pnpm validate` exits 0: 736 Vitest files, 6,389 passing tests plus one
skip, 100% statements/branches/functions/lines, Slice 09 evidence checks,
105 functional and nine production-built real-route Google Chrome checks,
build, bundle budget, and local performance smoke. These are local
response-contract corrections, not complete CMS-05/06/07 workflows or
hosted acceptance; all 75 composite criteria remain unchecked.

**Continuation (2026-09-28, 08:00 UTC)**: Corrected one production
CMS-03B-03 signed-history-cursor error boundary with a forward-only private
SQL migration. The existing wrapper already mapped malformed base64/JSON to
`INVALID_REQUEST`; wrong envelope keys, a non-UUID key ID, and malformed
signature text instead returned `CONFLICT`. Three new pgTAP assertions were
RED on that mismatch while a valid-shaped bad-MAC control retained
`CONFLICT`. The corrected wrapper returns `INVALID_REQUEST` for only the
malformed envelope branch; key verification, constant-time MAC comparison,
context binding, grants, and signed-key handling remain unchanged. Focused
Slice 10 RPC tests are GREEN (187/187); local `pnpm db:test` passes 82 files
and 2,850 assertions, SQL lint passes with unrelated existing warnings, and
generated database types match. Fresh pinned Node 22.23.1/pnpm 11.24.0
`pnpm validate` exits 0: 736 Vitest files, 6,383 passing tests plus one skip,
100% measured coverage, Slice 09 evidence checks, 105 functional and nine
production-built real-route Google Chrome checks, build, bundle, and local
performance smoke. This closes a local error-mapping gap only; the complete
CMS-05/06/07 authoring, conflict, and restore workflows and hosted acceptance
remain open, so all 75 composite criteria remain unchecked.

**Continuation (2026-09-28, 07:01 UTC)**: Closed a local admission-deadline
gap across the six served CMS-03B-01/02/03/04/10/11 Worker routes. Session
resolution, bounded body reads where applicable, dual-scope rate admission,
and persistence now spend one route budget; a stalled session or streamed body
returns a scrubbed 504 with its dependency signal aborted, and an expired
budget cannot start a late mutation/read. Telemetry no longer holds a
completed response when an injected asynchronous sink stalls; the production
logger remains synchronous and redacted. RED regressions reproduced stalled
sessions, cumulative overrun, stalled bodies, and telemetry waits before the
fixes. The focused CMS editorial suite is GREEN (24 files, 285 tests) with
100% targeted coverage on all changed routes and the shared rate helper.
Fresh pinned Node 22.23.1/pnpm 11.24.0 `pnpm validate` exits 0: 736 Vitest
files, 6,383 passing tests plus one skip, 100% statements/branches/functions/
lines, Slice 09 evidence checks, Google Chrome E2E, build, bundle budget, and
local performance smoke. This is local route behavior only, not a complete
CMS-05/06/07 workflow or hosted acceptance. The protected workflow-policy
source and draft-detail response correction still await owner decisions;
all 75 composite Slice 10 criteria remain unchecked.

**Continuation (2026-09-27, 22:52 UTC)**: Added two production-built Chrome
CMS-07 revision-history checks through the actual Astro proxy and Worker
route. A signed local session and test-owned, owner-bound history port prove
that unauthorized browsing redirects, authorized summaries render without
executable author-class markup, native state/locale filters and comparison
work, stale cursors recover safely, and non-owned entry IDs disclose no
summary. The initial browser test was RED while the Worker history port was
absent (404), then both tests turned GREEN after the isolated fixture was
wired. This is real browser/HTTP transport with local in-memory data, not
Supabase-backed authorization, tamper-evident cursor behavior, or hosted
acceptance. Fresh full `pnpm validate` exits 0: 729 Vitest files / 6,305
passing tests plus one skip at 100% measured coverage, 105 Chrome functional
E2E, eight production-built real-route E2E, build, bundle, and local
performance smoke. The 105 composite criteria remain unchecked.

**Continuation (2026-09-27, 20:39 UTC)**: Added the first-party
CMS-03B-04 revision-restore Astro endpoint and bounded private-binding proxy.
The endpoint checks same-origin and CSRF, UUID path/body agreement, strict
restore request and strong If-Match/idempotency headers, and the returned
new draft's entry, state, ETag, and Location. Four focused tests were RED
while the route was absent and GREEN after implementation. Fresh full local
`pnpm validate` exits 0: 729 Vitest files / 6,305 passing tests plus one
skip at 100% measured coverage, 105 Chrome E2E, five real-route E2E, build,
bundle, and local performance smoke. The protected Worker restore route
still has no production restore RPC/port and correctly fails closed; no
browser restore action or migration-chain success is claimed. The 75
composite criteria remain unchecked.

**Continuation (2026-09-27, 18:59 UTC)**: Added the missing first-party
CMS-03B-02 conflict-resolution Astro endpoint and server-only proxy.
It validates the UUID path/body pair, explicit choice contract, same-origin
CSRF, bounded JSON, strong If-Match/idempotency, and a two-parent 201
revision whose conflict ID, ETag, and Location agree with the request.
The four-test endpoint suite was RED on the absent route and GREEN after
implementation. Fresh full `pnpm validate` exits 0: 726 Vitest files,
6,293 passing tests plus one skip, 103 Chrome E2E, five real-route E2E,
build, bundle, and local performance smoke. This is transport and response
integrity only: no browser conflict form or authenticated hosted conflict
exercise has been proved. The 75 composite criteria remain unchecked.

**Continuation (2026-09-27, 18:44 UTC)**: Added the missing first-party
CMS-03B-10 entry-create Astro endpoint and CMS-03B-01 revision-save endpoint.
The server-only revision proxy checks same-origin, CSRF, a 256 KiB strict
request, UUID path/body agreement, a canonical strong If-Match equal to the
body's expected version, idempotency, and the 201 resource, entry ID, ETag,
and Location before relaying through the private `PLATFORM_API` binding.
Focused tests were RED on the absent route and then GREEN (seven endpoint
tests across create and revision). Fresh full `pnpm validate` exits 0:
725 Vitest files, 6,289 passing tests plus one skip at 100% measured
coverage, 103 Chrome E2E, five real-route E2E, build, bundle, and local
performance smoke. The create form remains deliberately fail-closed until
an owner-approved workflow policy can be selected; the draft editor still
needs a server-derived revision number and complete browser integration.
No composite criterion is checked and no hosted acceptance is claimed.

**Continuation (2026-09-27, 14:22 UTC)**: Registered the already-served
CMS-03B-10 initial-entry create and CMS-03B-11 draft-detail read operations
in the canonical platform inventory and generated OpenAPI. Both document the
existing author-or-editor capability rule, distinct user/party quotas, safe
typed errors, and strict runtime request/resource components. Create requires
Idempotency-Key and no If-Match; draft read exposes a UUID path and optional
locale query with no mutation headers. Two contract tests were RED before
registration and GREEN afterward. Fresh full `pnpm validate` exits 0: 712
Vitest files, 6,201 passing tests plus one skip at 100% coverage, 103 Chrome
E2E, five real-route E2E, build, bundle, and performance smoke. This is
documentation and route-registry coherence, not a completed browser create
flow or hosted acceptance. The 75 composite criteria remain unchecked.
The unchanged local `pnpm db:test` suite also passes 70 pgTAP files and
2,644 assertions, including the existing conflict-record and resolve-RPC
checks; it is not hosted evidence.

## Tasks

- [x] Contract: lock Zod, data, registry, event, and route contracts
- [x] `QA` RED: failing contract, permission, unit, integration, component, accessibility, and applicable E2E tests
- [x] `BE` data, API, and policy implementation
- [x] `FE` Astro SSR and bounded React-island implementation
- [x] `QA` GREEN, adversarial verification, and canonical validation
- [x] Documentation, runbooks, graph, feature ledger, and progress tracking

## Acceptance Criteria

**Current canonical floor (DEC-133 cascade, 2026-10-05)**: 105 authored/active, 91 checked (2026-10-08: 88 verified + 3 contract-only by identity receipts; 14 partial, see the 2026-10-07/08 continuation). Slice 09 is complete at 1235/1235 active under DEC-132; AC209, AC211, AC265, and AC266 retain their separate external timelines and do not gate Slice 10 implementation.

- [x] **P2-S10-AC-001** — Autosave only changed paths against an explicit base revision; same-field divergence creates a truthful conflict. [Architecture §Phasing](../../../wiki/specs/2026-08-02-architecture-design.md#phasing); [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Contracts, Access Control, Edge Cases
- [x] **P2-S10-AC-002** — Compare and restore with recorded schema, template, and taxonomy versions plus a proven migration chain. [Architecture §Phasing](../../../wiki/specs/2026-08-02-architecture-design.md#phasing); [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Contracts, Access Control, Edge Cases
- [x] **P2-S10-AC-003** — Preserve valid input, conflict preimages, focus, and canonical version through network failure and optimistic rollback. [Architecture §Phasing](../../../wiki/specs/2026-08-02-architecture-design.md#phasing); [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Contracts, Access Control, Edge Cases
- [x] **P2-S10-AC-004** — CMS-03B-01: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03B-01 — CMS-05 — POST /api/v1/cms/entries/{entryId}/revisions — EntryRevisionRequest → 201 EntryRevisionResource. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-005** — CMS-03B-01: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation. For `rich_text`, the request must satisfy the canonical `rich_text.v1` AST and protected validator binding; an invalid or noncanonical AST is a typed 422 with no mutation. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-006** — CMS-03B-01: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-007** — CMS-03B-01: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-008** — CMS-03B-01: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-009** — CMS-03B-01: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-010** — CMS-03B-02: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03B-02 — CMS-06 — POST /api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve — ConflictResolutionRequest → 201 EntryRevisionResource. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-011** — CMS-03B-02: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-012** — CMS-03B-02: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-013** — CMS-03B-02: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-014** — CMS-03B-02: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-015** — CMS-03B-02: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-016** — CMS-03B-03: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03B-03 — CMS-07 — GET /api/v1/cms/entries/{entryId}/revisions — RevisionHistoryQuery → 200 RevisionHistoryPage. Comparison output covers field, block, and relation domains using privacy-safe stable identities. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-017** — CMS-03B-03: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-018** — CMS-03B-03: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-019** — CMS-03B-03: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-020** — CMS-03B-03: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery. More than 512 authorized changes is refused with the typed comparison-unavailable response and never partially returned. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-021** — CMS-03B-03: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-022** — CMS-03B-04: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03B-04 — CMS-07 — POST /api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore — RevisionRestoreRequest → 201 EntryRevisionResource. Restore preparation binds an immutable migration-chain manifest derived from at most 64 completed 03a plan edges. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-023** — CMS-03B-04: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-024** — CMS-03B-04: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary. Authorization also covers every chain edge and conceals an unreadable source or chain. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-025** — CMS-03B-04: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules. The idempotency business hash and CAS bind the selected migration-chain identity. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-026** — CMS-03B-04: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-027** — CMS-03B-04: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry. Audit/outbox evidence records only chain identity/hash and safe counts, never migrated values. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [x] **P2-S10-AC-028** — Enforce CMS-03B-01: entryId; UUID path; must resolve to active ContentEntry after structural validation; 400 or policy-safe 404. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [x] **P2-S10-AC-029** — Enforce CMS-03B-01: baseRevision; positive bigint decimal string; revision must be readable; 422 or 409 VERSION_MISMATCH. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [ ] **P2-S10-AC-030** — Enforce CMS-03B-01: changedPaths; 1–128 unique JSON Pointers, each 1–256 chars, bound to stable field/block/relation IDs; 422. Relation changes are keyed by stable field ID rather than version-specific relation-definition ID. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [x] **P2-S10-AC-031** — Enforce CMS-03B-01: values; strict object keyed by stable field IDs; max 128 keys/8 levels/256 KiB; rich text is structured AST; 422. The `object` kind is valid only with the DEC-133 typed depth-1 `properties[]` structure; `rich_text` is valid only as canonical `rich_text.v1`. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [x] **P2-S10-AC-032** — Enforce CMS-03B-01: locale / expectedVersion; BCP 47 2–35 chars; positive decimal entry version; 422 or 409. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [x] **P2-S10-AC-033** — Enforce CMS-03B-02: conflictId; UUID; same entry and unresolved conflict; 400/404/409. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [x] **P2-S10-AC-034** — Enforce CMS-03B-02: choices; 1–128 strict { path, choice: base, theirs, yours, or explicit, value? }; explicit value must validate current schema; 422. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [x] **P2-S10-AC-035** — Enforce CMS-03B-03: cursor/limit; signed context-bound cursor ≤512 chars; limit integer 1–50 default 25; cursor expires ≤24h; 400. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [x] **P2-S10-AC-036** — Enforce CMS-03B-03: compareRevisionId/locale; UUID optional; BCP 47 optional; both revisions must be readable; 400/404. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [x] **P2-S10-AC-037** — Enforce CMS-03B-04: revisionId/migrationChainId; UUIDs; source revision immutable and chain covers source schema to current active schema; 422/409. Restore sets `parentRevisionIds = [currentDraftRevisionId, sourceRevisionId]` and preserves the verified migration-chain identity. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [ ] **P2-S10-AC-038** — Enforce CMS-03B-05: frozenHash; exactly 64 lowercase hex; must equal normalized revision hash; 422/409. This is a contract-only dependency-manifest rule; runtime completion requires the served preparation and write path. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [x] **P2-S10-AC-039** — Enforce CMS-03B-05: dependencyManifest; strict IDs/hashes for schema/template/blocks/patterns/terms/locale/settings/relations/checkers; max 256 entries/32 KiB; 422. This is a contract-only bounded dependency-manifest rule; runtime completion requires authoritative server derivation. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [ ] **P2-S10-AC-040** — Enforce CMS-03B-05: riskClass; ordinary or protected; protected requires configured two-person workflow; 422. `riskClass` is server-derived from frozen policy and dependencies; any caller-supplied `riskClass` is an unknown key. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [x] **P2-S10-AC-041** — Enforce CMS-03B-06: decision/reason; approve or reject; reason 1–2000 safe Unicode chars; 422. This is a contract-only review-decision rule until the protected decision operation is implemented. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [ ] **P2-S10-AC-042** — Enforce CMS-03B-06: stepUpAt/capability; ISO timestamp within configured MFA freshness; named reviewer capability, never caller-selected authority; 401/403/422. The caller supplies neither `stepUpAt` nor `capability`; every CMS-03B-06 decision requires server-verified recent binding-bound MFA and eligible assigned-reviewer capability. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [x] **P2-S10-AC-043** — Enforce CMS-03B-07: localDateTime/timezone; local ISO datetime without offset plus IANA timezone 1–64 chars; 422. This is a contract-only schedule rule until authoritative timezone and persistence paths are implemented. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [ ] **P2-S10-AC-044** — Enforce CMS-03B-07: resolvedUtc/tzdbVersion/disambiguation; offset ISO instant, tzdb 1–32 chars, disambiguation earlier/later/none; nonexistent local time rejected; 422. This is a contract-only publication-action rule until the protected operation exists. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [ ] **P2-S10-AC-045** — Enforce CMS-03B-07: action; publish, unpublish, expire, or archive; 422. This is a contract-only preview-token rule until mint/open/revocation paths exist. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [ ] **P2-S10-AC-046** — Enforce CMS-03B-08: versionSet; strict exact schema/template/taxonomy/settings/blocks/patterns IDs and hashes; 422; stale set 409. This is a contract-only bounded version-set rule until server derivation and revalidation exist. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [ ] **P2-S10-AC-047** — Enforce CMS-03B-08: audience/route; audience 1–64 safe chars; route 1–2048 normalized path; no external URL; 422. This is a contract-only preview-binding rule until the protected preview path exists. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [ ] **P2-S10-AC-048** — Enforce CMS-03B-09: frozenHash/expectedVersionSet; 64 lowercase hex and strict version/hash set equal to approved candidate; 422/409. This is a contract-only unpublish/expire/archive rule until the protected operation exists. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Request/Response Contracts validation table at line 154
- [x] **P2-S10-AC-049** — Enforce mutation headers: Idempotency-Key 8–128 printable ASCII and Content-Type application/json; existing-resource mutations require exact strong If-Match, while initial entry creation uses the explicit create precondition and no fabricated existing version; malformed headers return 400 INVALID_REQUEST. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §Route field validation matrix
- [x] **P2-S10-AC-050** — CMS-05 Create/edit entry: atomically bootstrap an authorized active entry with its first attributable draft revision, load only its protected current editable draft, then autosave changed paths against an explicit readable base revision; server derives owner, assignment, and acting context. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Acceptance Criteria, Interactions, Contracts, Access Control, Edge Cases
- [x] **P2-S10-AC-051** — CMS-05 Create/edit entry: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Acceptance Criteria, Interactions, Contracts, Access Control, Edge Cases
- [x] **P2-S10-AC-052** — `CMS-05` Create/edit entry: implement native create/edit forms with protected draft-detail loading; focus stays until navigation or named result heading; server-derived actor/context/capability, strict Zod input, create idempotency, update ETag/idempotency; render canonical response/version/provenance/next action and announce status; map exact `ApiError`, retain unsent input, focus summary/field, reconcile unknown mutation before retry; URL for navigation/filter, scoped draft before commit, server after success. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§Interaction Specification, Data Mapping, Navigation, Degradation, and Concurrency
- [x] **P2-S10-AC-053** — CMS-06 Resolve concurrent edit: given A same-field divergence from the same base revision is recorded on an entry the actor may edit, and both competing revisions plus their common base are still readable., implement locked behavior and completion exactly. The editor obtains bounded authorized base/theirs/yours preimages only through CMS-03B-12 before submitting a resolution. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Acceptance Criteria, Interactions, Contracts, Access Control, Edge Cases
- [x] **P2-S10-AC-054** — CMS-06 Resolve concurrent edit: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade. Conflict-detail and resolution both conceal hidden records, never expose resolver/authority identities, and preserve typed values. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Acceptance Criteria, Interactions, Contracts, Access Control, Edge Cases
- [x] **P2-S10-AC-055** — `CMS-06` Resolve concurrent edit: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§Interaction Specification, Data Mapping, Navigation, Degradation, and Concurrency
- [ ] **P2-S10-AC-056** — CMS-07 Compare/restore revision: given Actor may read the entry's revision history and both compared revisions exist with their recorded schema, template and taxonomy versions; a restore additionally requires edit capability plus a registered migration chain from the source revision's schema to the current active version., implement locked behavior and completion exactly. Comparison spans field, block, and relation domains; restore requires an exact immutable migration-chain manifest and refuses more than 512 changes. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Acceptance Criteria, Interactions, Contracts, Access Control, Edge Cases
- [x] **P2-S10-AC-057** — CMS-07 Compare/restore revision: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Acceptance Criteria, Interactions, Contracts, Access Control, Edge Cases
- [x] **P2-S10-AC-058** — `CMS-07` Compare/restore revision: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§Interaction Specification, Data Mapping, Navigation, Degradation, and Concurrency
- [x] **P2-S10-AC-059** — Execute Contract → QA-RED → data, API, SSR and island implementation → QA-GREEN → refactor; retain failing-test evidence and run canonical validation. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md); [Architecture §Phasing](../../../wiki/specs/2026-08-02-architecture-design.md#phasing)
- [ ] **P2-S10-AC-060** — Update slice tracking, feature-ledger assignments, applicable runbooks, and architecture graph in the same change; leave no unresolved implementation boundary or undocumented drift. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md); [Architecture §Phasing](../../../wiki/specs/2026-08-02-architecture-design.md#phasing)
- [x] **P2-S10-AC-061** — CMS-03B-10 initial-entry create: define strict Zod request, header, and success contracts; POST /api/v1/cms/entries atomically creates an active entry and attributable first draft revision, returning 201 EntryCreateResource without requiring an existing base revision. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Request/Response Contracts, Middleware & Policies, Data Flow, Error Handling, Verification and Test Strategy
- [x] **P2-S10-AC-062** — CMS-03B-10: reject unknown fields, malformed IDs, off-registry schema or values, invalid locale, and oversized payloads with stable field violations and no mutation. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Request/Response Contracts, Middleware & Policies, Data Flow, Error Handling, Verification and Test Strategy
- [x] **P2-S10-AC-063** — CMS-03B-10: derive actor, acting party, owner, capability, and initial assignment server-side; require authorized CMS author/editor and active compiled schema; preserve policy-safe 401/403/404 and RLS boundaries. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Request/Response Contracts, Middleware & Policies, Data Flow, Error Handling, Verification and Test Strategy
- [x] **P2-S10-AC-064** — CMS-03B-10: require Idempotency-Key and exact create preconditions, reject duplicate/conflicting keys, and replay the same entry/revision result without a second effect; do not require update-only If-Match for a nonexistent entry. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Request/Response Contracts, Middleware & Policies, Data Flow, Error Handling, Verification and Test Strategy
- [x] **P2-S10-AC-065** — CMS-03B-10: map validation, capability, schema, rate, dependency, deadline, and internal failures to BE00 ApiError with safe recovery; no entry or first revision remains after a failed transaction. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Request/Response Contracts, Middleware & Policies, Data Flow, Error Handling, Verification and Test Strategy
- [x] **P2-S10-AC-066** — CMS-03B-10: commit entry, first revision, normalized values, assignment, audit, idempotency, and outbox atomically; expose only canonical resource metadata and redacted telemetry. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Request/Response Contracts, Middleware & Policies, Data Flow, Error Handling, Verification and Test Strategy
- [x] **P2-S10-AC-067** — CMS-03B-11 draft-detail read: define strict UUID path/query and 200 EntryDraftDetailResource contract for GET /api/v1/cms/entries/{entryId}, including only authorized current editable values, field provenance, schema identity, and canonical versions. The canonical draft resource includes server-derived `revisionNumber`, `schemaVersionId`, and bounded `openConflict` identity. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Request/Response Contracts, Middleware & Policies, Data Flow, Error Handling, Verification and Test Strategy
- [x] **P2-S10-AC-068** — CMS-03B-11: reject malformed path/query, unsupported body/media, and invalid response values with stable ApiError and no fallback to private or untyped content. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Request/Response Contracts, Middleware & Policies, Data Flow, Error Handling, Verification and Test Strategy
- [x] **P2-S10-AC-069** — CMS-03B-11: derive session and acting context server-side; require entry-read assignment/capability; return 404 for concealed/absent entry and 403 only for a visible entry lacking assignment or read scope. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Request/Response Contracts, Middleware & Policies, Data Flow, Error Handling, Verification and Test Strategy
- [x] **P2-S10-AC-070** — CMS-03B-11: bind the read to current entry/revision versions, return a strong authenticated ETag and no-store response, and prohibit mutation headers, browser table grants, and cross-context cache reuse. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Request/Response Contracts, Middleware & Policies, Data Flow, Error Handling, Verification and Test Strategy
- [x] **P2-S10-AC-071** — CMS-03B-11: map authentication, concealment, rate, dependency, timeout, and internal failures to BE00 ApiError with safe recovery; never disclose hidden values, ownership, or authority. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Request/Response Contracts, Middleware & Policies, Data Flow, Error Handling, Verification and Test Strategy
- [x] **P2-S10-AC-072** — CMS-03B-11: perform a read-only canonical fetch with no audit/outbox mutation, safe redacted telemetry, and bounded data so the CMS-05 editor loads a truthful draft before autosave. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Request/Response Contracts, Middleware & Policies, Data Flow, Error Handling, Verification and Test Strategy
- [x] **P2-S10-AC-073** — CMS-03B-10 field validation: contentTypeId/contentTypeVersionId must be UUIDs resolving to the same active compiled schema with non-null activation evidence, exact SchemaArtifact and protected validator refs; reject stale or off-registry identity before mutation. Object values satisfy the frozen typed depth-1 property structure and rich-text values satisfy `rich_text.v1`; unknown/mismatched content is refused. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Request/Response Contracts, Middleware & Policies, Data Flow, Error Handling, Verification and Test Strategy
- [x] **P2-S10-AC-074** — CMS-03B-10 field validation: locale is bounded BCP 47; changedPaths are 1-128 unique stable JSON Pointers; values are strict stable-field-ID structured JSON within 128 keys, depth 8, and 256 KiB; no caller owner, assignee, authority, or executable content. Returned object and rich-text values are validated against the same compiled artifact and protected validator versions used at write time. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Request/Response Contracts, Middleware & Policies, Data Flow, Error Handling, Verification and Test Strategy
- [x] **P2-S10-AC-075** — CMS-03B-11 field validation: entryId is UUID and the authorized current draft must resolve to a readable immutable revision; response values/provenance are schema-valid and bounded, with absent or concealed targets returning 404 and no fabricated empty draft. The response includes server-derived `revisionNumber`, `schemaVersionId`, and bounded `openConflict`; it never fabricates a draft or authority metadata. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Request/Response Contracts, Middleware & Policies, Data Flow, Error Handling, Verification and Test Strategy
- [x] **P2-S10-AC-076** — DEC-133 object structure accepts exactly one typed depth-1 `properties[]` declaration with 0–32 properties and rejects nested object/list property kinds. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Request/Response Contracts, Validation and Error Matrix, Compilation Pipeline
- [x] **P2-S10-AC-077** — DEC-133 object properties use unique stable keys and only `scalar`, `enum`, or `rich_text` child kinds, each with an explicit required flag. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Request/Response Contracts, Validation and Error Matrix, Compilation Pipeline
- [x] **P2-S10-AC-078** — DEC-133 object property constraints are strict and kind-specific; unknown keys, missing required keys, incompatible constraints, and mismatched values return typed 422 errors without mutation. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Request/Response Contracts, Validation, Error Handling
- [ ] **P2-S10-AC-079** — DEC-133 object structure is normalized into the immutable SchemaArtifact and definition hash so review, activation, write, restore, preview, and publication bind the same bytes. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Compilation Pipeline, Hashing, Invariants
- [ ] **P2-S10-AC-080** — TypeScript and PostgreSQL validators enforce the same DEC-133 object structure and value semantics across create, append, conflict resolution, restore, draft read, preview, and publication. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Request/Response Contracts, Database Schema, Verification and Test Strategy
- [x] **P2-S10-AC-081** — The native object editor renders property controls from the preparation projection, preserves values and focus across typed failures/conflicts, exposes labels and descriptions, and never asks the user to edit JSON. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§Component Contracts, Accessibility, Error and Recovery, Testing Obligations
- [x] **P2-S10-AC-082** — `rich_text.v1` admits only paragraph, heading levels 2–4, bulleted/numbered list with list items, and quote blocks with the locked recursive bounds. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Rich text value grammar, Validation, Verification and Test Strategy
- [x] **P2-S10-AC-083** — `rich_text.v1` admits only bold/italic/code marks and https/mailto/safe internal-route links, rejects inline embeds and unsafe schemes, and never accepts raw HTML. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Rich text value grammar, Validation, Security
- [x] **P2-S10-AC-084** — `rich_text.v1` normalizes to RFC 8785/JCS bytes and the TypeScript and PostgreSQL validators produce parity for canonical hashes, bounds, and typed errors. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Protected Validator Registry, Compilation Pipeline, Verification
- [x] **P2-S10-AC-085** — `rich_text.v1` is a protected immutable validator key/version whose artifact reference and hash are frozen into the schema artifact and revalidated before every editorial transition. [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Protected Validator Registry, Activation, Compilation Pipeline
- [x] **P2-S10-AC-086** — The constrained native rich-text editor exposes semantic block, list, mark, and link controls with keyboard/focus/error behavior and never exposes a raw JSON or HTML editor. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§Component Contracts, Accessibility, Responsive, Testing Obligations
- [x] **P2-S10-AC-087** — The typed rich-text renderer maps only validated AST nodes to native elements without `dangerouslySetInnerHTML`, and fails closed with a safe recoverable state for unknown or invalid nodes. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§Component Contracts, Security, Error and Recovery, Testing Obligations
- [x] **P2-S10-AC-088** — CMS-03B-12 registers a strict protected GET conflict-detail contract and returns one readable open conflict with bounded base/theirs/yours typed preimages, provenance, and a strong ETag. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Request/Response Contracts
- [ ] **P2-S10-AC-089** — CMS-03B-12 rejects malformed entry/conflict UUIDs, undeclared queries or bodies, and out-of-bound preimages before any existence or dependency work. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Validation, Error Handling
- [x] **P2-S10-AC-090** — CMS-03B-12 derives session and acting context, requires current editorial read authority, and makes hidden, wrong-scope, closed, or absent conflicts indistinguishable 404 responses. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Middleware & Policies, Authorization Matrix
- [x] **P2-S10-AC-091** — CMS-03B-12 is no-store, uses the conflict ETag, and enforces the declared read rate, deadline, cancellation, and bounded response limits. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Performance, Reliability
- [x] **P2-S10-AC-092** — CMS-03B-12 maps only its declared safe typed errors, omits unreadable values and all owner/resolver/authority identifiers, and never relays upstream text. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Error Handling, Security, Privacy
- [x] **P2-S10-AC-093** — CMS-03B-12 is read-only with no audit/outbox mutation; telemetry is redacted to operation, outcome, latency, safe counts, and request ID. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Observability, Verification and Test Strategy
- [x] **P2-S10-AC-094** — CMS-03B-13 registers a strict protected assigned-entry list GET and returns a bounded keyset page of RevisionSummary rows plus an optional signed next cursor. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Request/Response Contracts
- [x] **P2-S10-AC-095** — CMS-03B-13 validates the closed filter/sort/cursor grammar and page bounds and rejects bodies, mutation headers, and undeclared query keys before reads. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Validation, Error Handling
- [x] **P2-S10-AC-096** — CMS-03B-13 derives session/acting context, returns only currently readable assigned entries, and reveals no hidden owner, assignment, capability, or authority identifier. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Middleware & Policies, Authorization Matrix, Privacy
- [x] **P2-S10-AC-097** — CMS-03B-13 signs and binds cursors to actor/context/filter/sort, is no-store, and enforces declared read rate, deadline, cancellation, and page limits. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Performance, Reliability
- [x] **P2-S10-AC-098** — CMS-03B-13 maps malformed/expired cursor, auth, rate, dependency, and internal failures to declared safe errors with truthful retry/degraded behavior and no upstream-text relay. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Error Handling, Failure Recovery
- [x] **P2-S10-AC-099** — CMS-03B-13 is read-only and is consumed by an accessible server-first entry list with native links, announced result/empty/filter states, keyboard order, and no optimistic rows. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§Page Route Contracts, Component Contracts, Accessibility, Testing Obligations
- [x] **P2-S10-AC-100** — CMS-03B-14 registers the literal authoring-context GET and returns a strict server-derived preparation projection for visible active types, schema artifacts, validator references, workflow policy, and activation evidence. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Request/Response Contracts
- [x] **P2-S10-AC-101** — CMS-03B-14 accepts only its closed bounded query grammar, never accepts caller-supplied schema/artifact/policy/approval authority, and rejects body or mutation headers. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Validation, Error Handling
- [x] **P2-S10-AC-102** — CMS-03B-14 derives session and acting context, requires author/editor scope, conceals inaccessible types, and never grants or implies `cms.schema_registry.read`. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Middleware & Policies, Authorization Matrix, Privacy
- [x] **P2-S10-AC-103** — CMS-03B-14 is matched before the entry UUID route, returns an ETag-bound no-store projection, and enforces declared read rate, deadline, cancellation, and response bounds. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Route Registry, Performance, Reliability
- [x] **P2-S10-AC-104** — CMS-03B-14 maps validation, auth, rate, dependency, and internal failures to declared safe typed errors and preserves the user form without fabricating preparation evidence. [BE03b](../../../wiki/specs/be/03b-editorial-workflow-publication.md) §§Error Handling, Failure Recovery
- [x] **P2-S10-AC-105** — CMS-03B-14 is read-only and the create/editor surfaces consume its projection to render accessible native controls, revalidate on submit, and preserve server authority. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§Page Route Contracts, Component Contracts, State Management, Testing Obligations

## Depth Ratio

- 2026-10-08: depth floor 105 (phase-2.md Slice 10 breakdown). Floor items with every clause proven by at least one specific, receipt-backed assertion: 90/105 (87 verified, 3 contract-only). The remaining 15 floor items each have partial, receipt-backed assertions; their unproven clauses are listed in the evidence ledger limitations. Ratio gate (≥ 1.0 per floor item) is not yet met for those 15 — pending the DEC-147 owner ruling, the Slice 12 receiving obligation (DEC-141) and the closure items AC059/AC060.
