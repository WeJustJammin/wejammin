# Review V12 report: taxonomy-integrity WIP (DEC-141 receiving obligations) before promotion

Status: FINAL (2026-10-27, reviewer V12 `claude_s12_review_v12`). Independent: V12 did not author any of this work.
Update 2026-10-28: root asked for a verification of the lane's follow-ups. The per-finding CLOSED / OPEN table, the DEC-233 and lock-order checks, my verification runs and the FINAL VERDICT (PROMOTE) are in section `## Verification` at the end of this file. Sections 1 to 11 and the appendices below are the first-pass review of 2026-10-27, kept unchanged; where they differ from `## Verification` (the verdict PROMOTE-WITH-CONDITIONS of section 1, 'no new lock' in section 6), the later section governs.
Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD `cd89d54cc84403e32699666c8d3710f45bbffce0`
(the lane's files are untracked; the lane report is SHA `43e49f01da4f817e...`, the same bytes root recorded).
Read-only: no repository file was edited except this report. Database facts come from (a) the lane's own staged-runner logs, whose staged manifests I
compared byte-for-byte with the current WIP files, and (b) one staged ALT run of my own (section 9). No race module, no `pnpm db:*`, no Playwright, no mutant
(a mutant needs a new `migrations-wip/` directory, which a read-only reviewer may not create: every "survives" below is established by reading the assertions,
not by running a mutant).

## 1. Verdict

**PROMOTE-WITH-CONDITIONS.**

The nine migrations are well made: every amendment applied cleanly to the installed bodies, nothing in a sibling WIP lane overlaps a function body they change, the
private functions are owned by the CMS definer with an empty `search_path` and no API-role EXECUTE, the resolver and the provider set and restore `app.cms_rpc` and have
context-cleared tests with a negative control, and no cross-owner read is reachable. No BLOCKER. Three MAJOR findings must be closed (or explicitly deferred by a root decision)
before the batch is promoted, because each one would otherwise surface later as a red canonical gate, an unprovable acceptance clause, or a spec-mandated concurrency rule that is not implemented.

Counts by severity: **BLOCKER 0, MAJOR 3, MINOR 6, NIT 4.**

The eight proposed corrections: **8 ACCEPT** (three with notes). A ninth correction is required that the lane did not find (V12-02).

### Top findings

1. **V12-01 MAJOR. No position-6 term lock in any assigning writer.** BE03c 1491 makes the `cms_terms` rows a lock position, `FOR SHARE` for "a 03b entry writer that assigns a term", so that
   term locks serialize merge and assignment; AC-276 and AC-277 ("term merge versus assignment") depend on it. `cms_create_entry`, `cms_create_revision`, `cms_resolve_conflict` and
   `cms_restore_revision` (after the patches) read term state with plain SELECTs and insert assignment rows with no term lock. A merge that commits between a writer's check and its commit leaves an
   active assignment to a merged term that no convergence will ever see.
2. **V12-02 MAJOR. A ninth oracle, in the real-stack suite, still asserts the retired token.** `tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts:90-94` expects
   `taxonomy_source_unavailable` for a non-empty taxonomy value; `pnpm db:api-test` is a blocking step of `pnpm db:verify` and CI. The packet also omits the ledger/receipt citations of five retitled
   assertions and the operator runbook row.
3. **V12-03 MAJOR. Several clauses the lane says become "provable" are not discriminated by any assertion.** "The new revision's taxonomy_version_ids are the vocabularies' current active version ids"
   is unproven on resolve and restore (every fixture records the same id before and after), a revision spanning two vocabularies is never built, and three fail-closed branches of the restore plan have no test.
4. V12-04 MINOR. `blockingCount` counts an assignment that fails two predicates twice; DEC-229 says "the number of offending assignments plus offending manifest versions", and
   `040-provider.sqlinc:165-166` pins 4 where DEC-229 gives 3.
5. V12-05 MINOR. Four of the six anchored amendments have no inverse check, and three wholesale `create or replace` bodies carry no baseline guard (I diffed them against the live definitions: only the intended hunks differ).

## 2. Findings

### MAJOR

#### V12-01 (MAJOR): the new assigning writers take no position-6 term lock, so term merge versus assignment is a lost-write race

Spec. BE03c:1491 ("Slice 12 lock order"): "Slice 12 adds one position ... **position 6**, the `cms_terms` rows of the vocabulary a command names (`FOR UPDATE` for a term action and a merge,
`FOR SHARE` for a 03b entry writer that assigns a term), so that term locks serialize merge and assignment. Within one position a command locks rows in ascending `id` order." BE03c:1804 requires the lock
order to be "proven through the real commands: concurrent pairs ... term merge versus assignment ... each end in one committed command and one typed 409 or 403, never a deadlock or a lost write";
P2-S12-AC-276 names "the revision-append carry-over" among the writers and AC-277 names the scenario (the ledger limitation of AC-277 lists "(3) term merge versus a concurrent assignment" as unproven).

Evidence. `grep -n -i "for share\|for update\|advisory" supabase/migrations-wip/taxonomy-integrity/*.sql` returns only `set local lock_timeout` lines: not one statement locks a `cms_terms` row.
- Check, early and unlocked: `20261024100400_cms_taxonomy_value_encoder.sql:95-112` (plain SELECTs through `cms_term_assignable`, :18-39), called from the live command loops at
  `20261005018040:263` (create), `20261005018045:331` (append), `20261005018050:524` (resolve).
- Write, later and unlocked: `20261024100600_cms_write_commands_term_assignments.sql:28-30` (create), `:93-95` (append), `:160-163` (resolve) call `cms_record_term_assignments` (`20261024100500:112-135`), whose plan
  (`:22-85`) re-reads the terms with plain SELECTs; the restore patch (`20261024100800:51-53, 66-68`) plans and records the same way (`20261024100700:67-203`).
- Merge side (already promoted): `20261014120400_cms_term_action_apply.sql:177-183` sets the retired term `merged` and converges only the assignment rows visible to it; the continuation job is requested only when rows remain
  after 5,000 (`:180-182`), and the recovery sweep acts only for a party with a failed job (BE03c 1552).

Deterministic interleaving (READ COMMITTED): W (append) checks term T, `active` (snapshot 1); M (merge of T into S) locks T and S, sets T `merged`, converges the rows it can see (W's row is not yet committed),
commits; W inserts its `active` assignment to T and commits. Result: a committed current `active` assignment to a `merged` term, never re-pointed. The provider reports `term_merged_unconverged`, so publication
stays blocked (fail-safe), but the write succeeded against a term that was already merged, nothing self-heals, and the AC-277 scenario has no deterministic outcome. With `FOR SHARE` on T held by W until commit, M waits and then
converges W's row; if M wins, W's recheck under the lock refuses with `term_unavailable`. The same hole exists for `cms_restore_revision`, which carries an assignment "unchanged" from a term that a concurrent merge is retiring.

Proposed fix (a forward edit of the same WIP files; nothing is promoted yet). In each of the four writers, after the revision INSERT (the trigger `cms_entry_revisions_review_invalidation`, `20261005017580:487`, takes position 5 there, so position 6 is not acquired before it),
`perform 1 from platform_private.cms_terms t where t.id = any(<distinct planned term ids>) order by t.id for share;`, then re-run `cms_term_assignable` for the authored terms (restore: re-run `cms_restore_term_plan` and compare) and
raise the operation's refusal on a change; keep the `lock_timeout` / deadlock conversion to the typed 409 (the WIP gaps-db2 wrapper migration `130300` converts `deadlock_detected` and `lock_not_available` for the append, resolve and restore
wrappers once promoted; the `cms_create_entry` wrapper is not in its list). Add a source-order pgTAP assertion (as `phase_02_slice_12_gaps_lock_order.sql` does for other writers) and a `term merge versus assignment` scenario for the race lane.
If root prefers to defer, the decision must be recorded against AC-276/AC-277 so that the limitation text stays true.

#### V12-02 (MAJOR): the correction packet is one oracle short, and its fallout is not listed

(a) `tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts:90-94` is a real-stack case (browser request, Worker, PostgREST, newest SQL) whose table row is
`label: 'a non-empty taxonomy value', reason: 'taxonomy_source_unavailable', value: () => ({ termIds: [randomUUID()] })`, and the test asserts 422 `VALIDATION_FAILED` with `details.reasonCode` equal to
that token. With the lane's migrations an unknown term id is `term_unavailable`, so this case fails. `pnpm db:api-test` (`vitest.postgrest.config.ts`) is a blocking step of `pnpm db:verify` and `infra/verify-database.sh`
(tests/postgrest/README.md). The lane ran pgTAP and Vitest only, so it could not see it; `grep -rln termIds tests packages apps/worker/src` (generated ledgers excluded) finds this single file. Fix: change that row to `term_unavailable` (the case still pins pointer, status, nothing written)
and add a second row naming a real deprecated term so the real stack proves the assignable branch too.

(b) The retitled assertions are cited by the evidence ledgers and their generated receipts; after the diff is applied those titles no longer exist, so the evidence guards
(`tests/contracts/phase-02-evidence-guard-*.test.ts`) would flag the citations until they are re-cited. Exactly: `phase-02-slice-10-evidence-ledger-001-035.ts` and `phase-02-slice-10-receipts.generated.jsonl` cite the titles of
`value_source_refusal` #21 (`cms_create_revision: tax_nonempty ...`), `value_source_resolve` #9 (`cms_resolve_conflict: tax_nonempty ...`) and `compare_lineage` #14 (`a non-empty recorded taxonomy list fails closed ...`);
`phase-02-slice-11-evidence-ledger-067-100.ts` and `phase-02-slice-11-receipts.generated.jsonl` cite `helpers_preflight` #90 and #91 (`a recorded taxonomy version fails the taxonomy gate`, `the remaining generic taxonomy reference gate ...`).
The lane report does not mention the re-citation.

(c) `docs/runbooks/platform/cms-editorial.md:175` still says `taxonomy_source_unavailable` is "Expected until those providers land. Do not insert rows around it" for taxonomy; it becomes `term_unavailable`
(caller-owned: the term is merged, deprecated, unknown, of another vocabulary or not listed for this type and field).

#### V12-03 (MAJOR): clauses cited as provable are not discriminated by any assertion (surviving mutants, established by reading)

The ledger limitations for AC-244 and AC-246 name what a proof must show; the lane's report says they "become provable". These parts are not shown:

1. **Current active version ids on resolve and restore.** Every fixture records the same version id before and after. `050-restore.sqlinc:54-57` expects `vg1`, which is also what the source recorded, and `vg1` never changes
   in that file; `025-resolve.sqlinc:66-70` expects `vg1` with a theirs revision that recorded `vg1`. Survivors: restore records `source_row.taxonomy_version_ids` (the pre-lane behaviour); restore records each carried term's
   write-version instead of the vocabulary's active version; resolve keeps `theirs_row.taxonomy_version_ids`. (Create and append are covered: `027-successor.sqlinc:16-20` separates write-version from active version, and
   `020-encoder.sqlinc:115-116` separates "recompute" from "copy the base".) Needed: supersede the vocabulary between writing the source and restoring/resolving, and assert the new id in the revision and the old write-version in the assignment row.
2. **More than one vocabulary.** No revision is ever built from terms of two vocabularies (`grep` for two ids in one expectation finds only forged `taxonomy_version_ids` updates, `030-compare.sqlinc:28`, `040-provider.sqlinc:146`).
   Survivors: `cms_taxonomy_plan_version_ids` returning one id, or unsorted ids (`cms_version_set_of` requires distinct ids; it sorts bytewise). The clause "the active version ids of the vocabularies of its terms" (BE03b 1542, AC-246) is plural.
3. **Untested fail-closed branches** of `cms_restore_term_plan`: a source assignment on a field that is no longer an active taxonomy field of the target (`20261024100700:95-108`), a non-empty taxonomy value with no source assignment
   (`:173-180`), the hop cap and a missing successor (`:140-150`; the chain is also unreachable in v1: `20261014120400:171-175` refuses to merge a term that already has inbound redirects, so `050` builds its chain by forging rows with triggers paused).
   Each can be replaced by `continue` without a red test. The provider's `least(total_units, 1000)` cap (`20261024100200:89`) is likewise unexercised.

Fix: add the cases above to `027-successor`/`050-restore`/`025-resolve`; they need no new production code. Until then, root should not cite these tests for the "current active ids" half of AC-244, for the plural half of AC-246, or for the `unknown term` half of AC-244 (unreachable by the stored foreign keys; the plan still refuses it).

### MINOR

#### V12-04 (MINOR): `blockingCount` counts an assignment that fails two predicates twice (DEC-229)

BE03c:1574 (DEC-229): "`blockingCount` is the number of offending assignments plus offending manifest versions, as for the pattern provider" (changelog 1905: "one blocking unit per offending assignment or manifest version").
`20261024100200_cms_taxonomy_assignment_integrity.sql:54-72` counts merged assignments and allowlist-failing assignments with two separate `count(*) filter`, and `:80` adds them: an assignment to a merged term whose vocabulary also dropped the field is two units.
The pattern provider appends one reason per offending pin (`20261016044200`), so "as for the pattern provider" is one unit per offender. `040-provider.sqlinc:159-166` pins the over-count: after `hte1` is merged, offenders are two assignments and one inactive version = 3, the test expects 4
(the preceding expectation, 3, is right). Fix: count `current_row` rows where `merged or allowlist_failed` once, keep `bool_or` of each flag for the reason order, change the oracle at `:165-166` to 3 (or have root amend DEC-229 to "per predicate").

#### V12-05 (MINOR): amendment guards are weaker than the precedent and than the lane's own first two migrations

`20261024100100` and `20261024100300` prove the amendment reversible (`replace(new, anchor_new, anchor_old) = old`). `20261024100600` (three amendments) and `20261024100800` (one) check that each anchor occurs once and that no other `pg_proc` attribute or comment changed,
but never replay the inverse (`100600:52-58, 118-124, 196-202`; `100800:90-96`), which is the check that catches an anchor that matched text inside an earlier pair's replacement. The three wholesale `create or replace` bodies
(`cms_value_source_refusal` and `cms_require_value_source_available` in `100400:44-122`; `cms_restore_source_side_valid` in `100700:20-65`) carry no guard that the installed body is the expected predecessor, so a later lane's change to them would be dropped silently.
I diffed all three against their newest definitions (`20261005010100:376-411`, `20261005012100:213-235`, `20261005010500:216-259`): only the intended hunks differ (the taxonomy branch of the predicate, the contextual taxonomy branch, the `media`-only fail-closed test), and no sibling WIP lane touches them, so nothing is lost today.
Fix: add the inverse replay to the four pair amendments and an md5/sha pin of the predecessor body (the pattern of `20261017044800`) to the three wholesale ones.

#### V12-06 (MINOR): "deprecated is tolerated for an existing assignment" is honoured differently by the two writers

`cms_create_revision` re-checks every patched taxonomy value, so an editor who adds one term to a field that holds an already-assigned deprecated term is refused `term_unavailable` and must first remove the deprecated term
(`020-encoder.sqlinc:144-146` pins this as `a_keeps_resend`); `cms_resolve_conflict` exempts a value equal to theirs' (`100600:170-176`, `025-resolve.sqlinc:44-48`). BE03b 1542 literally refuses a deprecated term in a written value and
BE03c 1574 tolerates it for an existing assignment at publication only, so the lane's reading is defensible, but the two writers should not differ, and the user-visible rule (an unrelated edit of a tags field forces the removal of a deprecated tag) should be an explicit decision.
Fix: root decision, then either accept a term that is already an `active` assignment of the source revision in the same field (pass the source revision to `cms_require_value_source_available`) or record the strict rule in BE03c and drop the resolve exemption.

#### V12-07 (MINOR): duplicate `termIds` are stored as authored while the assignments are distinct

BOUNDARY 2 of the lane. `20261024100500:37-53` keeps one assignment per distinct term in first-occurrence order, but the field value (and its hash) keeps the duplicates (`020-encoder.sqlinc:48-52`). The value and the assignment set then
disagree on the count, and the value is not canonical. BE03b rejects duplicates for relation targets; for taxonomy it is silent. Recommend root decide: refuse duplicates with the uniform `VALIDATION_FAILED`, or canonicalise before hashing.

#### V12-08 (MINOR): documentation and housekeeping drift in the lane's files

- `supabase/migrations-wip/taxonomy-integrity/` (nine files) has no `README.md`, unlike `gaps-db2/` and `node-pointers/` (`supabase/migrations-wip/README.md`: "Give the lane directory a short README.md"; `.claude/rules/extensibility.md`).
- Comments that DEC-229 made stale: `20261024100200:13-14` and `040-provider.sqlinc:155` still call the precedence a BOUNDARY of the lane report.
- `cms_restore_source_side_valid`'s `comment on function` (`20261005010500:261-262`) still says "media/taxonomy content fails closed"; `100700` replaces the body without re-issuing the comment.
- Lane report "Requests to root" 2 is stale: `cms-workflow-labels.ts:86-91` already has the copy and `cms-editorial-platform-error-details.ts:32` already lists `term_unavailable` (root fixed both).
- BE03b 1542 still says assignments are "bound to the active TaxonomyVersion"; DEC-229 amended only BE03c item 3. The sentence should point to the storage-key rule.

#### V12-09 (MINOR): promotion coupling

The contracts registry already carries the taxonomy row (`preflight.ts:148-164`, `registryVersion '2'`) and the web copy is in place, while the promoted database still serves the reference gate; the pgTAP registry oracle goes the other way (the old `helpers_preflight` #14 is green only without the WIP, the corrected one only with it). Contracts, the nine migrations and the corrected oracles (the eight and the ninth of V12-02) must therefore land in one commit. The WIP timestamps (`20261024100000..100800`) sort before `gaps-db2` (`1300xx`) and `node-pointers` (`1400xx`); a database that applied the later ones first needs
`supabase migration up --include-all` (`supabase/migrations-wip/README.md`). The report's "full impact set" is 40 pgTAP files; 234 of the 436 other top-level pgTAP files mention an object these migrations change or read (mostly through the entry-creating helpers).
I ran 41 of them that execute the changed writers, the evaluator, the comparison or the restore against the staged WIP: 5,291 tests, 0 not ok (section 9), so I found no further contradiction among them; the remaining files are root's canonical `pnpm db:verify`.

### NIT

- V12-10. `20261024100200:78` compares `version_row.id::text = recorded.id` (no index use, fine at this size; `recorded.id::uuid` would be exact, but the cast would raise on garbage and the lane prefers the fail-closed path). `cms_restore_term_plan` declares `v_field_key` and never uses it (`100700:82`).
- V12-11. RED evidence is partial by construction: both RED drivers aborted at the first missing object (`alt-staged-tax-red-070619-2159328.tap`: 24 assertions, 7-10 and 9/12-14 not ok), so the provider and restore logic assertions were first seen green; the four mutants (22 not ok, `alt-staged-tax-mutant-190547-100132.tap`) are the substitute and they do kill the predicates they target.
- V12-12. Corrected `compare_lineage` #14 asserts only `00000:`; the next block of the same file also proves the comparison was computed (`response ? 'compare'`); do the same. Corrected `field_kind_definer_reach` #21 now proves only that the definer can run a predicate that returns NULL; adding `cms_term_assignable` to the reach list would cover the function that now does the work.
- V12-13. When a vocabulary has no active version at all, the provider reports `taxonomy_version_not_active` and not `allowlist_changed` (`040-provider.sqlinc:141-142` pins it, the spec is silent). Reasonable; worth one sentence in BE03c.

## 3. Spec conformity, clause by clause

Spec lines are in `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` (BE03c) and `.../03b-editorial-workflow-publication.md` (BE03b); criteria in `.memory/wiki/specs/phases/phase-2.md`.
Migration files are under `supabase/migrations-wip/taxonomy-integrity/` (`1000xx` below), tests under `supabase/tests/phase_02_slice_12_taxonomy_integrity/`.

| # | Clause | Implemented | Proven by | Verdict |
| --- | --- | --- | --- | --- |
| 1 | BE03c 1580, AC-242: `cms_resolve_taxonomy_version(p_taxonomy_version_id uuid)` resolves any version id of the caller's owner scope, any state, to `{taxonomyId, taxonomyKey, taxonomyVersion, state, contentHash}` | `100000:15-50` (owner scope = published acting party, explicit `owner_id` filter) | `010-resolver`: all eight states, exact five keys, lineage id, second organization, no party | CONFORMS |
| 2 | BE03b 1712 and 1718(1), BE03c 1580: absent or out-of-scope id is the non-disclosing `comparison_unavailable` | `100000:39-41` (P0001, message only, no DETAIL; absent, foreign, null and unpublished-party ids are one path) | `010` identical text for absent/foreign/null/no party; S10 `compare_lineage` "never names the recorded taxonomy version" is kept | CONFORMS |
| 3 | BE03c 1580: CMS-03B-03 comparison and the CMS-03B-04 lineage compare recorded versions by identity, no longer failing closed | `100100:12-80` (guard), `100800:37-45` (restore pin check) | `030-compare`; S10 `compare_lineage` keeps absent / foreign / not-a-UUID / mixed refusals; `050` `rs_rp`, `rs_rn` | CONFORMS |
| 4 | BE03c 1582 (3), AC-244: active and deprecated assignments carry unchanged, merged re-pointed to the successor, unknown or other-vocabulary 409 `migration_chain_incomplete`, nothing written | `100700:67-203`, `100800:46-55, 66-68` | `050`: carry, deprecated, re-point incl. a (forged) chain, collapse to one row, converged source, other-vocabulary, no-active-version, refused restores write nothing | CONFORMS (unknown term unreachable by the foreign keys; chain unreachable in v1) |
| 5 | BE03c 1582: the new revision's `taxonomy_version_ids` are the vocabularies' current active ids | restore `100700:151-170, 183-201`; create/append/resolve `100500:22-107` | create and append are discriminated (`027`, `020:115-116`); resolve and restore are not (V12-03) | IMPLEMENTED, PARTLY UNPROVEN |
| 6 | BE03c 1584 (5), BE03b 1542, AC-246: each `termId` an `active` term of a vocabulary whose active version lists the type key and the field key, else 422 `term_unavailable` | `100400:18-39, 74-122` | `020`/`025`: nine refusal shapes byte-identical, nothing committed, malformed encodings still bare `VALIDATION_FAILED`, media unchanged | CONFORMS |
| 7 | BE03b 1545, pointers: the token is the whole P0001 message; 422 at `/fields/{stableFieldId}` | `100400:109-110` (message `term_unavailable`, DETAIL `["/fields/<id>"]`); Worker `error-vocabulary.ts:16-17` | `020` detail equals `["/fields/<id>"]`; Worker token test row | CONFORMS |
| 8 | BE03b 1542: persisted as `TermAssignment` rows on create, append and conflict resolution | `100500:22-135`, `100600:16-217` | `020`, `025`, `027` | CONFORMS |
| 9 | BE03c 1535, AC-224: deprecated is not newly assignable; tolerated for an existing assignment (1574) | encoder `lifecycle = 'active'` (`100400:35`); carry keeps the row (`100500:54-69`); provider tolerates | `020` `a_depr_set`, `a_keeps`; `025` `x_theirs_deprecated`; `040` `dep` | CONFORMS (the writers differ on a rewritten field, V12-06) |
| 10 | BE03c 1574, AC-239, AC-241: provider registered as a newer row replacing the reference gate (category `taxonomy`, kind `database`), dispatched before the row names it | `100300:19-72` (dispatch), `:74-95` (row `...000141`, version 2) | `040` registry, ACL, STABLE, dispatch through `cms_evaluate_preflight` in every phase; contracts and registry-parity tests | CONFORMS |
| 11 | BE03c 1574: `term_merged_unconverged`, `allowlist_changed`, `taxonomy_version_not_active` | `100200:54-88` | `040`: each both ways, every recorded id read, absent revision `unavailable` | CONFORMS |
| 12 | DEC-229 (BE03c 1574): first present reason in that order | `100200:85-88` | `040:162-166` | CONFORMS |
| 13 | DEC-229: `blockingCount` is offending assignments plus offending versions | `100200:54-72, 80` | `040:165-166` pins 4, DEC-229 gives 3 | DEVIATES (V12-04) |
| 14 | BE03c 1491, 1804, AC-276/277: position-6 term locks | none | none | MISSING (V12-01) |

Reasons and statuses present and spelled as specified: `comparison_unavailable` (P0001 -> 422 via the existing Worker table), `migration_chain_incomplete` (409), `term_unavailable` (422), `term_merged_unconverged`, `allowlist_changed`, `taxonomy_version_not_active` (preflight 422 `preflight_failed` entries, contracts `preflight.ts:148-164`).
Contract and Worker edits are minimal and correct (`preflight.ts`, three test files, `error-vocabulary.ts`, token test); `prettier --check` is clean on all six and the focused suites pass (section 9).

## 4. Security and posture

| Check | Result |
| --- | --- |
| SECURITY DEFINER ownership, `search_path = ''` | Resolver, boolean form and provider are `SECURITY DEFINER`, owned by `wejammin_cms_definer`, `set search_path = ''`, every reference schema-qualified (`100000:15-26, 55-60`; `100200:21-27`). Resolver and provider are asserted by `h11_private_definer` (`010-resolver.sqlinc:13`, `040-provider.sqlinc:67`: owner, definer, search_path, no anon/authenticated/service_role/PUBLIC EXECUTE). |
| Grants of the other helpers | `cms_term_assignable`, `cms_taxonomy_value_plan`, `cms_taxonomy_plan_version_ids`, `cms_record_term_assignments`, `cms_restore_term_plan`, `cms_restore_record_term_assignments` are invoker functions owned by the definer, each followed by `revoke all ... from public, anon, authenticated, service_role` (`100400:137-138`, `100500:147-152`, `100700:239-242`); not asserted individually by the lane's suites, covered by the catalog inventories (`sec2_all_schema_definer_rls`, `r8_api_surface`, `gaps_rpc_inventory`, green in the lane's 40-file run with the nine files staged). `grant create on schema ... ; revoke create` pairs are balanced in every file. No new `platform_api` function, so no new API surface. |
| `app.cms_rpc` set and restored | Resolver (`100000:23, 32, 37`), provider (`100200:29, 40, 96`): set for the read, caller's value restored on every non-aborting path; `cms_taxonomy_version_resolves` inherits it and its exception block rolls back on error. Helper readers run inside the writer's context, exactly as the existing readers they sit beside. |
| PAT-031 | Context-cleared tests exist with a negative control: `060-resolver-context` (definer reads 0 rows with the flag cleared; resolver, boolean form and a real `cms_create_entry` still answer / persist; flag restored) and `045-provider-context` (0 rows control; provider still returns the real failing answers with the flag cleared; empty stays empty, set stays set). Both would fail without the flag in the function under test. Not present for the evaluator dispatch (existing code that relies on its callers) nor for append/resolve/restore (existing entry points that set the flag themselves). |
| RLS | No table, policy or trigger is added or changed. The four taxonomy tables keep `cms_rpc_context_valid()` forced policies; the nine migrations only add readers and writers that run under that context. |
| Owner scoping | Resolver filters `tv.owner_id = party_id` (`100000:33-36`); `cms_term_assignable` filters `term.owner_id = p_owner_id` and `active_version.owner_id = term.owner_id` (`100400:26-38`); the plan joins `term.owner_id = p_owner_id` (`100500:84`); the restore plan scopes every term, version and active-version lookup to `p_owner_id` (`100700:94, 131-134, 145-146, 151-152`). Cross-owner shapes are tested: `vf1` / `foreign` in `010`, `020`, `030`. The schema owner and the entry owner are the same party (`cms_create_entry` requires `candidate.owner_id = acting_party_id`), so check and persistence use one owner. |
| Secrets, PII, logs | None touched. The restore audit and event payloads still carry no value or term identity. |

## 5. Anchored patches of live bodies

Each row was checked against the newest definition across `supabase/migrations/` and the three WIP directories. Sibling WIP lanes: `gaps-db2` (`130000..130300`) patches the template guards, `claim_outbox_batch`, `cms_define_template` and the `platform_api` wrappers of define / append / resolve / restore; `node-pointers` (`140000..140100`) patches `cms_create_pattern_version`. **No sibling touches any function body this lane changes** (the wrapper patch targets the `platform_api` wrapper text, not the `platform_private` bodies). One indirect overlap: `gaps-db2` `130000` adds a lifecycle-column guard to `cms_taxonomy_versions`; this lane's fixtures change a version's `state` with the user triggers paused (`h11_raw_exec`) and its production code never updates that table, and the combined run is green. The combined 15-migration run (`alt-staged-taxonomy-integrity+gaps-db2+node-pointers-190504-97171.tap`, 156/156) shows the anchors still apply in the combined order.

| Function | Migration | Kind | Predecessor | Anchors | Inverse check | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `cms_compare_revision_resolvable(uuid,uuid)` | `100100` | anchored | `20261005014100` | 1 | yes (`:62-65`) | attribute and comment equality checked |
| `cms_evaluate_preflight(jsonb)` | `100300` | anchored | after `20261016044400` (pattern branch) | 1 (+ `strpos` double-install guard) | yes (`:54-57`) | same anchor as the locale and pattern branches |
| `cms_value_source_refusal(text,jsonb)` | `100400` | wholesale | `20261005010100:376-411` | none | none | diff vs predecessor: taxonomy branch removed only |
| `cms_require_value_source_available(uuid,uuid,jsonb)` | `100400` | wholesale | `20261005012100:213-235` | none | none | diff: adds the taxonomy branch; the DETAIL pointer branch is byte-equal |
| `cms_create_entry(jsonb)` | `100600` | anchored | `18040` + `20261022010100` | 2 | no | |
| `cms_create_revision(jsonb)` | `100600` | anchored | `18045` + `20261016042200` carry | 3 | no | |
| `cms_resolve_conflict(jsonb)` | `100600` | anchored | `18050` + `20261016042200` carry | 4 | no | |
| `cms_restore_source_side_valid(...)` | `100700` | wholesale | `20261005010500:216-259` | none | none | diff: `kind in ('media','taxonomy')` -> `= 'media'`; comment not re-issued |
| `cms_restore_revision(jsonb)` | `100800` | anchored | `18055` + `20261017044800` (DEC-201) | 6 | no | payload hash is computed after the rewritten values (live `:397-402`), so the hash covers the carried terms |

See V12-05 for the missing inverse and baseline guards. All six anchored amendments assert owner, definer, volatility, language, `search_path`, comment and every other `pg_proc` attribute unchanged, which is the strongest part of this lane's method.

## 6. Lock order, idempotency, determinism

- Lock order: the lane's amendments add reads and inserts but no lock; positions 0-5 are the writers' existing ones (entry row `FOR UPDATE`, current and base revision `FOR SHARE`, schema version `FOR SHARE`, relation targets `FOR SHARE` ascending). Position 6 is missing (V12-01). No new lock means no new deadlock risk; the WIP gaps-db2 wrapper conversion of `lock_not_available` / `deadlock_detected` covers the append, resolve and restore wrappers once promoted.
- Idempotency: every amended path sits behind the command's existing reservation; a completed replay returns the stored response before any amended statement runs. The stored `taxonomyVersionIds` of append and resolve is now read back from the inserted revision (`100600:96-98, 164-166`), so a replay and the first response agree.
- Determinism: assignment positions are explicit (`row_number() ... order by first_ordinal`), carried rows keep their stored position, `taxonomy_version_ids` are distinct and sorted `collate "C"` (`100500:98-106`, `100700:200-201`; `cms_version_set_of` rejects duplicates and wants bytewise order), restore iterates fields by stable id and terms by `position, term_id`, the chain walk is bounded (64).

## 7. Test quality

RED evidence: two RED drivers (`alt-staged-tax-red-070619-2159328.tap`, `alt-staged-taxonomy-integrity-070226-2135136.tap`) show the genuine missing-feature failures and then abort at the first missing object; the provider and restore logic assertions were therefore first observed green (V12-11). The lane classified aborts as harness, correctly.
Mutants (`alt-staged-tax-mutant-190547-100132.tap`, sha256 `29c91054...04bc4`): the four named mutants fail 22 assertions (15 in the gallery driver, 7 in the provider driver) and each is killed by the predicate it targets; I re-read the manifest: the mutated files are `100200`, `100400`, `100700` and the other six hashes equal the GREEN run.
Predicates both ways: provider (merged, deprecated, active, converged; type key dropped, field key dropped, both listed; recorded id inactive, absent, second id, no active version; precedence; unavailable for absent and null revision), encoder (nine refusal shapes plus accepted, empty, duplicate), resolver (eight states, absent, foreign, null, no party), comparison (retired and draft resolve; absent and foreign refuse on either side), restore (active, deprecated, merged, chain, collapse, converged, other-vocabulary, no active version, retired pin, vanished pin). Gaps: V12-03.
Hoped-for context: the world helpers hold `app.cms_rpc = 'true'` for the whole transaction, which is why `045`/`060` exist and are good; the comparison test (`030`) pre-publishes the acting party with `ti_session`; the real path is source-verified instead: `cms_list_revisions` calls `cms_acting_party` at `20261005018020:106`, before its two guard calls at `:459-462`, and the same holds for create / restore (`18045:76`, `18055:115`). A pgTAP transaction cannot prove a cold session, because the published GUC persists across calls in one test. The vocabulary and term rows are labelled forgeries with user triggers paused; no assertion depends on a forged assignment except the three restore refusals, each labelled.

## 8. The eight proposed corrections (per file)

Mechanics verified: the diff applies with `patch -p1` to scratch copies of the eight originals, and each result equals the lane's `_corrected_oracles/*.sqlinc` copy once the `\ir ../` prefix is removed (eight byte-identical comparisons, all clean). No assertion line is deleted; every hunk replaces an expectation in place, so no negative case is lost. The lane's 565-test corrected run is green.

| File | Oracle replaced | Contradicted by (spec line) | Strength | Verdict |
| --- | --- | --- | --- | --- |
| `phase_02_slice_10_compare_lineage.sql` #14 | refusal for a recorded taxonomy version that exists in the owner scope | BE03c 1580 "no longer fail closed for a non-empty reference"; BE03b 1718(1) "Until then" | flips polarity, keeps the four negative cases (absent, foreign, not-a-UUID, mixed) that sit around it | **ACCEPT** (NIT V12-12: also assert the comparison was computed) |
| `phase_02_slice_10_value_source_encoding.sql` #41-42 | context-free predicate returns `taxonomy_source_unavailable` for a non-empty / full taxonomy value | BE03c 1584 / BE03b 1542: the fail-closed encoder is "replaced"; contextual refusal moves to `cms_require_value_source_available` | the refusal coverage moves to `020`; media rows unchanged | **ACCEPT** (indirect: it contradicts the lane's retirement of the predicate branch, which the spec text justifies; a dead branch returning a retired token would be worse) |
| `phase_02_slice_10_value_source_refusal.sql` #6, #21 | `taxonomy_source_unavailable` for create and append of `tax_nonempty` (a random term id) | BE03b 1542 and BE03c 1535 last sentence: an unknown term is `term_unavailable` | same exact-token strength | **ACCEPT** |
| `phase_02_slice_10_value_source_resolve.sql` #9 | same, for resolve | same | same | **ACCEPT** |
| `phase_02_slice_10_field_kind_definer_reach.sql` #21 | definer runs `cms_value_source_refusal('taxonomy', ...) = 'taxonomy_source_unavailable'` | as encoding #41 | proves execute reach of a NULL-returning predicate | **ACCEPT** (NIT V12-12: add `cms_term_assignable` to the reach list) |
| `phase_02_slice_10_validation_pointers.sql` #23 | `taxonomy_source_unavailable ["/fields/<id>"]` | BE03b 1542, 1545 | token changes, pointer assertion kept | **ACCEPT** |
| `phase_02_slice_11_helpers_preflight.sql` #14, #90-91 | registry string row for taxonomy; recorded unknown version fails `provider_unbuilt_reference`, count 1 | BE03c 1574 (newer row; `taxonomy_version_not_active` for a recorded id that is not an active version) | reason and exact count 1 kept | **ACCEPT** |
| `phase_02_slice_11_rpc_review_submit_refusals.sql` #19 | the failed taxonomy entry is `provider_unbuilt_reference` | BE03c 1574 | exact entry and `16 passed` count kept | **ACCEPT** |

Required additions to the packet (not weakenings): the real-stack case of V12-02(a); re-citation of the five retitled assertions in the S10 and S11 ledgers and receipts (V12-02(b)); the runbook row (V12-02(c)).

## 9. Runs (mine)

| # | Time (local, approx.) | What | Result |
| --- | --- | --- | --- |
| 1 | 19:25 | `vitest run` of the four contract and Worker files the lane edited (`preflight.test.ts`, `preflight-providers.test.ts`, `tests/contracts/phase-02-slice-11-sql-parity.test.ts`, `cms-editorial-production-error-tokens.test.ts`) | 4 files, 82 tests, pass |
| 2 | 19:29 | `vitest run` of the lane's full set (contracts `cms-editorial` + `cms-composition`, the sql-parity test, Worker `cms-editorial*`) | 206 files, 3,089 tests, pass (the lane's exact figure) |
| 3 | 19:31 | `vitest run` of five neighbouring registry consumers (web workflow labels and pattern reasons, contracts preflight reasons / coverage / pattern provider) | 5 files, 28 tests, pass |
| 4 | 19:33 | `node infra/generate-openapi.mjs --check` (the body of `pnpm contracts:check`) | exit 0, no file changed |
| 5 | 19:35 | `prettier --check` on the six TypeScript files the lane edited | clean |
| 6 | 19:20 | `patch -p1` of `lane-taxonomy-integrity-test-corrections.diff` onto scratch copies of the eight originals, then `diff` against the eight `_corrected_oracles/*.sqlinc` copies (with the `\ir ../` prefix removed) | 8 of 8 apply; 8 of 8 identical |
| 7 | 19:27 queued, lock 19:36:09, reset ok 19:36:48, done ~19:40 | **Staged ALT run, lane `taxonomy-integrity`** (543 promoted + the 9 WIP migrations), 41 top-level pgTAP files that execute the changed writers, the evaluator, the comparison or the restore and were not in the lane's 40-file set (file list in appendix B) | stamp `192735-159911`, plan: no_plan per file; **Files=41, Tests=5,291, Result PASS, exit 0, 0 not ok**; TAP `.lane-logs/alt-staged-taxonomy-integrity-192735-159911.tap` sha256 `5fa4b56608d7dcdd85903f1ccec38feb22b7f12e161b06a51c2aad3ca7533490`; its manifest lists the nine WIP files with the hashes of appendix A |

Run 7 used the original (uncorrected) oracles in all 41 files and found no further contradiction, which supports the lane's claim that only the eight files (plus the real-stack file of V12-02) encode the retired behaviour. Verified from the lane's own logs, not re-run: the final GREEN (`...072706-2281778.tap`, 156/156, sha256 `7657e730...64ab8`), the impact run (`...190103-87298.tap`: 40 files, 2,797 tests, exactly the 11 intended `not ok` in 8 files), the corrected-oracle run (`...190418-94136.tap`: 10 files, 565 tests, PASS), the combined 15-migration run (`...190504-97171.tap`: 156/156) and the mutant run; every staged manifest carries the nine current WIP hashes (the mutant manifest differs only in `100200`, `100400`, `100700`).
Not run, by rule or by role: race modules, `pnpm db:verify` / `db:lint` / `db:api-test`, Playwright, any mutant, any populated-database migration witness (the migrations touch no data except one registry insert, so the risk is low; root's usual witness applies).

## 10. What holds (confirmed independently)

- The nine WIP files are the bytes that were tested: their SHA-256 equal the staged manifests of the GREEN, combined and sweep runs.
- No sibling WIP lane (`gaps-db2`, `node-pointers`; `placement-perf` has no migration yet) changes a function body that this lane changes; the combined staged order applies all 15 migrations and both drivers pass.
- Every new private function has the SEC-2 posture; the two definer entry points and the provider set and restore `app.cms_rpc` and have context-cleared tests with a negative control (PAT-031).
- `term_unavailable`, `comparison_unavailable`, `migration_chain_incomplete` and the three preflight reasons are raised, mapped and spelled as the spec says, and each raise is exercised through the real command (DEC-226 rule 4).
- Owner scoping holds in the resolver, the encoder, the plan and the restore plan, with a foreign-owner control for each read.
- The restore rewrites the stored taxonomy value from the carried assignments before the payload hash is computed, so the stored value and `payload_hash` agree by construction (both read the rewritten `final_values`: live `20261005018055:402` and `:428`).
- Create and append record the vocabularies' current active ids, not the term's write-version, and a cleared field records none (`027`, `020`); the assignment row names the term's write-version, which the stored composite foreign key requires and DEC-229 ratifies.
- The contracts, Worker and registry-parity edits are minimal, formatted, and green; `contracts:check` is unaffected.

## 11. Conditions and requests to root

Conditions to close before the batch is promoted (the first, third and fourth are small and local; the second is the largest):

1. **V12-02.** Correct `tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts:90-94` (`term_unavailable`) with the eight; re-cite the five retitled assertions in the S10 and S11 ledgers and regenerate their receipts; update the runbook row.
2. **V12-01.** Implement the position-6 `FOR SHARE` lock with a recheck under it in the four assigning writers, with a source-order pgTAP assertion and a merge-versus-assignment scenario for the race lane; or record an explicit deferral against AC-276 and AC-277 (my recommendation is to implement now: it edits the same four bodies the batch already amends, and a later fix needs a second forward migration over the same text).
3. **V12-03.** Add the resolve / restore "current active id" cases, one two-vocabulary revision, and the restore refusal branches; do not cite the current tests for those clauses.
4. **V12-04.** Count offending assignments once (and change `040-provider.sqlinc:165-166` to 3), or amend DEC-229 to "per predicate".

Decisions only root can take: V12-06 (is a deprecated term already assigned in the field "existing" when the field is rewritten), V12-07 (duplicate `termIds`), and the BE03b 1542 sentence ("bound to the active TaxonomyVersion") versus DEC-229.
Land together in one commit: contracts + the nine migrations + the eight corrections + the ninth + ledger/receipt re-citations; apply `supabase migration up --include-all` where the later WIP batches were applied first.

### Re-citation guide (what the lane's tests may carry)

| Criterion | Cite | Do not cite for |
| --- | --- | --- |
| AC-221 (assignment clause) | `020-encoder` wrong-field, wrong-type, allowlist-dropped refusals | |
| AC-224 (not newly assignable) | `020` `a_depr_set`, `a_keeps`, `a_keeps_resend`; `025` `x_theirs_deprecated`; `040` `dep` | the claim that the writers agree (V12-06) |
| AC-239 | `040` registry, tolerated / merged / allowlist / not-active, every recorded id, precedence | the count at `:165-166` until V12-04 is fixed |
| AC-241 (taxonomy) | `040` evaluator tests; contracts `preflight.test.ts` and `preflight-providers.test.ts`; web label test | |
| AC-242 | `010-resolver`, `030-compare`, `060-resolver-context` | |
| AC-244 | `050` carry, deprecated, re-point, collapse, converged, other-vocabulary, no-version, pin checks | "current active ids" (V12-03.1), "unknown term" (unreachable), the refusal branches (V12-03.3) |
| AC-246 | `020`, `025`, `027` (create, append, clear, refusal matrix, pointer) | resolve and restore ids, the plural-vocabulary reading (V12-03.1-2) |
| AC-276 / AC-277 | nothing from this lane | the position-6 rule and the merge-versus-assignment scenario (V12-01) |

## Appendix A. Files reviewed (lines, SHA-256)

| File | Lines | SHA-256 |
| --- | --- | --- |
| supabase/migrations-wip/taxonomy-integrity/20261024100000_cms_resolve_taxonomy_version.sql | 88 | dcc3818ee3ef8e7ff9ebef37e3e75cf1a894ebaa32967a5da6540355f11b436b |
| supabase/migrations-wip/taxonomy-integrity/20261024100100_cms_compare_taxonomy_resolution.sql | 82 | f51c7b4ee6838eb5bece7dcb73833c66eabae3888e1182decbde1f42a4192ca3 |
| supabase/migrations-wip/taxonomy-integrity/20261024100200_cms_taxonomy_assignment_integrity.sql | 119 | 989a70b9e8ec3f69ae9cd3ff0a1e8985b354019224114c661fb7f2632bc9fd22 |
| supabase/migrations-wip/taxonomy-integrity/20261024100300_cms_preflight_taxonomy_provider.sql | 97 | 10b759b7a50bb13d5222832328b72506076bcf51b19bf4208fa9e8807fdc124b |
| supabase/migrations-wip/taxonomy-integrity/20261024100400_cms_taxonomy_value_encoder.sql | 140 | dc439b8adbdd887876265b5dde07120209ae688eda35f22b397bda3ed4c26703 |
| supabase/migrations-wip/taxonomy-integrity/20261024100500_cms_taxonomy_assignment_plan.sql | 154 | f00eafffc52b2ada4f8159d5834a219716c810ddc14d0198a0df39642ba4ad04 |
| supabase/migrations-wip/taxonomy-integrity/20261024100600_cms_write_commands_term_assignments.sql | 219 | b471aa31203cadf0d44be16695893ba7183adb69d3d47b0d32fffab6ad8c19fc |
| supabase/migrations-wip/taxonomy-integrity/20261024100700_cms_restore_term_assignments.sql | 244 | c5e5f661462097a934620782a882f122cc53590aeaa4345530825da74755c58f |
| supabase/migrations-wip/taxonomy-integrity/20261024100800_cms_restore_revision_term_plan.sql | 113 | b09c3cb65ba8b622a97453c9d103a776df3a0512c203df90d9997c98ff0a3340 |
| supabase/tests/phase_02_slice_12_taxonomy_integrity.sql | 29 | fa0d62f477380f436b8caccb87ae0777404aff3f0349a3b35451339f5afb1903 |
| supabase/tests/phase_02_slice_12_taxonomy_integrity_provider.sql | 31 | 878256a67d9f2259c8783edadb09b6a2d00984ac4ab44d290ebd8566206aae16 |
| supabase/tests/phase_02_slice_12_taxonomy_integrity/000-world.sqlinc | 110 | 1fed0cff99073b733875586efe8a306a9b465831ffae7fac2e3394be25009ab5 |
| supabase/tests/phase_02_slice_12_taxonomy_integrity/005-gallery-vocab.sqlinc | 50 | 05bc539b57b68dcdfe427f9560d356b1d656cab17fe135ef0ad9c8861a34b764 |
| supabase/tests/phase_02_slice_12_taxonomy_integrity/010-resolver.sqlinc | 68 | 4278d110d1260d0f8995ca77885fe171aabfcc136f5d8dd799a43f05d08cbbb1 |
| supabase/tests/phase_02_slice_12_taxonomy_integrity/020-encoder.sqlinc | 148 | c04dd0b414c2b1a58b1445365a9d321cd5df2efd304ca61ac715dd7b5c20423f |
| supabase/tests/phase_02_slice_12_taxonomy_integrity/025-resolve.sqlinc | 70 | 5297dda1dc7e172b46bd1b2732007fcd722afdf24f517c5aee00ca2d173e8da8 |
| supabase/tests/phase_02_slice_12_taxonomy_integrity/027-successor.sqlinc | 21 | cf637f46045fac43c7ac5255be4ed9511062b7447bc584efd5673cbb72d2a099 |
| supabase/tests/phase_02_slice_12_taxonomy_integrity/030-compare.sqlinc | 50 | c2bf49b3f03baeaf81377c97c07d211396f583b7e6fe0862faffab21fe9a9305 |
| supabase/tests/phase_02_slice_12_taxonomy_integrity/040-provider.sqlinc | 212 | c33f0bfb7acf48602d6f698340c74bd45069b7fac5d14a98d12bab0ef6743d46 |
| supabase/tests/phase_02_slice_12_taxonomy_integrity/045-provider-context.sqlinc | 33 | 9514ffde96b53731b72e522944953c8a4e91a05cfb98dc375e60deada8afe354 |
| supabase/tests/phase_02_slice_12_taxonomy_integrity/050-restore.sqlinc | 131 | 9a61e7b0e7f511a2d40ff722f6998d6fcf5a287c1b5b76b7ae5df8cea92feb2a |
| supabase/tests/phase_02_slice_12_taxonomy_integrity/060-resolver-context.sqlinc | 40 | 9ee16f55278c77466a5dab0d5c782222d8be6710f204e8feb73a82731e6ff382 |
| supabase/tests/phase_02_slice_12_taxonomy_integrity_corrected_oracles/phase_02_slice_10_compare_lineage.sqlinc | 277 | f83ce02203b167e60818b3562cff67fdf1b5285f1e7525994f62a5e9e1d90c06 |
| supabase/tests/phase_02_slice_12_taxonomy_integrity_corrected_oracles/phase_02_slice_10_field_kind_definer_reach.sqlinc | 153 | 35476f2a508c0c72715b6dc3d9d3dd4c7c515d0b3161e16f0adc470d5ea55c8e |
| supabase/tests/phase_02_slice_12_taxonomy_integrity_corrected_oracles/phase_02_slice_10_validation_pointers.sqlinc | 232 | 86b0eb28f58b6e12bc7b411ea56100c8915b5405b5b9bb637f7e4b8165bac435 |
| supabase/tests/phase_02_slice_12_taxonomy_integrity_corrected_oracles/phase_02_slice_10_value_source_encoding.sqlinc | 209 | 6d863b42b90da94aa894391d2cbce563134338a7782906f80f2e75e249552ed4 |
| supabase/tests/phase_02_slice_12_taxonomy_integrity_corrected_oracles/phase_02_slice_10_value_source_refusal.sqlinc | 175 | 90eb7c6bf8a13532c2d93dcd17576ea79fa9e9687df8d2a363fd8a0eff3a4d61 |
| supabase/tests/phase_02_slice_12_taxonomy_integrity_corrected_oracles/phase_02_slice_10_value_source_resolve.sqlinc | 167 | c41cbcaf54c9d2cd10a68b962d18e8b1ae97d7c4ce9a36086572a4470ac978bf |
| supabase/tests/phase_02_slice_12_taxonomy_integrity_corrected_oracles/phase_02_slice_11_helpers_preflight.sqlinc | 899 | 45ab4a0f02a1a3ce5ec0743d9a2d3429d714c76f32a3b96fa95c08e09c93e920 |
| supabase/tests/phase_02_slice_12_taxonomy_integrity_corrected_oracles/phase_02_slice_11_rpc_review_submit_refusals.sqlinc | 239 | 3602f0c8cc0c336b8f9dcf2de67e1a3dd0a3dd82b85c4ec61f9dbb0f2107ff6a |
| docs/handoffs/2026-10-22-claude-s12/lane-taxonomy-integrity-test-corrections.diff | 132 | 664852f9296ce4c199af1ba4b808e1013a602d913951c2d542e9c2c2fed62b23 |
| docs/handoffs/2026-10-22-claude-s12/lane-taxonomy-integrity-report.md | 119 | 43e49f01da4f817ee87b913c1e1b324f5db87e833ef72a45e842f770e841b432 |
| packages/contracts/src/cms-editorial/preflight.ts | 496 | e1e3462920122bf8c19685037c0a8d30c0b901b69129fcfeaa31bcd4600e789c |
| packages/contracts/src/cms-editorial/preflight.test.ts | 795 | 8894169b0755c31f74b28f3124f5df4f67a123d0b38fbb7a514279e81be09373 |
| packages/contracts/src/cms-composition/preflight-providers.test.ts | 99 | 822c7f325c80a509cea61bb8fd9e84134a028ba52525171f762ce254e1d56457 |
| tests/contracts/phase-02-slice-11-sql-parity.test.ts | 286 | 9061f5f73aad1c0f6fddccdd4afa1038847580f96fa3991a5e333b5de6377964 |
| apps/worker/src/cms-editorial/error-vocabulary.ts | 62 | 76167b6ec5e7920ecdf44888b0478992f653df6a0f82eca8df36a503eb519673 |
| apps/worker/src/cms-editorial-production-error-tokens.test.ts | 367 | affdb931c6f35236c4b6eeea2acd9c2da3659b759930989e6c29c2cfc0803a6a |

Also read in full or in the relevant parts: the lane report and brief, `lane-rules.md`, BE03c (1491-1584, 1535, 1574, 1592-1626, 1795-1810, changelog), BE03b (1535-1548, 1710-1718), `phase-2.md` AC-221/224/239/241/242/244/246/276/277 and their ledger limitations, the predecessor definitions cited in section 5, the sibling WIP lanes, `tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts`, `docs/runbooks/platform/cms-editorial.md:168-182`, and the lane's TAP / manifest logs under `.lane-logs/`.

## Appendix B. The 41 files of run 7

- phase_02_slice_09_evidence_paths.sql
- phase_02_slice_09_p240_a03_relation.sql
- phase_02_slice_09_entry_version_lock.sql
- phase_02_slice_09_schema.sql
- phase_02_slice_10_compare_chain_shared.sql
- phase_02_slice_10_write_path_locks.sql
- phase_02_slice_10_activation_lock_order.sql
- phase_02_slice_10_conflict_lifecycle.sql
- phase_02_slice_10_ev_ea_atomicity.sql
- phase_02_slice_10_ev_ea_authority.sql
- phase_02_slice_10_ev_ea_write_contract.sql
- phase_02_slice_10_ev_eb_create_validation.sql
- phase_02_slice_10_ev_eb_read_restore_resolve_read.sql
- phase_02_slice_10_protected_validator_freeze.sql
- phase_02_slice_10_response_contracts.sql
- phase_02_slice_10_rpc.sql
- phase_02_slice_10_value_encodings.sql
- phase_02_slice_10_field_kind_draft_gate.sql
- phase_02_slice_10_relation_authoring.sql
- phase_02_slice_10_successor_create.sql
- phase_02_slice_10_calendar_authoring.sql
- phase_02_slice_10_presence_lease.sql
- phase_02_slice_10_write_refusal_contract.sql
- phase_02_slice_10_snapshot_owner_integrity.sql
- phase_02_slice_10_comparison_domains.sql
- phase_02_slice_11_criteria_publish_gates.sql
- phase_02_slice_11_rpc_review_submit.sql
- phase_02_slice_11_rpc_publication_lock_order.sql
- phase_02_slice_11_e2_adoption.sql
- phase_02_slice_11_e7_settings_writer_tail.sql
- phase_02_slice_11_helpers_version_set.sql
- phase_02_slice_11_criteria_manifest_rls.sql
- phase_02_slice_11_recheck_index.sql
- phase_02_slice_12_block_rules_legacy.sql
- phase_02_slice_12_dec193_pattern_currentness.sql
- phase_02_slice_12_dec193_security.sql
- phase_02_slice_12_dec193_consumers.sql
- phase_02_slice_12_dec194_sweep.sql
- phase_02_slice_12_entry_default_template.sql
- phase_02_slice_12_composition_authority.sql
- phase_02_slice_12_taxonomy_terms_canonical.sql

## Verification

Appended 2026-10-28 by the same reviewer (V12), acting as verifier and not as fixer. Only this report was edited in the repository (the staged runner wrote its usual logs under `.lane-logs/` and reset the ALT stack as it always does; my scratch copies live in the session scratchpad). The first pass was cut off by the session limit after its evidence was gathered; on resume I re-hashed every input again (results below), so nothing in this section rests on a state that has since moved.

Inputs, all read at their current bytes:
- the lane report `docs/handoffs/2026-10-22-claude-s12/lane-taxonomy-integrity-report.md` (SHA-256 `ce67692065d8c60099cbbc953fcfd1579f019cc5f436d34aa4d93a612025a1cc`), section `## V12 follow-ups` (line 124 to the end);
- `supabase/migrations-wip/taxonomy-integrity/` (nine migrations and the new `README.md`), the tests (`phase_02_slice_12_taxonomy_integrity.sql`, `..._provider.sql`, the new `..._lock_order.sql`, the `.sqlinc` includes with the new `028-active-ids` and `046-provider-cap`, the tests `README.md`) and the two changed corrected oracles. All 19 changed files have a SHA-256 equal to the lane's "after" table. The three unchanged migrations (by prefix), the eight unchanged `.sqlinc` includes and the six contracts and Worker files of my first report are byte-identical to my first report's hash table (14 files re-hashed today);
- the correction diff `lane-taxonomy-integrity-test-corrections.diff` (SHA-256 `755c7a6603daab67091decda50eac3f305e818c662928de802feffafd2820d7b`): ten file diffs (eight pgTAP oracles, the real-stack apispec, the runbook); `git apply --check` passes on today's working tree;
- the DEC-233 raw record `dec-233` (`.memory/raw/events/2026-10-27.jsonl`) and the amended specs: BE03c `Receiving obligations from Slice 10 (DEC-141)` item 5 (line 1595) and its changelog row (line 1922), BE03c `Slice 12 lock order` (lines 1500-1517, position 6 defined at 1502), BE03b `Value encodings by field kind` taxonomy row (line 1542) and changelog (line 2293), and `phase-2.md` P2-S12-AC-276 and AC-277.

### Verdict: PROMOTE

All thirteen findings are closed in the current bytes. The three MAJOR findings are closed by code and by tests that fail without the fix: the lane's RED run (199 tests, 22 not ok against the previous WIP) is on disk and I matched its failures to the new behaviours assertion by assertion. The DEC-233 implementation matches the raw record and the amended spec. The two term-lock helpers follow BE03c position 6, and I found no deadlock path between them and the composition carry or copy they follow (static analysis of the live bodies, not a two-session run). I found no new BLOCKER and no new MAJOR. The four new items (V12-14 MINOR, V12-15 MINOR, V12-16 NIT, V12-17 NIT) are test and documentation hardening; none requires a functional change to the migrations (V12-16 touches comments).

What PROMOTE does and does not say. It is a verdict on the lane's bytes: nothing in them has to change first. It does not say that the position-6 lock is proven under concurrency: P2-S12-AC-276 (lock order and typed conversion under real waits) and the "term merge versus assignment" scenario of P2-S12-AC-277 have no dynamic proof of the new lock and stay unverified until a two-session test exists (open item 2). The promotion commit also carries a mechanical checklist that belongs to root (open items 1, 3 and 4): apply the ten-file diff, re-cite five retitled assertions in four tracked files, promote `nestable-read` first or together, land contracts, migrations and diff in one commit.

### Status of V12-01 to V12-13

| Finding | Status | Evidence in the current bytes |
| --- | --- | --- |
| V12-01 MAJOR position-6 term lock | **CLOSED** (code, static oracle, RED to GREEN); the dynamic proof is root's | `cms_lock_term_plan` (`100500:143-190`) locks the plan's terms `order by term.id for share` (`:156-167`) and re-checks the authored terms under the lock (`:170-188`); `cms_restore_lock_term_plan` (`100700:245-270`) locks the carried terms and re-runs `cms_restore_term_plan`, a changed plan is CONFLICT (`:265-268`). All four writers call them after the revision insert and the composition carry or copy and before the assignment rows: `100600:31-38` (create entry), `:106-116` (append), `:193-205` (resolve), `100800:64-74` (restore). Only these writers insert assignment rows besides the promoted merge convergence (a multi-line scan of every promoted and WIP migration finds exactly four `insert into platform_private.cms_term_assignments`: `20261014120300:94,105`, `100500:126`, `100700:229`). RED: the previous WIP (`100600` = delivery-1 hash `b471aa31...`) fails 22 of 199 assertions (`alt-staged-taxonomy-integrity-195004-218080.tap`, 177 ok), among them the eight source-order assertions and gallery `#127-128`; GREEN 199/199 on the current bytes (`...195653-233244.tap`, SHA-256 `487ce2b8d4caec38...`). The static oracle now has 11 assertions (four per-writer orders, an exactly-once check, two reversed-anchor controls, two helper-internal orders, one control, the typed-conversion marker). Mutants M11, M12, M18 and M19 are the lock mutants (lock order `#1/#2/#4/#5`, gallery `#128`). Order, snapshot and deadlock analysis below. |
| V12-02 MAJOR ninth oracle | **CLOSED** | The diff now has ten file diffs; the two new ones are `tests/postgrest/phase-02-slice-10-ev-ea-typed-reasons.apispec.ts` (row 3 becomes label "a non-empty taxonomy value naming an unknown term", reason `term_unavailable`; the case still asserts 422, `details.reasonCode`, the pointer and that nothing was written) and `docs/runbooks/platform/cms-editorial.md:175` (the row now names `term_unavailable` and `media_source_unavailable`). I applied the diff to scratch copies of the ten originals with `patch -p1`: the eight pgTAP results equal the eight `_corrected_oracles/*.sqlinc` copies line for line except for the documented `../` prefix of the `\ir` lines (8 of 8). The lane lists the five cited retitled assertions with old and new titles, identical to my list. Accepted residue: no second real-stack row for a real deprecated term (the real-stack world has no vocabulary seeding; the lane assigns it to the AC-246 real-stack lane). Root still has to re-cite the five ledger and receipt entries (open item 1); that is an action, not a defect. |
| V12-03 MAJOR discrimination | **CLOSED** | `028-active-ids.sqlinc` (resolve `:19-37`, restore `:39-54`, two vocabularies on create, append and restore with the term order reversed against the id order `:56-82`, the four restore refusals and the 64/65-hop boundary `:83-155`, the lock helper recheck both ways `:157-end`) and `046-provider-cap.sqlinc` (1001 offenders report 1000). The lane's three mutant lanes are on disk and their counts match the report: `tmut-a` 17 not ok, `tmut-b` 14, `tmut-c` 6; their staged manifests differ from the final WIP in 6, 5 and 4 files, and the failing assertions map onto M1-M8, M10-M12 and M13-M19 as the table says (for example `#113/#119` restore ids, `#116/#119` two vocabularies, `#121/#122/#125/#126` restore branches, provider `#49` cap, `#128` recheck, lock-order `#1/#2/#4` per writer). Caveat: the mutants share lanes, so kill attribution is by assertion, and M14/M17 are not separable (the lane says so). I could not re-run mutants (a mutant needs a new `migrations-wip` directory and I am read-only). M9 is correctly judged equivalent. New gaps in the same area: V12-14, V12-15. |
| V12-04 MINOR count | **CLOSED** | `100200:55-86`: `merged_units`, `allowlist_units` and `offender_units = count(*) filter (is_merged or allowlist_failed)`; `total_units := offender_units + inactive_units`; the reason order is unchanged. `040-provider.sqlinc:162-166` now expects 3 (the merged assignment that also fails the allowlist is one unit). Killed by M15 (`#32`). |
| V12-05 MINOR guards | **CLOSED** | The four pair amendments replay the inverse with the last pair first and require byte equality (`100600:68-75, 154-161, 247-254`; `100800:104-111`). The three wholesale bodies carry md5 pins checked before the replacement (`100400:49-64`, `100700:20-28`). I recomputed the three md5 values from the latest promoted definitions (`20261005010100_cms_field_kind_encodings.sql` refusal `6f4c07e4cafd0eab3dba234f970bdaea`, `20261005012100_cms_write_path_lock_helpers.sql` require `9ae6d84378d15314fe31b4a303d85caf`, `20261005010500_cms_restore_chain_manifest.sql` source-side `4d478a7763949f94dcb1e3c4bbbedbb3`): all three equal the pins. |
| V12-06 MINOR deprecated re-send | **CLOSED** (DEC-233) | See the DEC-233 table below. |
| V12-07 MINOR duplicate `termIds` | **CLOSED** (DEC-233) | See the DEC-233 table below. |
| V12-08 MINOR docs | **CLOSED** | `README.md` in the WIP directory (accurate: files, DEC-229 and DEC-233, the lock helper, the race note); `100200:12-14` and `040-provider.sqlinc:155` now cite DEC-229; `comment on function cms_restore_source_side_valid` re-issued (`100700:77-78`); BE03b 1542 amended by root (storage key, DEC-229, DEC-233). The stale web request in the lane report is annotated "done by root" rather than removed (the follow-up table says "removed"): harmless. Remaining drift is V12-16. |
| V12-09 MINOR coupling | **CLOSED** (acknowledged; the packaging is root's) | The lane acknowledges the one-commit rule and the `--include-all` note and ran the combined stack of all five live WIP lanes (22 migrations then, 199/199): the manifest `...201032-272653.manifest` lists the nine current hashes and the TAP hash equals the lane's `5e04e964...`. My own combined runs are in "Runs (verification)". |
| V12-10 NIT | **CLOSED** | `v_field_key` is gone from `cms_restore_term_plan`; the text comparison of `version_row.id::text = recorded.id` was kept on purpose (fail-closed on garbage). |
| V12-11 NIT RED partial | **CLOSED** (accepted) | The new tests were run RED first against the previous WIP (22 failures, listed and matched above); the behaviour-pinning tests that were green on the old code are covered by mutants. |
| V12-12 NIT | **CLOSED** | Corrected `compare_lineage` #14 is followed by "and the comparison is computed, not a partial answer" (`response ? 'compare'`); corrected `field_kind_definer_reach` adds `cms_term_assignable(...) is false` as the definer. |
| V12-13 NIT | **CLOSED** (accepted) | Pinned by `040-provider.sqlinc:140-141` (a vocabulary with no active version reports `taxonomy_version_not_active`); the BE03c sentence is root's and is not yet written (BE03c is silent on a vocabulary with no active version). |

### DEC-233 against the implementation

DEC-233 (raw record `dec-233`; BE03c 1595 item 5, changelog 1922; BE03b 1542, 2293): V12-06 option A, a deprecated term the source revision already assigns in the same field is an existing assignment and stays accepted when the value is re-sent, by both writers; V12-07 option A, a value naming the same `termId` twice is refused 422 `VALIDATION_FAILED` at the field pointer.

| DEC-233 clause | Implementation | Proven by | Result |
| --- | --- | --- | --- |
| A deprecated term the source revision already assigns in the same field stays accepted on a re-sent value, in `cms_create_revision` and `cms_resolve_conflict` alike | `cms_term_existing_deprecated(owner, source revision, stable field id, term)` (`100400:66-96`): an owner-scoped term with `lifecycle = 'deprecated'` (`:79`) whose current row in the source revision (highest version of the field-definition and term pair, matched by `stable_field_id`) is `active`. `cms_require_value_source_available/4` (`:128-187`) accepts a term that is assignable or existing-deprecated (`:164-173`). `cms_create_revision` passes `current_row.id` (`100600:125`) and `cms_resolve_conflict` passes `theirs_row.id` (`:217`), the revision `cms_record_term_assignments` carries from (`:115`, `:203`). The recheck under the lock applies the same pair (`100500:179-182`), so a re-sent existing deprecated term cannot pass the encoder and then fail under the lock | `020:148-155` (re-send; re-send beside a new active term with the deprecated assignment keeping its place), `025:79-82` (explicit resolution re-sending the deprecated term theirs assigns beside a new one) | CONFORMS |
| Not newly assignable stays true | a different deprecated term, or a deprecated term that only another entry assigns, is refused; a create has no source revision (the three-argument form delegates with NULL, `100400:192-205`) | `020:156-161` (`a_keeps_new_depr`, `a_keeps_other_field`), `025:71, 73-74` (`x_new_depr`), the create refusal `r_deprecated` in `020` | CONFORMS |
| Only `deprecated`, in the same field | `lifecycle = 'deprecated'` (`100400:79`) and `old_field.stable_field_id = p_field_id` (`:88`) | the negative cases are not asserted: the merged cases (`r_merged`, `ar_merged`, `x_merged`) use `omega`, which no revision assigns, and the test world has one taxonomy field | CONFORMS by reading; pins missing (V12-15) |
| A value naming the same `termId` twice is 422 `VALIDATION_FAILED` at the field pointer | `100400:154-159`: before any term lookup, `count(distinct lower(id)) <> count(*)` raises `VALIDATION_FAILED` with DETAIL `["/fields/<stable field id>"]`; create (through the delegating form), append and a changed resolve value all reach it; the plan keeps its `group by` (`100500:46`) as a defensive dedupe | create `020:50-56` (token, pointer, nothing committed), append `020:162-166`, resolve `025:72, 75-78` (token, pointer, nothing committed) | CONFORMS |
| "alike" for the two writers | both accept the existing deprecated term; resolve additionally keeps its older exemption that a taxonomy value equal to theirs' is never re-checked (`100600:214-217`) | `025` `x_theirs_deprecated` | CONFORMS for deprecated; residual asymmetry for a merged term in an unchanged value, V12-16 |

### The term-lock helpers against BE03c "Slice 12 lock order"

BE03c 1502 adds **position 6**: "the `cms_terms` rows of the vocabulary a command names (`FOR UPDATE` for a term action and a merge, `FOR SHARE` for a 03b entry writer that assigns a term)", ascending `id` within a position, and no earlier position after a later one. Program order of the four writers, from the live bodies plus the WIP anchors (`supabase/migrations` files by number):

| Position | `cms_create_entry` | `cms_create_revision` / `cms_resolve_conflict` | `cms_restore_revision` |
| --- | --- | --- | --- |
| 0 entry row | inserted by the command | `FOR UPDATE` (`18045:126`; `18050:145`, then the conflict record `:163`) | `FOR UPDATE` (`18055:125`) |
| 1 authority | `cms_require_entry_capability_locked` (`18040:63`) | same helper | same (`18055:131`) |
| 2 relation targets | the value loop: `cms_resolve_relation_targets` to `cms_lock_relation_target` per target (`18040:254`, `12100:421`) | `cms_lock_entry_rows_shared`, ascending (`18045:479`; `18050:535`) | same helper (`18055:368`) and the DEC-201 verified targets (`044800:163`) |
| 3 pinned definitions | the exact default template, `FOR SHARE` (DEC-202, `20261022010100`) | none | `cms_restore_composition_plan` locks template, pattern and block rows `FOR SHARE` (`044510:89,98,107`) |
| 4 schema version | `cms_lock_schema_version_shared`, moved below the value loop by DEC-202 | `18045:208`; `18050:240` | `18055:228` |
| 5 live reviews | `AFTER INSERT` trigger on the revision insert (`17580:487`) | same | same |
| carry or copy | none | `cms_revision_composition_carry`: one insert statement, no explicit lock (`042100:137`) | `cms_restore_composition_copy`: one insert statement, no explicit lock (`044700:271`) |
| **6 terms (WIP)** | `cms_lock_term_plan`, after the revision insert and the field-value loop | `cms_lock_term_plan`, after the carry | `cms_restore_lock_term_plan`, after the copy |
| then | assignments, relation rows, creator assignment, event | assignments, field values, relation rows, entry update, conflict supersession, events | assignments, field values, relations, events |

Checks, each against the source:
1. **Order and arity.** The term lock is the highest position and the last explicit lock of every writer; only the foreign-key `KEY SHARE` checks of the rows it inserts follow. It is `FOR SHARE`, ascending id, one statement per helper: `select ... order by term.id for share` locks in the sorted order (the sort runs first and the lock node sits above it, the same property the merge paths already rely on for `FOR UPDATE`). The merge side is ascending as well: the command locks the named rows in one `order by term.id for update` statement (`20261014190030:119-128`), the convergence function locks retired and survivor in one ascending statement (`20261014120300:76-84`), the continuation handler locks every retired term and survivor with pending work in one ascending set (`20261014190040:69-80`), and the superseded command and handler variants have the same shape. A scan of every promoted and WIP migration for row locks on `cms_terms` finds only these merge paths (nine hits, three of them `FOR SHARE` on taxonomy-version rows whose subselect joins `cms_terms`); no other transaction locks term rows.
2. **Snapshot semantics.** Both helpers are `VOLATILE` (the default; PostgreSQL rejects `FOR SHARE` in a non-volatile function), so each statement after the lock takes a fresh `READ COMMITTED` snapshot and sees a merge that committed before the lock was granted. The authored-term recheck therefore refuses what a committed merge or deprecation changed (gallery `#128` calls the helper with a merged term and gets `term_unavailable`); the restore helper re-runs the whole plan after the lock.
3. **Typed conversion.** `lock_not_available` and `deadlock_detected` become `P0001 CONFLICT` inside both helpers (`100500:165-167`, `100700:261-263`), the pair `cms_restore_composition_lock_plan` already converts; the RPC aborts with its reservation, so the same `Idempotency-Key` retries (P2-S12-AC-276). A `P0001` raised inside the command passes the `platform_api` wrappers' `deadlock_detected` and `lock_not_available` handlers (including the `lock_not_available` handler that `gaps-db2/20261024130300` adds to the four writer wrappers) unchanged, so there is no double conversion.
4. **Privileges.** `FOR SHARE` needs `UPDATE` on `cms_terms` for the executing role; the helpers run as `wejammin_cms_definer` (called from definer writers), which already updates `cms_terms` in the term actions, and every GREEN run exercises it.
5. **Lock set versus write set.** The authored half is exact: the authored terms come from the request, so lock-time and insert-time plans name the same ids, and the recheck under the lock refuses a term that stopped being assignable. The carried half is read from the source revision's current assignment rows; the three value writers lock the plan of one statement (snapshot taken before any lock wait) and write the plan of a later statement (fresh snapshot) without comparing them, whereas the restore helper compares (`is distinct from p_plan`, then CONFLICT). The two plans can differ only if the writer waited for a retired term whose convergence committed meanwhile: the plan then names the survivor, which the writer does not hold. I checked whether this opens an assignment to a merged term and it does not: a survivor can never be merged, because `cms_term_apply_merge` refuses to merge a term that is some term's successor (`20261014120400:172-175`) and the stored lifecycle guard forbids any later change of a merged or deprecated row (`20260927260000:175`); a deprecated survivor is tolerated by DEC-233. So the divergence is harmless today, but it rests on a rule enforced in the apply function and not by a table constraint. Observation, not a finding: one comment in `cms_lock_term_plan` stating this would stop a maintainer from treating the restore compare as redundant, or from relaxing the "no redirect chains" rule without adding the same compare to the value writers.
6. **No new deadlock path with the composition carry or copy.** They are single `insert into cms_composition_instances` statements (`042100:137`, `044700:271`) with a `BEFORE INSERT` guard that only reads (`20260927500000`); they take no explicit lock, only foreign-key `KEY SHARE` on the new revision, pattern-version and parent-instance rows, and they finish before the first term lock, so a writer never holds a term lock while waiting inside them. Any wait inside the carry is a pre-existing wait (for example behind a pattern activation's `FOR UPDATE`) in which the writer holds no term lock. For a cycle through a term lock, another transaction would have to hold something the writer needs while waiting for a term the writer holds. The only transactions that conflict with `FOR SHARE` on a term are the merge command, the convergence function and the continuation handler (`FOR UPDATE`, ascending). Once they hold term locks they need only `KEY SHARE` on revision, field-definition and taxonomy-version rows (the foreign keys of the assignment rows they insert), on which the writer holds at most `SHARE` (the current and base revisions) or `KEY SHARE`: compatible. Their own position-3 lock is `FOR SHARE` on the active taxonomy-version row, compatible with the writer's `KEY SHARE` on it. They touch neither the entry row, nor the review rows, nor the writer's idempotency row, and the per-actor revision write slot (`cms_acquire_revision_write_slot`, a non-blocking try-lock taken early, `18045:162`) never waits. Two writers hold terms in `SHARE` mode, so they never wait on one another through terms. Both sides take ascending ids, so no two lock sets can be acquired in opposite order. I found no cycle.
7. **Not proven dynamically.** No two-session test exists, as the lane says. The static oracle (`..._lock_order.sql`) proves placement (order of calls in the live sources), RED to GREEN proves the helpers are reached and recheck, and the single-session tests prove the recheck both ways; none of them proves a wait. The repository already has a pattern for two-session checks inside pgTAP (dblink workers, `phase_02_slice_09_schema/000b-activation-lock.sqlinc`, `ac265_*_concurrency.sql`), so the lane's remark that this "needs two sessions" does not mean it needs a race module; see open item 2.

### New findings (from the follow-up bytes)

- **V12-14 (MINOR).** The changed-plan branch of `cms_restore_lock_term_plan` (`100700:265-268`, `... is distinct from p_plan then raise CONFLICT`) is never executed by any test: the helper appears in the tests only as an anchor in the static oracle (`..._lock_order.sql:47,54,61,68`). The lane report calls the comparison "not provable by pgTAP (needs two sessions)". That holds for the lock wait, not for the comparison: it is a state difference between two evaluations, which one session can force. Compute a plan with `cms_restore_term_plan`, forge a lifecycle change of a carried term the way `050-restore.sqlinc:41-43` already does (`ti_term_to('rm', 'merged', 'rs')`), call `cms_restore_lock_term_plan` with the stale plan and expect `P0001:CONFLICT`, then call it with the fresh plan and expect a void return. Without it, deleting the comparison (the restore's only recheck under the lock, the analogue of the authored recheck that gallery `#128` pins) survives every suite. MINOR, because the `FOR SHARE` lock itself holds and the race scenario of the lane names this branch; test-only.
- **V12-15 (MINOR).** The negative scope of `cms_term_existing_deprecated` is unpinned, in two ways. (a) Only `deprecated` is accepted, but no test re-sends a term that is MERGED while the source revision still assigns it: `r_merged`, `ar_merged` and `x_merged` use `omega`, which no revision ever assigns, and the lock-helper cases in `028` pass a NULL source revision. Widening `lifecycle = 'deprecated'` to `<> 'active'` would pass all suites and would let a writer create a new assignment to a merged term, the state the lock exists to prevent. (b) The predicate is scoped to the same field (`old_field.stable_field_id = p_field_id`, `100400:88`), but every writer test uses the single taxonomy field `tags`, so dropping that condition (accepting a deprecated term the source assigns in another field) also passes all suites; DEC-233 says "in the same field". Both are by reading: I could not run mutants. Two cases close them (assign, forge the merge, re-send, expect `term_unavailable`; a content type with a second taxonomy field assigned a deprecated term, re-sent in the first field, expect `term_unavailable`).
- **V12-16 (NIT).** Documentation drift after DEC-233 and the follow-up: the header of `100500:8` still says "03b fixes no uniqueness of termIds: BOUNDARY in the lane report" although DEC-233 refuses duplicates (the `group by` is now a defensive dedupe); `supabase/tests/phase_02_slice_12_taxonomy_integrity_corrected_oracles/README.md` says "eight files" and "the same edits as a unified diff" while the diff now also carries the apispec and the runbook; the lane report's FINAL run row counts "9 corrected-oracle copies" (the directory holds eight `.sqlinc` files plus the README; 3 + 41 + 8 = 52 files and 5,901 tests is consistent with eight); resolve's equal-to-theirs exemption versus append's refusal of an explicit identical re-send is a residual asymmetry BE03c 1595 does not mention (harmless: nothing new is written, and the convergence reaches a merged term anyway).
- **V12-17 (NIT, and a correction of my first report).** No pgTAP asserts the absence of API-role `EXECUTE` on the thirteen new functions. My first report (section 4, "Grants of the other helpers") said the catalog inventories cover it; on re-check `r8_api_surface` and `gaps_rpc_inventory` pin named `platform_api` wrappers and named private bodies, `sec2_all_schema_definer_rls` pins definer ownership and privileges, and the corrected `definer_reach` "no API role" list names only the three-argument `cms_require_value_source_available`. The revocation itself is present: a script over the nine migrations finds, for each of the thirteen created functions, exactly one `alter function ... owner to wejammin_cms_definer`, exactly one `revoke all ... from public, anon, authenticated, service_role` and `set search_path = ''` in the definition (the three resolver and provider functions are `SECURITY DEFINER`, the other ten invoker helpers owned by the definer). Suggest adding the thirteen signatures to a "no API role EXECUTE" assertion in the corrected `definer_reach` file.

### Runs (verification)

All runs went through the staged ALT runner (`lane-db-alt-staged.sh`), one invocation per run, in the background, never looped. The lane's own logs were re-inspected on disk first (TAP files in `.lane-logs/`, counts re-computed by me): RED `alt-staged-taxonomy-integrity-195004-218080` 199 tests, 22 not ok (SHA-256 `1dd24c1e...`); GREEN `...195653-233244` 199/199 (`487ce2b8...`); FINAL `...200305-256517` 52 files, 5,901 tests, 0 not ok (`7082c4bc...`); the remaining 32 files `...200713-266129` 2,388 tests, 0 not ok (`cdfc925f...`); combined stack `...+gaps-db2+node-pointers+nestable-read+placement-perf-201032-272653` 199/199 (`5e04e964...`); mutants `tmut-a` 182 ok / 17 not ok, `tmut-b` 185 / 14, `tmut-c` 193 / 6. Every figure equals the lane report. 5,901 + 2,388 = 8,289 tests in 52 + 32 = 84 files: the same 84-file set that the lane ran in two parts and my run 2 ran in one go.

| Run (EDT) | Lanes staged | Files / tests | Result | TAP (SHA-256) |
| --- | --- | --- | --- | --- |
| 2: 2026-10-27 20:43, `alt-staged-taxonomy-integrity-204306-352086` | `taxonomy-integrity` (9 WIP migrations) | 84 files (3 entrypoints, 8 corrected oracles, 73 suites of the impact set) / 8,289 tests | 8,283 ok, 6 not ok, exit 1: `phase_02_slice_09_r8_api_surface.sql` #5 and #14, `phase_02_slice_12_gaps_rpc_inventory.sql` #1-4 | `a597f43518542342...` |
| 3: 2026-10-27 20:49, `alt-staged-taxonomy-integrity+gaps-db2+node-pointers+nestable-read+placement-perf-204838-363249` | all five live WIP lanes of that moment (22 migrations) | 21 files (3 entrypoints, 8 corrected oracles, both catalog suites, eight lock, carry and restore suites) / 1,828 tests | PASS, exit 0, "All tests successful" | `b4abbea8cd3e0e72...` |
| 4: 2026-10-28 00:14, same five lanes (now 23 migrations) | five lanes | 21 files | reset FAILED before any test, on another lane's file (below) | none |
| 5: 2026-10-28 00:18, `alt-staged-taxonomy-integrity+node-pointers+nestable-read+placement-perf-001551-608385` | `taxonomy-integrity`, `node-pointers`, `nestable-read`, `placement-perf` (19 migrations) | 17 files (3 entrypoints, 8 corrected oracles, both catalog suites, four lock, carry and restore suites) | PASS, exit 0, 1,613 ok, 0 not ok | `1bd49233195d6e3b...` |

- The six failures of run 2 are not a taxonomy-integrity defect. Both files had been edited at 20:42:14 by another lane (or root) to list `cms_list_pattern_nestable`, an RPC of the `nestable-read` WIP lane that a single-lane stage does not contain (diagnostics: 102 enumerated against 103 wanted, 34 against 33 wrappers, 36 against 35 bodies, 68 against 70 functions, the pair `platform_api.cms_list_pattern_nestable` and `platform_private.cms_list_pattern_nestable` missing). Staging `nestable-read` as well (run 3) makes both files pass. It is a promotion-order fact (open item 3).
- Run 4 failed at `supabase/migrations-wip/gaps-db2/20261024130000_cms_version_lifecycle_columns_governed_only.sql`, which was last modified at 00:04:54, ten minutes before: the CLI reports `mismatched parentheses at or near ")" (SQLSTATE 42601)` at statement 3, the `do $migration$` block. Line 31 of that file has an undoubled apostrophe (`the table's own write guard`) inside an `E'...'` literal, which ends the literal early. That is another lane's in-flight edit and outside this review; I mention it because it makes the combined five-lane stage red until it is fixed. All nine taxonomy-integrity migrations had applied before the failure. Run 5 therefore stages the other three lanes without `gaps-db2`: it passes, so the nine taxonomy-integrity migrations apply next to the current bytes of `node-pointers`, `nestable-read` and `placement-perf` with no anchor collision, and both catalog suites pass once `nestable-read` is staged.
- No skipped or `todo` test in the TAP of runs 2, 3 and 5 (checked); the plan-line counts (84, 21, 17) equal the file counts.

### Corrections to my first report

- Section 4, "Grants of the other helpers": I wrote that the catalog inventories cover the ACL of the invoker helpers. They do not (V12-17). The revocation is present in the migrations; it is simply not asserted.
- The lane's "9 corrected-oracle copies" is eight `.sqlinc` files plus a README (V12-16).
- BE03c line numbers in my first report (for example "1489-1500" for the lock order) predate the spec edits; the current lines are in the inputs list above.

### Open items for root

1. **Promotion commit content.** Apply the ten-file diff (`git apply docs/handoffs/2026-10-22-claude-s12/lane-taxonomy-integrity-test-corrections.diff`; `--check` passes today), delete `supabase/tests/phase_02_slice_12_taxonomy_integrity_corrected_oracles/`, and re-cite the five retitled assertions. They still carry the old titles in `tests/contracts/phase-02-slice-10-evidence-ledger-001-035.ts:183,1557,2803`, `tests/contracts/phase-02-slice-11-evidence-ledger-067-100.ts:5270,5294` and the matching receipts (`phase-02-slice-10-receipts.generated.jsonl:31,571,574`, `phase-02-slice-11-receipts.generated.jsonl:305,353`); the new titles are in the lane report ("Retitled assertions the ledgers cite"). The changed apispec row (`term_unavailable`) can only be proven by the canonical `pnpm db:api-test`; the ALT runner cannot run it.
2. **Dynamic proof of the lock (AC-276, AC-277 "term merge versus assignment").** Not written, not run. The lane's two interleavings (writer holds the lock and the merge waits; merge commits first and the writer is refused or restore gets CONFLICT) are right; add a third (a writer that carries a term whose merge is still in flight waits, then commits with the survivor, no deadlock). It need not be a race module: the repository already has two-session pgTAP checks with dblink workers (`supabase/tests/phase_02_slice_09_schema/000b-activation-lock.sqlinc`, `ac265_*_concurrency.sql`). Until it exists keep AC-276 and AC-277 unverified for this lock; do not cite the static oracle as a concurrency proof.
3. **Promotion order.** `phase_02_slice_09_r8_api_surface.sql` and `phase_02_slice_12_gaps_rpc_inventory.sql` now enumerate `cms_list_pattern_nestable`; promote the `nestable-read` WIP migrations first or in the same commit, otherwise those two suites fail on a stack that has taxonomy-integrity only (6 not ok, run 2). Separately, the `gaps-db2` WIP lane does not apply at the moment (run 4), so the combined stack is red until its apostrophe is fixed.
4. **One commit.** The registry row v2 in `packages/contracts/src/cms-editorial/preflight.ts` (and its two tests), the nine migrations and the ten-file diff land together; where later WIP batches were applied first, `supabase migration up --include-all` (V12-09).
5. **Non-blocking follow-ups for the lane:** V12-14 and V12-15 (tests), V12-16 (comments and counts), V12-17 (ACL assertion), a comment in `cms_lock_term_plan` on why plan drift under a waited lock is harmless (check 5), and root's BE03c sentence for a vocabulary with no active version (V12-13).

### Final verdict: PROMOTE

CLOSED: V12-01 to V12-13 (13 of 13). OPEN: none of the original thirteen. NEW: V12-14 MINOR, V12-15 MINOR, V12-16 NIT, V12-17 NIT; no BLOCKER, no MAJOR.
