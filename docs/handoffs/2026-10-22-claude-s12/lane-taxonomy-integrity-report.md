# Lane claude_s12_taxonomy_integrity report

## Status

GREEN (V12 verification follow-ups closed 2026-10-28; HEAD cd89d54c). Final run (lean, combined stack taxonomy-integrity + node-pointers + nestable-read + placement-perf, 19 WIP migrations): my five
entrypoints + review V12's 41 files + the 8 corrected-oracle copies = 54 files / 5935 tests, exit 0 (TAP `alt-staged-taxonomy-integrity+node-pointers+nestable-read+placement-perf-005223-700981.tap`).
The two-session lock proof (`..._concurrency.sql`) is 18/18. See `## V12 verification follow-ups` (the earlier `## V12 follow-ups` section is kept; where they differ the later one wins).

## Scope

DEC-141 receiving obligations 1 (resolver, comparison, restore pin check), 3 (restore carry of term assignments), 5 (taxonomy encoder) and
provider `cms.taxonomy.assignment_integrity` v1: AC-221 (assignment clause), AC-224 (not newly assignable), AC-239, AC-241 (taxonomy), AC-242, AC-244, AC-246.
Spec citations: BE03c "Preflight providers registered by Slice 12" (line 1574), "Receiving obligations from Slice 10 (DEC-141)" items 1, 3, 5 (1576-1584),
test line 1795, "Term actions" (1535); BE03b "Value encodings by field kind" taxonomy (1542), reason tokens (1545), registry row 6 (1816),
"Recorded taxonomy and composition references in comparison and restore" (1716).

## Files

WIP migrations (`supabase/migrations-wip/taxonomy-integrity/`, 20261024100000-100800, forward-only, each under 300 lines):

| File | Lines | SHA-256 |
| --- | --- | --- |
| 20261024100000_cms_resolve_taxonomy_version.sql | 88 | dcc3818ee3ef8e7ff9ebef37e3e75cf1a894ebaa32967a5da6540355f11b436b |
| 20261024100100_cms_compare_taxonomy_resolution.sql | 82 | f51c7b4ee6838eb5bece7dcb73833c66eabae3888e1182decbde1f42a4192ca3 |
| 20261024100200_cms_taxonomy_assignment_integrity.sql | 119 | 989a70b9e8ec3f69ae9cd3ff0a1e8985b354019224114c661fb7f2632bc9fd22 |
| 20261024100300_cms_preflight_taxonomy_provider.sql | 97 | 10b759b7a50bb13d5222832328b72506076bcf51b19bf4208fa9e8807fdc124b |
| 20261024100400_cms_taxonomy_value_encoder.sql | 140 | dc439b8adbdd887876265b5dde07120209ae688eda35f22b397bda3ed4c26703 |
| 20261024100500_cms_taxonomy_assignment_plan.sql | 154 | f00eafffc52b2ada4f8159d5834a219716c810ddc14d0198a0df39642ba4ad04 |
| 20261024100600_cms_write_commands_term_assignments.sql | 219 | b471aa31203cadf0d44be16695893ba7183adb69d3d47b0d32fffab6ad8c19fc |
| 20261024100700_cms_restore_term_assignments.sql | 244 | c5e5f661462097a934620782a882f122cc53590aeaa4345530825da74755c58f |
| 20261024100800_cms_restore_revision_term_plan.sql | 113 | b09c3cb65ba8b622a97453c9d103a776df3a0512c203df90d9997c98ff0a3340 |

What each does: 100000 `cms_resolve_taxonomy_version(uuid)` + `cms_taxonomy_version_resolves(text)` (definer, session-party owner scope, sets/restores `app.cms_rpc`);
100100 anchored amendment of `cms_compare_revision_resolvable` (recorded ids resolve by identity); 100200 provider `cms_taxonomy_assignment_integrity(uuid)`;
100300 evaluator dispatch branch + registry row v2 (owner id `0d6a0d6a-0000-4000-8000-000000000141`); 100400 `cms_term_assignable`, `cms_require_value_source_available`
(taxonomy -> `term_unavailable`, DETAIL `["/fields/<id>"]`), `cms_value_source_refusal` (taxonomy branch retired); 100500 plan/ids/record functions;
100600 anchored amendments of `cms_create_entry`, `cms_create_revision`, `cms_resolve_conflict` (persist assignments, record version ids, response ids; resolve skips the
re-check of a taxonomy value equal to theirs'); 100700 restore term plan + record + `cms_restore_source_side_valid` (only media still fails closed);
100800 anchored amendment of `cms_restore_revision`.

Tests (new): `supabase/tests/phase_02_slice_12_taxonomy_integrity.sql` (sha fa0d62f4...1903), `..._provider.sql` (sha 878256a6...ae16), dir
`phase_02_slice_12_taxonomy_integrity/` (000-world 110, 005-gallery-vocab 50, 010-resolver 68, 020-encoder 148, 025-resolve 70, 027-successor 21, 030-compare 50,
040-provider 212, 045-provider-context 33, 050-restore 131, 060-resolver-context 40, README), and the corrected-oracle copies in
`phase_02_slice_12_taxonomy_integrity_corrected_oracles/` (+ README) with the diff `docs/handoffs/2026-10-22-claude-s12/lane-taxonomy-integrity-test-corrections.diff`
(sha 664852f9296ce4c199af1ba4b808e1013a602d913951c2d542e9c2c2fed62b23). SHA-256 of every file: `sha256sum` over the paths above (recorded in the final message for the migrations and entrypoints).

Contracts / Worker (edited, named before editing): `packages/contracts/src/cms-editorial/preflight.ts` (taxonomy registry row v2, reasons in spec order),
`.../preflight.test.ts`, `packages/contracts/src/cms-composition/preflight-providers.test.ts` (registry/descriptor parity), `tests/contracts/phase-02-slice-11-sql-parity.test.ts`
(expected newer rows `['pattern','taxonomy','locale']`, gates `privacy, media, route`; this is the guard the earlier lane built to go red on landing),
`apps/worker/src/cms-editorial/error-vocabulary.ts` (`term_unavailable` in `TYPED_VALIDATION_REASONS`, `taxonomy_source_unavailable` kept), `apps/worker/src/cms-editorial-production-error-tokens.test.ts`.

## Runs

All through the staged ALT runner, lane `taxonomy-integrity` unless noted; TAPs under `.lane-logs/`.

| Run | Result | TAP (sha256 of the one named) |
| --- | --- | --- |
| probe, lane none, live function sources | 1/1 | alt-staged-none-053844-1792968.tap |
| RED baseline, lane tax-red (empty WIP), 07:09 | both drivers abort at the first missing object (resolver does not exist; real create raises taxonomy_source_unavailable); resolver 7-10 and provider 9, 12-14 not ok | alt-staged-tax-red-070619-2159328.tap |
| RED with only resolver + compare staged (07:03; staging raced with my file writes) | gallery 49 of 80 not ok (encoder, append, resolve, compare), provider 4 not ok then abort | alt-staged-taxonomy-integrity-070226-2135136.tap |
| GREEN 1, 7 migrations | provider 40/40; gallery 75/79 (harness: Vault history key for the compare RPC; one string expectation) | alt-staged-taxonomy-integrity-070932-2177335.tap |
| GREEN 2/3, 9 migrations | 91 then abort (harness helper, then FK findings below) | ...071747-2222831, ...072506-2268949 |
| GREEN final (07:27) | 156/156 pass, exit 0 | alt-staged-taxonomy-integrity-072706-2281778.tap, sha256 7657e73026d179ef2b59e8f7a0a1b9412a90cf69d9763f888a210b5afa064ab8 |
| Impact set, 40 files (S09 r8_api_surface / sec2 / trigger catalog, 22 S10, 8 S11, 8 S12 incl. taxonomy_terms, locale_gate, dec193/201) | 2797 tests, 11 not ok in 8 files, all intended contradictions | alt-staged-taxonomy-integrity-190103-87298.tap |
| Corrected oracles (8 copies) + both drivers | 565 tests, exit 0 | alt-staged-taxonomy-integrity-190418-94136.tap |
| Combined stack taxonomy-integrity,gaps-db2,node-pointers (15 WIP) + both drivers | 156/156, exit 0 | alt-staged-taxonomy-integrity+gaps-db2+node-pointers-190504-97171.tap |
| Mutants lane (deprecated counts as merged; allowlist field check removed; restore does not follow merges; wrong reason fallback), then deleted | 22 not ok (15 gallery, 7 provider): each mutant caught | alt-staged-tax-mutant-190547-100132.tap |

Failure classification: the aborts are harness (missing pg_temp helper, missing Vault test key, forged rows the stored foreign keys forbid), not feature RED; the 49 + 4 RED failures
are genuine missing feature; no genuine defect remained after GREEN. Vitest: contracts `cms-editorial` + `cms-composition`, `tests/contracts/phase-02-slice-11-sql-parity`, worker `cms-editorial*`
= 206 files / 3089 tests. RED for contracts: preflight.test.ts failed 4 tests against the HEAD `preflight.ts`; the worker token test failed with 500 for `term_unavailable` before the vocabulary edit.
prettier + eslint clean on the six TS files; `tsc --noEmit` clean for packages/contracts and apps/worker.
Scratch tar of the originals before in-place edits: `<scratchpad>/claude_s12_taxonomy_integrity/orig-072440.tar` (the scratchpad was cleaned by the host after the weekly limit; the files on disk are the tested ones, shas above).

## Test corrections

Eight existing files contradict BE03c DEC-141 items 1 and 5 once the authority exists; none is in my claim and `phase_02_slice_10*` is a never-edit family, so I changed none of them. The edits are in
`lane-taxonomy-integrity-test-corrections.diff` (`git apply --check` passes) and proven green as copies. Each cites the spec:
- `phase_02_slice_10_compare_lineage.sql` #14: an existing recorded taxonomy version now compares (`00000:`), BE03c item 1.
- `phase_02_slice_10_value_source_encoding.sql` #41-42: the context-free predicate no longer refuses taxonomy by kind (`<none>`), item 5.
- `phase_02_slice_10_value_source_refusal.sql` #6, #21 and `..._value_source_resolve.sql` #9: `term_unavailable` replaces `taxonomy_source_unavailable`, item 5 / BE03b 1542.
- `phase_02_slice_10_field_kind_definer_reach.sql` #21: the definer reaches the predicate and it is `null` for taxonomy.
- `phase_02_slice_10_validation_pointers.sql` #23: `term_unavailable ["/fields/<id>"]`.
- `phase_02_slice_11_helpers_preflight.sql` #14, #90-91: registry string row for taxonomy; `taxonomy_version_not_active` for a recorded unknown version (BE03c line 1574).
- `phase_02_slice_11_rpc_review_submit_refusals.sql` #19: the failed taxonomy entry is `taxonomy_version_not_active`.
No assertion was weakened: every changed expectation names the new spec behavior.

## Spec citations (behavior to line)

Resolver shape and non-disclosing refusal: BE03c 1580. Comparison/lineage by identity: 1580, BE03b 1716 (1). Restore carry: 1582 (3) (+ BE03b 1716 (3)). Encoder rule and `term_unavailable`:
BE03b 1542, BE03c 1584, 1535 (last sentence). Provider predicates: BE03c 1574. Dispatch before row: AC-241. The worker mapping of `term_unavailable`: BE03b 1545.
The real raise of every token is proven by pgTAP in the same lane (DEC-226 rule 4): `term_unavailable` on create, append and resolve; `migration_chain_incomplete` on restore; `comparison_unavailable` on compare.

## Open items / BOUNDARY

Update 2026-10-27: items 1 and 3 were ratified by root DEC-229 (count per offending assignment, assignment key = the term's storage identity), items 2 and 6 by DEC-233 (duplicate `termId` refused; a deprecated term the source revision already assigns stays accepted on a re-sent value by both writers). The text below is delivery 1.

1. Reason precedence for the taxonomy provider is not stated (BE03c lists `term_merged_unconverged`, `allowlist_changed`, `taxonomy_version_not_active`): implemented in that order; blocking_count = one unit per offending
   assignment (merged, allowlist) plus one per inactive recorded version id, total over all predicates, capped 1000 (the pattern provider's rule). Needs a BE03c sentence like the pattern one (propagate-decision).
2. `termIds` uniqueness: 03b fixes none. The value is stored as authored; one assignment per distinct term, position = index among distinct terms.
3. Stored foreign key `(term_id, taxonomy_version_id, owner_id)` pins an assignment row to the term's write-version, not to the vocabulary's current active version. The revision's `taxonomy_version_ids` are the current
   active versions (spec), the assignment row names the write-version (storage); proven with a superseded vocabulary version (027). If the spec means the assignment row must name the active version, the FK needs a Slice 12 storage change.
4. Restore: a recorded version of a vocabulary with no carried assignment keeps its recorded id (03c states the rule for assignments only); a vocabulary with no active version, or whose active version no longer lists the entry type and field key,
   refuses the restore `migration_chain_incomplete` ("other-vocabulary", BE03c item 3). "Unknown term" and "term of another owner" are unreachable shapes (foreign keys), the plan still refuses them.
5. Provider and resolver read `app.cms_session_party` for the owner scope (the resolver has a one-argument spec signature); with no published party they fail closed.
6. A taxonomy value equal to the current draft's is an existing assignment in `cms_resolve_conflict` and is not re-checked (a deprecated term already assigned must not block an unrelated resolution, BE03c 1535 "still resolvable").
   Writing a deprecated term into the field again is refused (`not newly assignable`).
7. `cms_value_source_refusal('taxonomy', ...)` no longer refuses (the encoder is context-dependent); the retired token stays in the Worker/web vocabularies for history.
8. Locale variants copy `taxonomy_version_ids` from their source without assignments (only primitive kinds are localizable); not changed.

## Requests to root

Update 2026-10-27: request 2 (web copy and `VALUE_REASONS`) was done by root. Current requests are in the final message and `## V12 follow-ups`.

1. Promote `supabase/migrations-wip/taxonomy-integrity/` (9 files) with the other batches; apply the diff to the eight test files and delete `phase_02_slice_12_taxonomy_integrity_corrected_oracles/`.
2. Web (out of claim): `apps/web/src/components/cms-editorial-workflow/cms-workflow-labels.ts` needs copy for `term_merged_unconverged`, `allowlist_changed`, `taxonomy_version_not_active`
   (`cms-workflow-labels.test.ts` "has copy for every registered reason of every provider" now fails for `taxonomy term_merged_unconverged`); `apps/web/src/server/cms-editorial-platform-error-details.ts`
   `VALUE_REASONS` needs `term_unavailable` (the copy already exists in `cms-editorial-reason-copy.ts`).
3. Ledger (not touched): AC-239, AC-242, AC-244, AC-246 become provable; AC-221 assignment clause and AC-224 "not newly assignable" gain tests; AC-241 (taxonomy) too. See the AC list in the final message.
4. Decide boundary 1 and 3 (spec sentence / FK).
5. Rebuild `packages/contracts/dist` and `packages/data-access` generated types if the canonical gate consumes them (I did not touch generated files).

## V12 follow-ups

Review `review-v12-report.md` (PROMOTE-WITH-CONDITIONS). RED first: new tests were added and run against the previous WIP (TAP `alt-staged-taxonomy-integrity-195004-218080.tap`: 199 tests, 22 not ok:
DEC-233 dup / deprecated re-send (#26-28, 61-63, 65, 77-80), the lock helper (#127-128 gallery) and the 8 static lock-position assertions, the DEC-229 count (provider #32)); the V12-03 gap tests (28 active ids, restore branches, cap)
were green on the old code (they pin existing behavior) and are proven by mutants instead. Then the WIP was changed (GREEN 199/199: `alt-staged-taxonomy-integrity-195653-233244.tap`, sha256 `487ce2b8d4caec389d961d5573d8913a8d67ad843a83aa63d0b985f631c3d56a`).

| Finding | Closed by |
| --- | --- |
| V12-01 MAJOR position-6 term lock | `cms_lock_term_plan` (100500) and `cms_restore_lock_term_plan` (100700): `FOR SHARE` on the assigned terms in ascending id order, after the revision insert and the composition carry/copy (so after position 5), before the assignment rows; the authored terms are re-checked under the lock (`term_unavailable` with the field pointer), the restore plan is re-run under the lock and a changed plan is `CONFLICT`; `lock_not_available` / `deadlock_detected` are converted to `CONFLICT`. Called by all four writers (100600, 100800). Static oracle `phase_02_slice_12_taxonomy_integrity_lock_order.sql` (8 source-order assertions with reversed-anchor controls + exactly-once) and `028-active-ids` (helper recheck both ways). |
| V12-02 MAJOR ninth oracle | the diff now carries `tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts` (row 3: `term_unavailable`, label "a non-empty taxonomy value naming an unknown term") and the runbook row `docs/runbooks/platform/cms-editorial.md:175`; `git apply --check` passes. The apispec case needs the canonical stack (`pnpm db:api-test`), so it is a diff, not a verified copy; a second row naming a real deprecated term needs vocabulary seeding helpers the real-stack world does not have: accepted, reason: belongs to the AC-246 real-stack lane. |
| V12-03 MAJOR discrimination | `028-active-ids` (resolve and restore record the CURRENT active id while the assignment row names the write-version; a three-term revision across two vocabularies, term order reversed against id order, on create, append and restore; restore refusals: assignment on a non-taxonomy field, non-empty value without assignment, merged term without successor, 64-hop chain resolves / 65-hop chain refused) and `046-provider-cap` (1001 offenders report 1000). Mutants below. |
| V12-04 MINOR count | provider counts `merged OR allowlist-failing` assignments once (+ offending version ids); `040-provider` #32 now pins 3 (DEC-229). |
| V12-05 MINOR guards | `gen`-style amendments (100600, 100800) replay the inverse (last pair first) and require byte equality with the installed source; the three wholesale `create or replace` bodies carry an md5 pin of the installed predecessor (`6f4c07e4...`, `9ae6d843...`, `4d478a77...`, taken from a staged run of the promoted migrations). |
| V12-06 / V12-07 (DEC-233) | `cms_require_value_source_available(uuid,uuid,jsonb,uuid)` (100400) takes the source revision: a deprecated term that revision currently assigns in the same field (`cms_term_existing_deprecated`) stays accepted; the same `termId` twice is `VALIDATION_FAILED` at `["/fields/<id>"]`. `cms_create_revision` passes `current_row.id`, `cms_resolve_conflict` passes `theirs_row.id` (its equal-to-theirs exemption stays: an unchanged value never re-checks, even a merged term); the 3-argument form delegates with null (create_entry). Tests: `020` (a_keeps_resend now accepted, re-send beside a new term, a different deprecated term refused, another entry's assignment does not count, duplicates on create/append), `025` (explicit resolve re-sending a deprecated assigned term accepted, a new deprecated term and duplicates refused). |
| V12-08 MINOR docs | README for the WIP dir; stale BOUNDARY comments replaced by DEC-229; `comment on function cms_restore_source_side_valid` re-issued; the report's stale web request removed (root fixed both); BE03b 1542 "bound to the active TaxonomyVersion" is root's spec edit (listed under Requests). |
| V12-09 coupling | acknowledged: contracts row, nine migrations, nine oracle copies/diff land in one commit; `supabase migration up --include-all` where later WIP batches were applied first. The combined stack with all live WIP lanes (taxonomy-integrity, gaps-db2, node-pointers, nestable-read, placement-perf) is run below. |
| V12-10 NIT | unused `v_field_key` removed; `version_row.id::text = recorded.id` kept (fail-closed on garbage, no cast). |
| V12-11 NIT RED partial | accepted: the first RED drivers aborted at the first missing object by construction; the mutants are the substitute and are recorded below. |
| V12-12 NIT | corrected `compare_lineage` #14 also asserts the comparison was computed; corrected `field_kind_definer_reach` adds `cms_term_assignable` to the reach list. |
| V12-13 NIT | accepted: a vocabulary with no active version reports `taxonomy_version_not_active` (pinned by `040`); the spec sentence is root's. |

### Retitled assertions the ledgers cite (for root to re-cite)

Old title -> new title (the diff changes them; the five cited ones are in the S10 ledger `phase-02-slice-10-evidence-ledger-001-035.ts` and `phase-02-slice-11-evidence-ledger-067-100.ts` plus their `*.receipts.generated.jsonl`):
1. S10 `value_source_refusal` #21 "cms_create_revision: tax_nonempty fails closed with the typed taxonomy_source_unavailable reason [BE03b]" -> "cms_create_revision: tax_nonempty names a term that is not assignable: the uniform term_unavailable reason (DEC-141 item 5) [BE03b]" (cited).
2. S10 `value_source_resolve` #9 "cms_resolve_conflict: tax_nonempty fails closed ..." -> "cms_resolve_conflict: tax_nonempty names a term that is not assignable: the uniform term_unavailable reason (DEC-141 item 5) [BE03b]" (cited).
3. S10 `compare_lineage` #14 "a non-empty recorded taxonomy list fails closed even when the version exists: no Slice 10 authority resolves it (DEC-141)" -> "a recorded taxonomy version that exists in the caller's owner scope is resolved by identity and the comparison succeeds (BE03c Receiving obligations from Slice 10 (DEC-141) item 1; P2-S12-AC-242)" (cited); a new assertion follows it: "and the comparison is computed, not a partial answer ...".
4. S11 `helpers_preflight` #90 "a recorded taxonomy version fails the taxonomy gate [P2-S11-AC-094]" -> "a recorded taxonomy version that is not an active version fails the taxonomy provider with taxonomy_version_not_active (BE03c Preflight providers registered by Slice 12; P2-S12-AC-239) [P2-S11-AC-094]" (cited).
5. S11 `helpers_preflight` #91 "the remaining generic taxonomy reference gate carries the exact reference count [P2-S11-AC-094]" -> "the taxonomy provider result carries one offending version id [P2-S12-AC-239]" (cited).
Retitled but not cited by a ledger: `value_source_refusal` #6 (create), `value_source_encoding` #41-42, `field_kind_definer_reach` #21, `validation_pointers` #23 (title and token), `helpers_preflight` #14 (registry string; title unchanged), `rpc_review_submit_refusals` #19 (title unchanged, expectation changed).

### Mutants (V12-03 and the new behaviors); records of kill counts

Three staged lanes of copies of the WIP with one edit each, my three entrypoints; all copies deleted afterwards. TAPs: A `alt-staged-tmut-a-195850-240243.tap` (17 not ok), B `alt-staged-tmut-b-200003-243879.tap` (14), C `alt-staged-tmut-c-200144-250662.tap` (6).

| # | Mutant | Killed by |
| --- | --- | --- |
| M1 | restore records the source's ids | gallery #113, #119 |
| M2 | restore records the term's write-version as the id | #113, #115, #119 |
| M3 | resolve records theirs' ids | #109, #111 |
| M4 | plan returns one version id | #116, #119 |
| M5 | ids not sorted (descending) | #116, #119 |
| M6 | restore skips the non-taxonomy-field check | #121, #126 |
| M7 | restore skips the value-without-assignment check | #122 |
| M8 | no hop cap | #125, #126 |
| M10 | provider without the 1000 cap | provider #49 |
| M11 | `cms_create_revision` takes no term lock | lock order #2, #5 |
| M12 | no recheck under the lock | gallery #128 |
| M13 | duplicate termIds accepted | #26-28, #65, #77-78 |
| M14 | no existing-deprecated acceptance | #61-63, #79 |
| M15 | count per predicate | provider #32 |
| M16 | resolve passes no source revision | #79, #80 |
| M17 | append passes no source revision | #61, #62 (run together with M14: killed by the same assertions; the two are not separated) |
| M18 | restore takes no term lock | lock order #4, #5 |
| M19 | `cms_create_entry` takes no term lock | lock order #1, #5 |
| M9 | restore without the explicit null-successor test | EQUIVALENT: the following lookup of a null id finds no row and raises the same `migration_chain_incomplete` |
Not provable by pgTAP (needs two sessions): the `is distinct from p_plan` comparison in `cms_restore_lock_term_plan` and the lock wait itself; both are the race scenario below.

### Race scenario for the root's race lane (no existing module covers P2-S12-AC-277 (3); I did not author or run one)

`term merge versus assignment`, independent sessions, READ COMMITTED, fresh ALT, after the DEC-194 outer kit (`supabase/tests/phase_02_slice_12_dec194_outer.race.mjs` is the closest module: merge side, real vocabulary and terms).
Interleaving A: session W calls `cms_create_revision` with `tags = [T]` and stops after its lock statement (T `FOR SHARE`); session M calls `cms_act_taxonomy_term` merge of T into S: M must wait; W commits; M then converges W's new assignment row
(`cms_taxonomy_merge_work` sees it): one committed command each, final state = survivor assignment active, T assignment superseded. Interleaving B: M commits first; W (any of create, append, resolve) is then refused `term_unavailable` and writes nothing; W = restore re-points to S (plan re-run) or, if the plan changed under the lock, `CONFLICT` retry succeeds on the second attempt. Assert in both: no deadlock, no active assignment to a merged term whose revision is committed, one typed result.

### Files, before and after (SHA-256)

WIP migrations (before = delivery 1, after = now):
| File | before | after |
| --- | --- | --- |
| 20261024100000_cms_resolve_taxonomy_version.sql | dcc3818e...436b | dcc3818ee3ef8e7ff9ebef37e3e75cf1a894ebaa32967a5da6540355f11b436b (unchanged) |
| 20261024100100_cms_compare_taxonomy_resolution.sql | f51c7b4e...2ca3 | f51c7b4ee6838eb5bece7dcb73833c66eabae3888e1182decbde1f42a4192ca3 (unchanged) |
| 20261024100200_cms_taxonomy_assignment_integrity.sql | 989a70b9e8ec3f69ae9cd3ff0a1e8985b354019224114c661fb7f2632bc9fd22 | d6825de78680ef765809cbf4e90c9c5062fca963b611c1c82385dec748f6f564 |
| 20261024100300_cms_preflight_taxonomy_provider.sql | 10b759b7...124b | 10b759b7a50bb13d5222832328b72506076bcf51b19bf4208fa9e8807fdc124b (unchanged) |
| 20261024100400_cms_taxonomy_value_encoder.sql | dc439b8adbdd887876265b5dde07120209ae688eda35f22b397bda3ed4c26703 | 37017b37685c919ecb2acb762065195788b559a7f90202f570b10ab0dc761ac1 |
| 20261024100500_cms_taxonomy_assignment_plan.sql | f00eafffc52b2ada4f8159d5834a219716c810ddc14d0198a0df39642ba4ad04 | 50eaf97a1ab615d8594690e891e45bd2abc1c3f65340028746659d833b7d2f40 |
| 20261024100600_cms_write_commands_term_assignments.sql | b471aa31203cadf0d44be16695893ba7183adb69d3d47b0d32fffab6ad8c19fc | e1e34719404721f75c29dc9935350d9d7cba5ca0ebb722af6450e3d58f2fdf44 |
| 20261024100700_cms_restore_term_assignments.sql | c5e5f661462097a934620782a882f122cc53590aeaa4345530825da74755c58f | c120403ec2666304e9694d67138a7284b34ad233965447db59b0793efe8bba9d |
| 20261024100800_cms_restore_revision_term_plan.sql | b09c3cb65ba8b622a97453c9d103a776df3a0512c203df90d9997c98ff0a3340 | d5b403133e69f353c4f901354d04a6326a857df99829c11640d3ded38db578f8 |
| README.md (new) | - | 755f2ebfe59bf4c620c9b5fe525ae8cbfd5d82078eeb784b54dff9f5cb69c439 |

Tests (before -> after): `phase_02_slice_12_taxonomy_integrity.sql` fa0d62f4...1903 -> 2927e5b222d9cbce44e5a986b9a4658a53f21c8af7deb4152b8b791c65b8bf5e; `..._provider.sql` 878256a6...ae16 -> eb2488e6dde72161bd949fcc3668787c8322731b7589b1b036a93c1daf03e122;
`..._lock_order.sql` (new) 7683de7da202d02f91d928bbe2a7a94358e7acab2de5ba541ab4359c6fd68afc; `020-encoder` c04dd0b4...423f -> 772ef3d8a68c034ac059af6e03a780bbb28edba55beefdae34b32fcc5c1faa8d; `025-resolve` 5297dda1...8da8 -> fb3c2fd2b44a0d911f1fbdc5f7338b3176158fed508a5983b6c793dd6722c13a;
`040-provider` c33f0bfb...3d46 -> ebc02f046d228e6a807ba0ae217703041ee343fa549dc1bc5dda9a7154b8af56; new: `028-active-ids` 5eb477fb9bac1efed5cf79837225c398141f8de577c94a5f35581a80ea347a57, `046-provider-cap` 1864540825261c806ad653f4e2d3f1982734a16982f680cc09daee0578041d67;
`README.md` (tests dir) -> 45397ea75b990dc259149d47ab06692ef0506cc4abb5be5e5b6d0961b591e3fe. Unchanged: 000-world, 005, 010, 027, 030, 045, 050, 060.
Corrected oracles: `compare_lineage` f83ce022...0c06 -> 58765ba4d7a27dfd2e50cdbc9ffca6f67f66bb8de75df89f9fcf4a6f9cc52ea2; `field_kind_definer_reach` 35476f2a...5e8 -> 2949a3fa65c4a158bd1e53c472080c2c5fdfb3a27818150e011e05cc3228658d; the other six unchanged.
Correction diff 664852f9...2b63 -> 755c7a6603daab67091decda50eac3f305e818c662928de802feffafd2820d7b (10 file diffs: the eight SQL oracles, the apispec, the runbook).

### Runs (V12)

| Run | Result | TAP |
| --- | --- | --- |
| RED vs previous WIP, my 3 entrypoints | 199 tests, 22 not ok (listed above) | alt-staged-taxonomy-integrity-195004-218080.tap |
| GREEN, my 3 entrypoints | 199/199 | alt-staged-taxonomy-integrity-195653-233244.tap (487ce2b8...3d56a) |
| Mutant lanes A, B, C | see the table | alt-staged-tmut-a-195850-240243, tmut-b-200003-243879, tmut-c-200144-250662 |
| FINAL: my 3 entrypoints + review V12's 41 files + 8 corrected-oracle copies | 52 files / 5901 tests, exit 0 | alt-staged-taxonomy-integrity-200305-256517.tap (7082c4bc...9416) |
| Remaining 32 files of the earlier 40-file impact set (original oracles) | 32 files / 2388 tests, exit 0 | alt-staged-taxonomy-integrity-200713-266129.tap (cdfc925f...c202) |
| COMBINED stack (taxonomy-integrity, gaps-db2, node-pointers, nestable-read, placement-perf), my 3 entrypoints | 199/199, exit 0 (22 WIP migrations staged together, no anchor collision) | alt-staged-taxonomy-integrity+gaps-db2+node-pointers+nestable-read+placement-perf-201032-272653.tap (5e04e9645ace133b2b440325648a38957feaf7b41182c0ef1bb365ac3141b4d9) |

## V12 verification follow-ups

Review V12 verification: PROMOTE (13/13 closed) with four new items (V12-14 to V12-17), one comment, and the dynamic lock proof. All closed in the same WIP dir and claims; no promoted file, spec or ledger was touched.

| Item | Closed by |
| --- | --- |
| V12-14 changed-plan CONFLICT of `cms_restore_lock_term_plan` | `029-scope-and-stale-plan.sqlinc`: plan computed, helper returns (void) while unchanged, a merge forged between plan and lock in the same session, helper raises `P0001:CONFLICT`, a plan recomputed after the merge passes. Also dynamic (below). Mutant N2 (comparison disabled) killed by `029` #130 and `concurrency` #11. |
| V12-15 negative scope of `cms_term_existing_deprecated` | `029`: a re-sent MERGED term the source still assigns is `term_unavailable` (and the predicate itself is false); a second taxonomy field `topics` (labelled forgery on the gallery version, `s10g_fid` extended in the test session) shows a deprecated term assigned in `topics` is refused when re-sent in `tags`, with the same term re-sent in `topics` accepted as control. Mutants: N3 (`lifecycle <> 'active'`) killed by #132-133; N4 (field condition dropped) killed by #135-136. |
| V12-16 drift | `100500` header now says duplicates are refused (DEC-233) and the `group by` is defensive; corrected-oracles README says the diff also carries the apispec and the runbook (ten file diffs) and no longer promises "eight files of the diff"; the lane report's "9 corrected-oracle copies" is 8 (3 + 41 + 8 = 52 files, 5901 tests then). |
| V12-17 ACL | new `phase_02_slice_12_taxonomy_integrity_acl.sql` (8 assertions): for the 13 created functions and the 3 replaced bodies, `proacl` shows no EXECUTE for PUBLIC, anon, authenticated or service_role, the owner is the only grantee of each created function, each created function is owned by the CMS definer with an empty `search_path`, only the resolver, its boolean form and the provider are SECURITY DEFINER, a `has_function_privilege` control. Mutant N5 (EXECUTE granted to service_role on the lock helper) killed by #3, #4, #8. |
| comment: plan drift under a waited lock | `cms_lock_term_plan` (100500) explains why it is harmless: the plan is read in the locking statement's snapshot, so the merged term is locked and the survivor, named by the fresh plan, is not; a survivor can never itself be merged (`cms_term_apply_merge`, 20261014120400:172-175 refuses a term that already has an inbound redirect), and a concurrent deprecation of a survivor is tolerated for an existing assignment (BE03c 1574). |
| V12-13 | root wrote the BE03c sentence; the pin `040-provider` stays. |

### Dynamic proof: `phase_02_slice_12_taxonomy_integrity_concurrency.sql` (AC-276, AC-277 (3))

Three dblink workers (`cc_a` writer, `cc_b` merger, `cc_c` late writer) plus a setup/cleanup worker, against COMMITTED forged fixtures (party, person, type, version, artifact, taxonomy field definition, active vocabulary version, eight terms, an entry, six revisions, two source assignments) built and removed by the file; the probe runs in autocommit before the pgTAP transaction (the precedent `phase_02_slice_09_schema/000b-activation-lock.sqlinc`), and a leak assertion compares row counts with the baseline. The merge worker runs exactly what `cms_act_taxonomy_term` does after authority (the named terms `FOR UPDATE` in ascending id order, `20261014120500:106-117`, then the real `cms_term_apply_merge`). The writer side is the real helpers `cms_lock_term_plan` and `cms_record_term_assignments`.
- control: a writer that only reads the term holds no lock; the merge completes at once (so the waits below are the lock, not the harness).
- (i) the writer takes the position-6 lock; the merge, started afterwards, waits (`pg_stat_activity.wait_event_type = 'Lock'`, still busy); only then the writer appends its assignment row and commits; the merge completes and converges the writer's committed row (`cc-t` superseded v2, `cc-s` active v1); one committed command each, no deadlock.
- (ii) a writer arriving after the merge committed is refused `term_unavailable`; a restore planned before a merge and locked after it is `CONFLICT`.
- (iii) a merge applied and uncommitted holds the rows `FOR UPDATE`; a writer carrying the term (source revision assigns it, nothing authored) waits (Lock), proceeds when the merge commits, and its new revision carries the SURVIVOR only; the source revision was converged the same way; no deadlock, no lock timeout.
Harness findings on the way (not feature defects): an earlier version ran inside the pgTAP transaction and a worker's DDL timed out on a lock; results written inside a `DO ... exception` block are rolled back with it, so the probe reads only after it ended; the record helper returns the row count (`ok:1`). Observation worth knowing for the race lane: the writer's own foreign-key insert also takes `KEY SHARE` on the term, which conflicts with the merge's `FOR UPDATE`, so the explicit position-6 lock is what closes the check-then-insert window; (i) therefore appends the row only after the merge is seen waiting.
Mutant N1 (the `for share` removed from `cms_lock_term_plan`, `alt-staged-tmut-d-005120-696908.tap`): killed by #4, #5, #7, #13 (the merge no longer waits and the writer's row lands on a merged term).

### Runs

| Run | Result | TAP |
| --- | --- | --- |
| my entrypoints with 029, ACL, first concurrency draft | 4 files 215 tests pass, concurrency file harness-fail (timeout, then temp-table scope) | alt-staged-taxonomy-integrity-002806-634092, ...004359-673380, ...004727-681909 |
| concurrency, working draft | 18 tests, 2 expectation fixes (the record helper returns `1`) | alt-staged-taxonomy-integrity (the v12b4 run) |
| mutants N2, N3 (lane tmut-d) and N4, N5 (lane tmut-e) | N2 #130, concurrency #11; N3 #132-133; N4 #135-136; N5 #3, #4, #8 | alt-staged-tmut-d-004916-689285.tap, alt-staged-tmut-e-005003-692399.tap |
| mutant N1 (lane tmut-d, after reordering (i)) | killed by #4, #5, #7, #13 | alt-staged-tmut-d-005120-696908.tap |
| FINAL lean combined run | 54 files / 5935 tests, exit 0 | alt-staged-taxonomy-integrity+node-pointers+nestable-read+placement-perf-005223-700981.tap (sha256 082ac4bc7b0b4c617e593905d4b99d483960a150e46ed0cceedcb049bbd997d7) |
RED-first note: `029`, the ACL file and the concurrency file pin behavior that already holds (they close review gaps), so they cannot be RED against the code; each is proven by the mutant that breaks the behavior it pins (above). The mutant lane directories were deleted.
`gaps-db2` was left out of the combined stack as instructed.

### Files, before -> after (SHA-256)

| File | before | after |
| --- | --- | --- |
| migrations-wip/taxonomy-integrity/20261024100500_cms_taxonomy_assignment_plan.sql | 50eaf97a1ab615d8594690e891e45bd2abc1c3f65340028746659d833b7d2f40 | ee109a69fa6b0ce557ac5af913524fc1a9b93ca80bfd6e34dcaeb07f469666b4 (comments only) |
| tests/phase_02_slice_12_taxonomy_integrity.sql | 2927e5b222d9cbce44e5a986b9a4658a53f21c8af7deb4152b8b791c65b8bf5e | 6e21bce2d69fee2d19cfd4fd6e760153214fbf6899ab1f7cd37d9f7dc0a07823 (includes 029) |
| tests/phase_02_slice_12_taxonomy_integrity/029-scope-and-stale-plan.sqlinc | new | 3b1666a069062790cecceb070235a6d7b2c573d10473c14875007252a1dad368 |
| tests/phase_02_slice_12_taxonomy_integrity_acl.sql | new | 44825869c5e71791d79c4c6679820caede73faa756ab50487d6a1141dff53975 |
| tests/phase_02_slice_12_taxonomy_integrity_concurrency.sql | new | 0be7a63aa9bbcbc11ccf1e87598a868a2a12a5cd82367100bbe6cf37ab5ad0e6 |
| tests/phase_02_slice_12_taxonomy_integrity_corrected_oracles/README.md | 3b5d530ed0d1e66f224f01218cc62a3b8b14310f9d86fd0dabbd08453cddc5cd | c66bcb379cac2fbce7f8b7d1d9cd471b564dcfd439a70eb0a0ad918671ede6e1 |
All other files are byte-identical to the `## V12 follow-ups` table.

### Requests to root

1. Add `phase_02_slice_12_taxonomy_integrity_acl.sql` and `phase_02_slice_12_taxonomy_integrity_concurrency.sql` to the canonical db-test run; the concurrency file uses dblink workers with `host=db port=5432 user=postgres password=postgres` (the precedent's string) and commits then removes its fixture, so it must not run beside a lane that counts `cms_terms` rows. AC-276 / AC-277 (3) may cite the concurrency file for the lock; the static `lock_order` file proves only the source order.
2. Everything in `## V12 follow-ups` Requests still stands (correction diff, delete the corrected-oracles directory, re-citation, one commit).
