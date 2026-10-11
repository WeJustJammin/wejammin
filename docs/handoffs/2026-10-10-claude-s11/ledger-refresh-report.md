# Slice 11 evidence-ledger refresh (2026-10-11)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`, HEAD `813fcafdf0aa91b80b9c8b502ceea59bc4be3ea8`
(the four fragments were filled at `618ec5c1`; 20 commits and 456 files have landed since). Nothing was executed: no test, `pnpm`, `node`, `vitest`,
database or git state change. Only the four fragments and this report were written.

Files written:

- `tests/contracts/phase-02-slice-11-evidence-ledger-001-034.ts`
- `tests/contracts/phase-02-slice-11-evidence-ledger-035-066.ts`
- `tests/contracts/phase-02-slice-11-evidence-ledger-067-100.ts`
- `tests/contracts/phase-02-slice-11-evidence-ledger-101-122.ts`
- `docs/handoffs/2026-10-10-claude-s11/ledger-refresh-report.md`

## Method (read-only, scripted outside the repository)

1. Parsed the four fragments and re-emitted them with a prettier-style emitter. Before any edit the emitter reproduced all four files byte for byte
   (so the edited files are formatted as `prettier --write` would; run it anyway, the emitter could not be checked against prettier itself).
2. Extracted the identity of every test of every cited file from the current tree: vitest titles (describe nesting by indentation, `it.each` and template
   titles as patterns), pgTAP descriptions (whole SQL string literals with whitespace collapsed, `\ir` closure walked: each cited description is a whole
   literal of exactly one file of its entrypoint closure and occurs once), race `check(...)` labels.
3. Re-resolved every citation, diffed every cited file against `618ec5c1` (hunk-level for the pgTAP and static vitest citations) and read the bodies of
   every test I added.
4. Replica of the guard's static rules over the result: clause tiling, status/limitation rules, citation shape (path grammar, extension per tool,
   trimmed single-line title), no duplicate in a clause, sole-proof limit (maximum observed: one citation is the sole proof of clauses of 2 criteria),
   no `skip`/`todo`/`fails`/`xit` and no duplicate static title (or pgTAP description literal that is a test description) in any cited file. `text` is byte-identical to the tracker for all 122 criteria and the
   order equals the tracker order.

## Final counts

| Status | Before (`618ec5c1`) | Now |
| --- | --- | --- |
| verified | 85 | **113** |
| partial | 35 | **7** (AC-041, 050, 053, 056, 071, 090, 106) |
| unverified | 2 | **2** (AC-044, 045) |

3,498 citations: 1,816 vitest, 1,591 pgTAP, 82 race, 9 Playwright (before: 3,113).

## Citations that no longer existed (re-resolved)

26 static citations and 6 race citations pointed at titles that were renamed or removed by the fix lanes. Each was replaced by the test that now proves the
same clause (the guard would otherwise report "no receipt"):

- `rpc_publication_{publish,schedule}_refusals.sql`: "stale frozen manifest returns the committed-refusal envelope ... carrying only the CURRENT
  dependencyHash" is now `... {kind, reasonCode version_set_stale, details {}} (BE03b E1 ...)`; the lapsed-approver title became four (`is found lazily`,
  `the reviewer-authority invalidation COMMITTED`, `the reservation is completed ... 422`, `an exact replay returns the same committed refusal`); "the
  invalidation committed ..." gained `with the reason dependency_changed`. Applied in AC-004, 021, 033, 034, 038, 041, 042, 090, 096, 112.
- `phase-02-slice-11-publish.apispec.ts`: the stale-manifest test is now "409 version_set_stale for the browser" (AC-004, 032, 033, 034, 041, 090).
- `rpc_publication_execute_refusals.sql`: the combined absent/failed/stale/bound-proof test split into "absent proof and a failed checker run" (AC-080, 083,
  097) and "stale ... proof ... typed conflict preflight_evidence_stale" plus "consumes no retry state" (AC-080).
- `rpc_publication_evidence_audit.sql` and `rpc_review_evidence_audit.sql` (AC-034, 101): the "joins by correlation id" titles became "keyed to the exact audit event".
- Races: `014` "E2: ..." became E2a/E2b/E3 labels (AC-032, 034); `016` L1/L2 labels were rewritten (AC-032, 034, 042, 115). Interpolated labels were not cited.
- One citation was dropped, not replaced: `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/workflow-route.test.tsx` (AC-054 clause 0). The guard's path
  grammar `[A-Za-z0-9_.@+/-]` rejects the brackets; the clause keeps its three other citations.

Drift check: the other cited tests in modified files were checked at hunk level; their bodies are unchanged apart from additive tests, fixture signatures
and the intended renames (the `a11y-structural` rule tests only gained nested-property cases; `cms-editorial-principals.test.ts` only gained cases).

## Criteria whose status changed

partial -> verified (28). Every uncited clause now has a condition-producing test that asserts the named outcome:

| AC | New evidence | Why it proves the clause |
| --- | --- | --- |
| 004 | `phase_02_slice_11_criteria_publish_gates.sql` | drives `cms_publish_revision` and the executor with each remaining gate failing (template, block, relation, route, locale, privacy, settings, schema) and asserts the exact refusal and the 14-table effect digest |
| 016, 022, 034 | `workflow-telemetry-redaction.test.ts` | the real route emits one event per scenario; closed members, closed metric families, published code and no id/reason/instant/hash/PII/upstream text, success and refusals, for CMS-03B-06/-07/-09 |
| 035, 038 | `phase-02-slice-11-feature-ledger.test.ts` | the BE03b ledger pointer (25.02.03, 25.02.04) is asserted against the tracker, BE03b ownership, the feature ledger, the Phase 2 plan and the route registry. Neither text has a clause the DEC-155 defects make unprovable (the weaker wording is satisfied by the stronger shipped rule) |
| 037, 040, 043 | `cms-workflow-focus-forms.test.tsx`, `CmsEditorialWorkflowIsland.focus.test.tsx`, `CmsEditorialReviewDetailIsland.focus.test.tsx`, `CmsEditorialScheduleForm.focus.test.tsx` | focus stays on the activated control while the command is in flight and through a lost/unverified read; only the named heading, the refusal alert or the local-error summary take it |
| 052 | `workflow-read-etag.test.ts` | the ETag moves for a schedule or publication version/state/projection change and not for key order or request id |
| 054 | island focus test | focus survives a reconciling refetch, verified then degraded |
| 060 | `route-heading-focus-install.test.ts`, `review-detail-route.test.tsx`, detail-island focus tests | the install script focuses the heading on navigation only (first load, fragment, `preventScroll`), and the review route uses that shell |
| 072 | detail-island focus tests, forms tests | focus returns to the assignments heading after an assign and after a revoke commit |
| 073 | `phase-02-slice-11-preview-verifier-seam.test.ts` | request/result/timings parsed from the BE04c seam row and compared member by member |
| 080 | `execute_refusals.sql` (4 forged-mismatch tests + effects) | version, dependency hash, activation-evidence hash and frozen hash each differing block the schedule `approval_invalidated` with no lineage row or event |
| 082 | `cms-publication-schedule-sweep-deadline.test.ts` | a hung claim/execute is aborted at exactly 15,000 ms; each call has its own deadline |
| 087 | `criteria_manifest_rls.sql` | the builder is a non-BYPASSRLS definer; without the CMS RPC context it answers NOT_FOUND; one builder, one input |
| 092 | race `030-settings-snapshot-race.mjs` (static labels L1/L2/L4) | the first writer holds the owner advisory lock, the second waits on that key, nothing is inserted meanwhile |
| 098 | `purity.test.ts`, `gate-isolation.test.ts`, `registry.test.ts` | no network/DOM/Browser Rendering name or import; gate runs with those globals trapped; `cms.entry_revision` target, one current version per target type, older versions readable |
| 103 | `criteria_schedule_tzdb_tag.sql` | stored tag and instant are immutable, tag grammar CHECK refusals, a schedule accepted under an older pin keeps its tag and still executes |
| 108 | `criteria_decision_order.sql` | one test per adjacent pair of the order (concealment, state, CAS, rebuild, separation/duplicate, grant) |
| 112 | `criteria_invalidation_states.sql` | archived, deletion_pending and held each yield `entry_unavailable` for review, schedule and token |
| 113 | recheck pgTAP files, `review-recheck/*.test.ts`, `review-recheck.test.ts`, `phase-02-slice-11-recheck.apispec.ts`, race `031` | six consumers enqueue `{eventId, kind, refId}`, selection through the index, rebuild/invalidate on inequality or non-current identity, idempotence, 500 per run with cursor |
| 116 | `projection_state.sql`, `projection_state_reads.sql` | pending/converged/degraded read per row id from `projection_consumer_state`; canonical lineage never rolled back |
| 118 | `preview_takedown.sql`, `phase-02-slice-11-preview-takedown.apispec.ts` | `service_role`-only RPC, CAS revocation, composition with mint and verify |
| 119, 120, 121 | `criteria_assignment_revoke.sql`, `criteria_review_ranges.sql`, `criteria_decision_snapshot_time.sql` | `updated_at` must advance on revoke (real defect fixed by the lane); 1-to-8 and non-empty `required_capabilities`; `updated_at = created_at` |

Strengthened only (status unchanged, verified): AC-015, 021, 033 (a real 500 per operation from the redaction suite), AC-069 (ended owner tenure), AC-086 (sealed
state-filtered history cursor does not disclose the concealed scan tail), AC-093 (version-2 row of each provider), AC-100 (render-plan vectors and order),
AC-113 clauses 0 and 1 (`recheck_index.sql`).

## Remaining non-verified entries and exactly what is missing

- **AC-041 (partial).** The criterion text is cut inside a word: "a preflight rerun against current revocation sta" (DEC-155). The clause was split in two:
  "and a preflight rerun against current revocation" is cited (publish-phase lazy-lapse tests, 17-entry refusal, publish-preflight API tests) and the tail `sta` is
  uncited. Missing: the owner's DEC-155 wording ruling; then restate the clause and the entry becomes verified. The BE03b ledger 25.03.04 pointer is now cited.
- **AC-050, 053, 056 (partial).** Clause "refuses a response as a 422 response-contract failure" (AC-053: "a response-bound failure (422)"). The breach tests
  (`workflow-read-breach-{workflow,review}.test.ts`, cited under the "when ..." clauses of AC-050 and AC-056) assert the Worker refuses every breach unserved but with
  status 502 through the single token `RESPONSE_BOUND_STATUS`. Missing: the owner's 422-versus-502 ruling; then either amend the text or flip that token and map the
  breach to 422 in `registerWorkflowRead`. AC-053 additionally notes that its 500/502/504 envelope tests are the shared per-row tests, not a dedicated CMS-03B-15 case.
- **AC-071 (partial).** "retries the review event idempotently": no test redelivers a `cms.entry.review-changed.v1` outbox event. Needs a pgTAP or consumer-seam test that
  delivers the same event id twice with one effect; there is no review-changed consumer in Slice 11, so decide what the consumer seam is first. Size S once decided.
- **AC-090 (partial).** The clause was split into "... (CMS-03B-07, CMS-03B-09" (cited: both commands return the committed 409 `version_set_stale` and invalidate the review
  `dependency_changed`) and "the executor) and finds ... returns 409 `CONFLICT` `version_set_stale`" (uncited). The executor's result type has no 409: it blocks the schedule
  `approval_invalidated` and invalidates the review `dependency_changed` (cited under the last clause). Missing: an owner wording ruling that the executor form satisfies the
  clause (or a 409 form for the executor).
- **AC-106 (partial).** "stays within the bundle-budget thresholds": the only gate is `pnpm bundle:check` (a build script, not a citable test); no test measures the built
  `contracts-time-authority` chunk. Missing: a vitest over the built chunk and initial route against `BUNDLE_BUDGETS`, or an owner ruling that the build gate is the proof.
  The gap, fold, `UTC` and three-segment clause is now cited.
- **AC-044, 045 (unverified).** Process and tracking criteria, provable only at slice close (canonical validation run, retained RED receipts, same-change tracker/runbook/graph
  update, no unresolved boundary or drift). The feature-ledger assignment part of AC-045 is now machine-checked (cited under AC-035/038/041). One boundary is open by design:
  `projection_consumer_state.projection_id` has no foreign key until the delivery slice; its tracking issue is not yet opened.

## Judgement calls the refutation review should look at first

1. **AC-116 is verified** against the lane's mapping (`converged` = every one of the eight consumers' newest row is `active|superseded|revoked`; `degraded` = a newest row
   `blocked`; row id = the publication version row). The criterion does not pin "reports"; the mapping still needs the DEC the preview-projection lane asked for.
2. **AC-035 and AC-038 are verified**; the DEC-155 punctuation and E6/E11 lag do not make any of their clauses unprovable (the shipped rules are stronger than the wording).
3. **AC-090 and AC-041 clause splits** (above) are deliberate: they leave the unprovable literal part uncited instead of citing an adjacent proof.
4. **AC-092** is proven by the race runner with `cms_publication_settings_effective_values` replaced by a stand-in so two first writes can differ; the writers, the tail, the
   lock and the ordinal allocation are production code.
5. Interpolated race labels (010 A5/A6/A7 outcomes, 014/016 outcome lines, 030/031 outcome lines) are not stable ids and are not cited.

## Citations I could not resolve exactly

None is unresolved. Titles of tests generated by `describe.each`/`it.each`/template titles cannot be matched statically against an executed list, so they were built by
hand with the vitest 4.1.11 `formatTitle` rules (`$prop` renders the value as a loupe string: single-quoted and cut to 38 characters plus `…`; `%s` renders raw) and checked
against the source. If a collector run reports "no receipt", fix these first:

- `workflow-telemetry-redaction.test.ts`: `'CMS-03B-06' telemetry redaction logs only closed labels for 'an approval'` (and `'a rejection'`, `'a stale MFA'`,
  `'a separation_of_duties refusal'`, `'an unavailable dependency'`, `'an internal failure'`; likewise for `'CMS-03B-07'` and `'CMS-03B-09'`) plus the two
  `keeps the entry hash ...` / `logs no entry hash ...` titles per operation.
- `cms-workflow-focus-forms.test.tsx`: `'Submit for review' [P2-S11-AC-037] Submit for review keeps focus ...` (seven forms, three titles each; the title repeats the form name
  once quoted, once raw).
- `phase-02-slice-11-feature-ledger.test.ts`: `[P2-S11-AC-035] [P2-S11-AC-038] [P2-S11-AC-041] the BE03b feature-ledger pointers 'P2-S11-AC-035' points at BE03b ledger '25.02.03' ...`
  and `... the feature ledger assigns '25.02.03' to P2-S11`.
- `source-consumers.test.ts`: `[P2-S11-AC-113] the six consumers of the review recheck source events cms.schema.activated.v1: rereads ...` (six event types).
- `workflow-read-breach-workflow.test.ts` and `-review.test.ts`: `... never served [P2-S11-AC-050] [P2-S11-AC-053] refuses <name>` (`%s` of the breach name).
- Older generated titles in unchanged files (`workflow-command-admission/-quota.test.ts`, `cms-editorial-production-*.test.ts`, `catalog.test.ts`, ...) were checked by the
  earlier lanes and their files have not changed since `618ec5c1`.

## Things the orchestrator still has to do

- Add `tests/contracts/phase-02-slice-11-evidence-guard.test.ts`, then `node scripts/evidence/run-slice-evidence.mjs --slice 11` (the guard also needs every test of every cited
  file to pass: the cited-file rule rejects any failing or duplicated test of a cited file).
- `phase_02_slice_11_recheck_run.sql` is cited (AC-113); its flaky test 47 was fixed in `813fcafd`. The cited-file rule needs every test of the file green, so confirm that on the first run.
- Run `pnpm exec prettier --write` on the four fragments.
