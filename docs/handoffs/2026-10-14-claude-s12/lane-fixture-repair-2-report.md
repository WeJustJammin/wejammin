# Lane report — claude_s12_fixture_repair_2

## Status
GREEN (2026-10-15T17:06Z). Both stale locale fixtures repaired; `locale_related_authority` 17/17 and `locale_owner_integrity` 13/13 pass on promoted migrations alone (lane `none`).

## Scope
Brief `briefs/fixture-repair-2.md`. Repair the stale raw `cms_related_content_rules` inserts in the two frozen locale fixtures made stale by promoted `20261014060000_cms_related_rule_registry.sql`. No assertion weakened, no production code or migration touched.

## Findings (diagnosis)
The brief and gate-A report name `max_candidates` only. Reading promoted `20261014060000` lines 63-72 shows the same derived rows violated THREE further checks, so adding `max_candidates` alone would still abort:
- `cms_related_content_rules_rule_registry_check`: `rule_key` must be in the registry (`shared-terms`, `same-type-recent`, version 1); the fixtures used `similar-genre` / `same-tag`.
- `cms_related_content_rules_derived_reason_check`: `reason_code` must equal `upper(reason(rule_key))` = `SHARED_TERMS`; the fixtures used `MATCHED_RULE`.
- `cms_related_content_rules_max_candidates_check`: derived rows require `max_candidates` between 1 and 128 (BE03c CMS-03C-05 validation row `derivedRule`: "`maxCandidates` 1–128"; "Derived rules (OD-5)": registry members `shared-terms` reason `shared_terms`, `same-type-recent`).
- `cms_related_content_rules_derived_rule_check`: derived rows must carry a `rule_key` (affects the third insert below, which had none).
A CHECK violation (23514) precedes FK checks, so the owner_integrity insert (expects 23503) must be otherwise fully valid or the assertion would pass/fail for the wrong reason.

## Files (path, lines, SHA-256)
- `supabase/tests/phase_02_slice_12_locale_related_authority.sql` 197 lines `9615ecf0b80185d5baa9e9c418fcba72a993912d044d9d47606599096a676542` (before `7cbb6e6f2bfc1417fcd7fc7de308b929e52a0984e6b049e9e73a12df8545a423`)
- `supabase/tests/phase_02_slice_12_locale_owner_integrity.sql` 133 lines `f33fb282f012adb72aeedd16672e472b3010f956f3cb522981aaff0ea3338962` (before `f362d894636cac2da1f84d764fc9beb3e4bad2701497a66834716683c9e93d24`)

## Test corrections (for independent review)
All are fixture-data corrections inside raw derived inserts; every assertion (`throws_ok` code, message, description) is unchanged.
1. `locale_related_authority.sql` ~150: column list gains `max_candidates`; values `'similar-genre', 1, 'derived', 'MATCHED_RULE'` become `'shared-terms', 1, 'derived', 'SHARED_TERMS', 4`. This row is the one the later append-only DELETE assertion targets (id ...302), so it must insert successfully.
2. `locale_related_authority.sql` ~185 (`derived rule cannot hardcode a target entry`, expects 23514): previously omitted `rule_key`/`rule_version`/`max_candidates`, so it was failing a registry/derived CHECK as much as `cms_related_content_rules_target_mode_check`. Columns now `rule_key, rule_version, mode, reason_code, max_candidates` with `'shared-terms', 1, 'derived', 'SHARED_TERMS', 4`, so the ONLY violated constraint is the target-mode check the description names (a strengthening of the assertion's reason, not a weakening).
3. `locale_owner_integrity.sql` ~120 (`related-content source cannot claim another owner`, expects 23503): column list gains `max_candidates`; `'same-tag', 1, 'derived', 'MATCHED_RULE'` becomes `'shared-terms', 1, 'derived', 'SHARED_TERMS', 4`, so the FK `cms_related_content_rules_source_owner_fkey` is the sole failing constraint.

## Sweep
`grep` of `supabase`, `apps`, `packages`, `scripts` for `into platform_private.cms_related_content_rules` finds only: these two fixtures (3 inserts, all repaired), `related_content/002-shape-and-grants.sqlinc:42` (a `jsonb_populate_record` probe whose derived case already supplies `max_candidates: 4`, `shared-terms`, `SHARED_TERMS`), and promoted `20261014060350_cms_related_rules_replace.sql` (production). `MATCHED_RULE`/`similar-genre`/`same-tag` remain only in TS tests that do not touch SQL. No other stale raw insert. No suite includes either of the two files (`grep` for their names across `supabase/tests` finds no includer).

## Runs
| # | stamp | files | result | classification | TAP SHA-256 |
|---|---|---|---|---|---|
| 1 | `alt-staged-none-130448-2460930` (started 2026-10-15T17:04:48Z, reset ok 17:05:44Z, no WIP migrations) | `locale_related_authority.sql` (plan 17), `locale_owner_integrity.sql` (plan 13) | 30 planned, 30 ok, 0 not ok, pg_prove exit 0, `Result: PASS`; related_authority previously aborted at :158, owner_integrity previously failed #13 (now ok 13) | GREEN; fixture defect fixed | `4f75559aa87467cb8dc89d8dc0626ce947186aec9ee30f1d1533728273b51dc7` at `.lane-logs/alt-staged-none-130448-2460930.tap` |

No other suite includes these two files, so no further suite needs re-running.

## Spec citations
- BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` CMS-03C-05 validation row (line 386): derivedRule `key` registry member, `reasonCode` equality with the registry value, `maxCandidates` 1-128.
- BE03c "Derived rules (OD-5)" (line 1420): registry members and reasons.

## Open items / BOUNDARY
None.

## Requests to root
None.
