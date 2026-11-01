# DEC-202 entry-create lock-order RED plan

Status: source-only design, UNRUN. Only this new report is authored. Existing 76-case QA, migrations, race helpers and all other sources remain frozen. No parser, formatter, tests, database, Docker, Git, network or application runtime was invoked. Proposed test paths below require a new root claim/release before authoring.

## Contract and current receiving boundary

- DEC-202: `.memory/wiki/decisions.md:5332–5334` requires the exact authorized active schema default, NULL preservation, completed replay before dependency revalidation and relation2/dependency3/schema4 fencing.
- BE03b `.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1723–1729` preserves author/editor authority and public shape; `1726–1727` requires same-owner default precheck, lock order and post-wait rederivation. The global table at `1733–1748` requires complete ascending-UUID relation targets and caller assignments at2, exact default FOR SHARE at3, schema FOR SHARE at4, and visibility/authority rechecks.
- `.memory/pipeline/progress/slices/phase-02-slice-12.md:3318`, AC294, includes those obligations plus no invisible/foreign lock lever. The two cases proposed here prove only the bounded positive ordering, not all AC294.
- Executed `supabase/migrations/20261005018040_cms_create_entry_derived_state.sql:57–79` resolves authority/reservation/replay; `107–121` resolves then share-locks schema; only later `248–257` resolves relations. The insert at `330–339` still supplies SQL NULL for the template. These are concrete receiving defects, not a proposed request operand.
- `supabase/migrations/20261005012100_cms_write_path_lock_helpers.sql:408–431` sorts targets, prechecks visibility, locks and rechecks. Final target locking is `20261005016200_cms_relation_target_no_authority_rescan.sql:115–142`: target row, then caller assignments. That file's `19–52` locks the resolved person's author/editor assignments in assignment-ID order, not identity authority rows again.

## Proposed exact test write set

Four NEW files under `supabase/tests/phase_02_slice_12_entry_default_template_lock/`:

1. `000-world.sqlinc`: genuine governed fixture setup, asserted premises and final manifest; no COMMIT inside the fragment. Target <=300 lines.
2. `020-race.mjs`: Node test runner with two independent order cases and one prerequisite unblocked control. Target <=400 lines.
3. `030-race-fixture.mjs`: approved include expansion, premise validation, public request/outcome capture, literal row/image probes and fixture manifest. Target <=300 lines.
4. `040-race-session.mjs`: narrow persistent psql clients, exact ALT/run gate and owned cancellation/drain/rollback. Target <=300 lines.

No existing file, package script, server, trigger, provider, migration or 76-case assertion needs modification. Four focused paths avoid copying the large race kit or coupling a new test to the restore runner's release flag. The established Session implementation is a source pattern, not a reason to enable the old runner.

## Real fixture authority, not guarded activation

Reuse the existing SQL helper sources loaded by `supabase/tests/phase_02_slice_12_entry_default_template.sql:5–14`, plus `phase_02_slice_09_dec108/03-support.sqlinc` for the real field-add request shape. Restate the narrow fixture sequence in the new world; do not extract/modify portions of the frozen test at runtime.

1. Use the real owner/reviewer actor chain: `phase_02_slice_09_dec108/01-actors.sqlinc:25–56,92–117` provisions test Auth identities, calls auth_bootstrap and initialize_cms_owner, and obtains actual identity_context_bind bindings. Retain its explicit labels for unrelated legacy membership/negative-control setup; do not claim those are production producers.
2. Grant owner cms.author and cms.template_designer through the actual grant command as the 76-case QA does at `16–19`; retain independently authenticated reviewers and their real assignment/decision commands. Persist actual actor/auth/person/organization/binding IDs in the manifest.
3. Produce a separate genuine active no-default target type through s09d_create_type/to_active, as frozen QA `23–25,90–98` does. Create its target entry through actual `platform_api.cms_create_entry` as the owner author. Its automatically created caller assignment is the relation's real visibility authority; no entry/revision/assignment INSERT seam is necessary.
4. Create the source type as a draft. Add one optional relation field through cms_add_field_definition, then bind it through cms_bind_relation before the real activation chain. `03-support.sqlinc:28–53,95–115` supplies existing mutation/CAS patterns, but its domain/profile binding must NOT be reused unchanged. Use content targetKind, the exact target type's real type_key, registered projection cms.article.card, many/min0/max1/ordered/onUnavailable omit. The content relation shape is source-backed by `phase_02_slice_10_relation_authoring/000-relation-fixture.sqlinc:56–64`; copy only that request shape, never its activation/evidence replacement at `90–121`.
5. Govern the source base, mint/submit/assign/approve/activate compatible T1 with literal main/maxCount7, then produce and govern a source successor with default T1 and explicit empty bindings, following frozen QA `34–104`. The source population is genuinely empty; the independently created target belongs to another type. Final source field/RelationDefinition IDs come from the actual successor, not stale base definition IDs.
6. Assert every producer/worker/review/activation outcome and actual active/schema-artifact/default/owner/compatibility row, T1's literal slots and empty bindings. Also assert actual target lifecycle/version, exact creator assignment, resolved human binding and current visibility through the real helpers. A failed premise aborts setup before COMMIT and is not meaningful lock RED.

Do NOT call restore race `prepare()`/race-kit `buildFixture()`: the latter imports the guarded S10 active relation/evidence fixture (`infra/database-races/race-kit.mjs:255–287,344–363`). Do NOT use seedArticleTarget's raw storage writes at `687–701`. This new harness requires governed evidence and an actual public target create instead.

The bootstrap client stays open until Node validates all emitted setup outcomes and the manifest; only then COMMIT the genuine fixture so independent clients can see it. Record the manifest immediately in root's captured receipt. It includes source type/version/artifact, exact default T1, final title/relation stable IDs and definition IDs, target entry/assignment and actual request evidence/context. No secret is printed.

## Public caller and prerequisite control

Construct the exact strict public create body from actual stored artifact/activation/policy evidence and independent literal values: title plus `{targets:[{targetId: TARGET}]}` under the relation's stable field ID. Use a unique key per control/case. No template operand, expectedVersion or If-Match is introduced.

Mirror frozen QA `116–170`: select the real actor and real binding through the existing SQL transport seam, clear per-request verified session caches as s09d_session does (`00-helpers.sqlinc:116–132`), then `SET LOCAL ROLE service_role` and call actual `platform_api.cms_create_entry`. Never prepopulate trusted app.cms_session_actor/app.cms_session_party or substitute actor, authority, compatibility or workflow-policy helpers. This proves public SQL service-role behavior, not HTTP/JWT gateway or Worker transport.

Before either case, an unblocked control must succeed with the same governed source/target evidence and actual caller. Assert unchanged strict resource shape, exact source schema, first revision/creator assignment, independent literal title/hash and normalized relation tuple `(stableField, content, TARGET, NULL, position0, omit)`. Record the current template pin, but do not require the still-unimplemented T1 pin as a prerequisite to reaching the lock-order RED. The frozen 76-case suite retains that pin oracle unchanged. Roll back this control and prove complete store images restored.

## Case A — held relation position2 precedes exact default3 and schema4

1. Open holder H; BEGIN and SELECT the exact target ContentEntry row FOR UPDATE. Save returned id, tableoid and ctid; require exactly one actual target row. H acquires no authority, template or schema row lock and changes no row.
2. Observer O proves the exact target query FOR UPDATE NOWAIT fails55P03, while exact source schema and exact T1 queries are initially free. Every probe uses its own BEGIN/ROLLBACK so O retains no lock.
3. Start C's real authorized public create in a still-open transaction. Observe H.pid in pg_blocking_pids(C.pid), matching both exact nonce application names/database and pending C work. Reconfirm exact target NOWAIT55P03. This is the synchronization barrier, not elapsed time or wait_event alone.
4. While that exact edge remains, probe exact T1 FOR UPDATE NOWAIT and exact source ContentTypeVersion FOR UPDATE NOWAIT; both must be free. Recheck the edge before H is released. This detects both forbidden3→2 and4→2 orderings.
5. Roll back H, bounded-await C, assert real success and exact relation/schema/derived T1 stored pin, then roll back C. Capture all evidence before raising an order assertion so cleanup and image equality still run on RED.

Prediction against executed18040: the actual target edge is reached, but schema NOWAIT returns55P03 because line121 already share-locked4. With valid premises, that is meaningful order RED. A missing edge caused only by timeout or an unexpected early error is not that proof.

## Case B — held exact default position3 precedes schema4

1. Fresh request/caller C; H BEGINs and locks only exact same-owner T1 FOR UPDATE, saving id/tableoid/ctid. O verifies T1 NOWAIT55P03 and initial target/schema freedom.
2. Start actual create. A bounded observer returns one classified outcome: exact C→H blocking edge, or verified completion of C's public call. A deadline without either is harness failure, never passing evidence.
3. Correct waiting branch: prove the exact default edge and T1 NOWAIT55P03, then target NOWAIT55P03 (C acquired2) and source schema NOWAIT free (C has not acquired4). Recheck the edge, then release H, await success, inspect exact stored pin/schema/relation, and roll back C.
4. Early-completion branch: capture the real service-role result, exact stored first revision/schema/relation and held T1 witness while C's transaction remains open. A successful create crossed the held required default without fencing it: fail the behavioral expectation to wait, also record schema NOWAIT. Do not misclassify this deterministic skip as an unobserved-barrier setup abort. Unexpected refusal is a separately diagnosed premise/command failure.

Prediction against hard-NULL18040: create may complete successfully without waiting on T1 and keep schema4 locked; either the verified skip or a proven default-edge-with-schema-held is meaningful RED. Do not assume a template wait which the current body never performs.

## Barrier, lifetime and rollback discipline

Use the proven owned-PID/application-name identity and exact-row NOWAIT approach from restore relation `030-race-fixture.mjs:174–232`, with its `020-race.mjs:264–320` target-before-schema pattern. An exact holder row query plus isolated H and observed pg_blocking_pids edge is the row-key proof; PostgreSQL need not expose every held row lock as a pg_locks tuple entry. Never substitute a plain lock wait_event or a passed sleep.

Follow `040-race-session.mjs:36–52,122–137,139–239`: one pending command per persistent client, bounded statement/idle/client deadlines, tracked work rejection handlers, PID+nonce+database-constrained cancellation, drain pending work, rollback owned sessions, close/await owned children, aggregate cleanup errors. Timers bound synchronization only. Do not drop fixtures, reset, finish a test or leave a detached create running before all owned work has drained.

New gate requires explicit RUN_S12_ENTRY_DEFAULT_TEMPLATE_LOCK_RACE=1, explicit exact supabase_db_wejammin_ev selection and independent matching confirm value; no primary/default fallback, API startup or automatic reset. Root must hold all four existing locks (supabase-ci, quiet shared, altdb, reset) and verify the staged source hashes before any runtime.

Before/after every rolled-back control/case, compare the complete durable CMS store inventory and ordered full-row digests, plus idempotency, audit and outbox. Existing image-only helper `000-fixture.sqlinc:39–69` supports NULL target to exclude nothing; adapt only the image utility, not its guarded setup. Include full target/assignment/source schema/template rows, preserve timestamps, and require identical inventory and hashes. Observer/holder probes must produce no durable effects. After the committed governed fixture, root performs its separately owned fresh ALT reset/re-stage after EVERY run, including failure; the harness never deletes immutable history or resets itself.

## Explicit follow-up gaps — not covered by two order cases

- Caller-first fence: leave a successful create uncommitted; separate guarded target-lifecycle and actual caller-assignment mutation sessions must each block behind that caller, then resume only after its transaction ends. Restore `020-race.mjs:325–376` is the proven shape. This is a lock proof, not a claim that a guarded assignment mutation is a public revoke producer.
- Revocation-first/recheck: hold the exact target or caller assignment, start create, prove the exact edge, commit the legitimate guarded assignment revocation, then require the existing uniform VALIDATION_FAILED field pointer and zero effects. Prove target visibility lost while source author authority remains. No late authority-row rescan is permitted; final162's assignment-only helper is authoritative.
- Complete union/ascending UUID across multiple relation fields, including reversed input order and overlap; one positive target cannot prove it.
- Unreadable target and concealed/foreign default held-lock negative controls must refuse without becoming lock levers. Authority/grant/tenure revocation and default withdrawal/schema-activation post-wait rechecks need their own correctly ordered actual/labelled mutation controls.
- Exact completed replay under held/withdrawn dependencies, typed lock/deadlock failures and atomic injected-fault recovery remain separate receiving requirements.

These follow-ups need separately released tests before claiming AC294 or DEC-202 concurrency complete. This report proposes no production implementation, contract shape or new product policy; all RED predictions remain UNRUN until root observes them.
