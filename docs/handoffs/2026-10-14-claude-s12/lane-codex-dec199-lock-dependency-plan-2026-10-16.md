# DEC-199 early-lock and dependency-receiving source plan

Date: 2026-10-16. Author: native `gpt-6.1-sol` / ultra,
`native_web_b_review_20261016`. Worktree:
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.

Status: source-only plan, persisted under the exact one-file S12 Dispatch claim.
All signatures and amendments below are **PROPOSED / UNRELEASED**. This is not a
SQL or TEST release, an executed migration, a passing runtime receipt, or an
acceptance/slice-completion claim. Root retains implementation/integration review.
The separate 440–444 provider lane does not establish publication linearization
or nested-event-to-review invalidation.

## Authority and verified boundaries

- `.memory/wiki/decisions.md:5336–5346` (DEC-199): live root/nested patterns must
  retain active state and the existing owner/compatibility graph rule; existing
  `nested_pattern_not_active` is the nested failure token. Nonnull canonical
  `detached_tree` validates its own blocks/digest, never its provenance pin;
  NULL-tree linked/legacy detached use remains live, including mixed use.
- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:1536`: the
  pattern provider's activity/content-hash/recomputed reachable digest contract,
  existing phase applicability and three existing reason tokens.
- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1721–1742`:
  positions 0 entry, 1 authority, 2 relation targets, 3 candidate/dependency graph,
  4 schema, 5 reviews; never acquire an earlier position after a later one.
  Rule 2 requires visibility before locking relation targets and a locked recheck.
- `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:1454–1475`:
  Slice 12 extends that order; pinned pattern rows precede schema/reviews, locks
  within a position are deterministic, and lock failures retain typed refusals.
- `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1778,1788`:
  manifest block identity/hash membership and frozen-set currentness; `1871–1880`:
  invalidation/cancellation, indexed source-event receiving, idempotency and
  500-review continuation. `2011` makes dependency history immutable.

The review used migration/adversarial-review methodology and direct source reads.
It did not execute project modules, SQL, parsers, formatters, tests, services,
network requests or Git operations. Memory supplied a review checklist only;
current source anchors below were checked directly.

## Eight proposed steps

### 1. Project canonical dependency identities without effects

Proposed private signature:

`platform_private.cms_revision_pattern_dependency_refs(uuid)`
`RETURNS TABLE(kind text, ref_id uuid)`.

Use `STABLE`, SECURITY INVOKER, CMS-definer ownership, empty `search_path` and no
PUBLIC/API execution grant. Select newest composition row per revision/path
**before** draft/active/pending eligibility, matching
`supabase/migrations-wip/dec193/20261016042300_cms_revision_effective_composition.sql:6–19`.

Return deduplicated exact root/nested PatternVersion row IDs for live/NULL-tree
uses, plus block-definition IDs reached by the whole live pin, canonical trees,
standalone rows and template slots. Canonical provenance contributes no live
pattern edge; mixed use still contributes the live edge. Do not filter pattern
refs by active state: the now-superseded pinned row must remain discoverable when
its successor's event is received. Missing/incompatible references remain
offenders for the evaluator, not silently omitted passes.

Existing primitives: `cms_pattern_nested_closure(uuid,jsonb)` returns exact nested
row IDs, including inactive pins and NULL for an unresolved pin
(`supabase/migrations/20261014020300_cms_pattern_graph_helpers.sql:25–54`).
The projection must not call the volatile locking digest helper at `:56–108`.

### 2. Lock that closure early, then re-read after waits

Proposed private signature:

`platform_private.cms_lock_revision_pattern_dependencies(uuid) RETURNS void`.

Use VOLATILE PL/pgSQL, SECURITY INVOKER, CMS ownership, empty `search_path`, no
PUBLIC/API execution. The caller must already hold its entry fence and earlier
authority/relation positions. Lock exact root/nested pattern rows deterministically,
then exact block-definition rows used by activity/digest/currentness checks, all
before schema/review locks. Re-read authoritative identities and state after any
wait; no stale pre-lock snapshot may decide acceptance. Preserve existing refusal
vocabulary and reject any offender regardless of diagnostic preference.

Actual conflicting producer boundaries:

- `supabase/migrations/20261014070400_cms_activate_governed_subject.sql:100–110`
  locks subject, prior active lineage row and graph before reviews.
- `supabase/migrations/20261014070000_cms_governed_activation_helpers.sql:17–44`
  takes the prior active pattern row `FOR UPDATE`.
- `supabase/migrations/20261003130400_cms_release_routes_human_forbidden.sql:185–215`
  locks a block definition `FOR UPDATE` before its lifecycle append.

The entry fence stabilizes which composition head identities the checker uses;
the graph locks stabilize mutable pattern/block lifecycle while acceptance commits.
Read-only digest/currentness helpers by themselves provide neither guarantee.

### 3. Amend all five relying callers before positions 4/5

| Caller | Exact promoted anchor before which earlier locks must be complete |
| --- | --- |
| `cms_submit_review(jsonb)` | `supabase/migrations/20261005017640_cms_submit_review.sql:182–185`, schema lock; rebuild at `:199`, evaluator at `:209` |
| `cms_schedule_publication(jsonb)` | `supabase/migrations/20261005017710_cms_schedule_publication.sql:202`, `cms_publication_lock_review`; status at `:235`, preflight at `:243` |
| `cms_publish_revision(jsonb)` | `supabase/migrations/20261005017720_cms_publish_revision.sql:175`, same review helper; status at `:188`, preflight at `:196` |
| `cms_execute_publication_schedule(jsonb)` | `supabase/migrations/20261005017740_cms_execute_publication_schedule.sql:158`, `cms_schedule_lock_review`; schedule lock at `:162`, status at `:185`, evaluator at `:199` |
| `cms_record_review_decision(jsonb)` | `supabase/migrations/20261005017630_cms_record_review_decision.sql:192–195`, schema lock; status at `:196`, review lock at `:214` |

The decision path currently has authority position 1 at `17630:163` but no earlier
entry fence. Add its concealed revision's entry `FOR SHARE` **before** that call,
not inside a helper invoked after authority/schema. Preserve scope/assignment
concealment before using a target as a lock lever. Recheck review/CAS under its
existing later lock.

Publication support is not already sufficient:
`supabase/migrations/20261005017700_cms_publication_command_support.sql:126–168`
takes entry/authority only; `:174–218` takes schema/review. Executor support
`supabase/migrations/20261005017740_cms_execute_publication_schedule.sql:41–73`
also starts at schema position 4. Preserve replay, CAS, committed stale refusals,
schedule lease rechecks, review invalidation and publication-lineage observation.

### 4. Keep relation position 2 and its separate receiving gap explicit

Proposed private person-based adapter:

`platform_private.cms_lock_revision_relation_targets(`
`revision_id uuid, person_id uuid, owner_id uuid) RETURNS void`.

Derive canonical targets; reuse the existing draft-read policy and uniform
unavailable behavior, visibility-before-lock and locked visibility/version
rechecks. Lock target entries in ascending UUID order, then the caller's target
assignments, after necessary standing authority is held at position 1 and before
pattern position 3. No new authority or client-supplied identity is introduced.

The existing `cms_lock_relation_target(uuid,uuid,uuid)` expects an **auth-user ID**
(`supabase/migrations/20261005016200_cms_relation_target_no_authority_rescan.sql:115–138`).
Execute's `schedule_row.created_by` is a **person ID** (`17740:156–157`); never pass
it as the auth-user operand. Existing publication authority requests only
publisher/reviewer capabilities (`17700:152–167`), so any author/editor standing
rows needed by target readability must be explicitly held earlier, not rescanned
after schema. The old actor-based readability contract is
`supabase/migrations/20261005011600_cms_relation_authoring_helpers.sql:236–270`.

Separate source gap: relation preflight currently checks target lifecycle/version
but not draft-read visibility (`supabase/migrations/20261005017570_cms_preflight_evaluation.sql:475–508`),
whereas locked BE03b `:1805` requires readability. This needs its own bounded
receiving correction/tests. Do not claim position 2 or complete publication
currentness cleared merely by adding pattern locks.

### 5. Receive nested and whole-live-pin block changes without manifest changes

Preserve `cms_review_dependency_refs(uuid,jsonb)` and its non-pattern behavior;
replace the manifest-root-only pattern arm at
`supabase/migrations/20261005017560_cms_dependency_manifest.sql:866–867` with
revision-aware live root/nested refs. Union whole-live-pin block refs with existing
block refs; preserve strict owner/version binding and deduplication. Submit already
uses this seam at `supabase/migrations/20261005017640_cms_submit_review.sql:263–267`.

Whole-pin sibling blocks are necessary: effective manifest composition blocks are
selected subtrees plus template allowed blocks (`dec193/20261016042400_cms_composition_dependency_manifest_dec193.sql:30–37`
and promoted `17560:186–223`), but the live pin's digest covers its full reachable
forest. Withdrawal of a block under an unplaced sibling can therefore stale the
pin without being named in the manifest's block group. Index it as a receiving
dependency; do not smuggle nested identities into the frozen manifest.

### 6. Backfill live reviews without changing immutable history

Plain `INSERT ... ON CONFLICT` is insufficient. The installed
`cms_review_dependency_guard()` takes a review share lock and permits inserts
only when state is `open` and version is 1
(`supabase/migrations/20261005017040_cms_editorial_review_dependencies.sql:53–75`).
It rejects approved and decision-advanced open reviews even with `app.cms_rpc`.

Proposed minimal existing-table route: guarded source amendment retaining that
original rule, plus a narrowly constrained allowance for **source-derived missing
pattern/block closure refs** on existing live reviews. Reject arbitrary refs and
unrelated kinds. Append missing refs idempotently with canonical owner/revision
proof and ordered fences; preserve each review's frozen data/state/version and
all existing dependency rows. Never disable guards, temporarily rewrite review
state, grant API writes, or update/delete immutable history. Preserve and restore
any migration-local CMS context exactly.

Old provenance-only dependency rows remain historical. Amend candidate selection
at `supabase/migrations/20261010164100_cms_dependency_recheck.sql:231–239` so legacy
pattern edges select a review only when its actual revision live closure still
uses that pin/lineage. Mixed use remains eligible. The projection used for this
test must not require the pin to remain active. Backfill and in-flight submission
interleavings need their own test; a one-time source scan is not proof of closure.

### 7. Preserve the real source-event/consumer/job path

Pattern activation/retirement events name a PatternVersion **row** as aggregate
and `patternVersionId`, plus lineage `patternId`
(`supabase/migrations/20261014070200_cms_governed_activation_core.sql:109–135`;
`20261014160100_cms_governed_retire_apply.sql:98–106`). Block events name exact
`blockDefinitionVersionId` (`20261003130400_cms_release_routes_human_forbidden.sql:216–223`).

The real resolver maps those members to `pattern`/`block` refs
(`supabase/migrations/20261010164100_cms_dependency_recheck.sql:126–145`). Its
`:80–85` lineage expansion lets a successor's event find predecessor row refs.
Worker source consumers reread the committed event and enqueue
`{ eventId, kind, refId }`
(`apps/worker/src/cms-editorial/review-recheck/source-consumers.ts:124–157`).
The job sends that tuple plus cursor to the RPC and enqueues continuation before
acknowledgement (`apps/worker/src/cms-editorial/review-recheck/job.ts:131–148`).
Keep these transport contracts, exact event IDs, bounded 500 selection, correlation
and idempotent invalidation semantics. No new event family or manifest shape is
needed. Existing service-only wrappers/grants remain unchanged.

### 8. Prove real races, receiving and full effects before acceptance

Minimum real concurrent matrix, with deterministic held-lock/barrier observations
and bounded deadlines rather than sleeps or mocked verdicts:

| Boundary | Both required commit orders / controls |
| --- | --- |
| Nested supersession versus each of submit, decision, schedule, publish and execute | Ten scenarios: change commits before caller locks; caller holds closure locks first and change genuinely waits |
| Root retirement versus publish | Both orders, with currentness's exact root row identity observed |
| Block withdrawal versus publish | Both orders, using the real guarded lifecycle producer and held definition row |
| Composition head replacement versus decision | Entry fence stabilizes newest-row identity; latest retired head hides history |
| Position 2 versus later graph/schema locks | Visible target version/assignment changes observed; hidden targets are not lock levers; deterministic multi-target ordering |
| Canonical-only and mixed use | Canonical provenance does not wait on/reopen nested pins; mixed use still locks and validates live closure |

Change-first outcomes must retain each caller's existing contract: submit
preflight refusal, decision committed invalidation, schedule/publish stale-set
refusal, execute typed blocked result. Caller-first must commit before the change
proceeds; later receiving invalidates surviving live reviews without rewriting
already committed publication history. Assert whole durable images: review,
decision, schedules/leases/cancellation, publication lineage, audit/outbox,
idempotency and retryability. No raw deadlock/lock-error leakage or partial effects.

Receiving matrix: transitive nested activation; unplaced-sibling withdrawal;
canonical-only exclusion; mixed use; existing approved and advanced-open backfill;
forged/unrelated-ref rejection; immutable-history preservation; repeated/concurrent
delivery; actual resolver-to-source-consumer-to-job receiving; 501 eligible reviews
with deterministic continuation and no skipped/duplicate invalidation. Check
in-flight old submission versus backfill. Preserve all original unrelated refs.

Incompatible-active historical fixtures remain unproved where current governed
producers cannot lawfully create them; do not fabricate active state or bypass
guards. Read-only SQL unit tests do not prove actual RPC isolation or these races.

## Amendment and release gates

Use new forward WIPs only after exact path claims, TEST release and genuine RED.
Every existing-function source amendment must require unique complete old anchors,
new-anchor absence, reversible inverse full-source equality, unchanged function
OID/full `pg_proc` attributes/comment/ACL and unchanged non-anchor bytes. Test
prepared/cached callers after DDL invalidation. No wholesale oversized function
copies, new exports or API rights. Keep new helper units within normal file limits.

The precise path split for this follow-up remains for root's separate claim;
445+ numbering is not an implementation authorization in this report. The separate
440–444 work does not waive early-lock, receiving, backfill or real-race gates.
