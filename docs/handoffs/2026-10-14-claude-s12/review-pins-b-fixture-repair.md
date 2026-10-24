# Review: `claude_s12_pins_b` + `claude_s12_fixture_repair` (independent, adversarial)

Read-only, 2026-10-15 ~17:00Z. HEAD b16edb54, 461 promoted migrations (newest mtime 13:45Z: every lane run saw one
schema). Method: git diff vs HEAD, migration reads, `.lane-logs/*.tap` parsed by script; no DB/docker/test execution.

## Claim re-verification
- Report hashes match: pins-b `4b4ec8ad…e43c`, fixture-repair `cf71436f…9376`. All 11 file SHA-256 + line counts in both
  Files tables match disk. All five TAP SHA-256 match (`123315`, `123621`, `123829`, `124400`, `124835`).
- TAP counts reproduced: run 1 815 tests / 5 not ok (r8 #4/#13/#14, sec2_all #6, schema #448); run 2 815/815; run 3
  146 files / 6380 / 12 red files exactly as classified; run 4 7 files 299/299; fixture run 78 files / 2989 / 4 not ok,
  every file at full plan (no abort).
- Edit windows (mtime): pins-b touched only its 4 files (16:35-16:36Z); fixture-repair only its 7 files (16:48Z). No other
  `supabase/` file changed until the locale-gate lane began at 16:55Z.

## Target A — pins_b
Additivity (diff vs HEAD): r8 `r8a_supporting` 54 -> 73 rows, 19 `+` lines, nothing removed; `r8a_original/amendment/
internal` untouched; #14 message text only. sec2_all #6 set diff: 76 -> 85, removed = none, added = exactly the 9 named.
Trigger inventory: pins-b added one row + 148 -> 149. The one `-` row in 06-trigger-probes (`cms_entry_revisions_locale_
stale`) and 134 -> 148 are baseline-repair's (its report :64-75), justified by `20261014050310:52 drop trigger`.

19 new `supporting` RPCs, each checked three ways (definition migration; statement-level grants; non-test Worker caller):
all 19 are `revoke all … from public, anon, authenticated, service_role` + `grant execute … to service_role` in the cited
migration; `cms_run_taxonomy_merge_converge` is redefined by `120820` via `create or replace` on the same `(jsonb)`
signature (ACL kept). Worker callers (non-test, imported by production modules): governed-review-policy.ts (6),
cms-governed-activation-rpc-names.ts (2), cms-composition-production-pattern-definition-latest.ts (2),
cms-composition-production-pattern.ts:148 (`cms_insert_pattern_instance`, template URL), pattern-update-operations.ts:36,
taxonomy-rpc-table.ts (5), cms-taxonomy-merge-converge-names.ts, cms-composition-production-related.ts. None is
`internal`. BE03c registry rows 158-179/187-188 match the cited operation ids. Live proof: run 2 #10/#12/#13/#14 ok.

Forced-RLS state of the 9 additions, from migrations: canonical_domain_registry `20261013300100:57`; activation_schedules
`300700:145`; 4 governed review tables `300200:223` loop; related_content_rules `20260927310000:109` loop; term_labels
`20260927260000:195-199` loop; role_facet_assertion `20260901030000:494`. Each is named by a definer function owned by
`wejammin_cms_definer` (e.g. `cms_related_content_public_targets` 060200:54/111; `cms_term_write_labels` 120200:237/280).
Why `role_facet_assertion` appears now: it was forced since Slice 02, but no dedicated-role definer named it until
taxonomy-terms promoted `20261014120100`, which adds `cms_canonical_role_facets(text[])` (SECURITY DEFINER, body :63
`from platform_private.role_facet_assertion`, owner set :150), a column grant `(facet_code, state)` :146 and a SELECT
policy for the CMS definer :147. The suite pins every forced table a dedicated-role definer names, so the pin is correct.

Trigger count 149: `cms_terms_00_lineage_fill` is `20261014120000:117` BEFORE INSERT FOR EACH ROW = tgtype 7, function
`cms_terms_lineage_fill`; it is the only `create trigger` among 202610141* promoted migrations. Inventory has PK
`(table_name, trigger_name)`, 149 rows counted; run 2 #448 (catalog ⊆ inventory) + #449 (inventory ⊆ catalog) + #451
(149) prove live = 149. Run 1 #451 = 148 and #448 = 1 extra confirm the single missing row.

Sweep: no non-Slice-12 suite matching the stated pattern (pg_proc|pg_class|pg_policy|pg_trigger|information_schema) was
left out of run 3. 28 more suites read the catalog via has_function_privilege/pg_constraint/pg_attribute only; none names
a Slice 12-changed object (grep), so low risk; canonical `db:test` remains the proof. Pass C list agrees with a static
read of `migrations-wip/pattern-updates` and `locale-gate` (no table, no trigger, two platform_api fns, both service_role).

Findings
- `supabase/tests/phase_02_slice_09_sec2_all_schema_definer_rls.sql:109-110` (and pins-b report :57-58) — minor — the
  comment says role_facet_assertion is read "through the column grant … of cms_canonical_taxonomy_match (20261014120100:146)";
  the function that names the table is `cms_canonical_role_facets` (:55-63); the matcher names none (migration :11 says
  so). Why: the pin's provenance points a later auditor at the wrong function. Fix: reword to `cms_canonical_role_facets
  (20261014120100:55-63; column grant :146, policy :147)`. Pin value itself is correct.
- info — the pin encodes the cross-shard grant + policy on `role_facet_assertion` that `review-taxonomy-terms-f1.md:43`
  and taxonomy-terms R7 still list as a root ratification; the pin records it, it does not ratify it. Root: record R7.

Target A verdict: CLEAR (one minor comment-provenance fix; no blocker or major).

## Target B — fixture_repair
Positions (DEC-185; BE03c 1463 "consecutive positions … starting one above the slot's greatest (0 for an empty slot);
every other append … copies the position"; `20261014110000`): 001-world `h11w_instance`, 003-registry `h11m_instance`,
e2 `e2_instance`: existing position of the same `(revision, 'primary', path)` else `coalesce(max+1, 0)` — exactly the
placement rule plus the path-shares-position rule. helpers_manifest :365/:370 bulk raw inserts: fresh revisions `big`,
`big2` (h11w_revision inserts no instance), distinct `/p<n>`, `n - 1` = 0..127. 002-compare: `max+1` + dense_rank of path.
Collision: impossible. The only uniques on the table are `(revision_id, path, version)` and `(id, owner_id)`; position has
`check (position >= 0)` and a non-unique index; no trigger reads `new.position`. All supplied values are >= 0.
taxonomy_id: `tax1` is a version-1 row, so `cms_taxonomy_versions_lineage_guard` (030100:42,55-56) sets its taxonomy_id
= its id; the three raw term images now name `h11w_uuid('tax1')`, and the composite FK `cms_terms_version_lineage_fkey
(taxonomy_version_id, taxonomy_id, owner_id)` (120000:82-84) checks it. helpers_references :126 is a plain insert (fill
trigger runs). Grep: no other non-S12 raw/plain cms_terms or composition insert lacks the new column.
No trigger bypass added: the `h11_raw_exec` uses (000-helpers.sqlinc:126, `disable trigger user`) pre-exist; the lane
supplies the value instead of re-enabling. No assertion weakened: the only removed assertion-bearing line in the 7-file
diff is `plan(88)` -> `plan(92)` (an earlier lane's four added DEC-186 cases). e2 #7 still reaches the FK (23503), now
that 23502 no longer pre-empts it, so the oracle is exercised, not bypassed. Edits limited to the 7 named files (mtime).
Coverage: 62 suites transitively include the edited helpers; 59 ran. Not run: `phase_02_slice_12_locale_gate` (WIP),
`phase_02_slice_11_reads_bench128` and `_reads_plan_stability` (include 001-world via bench128/010-fixtures.sqlinc:14 but
never call `h11w_instance`; plan_stability was green in pins-b run 3). No action.

Findings
- `lane-fixture-repair-report.md:53-59,63` — minor — the pgTAP mechanism is wrong. `pnpm db:test` = `supabase test db
  --local`; Supabase CLI 2.116.0 (`@supabase/cli-linux-x64/bin/supabase`, `legacy.test.db`) itself runs `create extension
  if not exists pgtap with schema extensions` on its own connection BEFORE spawning `pg_prove --ext .pg --ext .sql -r`,
  and drops it afterwards only if it created it. So the six files never depend on
  `ac265_hosted_artifact_source_authority_concurrency.sql` (which is the 8th root file in C order, not the 7th). The
  conclusion "not canonical failures" stands; the caveat and Request to root 2 are unfounded. Fix: root declines Request
  2 (a persisting prefix would matter only for the staged ALT runner, which does not pre-install pgtap).
- `supabase/tests/phase_02_slice_10_signed_read/002-compare-helpers.sqlinc:109,116` — nit — "a path keeps one position
  across its versions" holds only within one call (dense_rank over that call's rows); a second call on the same revision
  and path would get `max+1`, and the rank uses the default collation, not `COLLATE "C"`. No caller does either
  (compare_lineage_domains.sql:131-234: one call per fresh probe; paths order identically). Optional comment narrowing.
- info — no own RED run; pins-b run 3 on the identical promoted set is the RED baseline. Acceptable.

Target B verdict: CLEAR (edits correct; one minor report-only error that changes a root request, one nit).

## The four remaining not-ok (both targets) — locale-gate dependent: confirmed
- helpers_preflight #14: have/want differ in exactly one row, `locale=preflight.reference_gate@1/reference_gate/locale`
  vs `cms.locale.no_fallback_gate@1/database/-`, the row `migrations-wip/locale-gate/20261014050700:83-88` inserts.
- helpers_preflight #94 (:478) and criteria_publish_gates #32/#33 (:349/:352): have `provider_unbuilt_reference` (the
  promoted reference gate), want `no_fallback_missing`, emitted only by `cms_locale_no_fallback_gate` (WIP 050600:52-65).
  The oracles were set by an earlier lane (file mtimes 2026-10-14 21:20Z), not by either lane under review.
- Note: locale-gate WIP files were being edited at 16:55-16:57Z; re-confirm all four on its promotion run.

## Requests to root
1. Decline fixture-repair Request 2 (CLI pre-installs pgtap). 2. Optionally fix the sec2_all :109-110 provenance comment.
3. Record taxonomy-terms R7; the pin follows it. 4. Both shared-helper exceptions are within their briefs: accept.

Target A (claude_s12_pins_b): CLEAR
Target B (claude_s12_fixture_repair): CLEAR
VERDICT: CLEAR
