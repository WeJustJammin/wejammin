# Lane claude_s12_gaps_db4 report

## Status
FIX ROUND DONE (see `## Fix round`): GREEN, run 4 186/186. Earlier status: GREEN with one request: all five rows closed with proposals written (recite3/db4-proposals.json, 75 citations, each title verified as an `ok` line in the TAP below). One genuine DEFECT found (AC-256) and fixed forward in a WIP migration; AC-256 is verified only once that migration is promoted. Run 2 (lane gaps-db4): 128/128 PASS. Merge-lock and taxonomy-activation files green in run 1 (promoted only, unchanged since).

## Scope
Rows: AC-210 c0, AC-223 c0 (taxonomy activate/schedule over a drifted role registry row), AC-225 c0 (merge lock source oracle),
AC-155 c0+c2 (aclexplode owner-only), AC-256 c0 (registry catalog + probes).

## Files (all NEW, nothing existing edited)
- supabase/tests/phase_02_slice_12_gaps_db4_registry.sql (AC-256)
- supabase/tests/phase_02_slice_12_gaps_db4_related_acl.sql (AC-155)
- supabase/tests/phase_02_slice_12_gaps_db4_merge_lock.sql (AC-225)
- supabase/tests/phase_02_slice_12_gaps_db4_taxonomy_activation.sql (AC-210, AC-223)

## Runs
run 1 queued 2026-10-29T01:31Z, log scratchpad/claude_s12_gaps_db4/run1.log

## Test corrections
none

## Spec citations
- BE03c Governed activation step 5 (taxonomy: registered provider for every declared canonical domain, else 422 canonical_source_unavailable with the domain).
- BE03c registry invariants, taxonomy_version row; Persistence cms_canonical_domain_registry; Internal service operations CMS-03C-21.

## Open items / BOUNDARY
(pending)

## Requests to root
none yet

## Run log (appended)
- run 1 2026-10-29 22:27 (ET stamp 213138-478231), lane none, 4 files, 106 tests: 103 ok / 3 not ok.
  TAP .lane-logs/alt-staged-none-213138-478231.tap sha256 f3ac07bf280ca4e77ebed623dcdd12772d7b656fcd3b29442d2b8dcb46525af4.
  - registry 18, 19 RED = genuine DEFECT: the promoted CHECK cms_canonical_domain_registry_provider_check accepts an unbuilt row that
    carries exactly one of provider_key / provider_version (BE03c: both non-null exactly when built). Fix forward in WIP
    supabase/migrations-wip/gaps-db4/20261029110000_cms_canonical_domain_registry_provider_pair.sql (adds CHECK (key IS NULL) = (version IS NULL)).
  - related_acl 13 RED = my wrong expectation (harness): the caller of cms_related_derived_candidates is cms_related_eligible_count,
    not cms_related_rules_replace. Test corrected (new file, not an existing oracle).
  - merge_lock 15/15 and taxonomy_activation 18/18 green first run.
- run 2 queued: lane gaps-db4, registry + related_acl + existing taxonomy_terms_canonical (touches the registry).

## Runs (final)
- run 2 2026-10-28 23:29 ET (stamp 222821-886118), lane gaps-db4 (1 WIP migration), registry + related_acl + existing taxonomy_terms_canonical:
  pg_prove exit 0, 3 files, 128 tests, 0 failed (47 + 19 + 62). TAP .lane-logs/alt-staged-gaps-db4-222821-886118.tap sha256 b94ccea5ac4ffa8b284f02f2431c8242a5d19c3807f5d15ce5618b5ee5ccd75a.
- run 1 correction: merge_lock 15/15 and taxonomy_activation 25/25 green (not 18).

## Per-row outcome
| criterion | clause | outcome | identity |
|---|---|---|---|
| AC-210 | c0 | closed | gaps_db4_taxonomy_activation.sql: schedule over a role row flipped to unbuilt: P0001:canonical_source_unavailable#{"domain":"role"}, no schedule/event/reservation; negative (no declared domain activates); precedence (step-up, capability, CAS before provider); control (built row returns, activates) |
| AC-223 | c0 | closed | same file: activate refused, review approved v2, subject approved, no event/audit/reservation, repeat refused, restored-provider control |
| AC-225 | c0 | closed (static) | gaps_db4_merge_lock.sql: anchored `select term.id from cms_terms ... order by term.id for update` naming termKey/parentId/survivorId, sole FOR UPDATE and ORDER BY, precedes both appliers, applier takes no lock; 5 inverse controls |
| AC-155 | c0, c2 | closed | gaps_db4_related_acl.sql: aclexplode owner-only on public_targets, head predicate, derived reader; has_function_privilege over all non-superuser roles; real-role 42501; owner executes; inverse grant/caller controls |
| AC-256 | c0 | closed after WIP | gaps_db4_registry.sql: columns, CHECKs, UNIQUE, guards, seeds, probes, grants/RLS/policy, no writer functions, greatest-version reader, context-cleared; DEFECT below |

## Defects
- AC-256: BE03c says provider_key and provider_version are non-null exactly when built. Promoted CHECK `cms_canonical_domain_registry_provider_check` accepts an unbuilt row with exactly one of the two (RED in run 1, tests 18 and 19). Fix forward: supabase/migrations-wip/gaps-db4/20261029110000_cms_canonical_domain_registry_provider_pair.sql adds CHECK ((provider_key is null) = (provider_version is null)); existing rows satisfy it. Green in run 2. Needs promotion.

## Open items / BOUNDARY
- AC-155 c0: the Shard 04 delivery projection and the Slice 11 related-content recheck do not exist as DB callers; owner-only ACL + empty caller inventory is all that is provable (AC-150 precedent). Caller-inventory assertions pin today's referrers (public_targets: none; derived reader: public_targets, cms_related_eligible_count; head predicate: public_targets, derived reader) and will need updating when a registered caller is added.
- AC-210/223 ordering: cms_governed_activation_verdict checks the declared-domain provider BEFORE the frozen status (incl. the canonical_domain registry-row dependency). BE03c step 4 (dependency recheck, invalidate dependency_changed) literally precedes step 5 (provider), and a registry change is always a newer row, so under strict spec order canonical_source_unavailable would be unreachable. Tests follow the implementation and the existing fire-time test; owner/spec clarification suggested.
- AC-225 is source order only; opposed A->B / B->A merge race belongs to root.
- Real-role denial tests (AC-155, AC-256) may be partly masked by missing schema USAGE; the aclexplode / has_*_privilege assertions carry the ACL proof.

## Files (sha256)
- supabase/tests/phase_02_slice_12_gaps_db4_registry.sql (234) 242cf2a88c78f310145058abe00c2c41e05771aab33ebf1094918946a838bb64
- supabase/tests/phase_02_slice_12_gaps_db4_related_acl.sql (115) 448caeea461d6f066ef620325184be5a7efb733fa37bd917c381d0fd0105e3eb
- supabase/tests/phase_02_slice_12_gaps_db4_merge_lock.sql (72) c02a82ffc2ede7085d7ea2de0e039ee63f52fa0a024ed48dbe964e4c78d4e05d
- supabase/tests/phase_02_slice_12_gaps_db4_taxonomy_activation.sql (176) 7057fc3dd45d39aab3c5b9a03fc87983a7ebf4f83bb56beb6f6555ffe9388331
- supabase/migrations-wip/gaps-db4/20261029110000_cms_canonical_domain_registry_provider_pair.sql 4c4d8290a4dc3626f053b28a062c1923b394564d3e24db05cbd876e852ca3ec0
- docs/handoffs/2026-10-22-claude-s12/recite3/db4-proposals.json db6a0a4ccac95d564d01066134cfaae735409d807c3a1da987ac0ef2cf2cdd91
No untracked file was edited in place, so no tar backup was needed.

## Requests to root
- Promote the WIP registry-pair migration (renumber if desired) and re-run the registry suite canonically; AC-256 depends on it.
- Decide the AC-210/223 verdict-order question with the owner.

## Fix round (refutation 3, DEC-238)
Backup of every file edited in place: scratchpad/claude_s12_gaps_db4/orig-003418.tar (WIP, four tests, proposals, report).
1. WIP 20261029110000 rewritten: `set local statement_timeout = '30s'`, a typed SQLSTATE 55000 pre-check (count of half-set rows; installed
   provider CHECK shape asserted; pair CHECK must not already exist), the `add constraint`, a `convalidated` post-verify. Header now says
   it is a tightening implementing BE03c 1624 as amended by DEC-238 and the ratified AC-256 (the promoted CHECK is the original 1624 formula).
   Not covered: the 55000 refusal path itself (no populated witness; the reset over the six seeds exercises the success path).
2. Registry test: new probe "an unbuilt row keeping both provider members is refused" (23514).
3. AC-225 detector: literal `strpos` match of the whole lock statement (no wildcards), with the literal `or` connectives; the applier check
   is now three literal fragments (survivorId constant, retired read by termKey, survivor read by id within vocabulary and owner).
   Inverse controls on the live source: first `or`->`and`, second `or`->`and`, `and false` in the alternatives, `and false` before them,
   descending order, FOR SHARE, wrong survivor read, wrong retired read (8 new, all green; plus the earlier 6).
4. Masked and blind assertions:
   - `anon`/`authenticated` probes (AC-155 x2, AC-256 x2): schema USAGE is granted first (rolled back) so only the object privilege can refuse.
     AC-256 asserts the exact message `permission denied for table cms_canonical_domain_registry`; both files carry a control
     (INSERT + policy-function EXECUTE, or function EXECUTE, granted -> the same call runs, '00000').
     Run 3 caught my own control being incomplete (policy function EXECUTE also needed); fixed, run 4 green.
   - Blind no-effect assertions (old :124, :137, :141, :150, :153): replaced by write witnesses. A temporary BEFORE trigger on each of
     reviews, taxonomy versions, schedules, outbox, audit and idempotency bumps its own sequence; nextval is not rolled back, so attempted
     writes inside the rolled-back call are counted. Controls: a real activation advances review/subject/outbox/audit, a real schedule
     advances the schedule witness. Removed: the "no idempotency reservation" claim (the reservation precedes the provider check and is
     rolled back; the step-up and capability refusals are asserted to attempt no idempotency write at all), the lineage-has-no-active-version
     assertion (:141, trivially true), and the "refusal not stored" wording of :153 (now "a repeat with the same key is refused again").
5. AC-210 two-declared-domain case: instrument registered built (v2); four vocabularies declaring [role, instrument]; with both built one
   activates and one is scheduled (pending row); instrument (second declared) then goes unbuilt (v3) and activate and schedule are refused
   `canonical_source_unavailable` naming `instrument` with role still built, with no attempted write.

### Fix-round run
run 4 2026-10-29 00:37 ET, lane gaps-db4 (1 WIP migration), 5 files: pg_prove exit 0, 186/186 (registry 49, related_acl 20, merge_lock 23,
taxonomy_activation 32, taxonomy_terms_canonical 62). TAP .lane-logs/alt-staged-gaps-db4-003722-1630371.tap sha256
72837ac64dd527ed765b5fe692255db054a24672744d37c48be37fb0fcee61f1. Run 3 (003603-1622754): 185/186, only my incomplete anon-INSERT control (fixed).

### Changed files (sha256)
- supabase/tests/phase_02_slice_12_gaps_db4_registry.sql (264) a8c7547d6b8048ab89e71a7d87267d6caacc5923011970f46ebccac0608ed33e
- supabase/tests/phase_02_slice_12_gaps_db4_related_acl.sql (120) 9e3199b3b43029704429b950aa188cacdf6388e9bef3156f448e870d66f1c959
- supabase/tests/phase_02_slice_12_gaps_db4_merge_lock.sql (96) bc0edb869fc1805bace07bb8c1d70f73ab0295fefa3ab0a4014a75c34c0b77b0
- supabase/tests/phase_02_slice_12_gaps_db4_taxonomy_activation.sql (245) d46f0fcd3f651cb5321e7c78bfdcc3c1ef0950cc2e660fdd54da5c3899addcde
- supabase/migrations-wip/gaps-db4/20261029110000_cms_canonical_domain_registry_provider_pair.sql e7251eaae96d1303fb46b34e41fcff0a19095f7d56fecce666d9e24b8d16fd34
- docs/handoffs/2026-10-22-claude-s12/recite3/db4-proposals.json bf7a71939c639a3b63e1bdb90a63d560b5c0189ddb4b03f1a332d713a6a00aa9
Proposals: 94 citations (all verified as `ok` lines in the run-4 TAP). Renamed/removed identities replaced; new identities added.
AC-155 proposed `partial` with the BOUNDARY limitation for the two unbuilt registered callers (the clause split is root's); AC-256 `verified`
with no limitation (WIP promotion is a root step, DEC-238); AC-210/223/225 `verified`.
