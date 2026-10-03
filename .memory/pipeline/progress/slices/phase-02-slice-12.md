# Phase 2 / Slice 12: Templates, reusable patterns, and taxonomy governance

**Status**: in-progress  
**Complexity**: M  
**Surface scope**: web  
**Depends on**: Slice 09  
**Implementation gate**: Slice 09 activation-chain criteria were reopened on 2026-09-30 and remain open together with AC019, AC039, AC043, AC054, AC100, AC143, AC181, AC196, AC215, AC222, AC259, AC264, AC273 and the 956 amended criteria AC284-AC1239, while the separately reopened AC250 was Chrome-verified and closed 2026-10-01 (1234/1235 active); Slice 12's local work remains in progress but cannot close before that dependency.  
**Spec depth floor**: 53  
**Acceptance criteria**: 53  
**Plan source**: [Phase 2 plan](../../../wiki/specs/phases/phase-2.md)  

**Receiving scope (2026-10-03, DEC-121, DEC-122 owner-ratified and DEC-123)**: (1) Slice 09 AC1166 and AC005 cover only the declaration and storage of `no_fallback` (declared per locale variant, refused on a nonlocalizable field at authoring). The resolution semantics, that a `no_fallback` field is never resolved through `fallbackChains` to `defaultLocale`, and the DEC-121 rule that a stale fallback-permitted field keeps serving its last approved translation, are received by this slice's explicit receiving criteria P2-S12-AC-051 and AC-052 and by Slice 15 delivery resolution (CMS-15). (2) Slice 09 delivers only the template-binding mechanics DEC-123 fixes: a new type carries no template, and CMS-03A-09 binds the default template and bindings through the first successor version, each resolved through the compatibility resolver against the exact candidate. Template authoring and compatibility declaration (CMS-03C-01), compatibility maintenance and every other template-binding flow are received by this slice's explicit receiving criterion P2-S12-AC-053 and Slice 15. All three receiving criteria were authored 2026-10-03 and are open; no Slice 09 criterion verifies the resolution semantics or the flows beyond DEC-123.  

**Continuation (2026-09-30, generated OpenAPI reference integrity)**:
The published-document contract test found 44 dangling local schema pointers
across CMS components and inline request bodies (RED), and the standalone
profile-portfolio builder had 21 more occurrences. All three emitters now
anchor structural references beneath their owning OpenAPI component while
preserving reference-shaped sample data. All five document variants resolve
their structural local references; unit tests and a reverted-prefix probe
cover the correction. Fresh pinned `pnpm validate` passes 769 Vitest files /
6,643 tests plus one skip, configured 100% coverage, 105
functional and twelve production-built Chrome checks, builds, bundle budgets,
and local smoke. This is contract-document correctness only; taxonomy curator
authority remains unimplemented, P2-S12-AC-016 stays unchecked, and Slice 12
remains 0/50. [Local checkpoint](../verification/2026-09-30-phase2-local-contract-and-scope-checkpoint.md).

**Continuation (2026-09-30, CMS-03C-03 canonical taxonomy API authority)**:
The served taxonomy-term route now has a strict path/headers/body transport
schema, an exact protected operation in the canonical platform registry, and
a generated OpenAPI path with required `taxonomyId`, `Idempotency-Key`, and
`If-Match`, the 200 safe resource, declared errors, rate limits, and Tier-2
timeout/SLO. The registry/OpenAPI tests were RED 2/2 before registration and
GREEN 2/2 after; the schema test was independently RED before the wrapper
existed. Inventory assertions now include the new operation and components.
Fresh pinned `pnpm validate` passes 767 Vitest files / 6,618 tests plus one
skip, configured 100% coverage, 105 functional and twelve production-built
Chrome checks, builds, bundle budgets, and local smoke. This is contract
publication only: the production `actTerm` port still fails closed with a
sanitized 503 until canonical-overlap and atomic curator authority exist.
P2-S12-AC-016 and Slice 12 remain unchecked at 0/50; Slice 09's activation
gate remains open at 262/279 (AC250 closed 2026-10-01). [Local checkpoint](../verification/2026-09-30-phase2-local-contract-and-scope-checkpoint.md).

**Continuation (2026-09-30, CMS idempotency business hash)**:
Real lost-response retries received fresh Worker trace IDs, so the private
reservation returned `IDEMPOTENCY_MISMATCH` instead of the committed template.
The first pgTAP was RED 3/65; expanded authority and malformed-context
controls were RED 4/70 against a partial fix. Forward-only migration
`20260930150000_cms_idempotency_business_hash.sql` now excludes transport
trace fields, retains the authority-bearing acting-context ID, binds the
server-resolved acting party, and refuses cutover while old CMS reservations
exist. Focused template and entry-create suites pass 302/302; clean-reset
`pnpm db:verify` passes 88 files/3,001 assertions, lint, and type parity.
Fresh pinned `pnpm validate` exits 0 with 761 Vitest files/6,560 passes plus
one skip, configured 100% coverage, 105 functional and twelve production-built
Chrome checks, builds, bundle budgets, and local smoke. No hosted proof,
deployment, promotion, or acceptance-count change occurred; Slice 12 stays
0/50.

**Continuation (2026-09-30, CMS-11 strict write query admission)**:
The first-party template-version POST silently dropped undeclared URL query
parameters while forwarding an otherwise valid protected write. A new
same-origin proxy regression using `ownerId` in the query was RED 1/4: it
received 201 and reached the Worker. The proxy now returns BE03c's no-store
400 `INVALID_REQUEST` before forwarding; focused GREEN is 15/15 across the
proxy and route suites. Fresh pinned `pnpm validate` exits 0 with 761 Vitest
files/6,560 passes plus one skip, configured 100% coverage, Slice 09 evidence
checks, 105 functional and twelve production-built Chrome checks, builds,
bundle budgets, and local smoke. No database change, hosted proof, deployment,
or promotion occurred. Template activation and the other CMS-03C authority
decisions remain open; Slice 12 stays 0/50.

**Continuation (2026-09-30, same-version conflict retry)**: CMS-11's
successor form allowed a new submit after a definite 409 and explicit
protected latest read of the same parent, but it reused the rejected
idempotency key. The interaction regression was RED 1/3. The reconcile hook
now resets that key only after a confirmed 409 and a canonical same-version
identity/hash match; a lost-response/uncertain attempt retains its key for
safe replay. A stale or same-number different immutable parent remains
unverifiable. Focused GREEN is 4/4 interaction cases plus 2/2 identity cases;
the adjacent composition suite passes 38/38. Fresh pinned `pnpm validate`
exits 0: 760 Vitest files/6,541 passes plus one skip, configured 100%
coverage, Slice 09 evidence checks, 105 functional and eleven production-built
Chrome checks, builds, bundle budgets, and local smoke. This is local,
uncommitted, unpromoted correction; locked latest-read propagation, activation,
hosted acceptance, and the other CMS-03C authorities remain open. Slice 12
stays 0/50.

**Continuation (2026-09-30, template error and rate-wait contracts)**: A
production-built local Chrome test passed the real two-tab CMS-11 sequence:
first write 201, stale write 409, protected latest read, explicit rebase of
unsent values, and successful new-precondition write. The propagation scan
was corrected to distinguish this local proof from still-missing hosted
acceptance and locked BE03c/FE03 approval. Create/edit transport now confirms
403, 409, and 429 only from the matching validated BE00 error envelope;
malformed or mismatched bodies remain uncertain. A verified 429 also requires
matching numeric `Retry-After` evidence and blocks both forms for the bounded
wait. Focused tests were RED before implementation, GREEN 25/25 afterward,
RED again when only the new guards were disabled, and GREEN after
byte-identical restoration. Fresh pinned `pnpm validate` exits 0: 759 Vitest
files/6,532 passes plus one skip, configured 100% coverage, Slice 09 evidence
checks, 105 functional and eleven production-built Chrome checks, builds,
bundle budgets, and local smoke. No hosted proof, approval, deployment, or
promotion followed; Slice 12 remains 0/50.

**Continuation (2026-09-30, protected template read admission)**: The
locked `cmsTemplateContextRead` contract forbids request bodies,
idempotency keys, and write preconditions, but both that context route and
the locally implemented latest-template read accepted write-only headers
and body/media claims. Ten route assertions were RED (10/56 failures).
A shared read-header admission check now rejects those requests before
session or private RPC access with stable BE00 400/415 errors. Focused
GREEN is 56/56; temporarily disabling only the new check reproduced the
same ten failures, and restoring the exact source bytes returned GREEN.
Fresh pinned `pnpm validate` exits 0: 759 Vitest files/6,514 passes plus
one skip, configured 100% coverage, Slice 09 evidence checks, 105
functional and eleven production-built Chrome checks, builds, bundle
budgets, and local smoke. The latest-template route still awaits owner
approval for BE03c/FE03 locked-spec propagation; activation and other
Slice 12 authority decisions remain open. This is local, uncommitted,
unpromoted hardening, not a complete CMS-11 workflow or hosted proof;
Slice 12 remains 0/50.

**Continuation (2026-09-30, localized calendar values)**: The active 03a
fixture marks date and datetime fields localizable and the pinned draft-value
helper validates both, but CMS-03C-04 refused their kinds before validation.
A rolled-back pgTAP source revision and locale-authoring case was RED (9/32
observed failures, including generic dependency refusals for invalid values
and no valid target variant). Forward-only migration
`20260927580000_cms_locale_calendar_values.sql` widens only the private
locale-authoring allowlist; other complex kinds remain fail-closed. Focused
GREEN is 36/36, covering malformed calendar values, exact target values and
hash, draft-only state, entry CAS, and exact-key replay. Fresh pinned
`pnpm db:verify` exits 0 after reset: 88 pgTAP files/2,944 assertions,
SQL lint, and generated-type parity. Fresh pinned `pnpm validate` exits 0:
759 Vitest files/6,504 passes plus one skip, 100% measured coverage, 105
functional and eleven production-built Google Chrome checks, build, bundle,
and local smoke. This is a local endpoint increment, not the Phase 2-deferred
CMS-15 human form or hosted acceptance; Slice 12 remains 0/50.

**Continuation (2026-09-28, 15:00 UTC)**: Added the protected CMS-03C-02
pattern-instance insertion route, server-bound production adapter, first-party
Astro proxy, strict contract/OpenAPI entry, and fail-closed tests. The route
checks origin/CSRF, bounded JSON, strong If-Match, idempotency, assigned
author/editor session, two rate scopes, response identity/version, deadline,
safe telemetry, and typed error envelopes. A missing private
`cms_insert_pattern_instance` RPC maps to sanitized 503, never a false 404.
Focused tests passed RED/GREEN; six focused files now pass 30 tests with 100%
coverage across five runtime modules. Fresh pinned `pnpm validate` exits 0:
758 Vitest files, 6,497 passing tests and one skip, 100% measured coverage,
Slice 09 evidence checks, 105 functional and ten production-built real-route
Google Chrome tests, build, bundle budget, and local performance smoke.
No pattern-source authoring/activation/selector authority, atomic insertion
RPC, native insertion form, or hosted proof was invented. The owner decisions
recorded in the pattern-source scan remain open. No composite Slice 12
criterion is checked (0/50); Slices 13–17 remain dependency-locked.

**Continuation (2026-09-28, 13:33 UTC)**: Advanced local CMS-11/12/14/15
boundaries. Composition routes now return the BE00 429 details and headers
with epoch-seconds retry arithmetic. Forward-only SQL fixes the locale
source-hash mismatch to `VERSION_MISMATCH`/409 and rejects same-owner,
non-draft pattern source revisions without changing cross-owner concealment.
The protected related-content rule route, strict contract/OpenAPI entry, and
first-party proxy are present; its production port still refuses with 503
until the owner approves the eligible-target authority. The template browser
now reconciles an uncertain save before retry, retains form values and the
idempotency key, and has a real-route Chrome regression. Route/test modules
were split under project size limits. Fresh pinned `pnpm db:verify` exits 0;
fresh pinned `pnpm validate` exits 0 with 752 Vitest files, 6,466 passing
tests and one skip, 100% coverage, 105 functional and ten production-built
real-route Google Chrome tests, build, bundle budget, and local performance
smoke. Activation, pattern-source, taxonomy-authority, locale-fanout, related-
target decisions, full protected workflows, and hosted acceptance remain
open. No composite Slice 12 criterion is checked (0/50); Slices 13–17 remain
dependency-locked.

**Continuation (2026-09-28, 08:50 UTC)**: Closed a local
CMS-03C-04 production-adapter error-catalog mismatch. The private locale
RPC's generic editorial refusals reached the Worker port as BE03b codes;
BE03c requires the operation-specific 403/404/409/422 `LOCALE_*` codes.
Focused adapter tests were RED on those four mappings, then GREEN after the
adapter mapped only those statuses and preserved unrelated dependency
failures. A coverage RED exposed an unreachable branch and an unexercised
telemetry callback; the final focused adapter suite is GREEN (9/9) with
100% measured file coverage. Fresh pinned Node 22.23.1/pnpm 11.24.0
`pnpm validate` exits 0: 736 Vitest files, 6,385 passing tests plus one
skip, 100% statements/branches/functions/lines, Slice 09 evidence checks,
105 functional and nine production-built real-route Google Chrome tests,
build, bundle budget, and local performance smoke. This is local error
mapping and transport evidence, not a complete CMS-15 authoring form,
hosted role exercise, or publication-policy acceptance. No composite
Slice 12 criterion is checked (0/50).

**Continuation (2026-09-28, template activation authority scan)**: A
read-only cross-layer audit confirmed that CMS-03C-01 defines a draft
candidate, while BE03c requires a later governed immutable activation and
`cms.template.activated.v1` event without declaring the activation operation,
approving actor/policy, or concurrent-switch/replay contract. The
[template-activation scan](../../../wiki/specs/audits/propagation-scan-2026-09-28-cms-template-activation.md)
records the exact spec gaps. The owner was asked to select the approval
model before an IA/BE/FE cascade. No locked spec changed and no composite
criterion is checked (0/50).

**Continuation (2026-09-28, related-content authority scan)**: A read-only
audit of CMS-03C-05 found that BE03c locks pin/exclusion order, bounded rule
shape, and read-time authorization rechecks, but does not name the eligible-
target projection or define derived-candidate ranking and invalidation
semantics. The
[related-content source scan](../../../wiki/specs/audits/propagation-scan-2026-09-28-cms-related-content-source.md)
records the owner decision needed before a genuine 201 curator path can be
implemented. No locked contract changed and no composite criterion is checked
(0/50).

**Continuation (2026-09-28, 05:41 UTC)**: Added the protected
CMS-03C-03 taxonomy-term Hono route, optional Worker composition, and a
production dependency that authenticates and rate-limits but refuses term
mutation with a sanitized 503 until the canonical-overlap authority and
atomic curator RPC are specified and deployed. The route validates origin,
CSRF, path/query, strict bounded JSON, strong If-Match, idempotency, curator
capability, two distinct rate buckets, response identity/version, deadline,
safe errors, and redacted telemetry. The standalone route was RED (404/5
tests); its Worker composition test was RED (404/1); and the runtime injection
test was RED (missing dependency/1). The focused route/runtime/adapter suites
are GREEN (3 files, 17 tests), including deadline and malformed-provider
regressions; route-focused V8 coverage reaches 100%. Fresh pinned Node
22.23.1/pnpm 11.24.0 `pnpm validate` exits 0: 736 Vitest files, 6,352
passing tests plus one skip, 100% statements/branches/functions/lines,
105 functional and nine production-built real-route Chrome tests, build,
bundle budget, and local performance smoke. This proves local admission and
fail-closed deployment transport, not a curator happy path, canonical source,
named mutation RPC, browser workflow, or hosted acceptance. No composite
Slice 12 criterion is checked (0/50).

**Continuation (2026-09-28, 04:45 UTC)**: A RED pgTAP assertion (1 of 26
failed) exposed that a taxonomy assignment's `field_definition_id` referenced
the field table by ID alone, while its revision and term links already enforced
owner identity. Forward-only migration
`20260927480000_cms_taxonomy_assignment_field_owner.sql` refuses existing
cross-owner assignments, adds a field `(id, owner_id)` key, and validates a
composite assignment-to-field FK without rewriting rows. The focused test is
GREEN (26/26), generated database types include the new relationship, and
fresh `pnpm db:verify` exits 0: 82 pgTAP files / 2,841 assertions, SQL lint,
and type parity. A preceding full-suite attempt had a transient TAP parse
failure in the unrelated locale-stale test; that file passed alone (11/11) and
the canonical rerun passed. Fresh `pnpm validate` exits 0: 734 Vitest files /
6,337 passing tests plus one skip at 100% measured coverage, 105 functional
and nine production-built real-route Google Chrome tests, build, bundle budget,
and local performance smoke. This closes one private owner-link integrity gap;
the named curator RPC, browser flow, and hosted acceptance remain open. A
[canonical-taxonomy source scan](../../../wiki/specs/audits/propagation-scan-2026-09-28-cms-taxonomy-source.md)
records the missing overlap authority and version-authoring routes for owner
direction. No composite Slice 12 criterion is checked (0/50).

**Continuation (2026-09-28, 04:18 UTC)**: A RED contract test showed
`TemplateVersionRequestSchema` accepted the same content-type UUID twice when
letter case differed; RED pgTAP showed the private manifest validator and
`cms_define_template` also accepted it (three failed assertions in the
focused 58-assertion file). The contract now compares canonical UUID text, and
forward-only migration `20260927470000_cms_template_uuid_identity.sql`
replaces only the manifest validator's duplicate comparison. Its preflight
refuses pre-existing ambiguous immutable template rows without rewriting
them. The focused contract suite is GREEN (9/9); fresh `pnpm db:verify` passes
82 pgTAP files / 2,840 assertions, SQL lint, and generated-type parity. Fresh
`pnpm validate` exits 0: 734 Vitest files / 6,337 passing tests plus one skip
at 100% measured coverage, 105 functional and nine production-built real-route
Google Chrome tests, build, bundle budget, and local performance smoke. This
closes one template-identity integrity gap, not the composite CMS-11 criteria
or hosted acceptance. A separate
[CMS-12 pattern-source scan](../../../wiki/specs/audits/propagation-scan-2026-09-28-cms-pattern-source.md)
records that the locked API has no protected pattern create, activation, or
selector-read route despite requiring an immutable readable pattern; it
awaits owner direction. No Slice 12 criterion is checked; status remains 0/50.

**Continuation (2026-09-28, taxonomy stable key)**: A RED pgTAP probe
demonstrated that, after an existing term advanced from version 1 to 2, a
second term could claim its original key at version 1. A forward-only unique
constraint now reserves `(taxonomy_version_id, term_key)` for the same durable
term across all CAS versions; migration preflight refuses pre-existing
duplicates without deleting or rewriting rows. The focused taxonomy test is
GREEN (25/25), and local `pnpm db:verify` passes 82 pgTAP files / 2,837
assertions, SQL lint, and generated-type parity. Two subsequent full
`pnpm validate` runs passed contract/type/progress/format/lint and all 734
Vitest files (6,337 passing, one skip, 100% coverage) plus 105 functional
Chrome tests, but each stopped when the local Wrangler real-route proxy
reported `Network connection lost` during the nine-test suite (7/9 and 8/9
respectively). The nine-test suite passes alone (9/9), as does the complete
105-plus-nine Chrome sequence and a coverage-plus-nine sequence. A bounded
local repro of 50 invalid-CSRF JSON POSTs against the built first-party
route yielded 25 expected 403s, 22 proxy 500s, then a closed socket; the
Wrangler process exited. Cancelling the unread request stream did not remove
the failure (30 403s, 19 500s, then a closed socket on a second 50-request
probe), so that experimental app change was removed. The crash signature
matches [Cloudflare workers-sdk issue #15203](https://github.com/cloudflare/workers-sdk/issues/15203);
no upstream dependency was changed. A third unchanged full `pnpm validate`
run exited 0: 734 Vitest files / 6,337 passing tests plus one skip at 100%
measured coverage, 105 functional and nine real-route Chrome tests, build,
bundle budget, and local performance smoke. The local Wrangler failure is
reproducible under repeated rejected POST traffic and remains an upstream
test-runtime reliability risk despite this green run. This closes a private
stable-key integrity gap only; the named curator RPC, browser flow, merge
convergence, and hosted acceptance remain open, so no composite criterion
is checked.

**Continuation (2026-09-28, 02:41 UTC)**: Added a production-built Google
Chrome real-route exercise for CMS-03C-04 through the actual first-party Astro
proxy and Hono Worker route. The test was RED (502) before its isolated
Worker-side locale port was wired, then GREEN. A signed local session and
test-owned in-memory port prove browser-initiated CSRF refusal, a 201 draft
with bounded fields and next aggregate ETag, safe 409 stale-version details,
and a successful explicit rebase. The functional Playwright config excludes
this fixture-dependent test; the dedicated real-route config includes it.
An initial combined run hit a transient local Wrangler `Network connection
lost`; the standalone real-route suite passed 9/9 immediately afterward and
a fresh full `pnpm validate` then exited 0: 734 Vitest files / 6,337
passing tests plus one skip at 100% measured coverage, 105 Chrome functional
and nine production-built real-route E2E, build, bundle, and local
performance smoke. This is local browser/HTTP transport proof, not a CMS-15
authoring form, Supabase-backed persistence/RLS, hosted role exercise, or
publication-policy acceptance. No composite criterion is checked; Slice 12
remains 0/50.

**Continuation (2026-09-28, 02:01 UTC)**: Added the first-party CMS-03C-04
Astro POST endpoint and server-only locale-authoring proxy. The two focused
test suites were RED when their modules were absent, then GREEN (8 tests,
including a separately RED version-overflow check).
The proxy checks same-origin/CSRF, bounded JSON, strict path/body and
entry-version `If-Match` agreement, allowlisted cookies/headers, and a 201
draft resource bound to the source revision, locale, fallback policy, and
next aggregate ETag. It drops provider-private error text and unknown
details while preserving safe 409 reconciliation versions. Fresh full local
`pnpm validate` exits 0: 734 Vitest files / 6,337 passing tests plus one
skip at 100% measured coverage; 105 Chrome functional and eight
production-built real-route E2E; build, bundle, and performance smoke. This
is local transport evidence, not the CMS-15 browser form, Supabase-backed
HTTP or hosted acceptance. No composite criterion is checked; Slice 12
remains 0/50.

**Continuation (2026-09-28, 01:17 UTC)**: Added the append-only
CMS-03C-04 source-stale transition in a forward-only migration. A RED pgTAP
suite found no transition or audit/outbox effect (6/13 failures). The
entry-serialized revision trigger now compares the latest immutable source
hash, appends one `stale` variant version per dependent locale without
rewriting its predecessor, clears stale approval evidence, and emits only
identifier-only `cms.localization.changed.v1` events with private audit.
A migration-time reconciliation handles pre-trigger rows and is idempotent;
private helper execution is denied to browser and service roles. Focused
tests pass 15/15 for two dependent locales and 11/11 for pre-trigger
reconciliation. Fresh local `pnpm db:verify` exits 0: 82 pgTAP files /
2,836 assertions, SQL lint, and matching generated types. Fresh full
`pnpm validate` exits 0: 732 Vitest files / 6,329 passing tests plus one
skip at 100% measured coverage, 105 Chrome functional E2E, eight
production-built real-route E2E, build, bundle, and local performance smoke.
This is local immutable-state and event proof, not a no-fallback publication
gate, CMS-15 browser flow, Supabase-backed HTTP, hosted acceptance, or
production-capacity proof. No composite criterion is checked; Slice 12
remains 0/50.

SPEC GAP: BE § Data Flow — synchronous source-stale fanout has no per-entry
locale bound — an adversary can make one source write exceed its 15-second
deadline by creating many dependent locales — owner to select a bounded
locale count or an asynchronous fail-closed invalidation protocol.

SPEC GAP: BE § Event schemas — distinct locale invalidations can share one
entry `aggregateVersion` — a consumer that deduplicates only by aggregate
version may miss a locale — specify event-ID-plus-locale reconciliation or a
different per-locale aggregate key before implementing the consumer.

**Continuation (2026-09-28, 00:45 UTC)**: Advanced CMS-03C-04 from storage
constraints to a protected, named locale-authoring path. A RED pgTAP suite
first found the absent RPC; a forward-only migration now admits only a
server-derived assigned author/editor, current readable source revision and
hash, active compiled schema, localizable scalar fields, bounded fallback and
mandatory `no_fallback` IDs, exact aggregate CAS, and idempotent replay. It
atomically appends the target revision/field values/variant, entry version,
redacted audit, and `cms.localization.changed.v1` outbox event. The focused
pgTAP suite passes 22/22; full local `pnpm db:verify` exits 0 with 80 files /
2,810 assertions, SQL lint, and regenerated database types. A protected Hono
route, production RPC adapter, and Worker wiring have RED→GREEN unit tests
with complete targeted coverage. The canonical route registry and generated
OpenAPI now publish CMS-03C-04's exact path, headers, 201 resource, limits,
and safe errors; the initial focused OpenAPI test was RED before registration
and is GREEN. Fresh full `pnpm validate` exits 0: 732 Vitest files / 6,329
passing tests plus one skip at 100% measured coverage, 105 Chrome functional
E2E, eight production-built real-route E2E, build, bundle, and local
performance smoke. This is local data/API proof only: source-stale
propagation (added in the later continuation above), publication/legal no-fallback gate, CMS-15 browser flow,
Supabase-backed HTTP and hosted role/browser acceptance remain open. No
composite criterion is checked; Slice 12 remains 0/50.

**Continuation (2026-09-27, 23:19 UTC)**: Closed a CMS-03C-04 immutable-source
integrity gap. A locale variant could name a real source revision while
storing an unrelated `source_hash`; pgTAP was RED on the missing constraint
and accepted mismatch (2/11 failures). A forward-only composite FK now binds
`(source_revision_id, source_hash)` to the immutable revision ID and payload
hash; the prior owner/entry/locale FKs remain in force. Existing fixture
snapshots now use the source revision's real hash. The focused test is GREEN
11/11 and full local `pnpm db:verify` exits 0: 79 files / 2,788 assertions,
SQL lint, and generated types matching the migrated schema. The migration
skill led to a bounded lock timeout, `NOT VALID` then validation, and
forward-only history preservation. Fresh full `pnpm validate` exits 0:
729 Vitest files / 6,305 passing tests plus one skip at 100% measured
coverage, 105 Chrome functional E2E, eight production-built real-route E2E,
build, bundle, and local performance smoke. This is source-provenance storage
protection only, not localizable-field admission, fallback/no-fallback
policy, source-stale transition, named RPC, browser flow, or hosted
acceptance. Slice 12 remains 0/50.

**Continuation (2026-09-27, 22:16 UTC)**: Added a production-built Chrome
CMS-11 two-tab successor test through the actual Astro proxy and Worker route
with a test-owned in-memory template port and signed local session. RED first
returned 502 without a fixture, then revealed a browser-hydration failure:
the production bundler split contracts/Zod into a circular `src` ↔
`api-error` dependency, so the form never attached handlers. An explicit
client chunk boundary fixes hydration. The GREEN scenario proves a 201
successor, stale-tab 409, preserved input and focused error, latest-version
comparison, explicit rebase, second 201 with the new strong If-Match, and no
serious/critical axe violations. The shared production-built real-route
suite passes 6/6. This is browser/transport evidence with a local port, not
a genuine Supabase-backed two-request 409 or hosted acceptance. Slice 12
remains 0/50. Fresh full `pnpm validate` exits 0: 729 Vitest files / 6,305
passing tests plus one skip at 100% measured coverage, 105 Chrome functional
E2E, six production-built real-route E2E, build, bundle, and local performance
smoke.

**Continuation (2026-09-27, 21:45 UTC)**: Hardened CMS-03C-02 nested
composition storage so a child cannot reference a same-owner parent from a
different revision. The focused pgTAP suite was RED on the missing constraint
and accepted invalid insert (2/12 failures), then GREEN (12/12) after a
forward-only, validated composite foreign key. A same-revision child remains
valid. Canonical local `pnpm db:verify` exits 0: 79 files / 2,786
assertions, SQL lint, and regenerated database types matching the migrated
schema. Fresh full `pnpm validate` exits 0:
729 Vitest files / 6,305 passing tests plus one skip at 100% measured
coverage, 105 Chrome functional E2E, five real-route E2E, build, bundle, and
performance smoke. This is a graph-scope prerequisite, not
the named pattern-instance RPC, registered pattern source, browser flow, or
hosted acceptance. Slice 12 remains 0/50.

**Continuation (2026-09-27, 21:28 UTC)**: Aligned CMS-03C-03 term-key
admission with the locked BE contract and SQL key constraint. The contract
had accepted underscores that persistence necessarily rejects. Request and
resource RED tests failed 2/5; the hyphen-only key fix made the suite 5/5
GREEN. Fresh full `pnpm validate` exits 0: 729 Vitest files / 6,305 passing
tests plus one skip at 100% measured coverage, 105 Chrome E2E, five real-route
E2E, build, bundle, and performance smoke. No term-action acceptance is
claimed. The canonical role/instrument/gear/place/rights/jurisdiction
taxonomy source required for overlap checks is absent from this checkout; an
owner architecture choice was requested while mutation remains fail-closed.
Slice 12 remains 0/50.

**Continuation (2026-09-27, 21:17 UTC)**: Hardened CMS-03C-03 permanent
merge redirects. RED pgTAP proved two accepted invalid transitions: choosing
an already-merged survivor, and merging an active survivor with inbound
redirects. Forward-only local migrations add a preflight and a closed
successor trigger on the same per-vocabulary serialization lock; a second
forward-only correction preserves the existing cross-vocabulary FK error.
The focused suite is GREEN at 25/25. A clean local `pnpm db:verify` passes
79 pgTAP files / 2,783 assertions, generated types, and SQL lint (with
unrelated existing warnings). Fresh full `pnpm validate` exits 0: 729 Vitest
files / 6,305 passing tests plus one skip at 100% measured coverage, 105
Chrome E2E, five real-route E2E, build, bundle, and performance smoke.
Database-schema and migration guidance led to an owner-scoped direct-survivor
invariant, preflight, closed trigger privileges, and forward-only corrections.
This is still local storage protection only; no curator RPC, assignment
convergence, browser workflow, hosted proof, or full criterion is claimed.
Slice 12 remains 0/50.

**Continuation (2026-09-27, 21:01 UTC)**: Hardened CMS-03C-03 taxonomy
hierarchy integrity in two forward-only local migrations. A RED pgTAP update
proved that a permitted term CAS could move a root beneath its grandchild;
the first guard serializes changes per vocabulary and rejects ancestor cycles.
A second RED test proved that merged redirects could still become parents;
the follow-up guard rejects child attachment to a merged term and refuses a
merge while children still reference that term. Valid same-vocabulary moves
remain allowed. The suite passed 79 pgTAP files / 2,779 assertions after the
local migrations; generated DB types match and SQL lint exits 0 with existing
unrelated warnings. Fresh full `pnpm validate` exits 0: 729 Vitest files /
6,305 passing tests plus one skip at 100% measured coverage, 105 Chrome E2E,
five real-route E2E, build, bundle, and local performance smoke. The
database-schema and migration skills led to serialization, pre-existing-data
preflights, closed trigger privileges, and forward-only fixes. This is a
storage invariant only: no curator RPC, canonical overlap source, browser
workflow, hosted acceptance, or composite criterion is claimed. Slice 12
remains 0/50.

**Continuation (2026-09-27, 20:18 UTC)**: Added the CMS-11
existing-template successor page and bounded edit island. The no-store Astro
route hydrates only after both protected selector context and canonical latest
detail validate; malformed keys receive an accessible disclosure-safe 404.
The island prefills every editable value, fixes the immutable key, submits
the canonical expected version with exact strong `If-Match`, and accepts only
a newer validated private-draft resource/ETag. A 409 or unknown outcome keeps
unsent values and offers a no-store latest-version comparison; an explicit
rebase is required before submitting against a newer parent and resets the
idempotency attempt. RED→GREEN request, transport, reconciliation, route,
interaction, and Chrome fail-closed tests cover this local increment. Full
local `pnpm validate` exits 0: 728 Vitest files, 6,301 passing tests plus
one skip, 100% measured coverage, 105 Chrome functional E2E tests, five
real-route E2E tests, build, bundle, and local performance smoke. The
prepared locked BE03c/FE03 latest-read propagation still awaits owner
confirmation; a genuine authenticated two-request HTTP 409 exercise and
hosted CMS-11 acceptance remain open. The CMS-12 pattern-version producer
is absent from the locked route/RPC inventory and needs an owner source
decision. No composite criterion is checked; Slice 12 remains 0/50.

**Continuation (2026-09-27, 19:29 UTC)**: Added forward-only
locale/revision foreign keys so a CMS-03C-04 snapshot cannot relabel an
en-US revision as a fr-FR target or de-DE source. The RED pgTAP case failed
4/9 checks before migration and passed 9/9 afterward; the existing
append-only storage fixture now uses a structurally real fr-FR revision
instead of reusing its en-US source. Full local `pnpm db:test` passes
79 files / 2,771 assertions, generated types match, SQL lint exits 0 with
pre-existing warnings, and fresh full `pnpm validate` exits 0 (726 Vitest
files, 6,293 passing plus one skip; 103 Chrome E2E, five real-route E2E,
build, bundle, and local performance smoke). The fixture proves structural
locale identity, not translated field validity or policy. No hosted
acceptance or composite criterion is claimed.

**Continuation (2026-09-27, 19:15 UTC)**: Added forward-only
owner/entry-bound foreign keys for CMS-03C-04 locale variants and the
CMS-03C-05 related-content source, plus a revision-to-entry owner anchor.
The RED pgTAP case failed 9/13 checks, including privileged cross-owner
and cross-entry inserts that were accepted; after the local migration it
passes 13/13. Full local `pnpm db:test` passes 78 files / 2,762 assertions;
generated types are synchronized, SQL lint exits 0 with pre-existing
warnings, and fresh full `pnpm validate` exits 0 (726 Vitest files,
6,293 passing tests plus one skip, 103 Chrome E2E, five real-route E2E,
build, bundle, local performance smoke). This closes a storage-integrity
hole only. It does not implement locale authoring/fallback, related-target
eligibility, protected routes, browser flows, or hosted acceptance. 0/50
composite criteria remain checked.

**Implementation note (2026-09-27)**: Slice 12 depends on completed Slice 09,
not Slice 10. CMS-03C-01 request/resource/header contracts and the Worker
RFC 8785/JCS digest helper have RED→GREEN coverage. The forward-only private
template-version table, closed designer grant, and atomic `cms_define_template`
RPC are applied only to the local test database. Rolled-back pgTAP fixtures
cover actual draft creation, replay, successor CAS, audit, owner capability,
protected regions, compatible type and supported block admission, exact digest,
and deprecated/withdrawn refusal. Five forward-only corrective migrations
preserve migration history after behavioral tests found grant, digest-order,
nonempty manifest, lifecycle-hash, and same-key first-create concurrency
defects. A separate-backend advisory-lock probe was RED before the final
migration and GREEN after it; the API wrapper now serializes same-key calls
before the private first-create/version read. The local database suite passes
2,644 assertions across 70 files. A protected CMS-03C-01 Hono route now enforces
strict admission, server-resolved human designer authority, separate user/party
quotas, stable safe errors, no-store response, and a 15-second deadline. Its
production adapter calls only `platform_api.cms_define_template` with the
server-derived context and bounded response parsing; runtime composition
registers the route. Route, adapter, and runtime tests were RED before
implementation and GREEN after it. Full `pnpm validate` passes 704 Vitest files,
6,162 tests plus one skip at 100% coverage, 103 Chrome E2E tests, five real-route
tests, build, bundle, and performance smoke. The browser CMS-11 workflow, a real
two-request HTTP 409/reconciliation proof, hosted acceptance, and composite
criteria are still incomplete; 0/50 remain checked. Other Slice 12
operations and all dependent slices stay gated by their declared criteria and
validation.

**Continuation (2026-09-27, 12:48 UTC)**: The CMS-11 Astro same-origin
`POST /api/v1/cms/templates/versions` proxy now forwards only bounded,
schema-valid requests through the private `PLATFORM_API` binding with CSRF,
idempotency, and strong successor checks. It accepts only a strict 201
resource/ETag pair and relays documented, disclosure-safe errors; a RED
regression for an upstream-invented validation code is now GREEN behind an
allowlist. The proxy and thin route have 14 focused tests and 100% targeted
coverage. Fresh full `pnpm validate` passes 706 Vitest files, 6,176 passing
tests plus one skip at 100% coverage, 103 Chrome E2E tests, five real-route
tests, build, bundle, and performance smoke. This transport is not the CMS-11
browser workflow: the current read projection does not expose the separate
`cms.template_designer` authority needed for a server-derived capability gate.
The owner has been asked to choose a narrow protected template-context read
route or an auth-session extension. No hosted CMS-03C-01 evidence or composite
criterion is claimed; 0/50 remain checked.

**Continuation (2026-09-27, 13:14 UTC)**: Began independent CMS-03C-02
contract-first work. The strict `PatternInstanceRequest`, required
idempotency/strong-`If-Match` headers, bounded override object, and closed
`CompositionInstanceResource` are exported from the composition package.
Six focused tests are GREEN at 100% targeted coverage; one RED regression
showed that per-value JSON depth admitted an override object one level beyond
the locked depth-eight limit, which the contract now counts from the override
root. Fresh full `pnpm validate` passes 707 Vitest files, 6,182 passing tests
plus one skip at 100% coverage, 103 Chrome E2E tests, five real-route tests,
build, bundle, and performance smoke. No CMS-03C-02 RPC, Worker route,
pattern-version source, browser form, or hosted proof is claimed. Slice 12
remains 0/50.

**Continuation (2026-09-27, 13:26 UTC)**: Added strict CMS-03C-03
taxonomy-term action, strong mutation-header, and closed browser-resource
contracts under RED→GREEN tests. The request admits only the five named
actions, keeps a merge survivor merge-only, bounds localized labels and
aliases, and requires NFC labels; the browser term resource excludes owner
authority and uses the physical `active|deprecated|merged` lifecycle. Five
focused tests pass with 100% targeted coverage. Fresh full `pnpm validate`
passes 708 Vitest files, 6,187 passing tests plus one skip at 100% coverage,
103 Chrome E2E tests, five real-route tests, build, bundle, and performance
smoke. No CMS-03C-03 RPC, Worker route, browser workflow, merge/redirect
proof, or hosted acceptance is claimed; Slice 12 remains 0/50.

**Continuation (2026-09-27, 13:40 UTC)**: Added strict CMS-03C-04 locale
path/request/header/resource contracts and CMS-03C-05 related-content
path/request/header/resource contracts under RED→GREEN tests. Locale fields,
ordered fallback, and no-fallback IDs are bounded and deduplicated; related
pins/exclusions are bounded, unique, and cannot overlap, while derived rules
remain named and bounded. Ten focused tests pass with 100% targeted coverage.
Fresh full `pnpm validate` passes 710 Vitest files, 6,197 passing tests plus
one skip at 100% coverage, 103 Chrome E2E tests, five real-route tests,
build, bundle, and performance smoke. All five CMS-03C operations now have
request/resource contract modules; only CMS-03C-01 has a Worker route.
Locale and related-content persistence, domain policy, browser workflows,
and hosted acceptance are not claimed; Slice 12 remains 0/50.

**Continuation (2026-09-27, 14:07 UTC)**: Registered the already-served
CMS-03C-01 template-version POST in the canonical platform route inventory
and generated OpenAPI. The request body, required Idempotency-Key, conditional
If-Match, designer capability, dual user/party quotas, timeout, 201 resource,
and typed safe errors are now derived from runtime contracts. Two new
contract tests were RED before registration and GREEN afterward; the exact
OpenAPI component inventory was updated when the full suite found its stale
expectation. Fresh full `pnpm validate` exits 0: 711 Vitest files, 6,199
passing tests plus one skip at 100% coverage, 103 Chrome E2E, five real-route
E2E, build, bundle, and performance smoke. This is route documentation and
registry coherence, not browser workflow or hosted acceptance; Slice 12
remains 0/50.

**Continuation (2026-09-27, 14:48 UTC)**: Began CMS-03C-03 persistence
test-first. Eleven initial pgTAP checks were RED because the four private
taxonomy tables were absent, then GREEN after a forward-only migration added
TaxonomyVersion, TaxonomyTerm, TermLabel, and TermAssignment with typed FKs,
unique version identities, indexes, forced RLS, no browser/service-role table
grants, verified-RPC row policies, and write/immutability guards. The full
database suite exposed default PUBLIC execute on two new private guard
functions; a new RED assertion and forward-only privilege migration closed
that gap. A further RED behavior test showed stable term IDs could not advance
their version for alias/merge CAS; a third forward-only migration corrected the
guard while preserving immutable keys, terminal redirects, and direct-write
denial. The local pgTAP suite now passes 2,668 assertions across 71 files;
SQL lint exits 0 with existing unrelated warnings. Generated database types
were synchronized. No curator RPC, canonical-overlap/hierarchy transaction,
atomic assignment convergence, Worker route, browser workflow, or hosted
proof is claimed; composite criteria remain 0/50.

**Continuation (2026-09-27, 15:00 UTC)**: Added the remaining four BE03c
private records under RED→GREEN pgTAP: PatternVersion and CompositionInstance
for CMS-03C-02, then LocaleVariant and RelatedContentRule for CMS-03C-04/05.
The pattern/instance tables bind real revision and pattern versions, constrain
canonical block-key syntax, and preserve append-only composition snapshots.
A real composition insert exposed an invalid PostgreSQL path-regex repetition
bound; a forward-only correction replaced it with a separately byte-bounded
path check and capped the recursive block-key walk. Locale variants bind entry
and source revisions, keep target/source locales distinct, and are immutable;
related rules bind source/target entries, distinguish derived versus explicit
targets, and are immutable. All nine BE03c private tables now exist locally
with forced RLS and no direct browser/service-role grants; the eight new
tables use verified-RPC row policies, while the earlier template table keeps
its separate guarded-definer boundary. The full local pgTAP suite passes
2,704 assertions across 73 files;
generated database types are synchronized and SQL lint exits 0 with
pre-existing warnings. Fresh full `pnpm validate` exits 0: 712 Vitest files,
6,201 passing tests plus one skip at 100% coverage, 103 Chrome E2E tests,
five real-route E2E tests, build, bundle, and performance smoke. Graph
admission, canonical-taxonomy overlap, source
locale policy, target eligibility, named RPCs, Worker/browser behavior, and
hosted evidence remain open. Slice 12 remains 0/50.

## Tasks

**Continuation (2026-09-27, 18:25 UTC)**: Added forward-only CMS-03C-03
taxonomy-link integrity so a term parent or merge successor cannot cross a
vocabulary/owner boundary, a term assignment cannot pair a term with another
taxonomy, and an assignment cannot attach a foreign-owner revision. A new
pgTAP suite first failed 8/13 checks, including four successful invalid
writes, then passed 13/13 after the constraints. The foreign keys were
validated against existing local rows; generated database types were
refreshed. Full local `pnpm db:test` passes 77 files / 2,749 assertions;
`pnpm db:lint` exits 0 with pre-existing warnings; full `pnpm validate`
exits 0 across contracts, types, progress, format, lint, TypeScript, coverage,
Chrome functional and Slice 09 real-route E2E, build, bundle, and local
performance smoke. The canonical overlap source, curator RPC, assignment
convergence, browser flow, and hosted proof remain open; Slice 12 stays 0/50.

**Continuation (2026-09-27, 18:07 UTC)**: Hardened the private CMS-03C-02
composition storage with forward-only, owner-bound foreign keys from each
instance to its revision, optional pattern version, and optional parent
instance. A new pgTAP suite first failed 5/9 checks because cross-owner
revision and pattern inserts succeeded, then passed 9/9 after the migration.
Generated database types were refreshed. Full local `pnpm db:test` passes 76
files / 2,736 assertions; `pnpm db:lint` exits 0 with pre-existing warnings;
full `pnpm validate` exits 0 with 723 Vitest files, 6,282 passing tests plus
one skip, 100% measured coverage, 103 Chrome functional E2E tests, five
Slice 09 real-route E2E tests, build, bundle, and local performance smoke.
This is a storage integrity prerequisite, not a CMS-03C-02 named mutation
RPC, pattern source, browser workflow, hosted proof, or accepted criterion;
Slice 12 remains 0/50.

**Continuation (2026-09-27, 17:36 UTC)**: Added the narrow CMS-11 latest-template
read support path for existing-version inspection: strict key/detail contracts,
forward-only private `cms_template_latest` RPC, owner and live-designer grant
checks, private-to-service-only execution, protected Worker GET and production
adapter, first-party Astro proxy, route registry, generated OpenAPI, and
red-to-green contract/route/adapter/proxy/pgTAP tests. It returns the current
editable definition with a matching strong ETag, no-store, and no owner or
renderer internals. Full local `pnpm db:test` passes 75 files / 2,727
assertions. Full `pnpm validate` exits 0: 723 Vitest files, 6,282 passing
tests plus one skip, 100% measured coverage, 103 Chrome functional E2E tests,
five real-route E2E tests, build, bundle, and local performance smoke. The
progressively locked BE03c/FE03 amendment is **not yet applied**: propagation
scan is written and owner confirmation requested. Existing-version edit UI,
real two-request HTTP 409/reconciliation proof, hosted acceptance, and other
CMS-03C operations remain open; Slice 12 remains 0/50.

**Continuation (2026-09-27, 16:29 UTC)**: Added the CMS-11 protected Astro
designer page at `/app/cms-content-modeling/templates/new` and a bounded
React create-draft island. The page renders no form on missing, denied,
rate-limited, or degraded template context; the island uses only the served
active-type/supported-block selectors, validates the exact create body,
preserves the fixed five-region spine, and submits through the first-party
same-origin proxy with CSRF and create-only idempotency. It never sends
`If-Match` for creation. Unknown network outcomes retain unsent values and
reuse the same idempotency key for an unchanged body; 409 remains a distinct
conflict, and only a verified 201 resource/ETag is announced as a **private
draft**. RED→GREEN unit, component, interaction, and route-structure tests
cover this increment; a real authenticated two-request conflict proof and
hosted CMS-11 acceptance remain open. Full local `pnpm validate` exits 0:
719 Vitest files, 6,243 passing tests plus one skip, 100% measured coverage,
103 Chrome E2E tests, five real-route E2E tests, build, bundle, and local
performance smoke. This does not close any of the 50 composite criteria.

**Continuation (2026-09-27, 15:38 UTC)**: Implemented the narrow protected
CMS-11 designer-context read path as a support route, without extending the
general auth session. A strict bounded selector contract, forward-only private
RPC, Worker GET, production RPC adapter, same-origin Astro proxy, route
registry, generated OpenAPI, and BE/FE contract amendments are in place.
The SQL RPC rechecks confirmed membership and current
`cms.template_designer` grant, returns only owned active compiled type IDs and
supported registered block keys, and grants execution only to the service
role; the browser has no direct table or RPC access. RED contract/pgTAP/route
tests turned GREEN. The new Worker route and production adapter now have 100%
targeted statement, branch, function, and line coverage. The protected read
does not grant later write authority; the POST rechecks everything. The CMS-11
form, two-request conflict proof, other 03c operations, hosted acceptance, and
the 50 composite criteria remain open. Full local `pnpm db:test` passes 74
files / 2,713 assertions. Fresh full `pnpm validate` exits 0: 714 Vitest
files, 6,231 passing tests plus one skip, 100% measured coverage, 103 Chrome
E2E tests, five real-route E2E tests, build, bundle, and performance smoke.

- [ ] Contract: lock Zod, data, registry, event, and route contracts
- [ ] `QA` RED: failing contract, permission, unit, integration, component, accessibility, and applicable E2E tests
- [ ] `BE` data, API, and policy implementation
- [ ] `FE` Astro SSR and bounded React-island implementation
- [ ] `QA` GREEN, adversarial verification, and canonical validation
- [ ] Documentation, runbooks, graph, feature ledger, and progress tracking

## Acceptance Criteria

- [ ] **P2-S12-AC-001** — Preserve reserved profile and provenance regions, block compatibility, audience and locale constraints, and accessibility contracts in templates. [Architecture §Phasing](../../../wiki/specs/2026-08-02-architecture-design.md#phasing); [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Contracts, Access Control, Edge Cases
- [ ] **P2-S12-AC-002** — Reject cyclic or over-limit composition trees and retain immutable reusable-pattern versions. [Architecture §Phasing](../../../wiki/specs/2026-08-02-architecture-design.md#phasing); [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Contracts, Access Control, Edge Cases
- [ ] **P2-S12-AC-003** — Keep taxonomy keys stable, hierarchies acyclic, merges survivor-directed, assignments convergent, and redirects intact. [Architecture §Phasing](../../../wiki/specs/2026-08-02-architecture-design.md#phasing); [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Contracts, Access Control, Edge Cases
- [ ] **P2-S12-AC-004** — CMS-03C-01: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03C-01 — CMS-11 — POST /api/v1/cms/templates/versions — TemplateVersionRequest → 201 TemplateVersionResource. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [ ] **P2-S12-AC-005** — CMS-03C-01: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [ ] **P2-S12-AC-006** — CMS-03C-01: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [ ] **P2-S12-AC-007** — CMS-03C-01: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [ ] **P2-S12-AC-008** — CMS-03C-01: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [ ] **P2-S12-AC-009** — CMS-03C-01: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [ ] **P2-S12-AC-010** — CMS-03C-02: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03C-02 — CMS-12 — POST /api/v1/cms/compositions/pattern-instances — PatternInstanceRequest → 201 CompositionInstanceResource. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [ ] **P2-S12-AC-011** — CMS-03C-02: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [ ] **P2-S12-AC-012** — CMS-03C-02: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [ ] **P2-S12-AC-013** — CMS-03C-02: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [ ] **P2-S12-AC-014** — CMS-03C-02: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [ ] **P2-S12-AC-015** — CMS-03C-02: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [ ] **P2-S12-AC-016** — CMS-03C-03: define strict Zod request, path, query, header, and success contracts and complete the declared happy path — CMS-03C-03 — CMS-14 — POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions — TaxonomyTermActionRequest → 200 TaxonomyTermResource. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [ ] **P2-S12-AC-017** — CMS-03C-03: reject unknown fields and every invalid request value with the exact stable field violation, safe message, and no state mutation. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [ ] **P2-S12-AC-018** — CMS-03C-03: derive actor and acting context server-side; enforce principal, capability, ownership, scope, and RLS with the specified 401, 403, and 404 boundary. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [ ] **P2-S12-AC-019** — CMS-03C-03: enforce declared idempotency, If-Match or CAS, duplicate, replay, pagination, cache, rate, deadline, and concurrency rules. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [ ] **P2-S12-AC-020** — CMS-03C-03: map every declared domain, dependency, timeout, rate, and internal failure to typed ApiError and preserve safe recovery. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [ ] **P2-S12-AC-021** — CMS-03C-03: commit audit and outbox effects atomically where applicable, reconcile lost responses without duplicate effects, and emit redacted telemetry. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§API Endpoints, Request/Response Contracts, Middleware & Policies, Error Handling and Failure Recovery, Verification and Test Strategy
- [ ] **P2-S12-AC-022** — Enforce CMS-03C-01: templateKey/version; key /^[a-z][a-z0-9-]{1,63}$/; version positive integer; pair never reused; 422/409. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Request/Response Contracts validation table at line 148
- [ ] **P2-S12-AC-023** — Enforce CMS-03C-01: compatibleTypeIds; 1–64 UUIDs, each active/allowlisted ContentTypeVersion family; 422. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Request/Response Contracts validation table at line 148
- [ ] **P2-S12-AC-024** — Enforce CMS-03C-01: slots/reservedRegions; strict JSON manifests; ≤64 slots, ≤32 reserved names; fixed Shard 02 Header→Now→Record→Detail/provenance regions immutable; 422. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Request/Response Contracts validation table at line 148
- [ ] **P2-S12-AC-025** — Enforce CMS-03C-01: bindings/locale/audience; strict binding manifest; BCP 47 locale; audience 1–64 safe chars; 422. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Request/Response Contracts validation table at line 148
- [ ] **P2-S12-AC-026** — Enforce CMS-03C-02: revisionId/patternId; UUIDs; revision/template draft readable and pattern immutable; 400/404. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Request/Response Contracts validation table at line 148
- [ ] **P2-S12-AC-027** — Enforce CMS-03C-02: patternVersion/linkMode; positive version; linked or detached only; 422. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Request/Response Contracts validation table at line 148
- [ ] **P2-S12-AC-028** — Enforce CMS-03C-02: slotPath/overrides; normalized path 1–512 chars; strict overrides max 64 keys/8 depth; 422. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Request/Response Contracts validation table at line 148
- [ ] **P2-S12-AC-029** — Enforce CMS-03C-02: graph; no cycles; max protected depth/nodes; all blocks registered and compatible; 409/422. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Request/Response Contracts validation table at line 148
- [ ] **P2-S12-AC-030** — Enforce CMS-03C-03: taxonomyId/action; UUID; action create, rename, alias, deprecate, merge; 400/422. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Request/Response Contracts validation table at line 148
- [ ] **P2-S12-AC-031** — Enforce CMS-03C-03: termKey/labels; stable key /^[a-z][a-z0-9-]{1,63}$/; 1–64 localized labels; NFC; 422. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Request/Response Contracts validation table at line 148
- [ ] **P2-S12-AC-032** — Enforce CMS-03C-03: survivorId/parentId; UUID or null; required for merge/specified hierarchy; cannot be self/cyclic/merged; 422/409. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Request/Response Contracts validation table at line 148
- [ ] **P2-S12-AC-033** — Enforce CMS-03C-04: entryId/locale/sourceRevisionId; UUID, BCP 47, UUID; source revision must exist and be readable; 400/404. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Request/Response Contracts validation table at line 148
- [ ] **P2-S12-AC-034** — Enforce CMS-03C-04: fields/fallbackChain; 1–128 field IDs/values; only localizable fields; ordered BCP 47 list ≤16, explicit no_fallback; 422. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Request/Response Contracts validation table at line 148
- [ ] **P2-S12-AC-035** — Enforce CMS-03C-04: sourceHash/expectedVersion; 64 lowercase hex; positive decimal version; 422/409. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Request/Response Contracts validation table at line 148
- [ ] **P2-S12-AC-036** — Enforce CMS-03C-05: pins/exclusions; pin UUID array ≤32, exclusion UUID array ≤64, de-duplicated; exclusions win; 422. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Request/Response Contracts validation table at line 148
- [ ] **P2-S12-AC-037** — Enforce CMS-03C-05: derivedRule; strict bounded rule or null; explainable key/version, no arbitrary query/expression; 422. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Request/Response Contracts validation table at line 148
- [ ] **P2-S12-AC-038** — Enforce CMS-03C-05: expectedVersion; positive decimal strong If-Match match; 400/409. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Request/Response Contracts validation table at line 148
- [ ] **P2-S12-AC-039** — Enforce All: headers/body; JSON, raw body ≤256 KiB, Idempotency-Key 8–128 printable ASCII, unknown keys reject; 400/415/422. [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §Request/Response Contracts validation table at line 148
- [ ] **P2-S12-AC-040** — CMS-11 Define template: given Actor holds the template designer capability, every referenced block version is registered and currently supported, and the target content types, locale/audience and reserved regions — including the Shard 02 fixed profile spine and provenance components — are declared and left intact., implement locked behavior and completion exactly. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Acceptance Criteria, Interactions, Contracts, Access Control, Edge Cases
- [ ] **P2-S12-AC-041** — CMS-11 Define template: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Acceptance Criteria, Interactions, Contracts, Access Control, Edge Cases
- [ ] **P2-S12-AC-042** — `CMS-11` Define template: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§Interaction Specification, Data Mapping, Navigation, Degradation, and Concurrency
- [ ] **P2-S12-AC-043** — CMS-12 Use reusable pattern: given Actor may edit the target entry revision or template draft, the referenced pattern version is immutable and readable, and the resulting block tree stays acyclic within the protected depth and count limits., implement locked behavior and completion exactly. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Acceptance Criteria, Interactions, Contracts, Access Control, Edge Cases
- [ ] **P2-S12-AC-044** — CMS-12 Use reusable pattern: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Acceptance Criteria, Interactions, Contracts, Access Control, Edge Cases
- [ ] **P2-S12-AC-045** — `CMS-12` Use reusable pattern: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§Interaction Specification, Data Mapping, Navigation, Degradation, and Concurrency
- [ ] **P2-S12-AC-046** — CMS-14 Govern taxonomy term: given Actor holds the taxonomy curator capability for that specific editorial vocabulary, the term key is stable and the proposed hierarchy stays acyclic, canonical-taxonomy overlap has been checked, and a merge names a survivor whose counterpart is not already merged., implement locked behavior and completion exactly. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Acceptance Criteria, Interactions, Contracts, Access Control, Edge Cases
- [ ] **P2-S12-AC-047** — CMS-14 Govern taxonomy term: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade. [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Acceptance Criteria, Interactions, Contracts, Access Control, Edge Cases
- [ ] **P2-S12-AC-048** — `CMS-14` Govern taxonomy term: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success. [FE03](../../../wiki/specs/fe/03-cms-content-modeling.md) §§Interaction Specification, Data Mapping, Navigation, Degradation, and Concurrency
- [ ] **P2-S12-AC-049** — Execute Contract → QA-RED → data, API, SSR and island implementation → QA-GREEN → refactor; retain failing-test evidence and run canonical validation. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md); [Architecture §Phasing](../../../wiki/specs/2026-08-02-architecture-design.md#phasing)
- [ ] **P2-S12-AC-050** — Update slice tracking, feature-ledger assignments, applicable runbooks, and architecture graph in the same change; leave no unresolved implementation boundary or undocumented drift. [Engineering Standards](../../../wiki/specs/ENGINEERING-STANDARDS.md); [Architecture §Phasing](../../../wiki/specs/2026-08-02-architecture-design.md#phasing)
- [ ] **P2-S12-AC-051** — Resolve a `no_fallback` field only from its own target-locale variant: it is never resolved through `fallbackChains` to `defaultLocale` or any other locale, and a missing target-locale value for a `no_fallback` field blocks publication of that locale and increments `cms_no_fallback_block_total` (DEC-121; received from Slice 09 AC005 and AC1166 under DEC-122, which own only the declaration and storage). [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§Middleware & Policies, Observability, Testing Strategy; [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Data Models, Edge Cases
- [ ] **P2-S12-AC-052** — Keep serving the last approved translation for a stale fallback-permitted locale field after its source changes (never resolving it through the fallback chain to the default locale and never blocking the locale), expose the stale state to editorial reads and `cms_locale_stale_total` until revalidation, and keep `no_fallback` fields blocking publication when their value is missing (DEC-121, DEC-122). [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§Middleware & Policies, Observability, Testing Strategy; [IA03](../../../wiki/specs/ia/03-cms-content-modeling.md) §§Data Models, Edge Cases
- [ ] **P2-S12-AC-053** — Author template versions that declare compatibility with an existing content-type id through CMS-03C-01 `compatibleTypeIds` and keep every template binding consistent afterwards: a successor that binds a template through CMS-03A-09 resolves it through the compatibility resolver against the exact candidate, refuses an absent template with 404, a template that does not list the type id with 422 and a pointer, and a withdrawn template with 409, and never alters an already-active definition hash (DEC-123; the flows beyond the first-successor binding mechanics that Slice 09 delivers, received under DEC-122). [BE03c](../../../wiki/specs/be/03c-composition-taxonomy-localization.md) §§Middleware & Policies, Observability, Testing Strategy; [BE03a](../../../wiki/specs/be/03a-content-schema-registry.md) §§Route Registry, Request/Response Contracts, Error Handling
