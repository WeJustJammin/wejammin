# Lane brief — `claude_s12_pattern_def_sql` (staged-runner lane `pattern-def`)

Implement the missing SQL producers for CMS-03C-12 (POST /api/v1/cms/patterns/versions → `cms_create_pattern_version`) and the supporting read `cmsPatternLatestRead` (GET /api/v1/cms/patterns/{patternKey} → `cms_pattern_latest`), taking the existing RED pgTAP suite to GREEN through strict TDD.

## Your files (exclusive)
- `supabase/migrations-wip/pattern-def/` — new forward migrations, timestamps ONLY in 20261014020000–20261014029999.
- `supabase/tests/phase_02_slice_12_pattern_definition.sql` and `supabase/tests/phase_02_slice_12_pattern_definition/` — existing RED suite (independently reviewed). Add cases freely; correct an existing oracle only under the lane-rules "Test corrections" rule.
- Report: `docs/handoffs/2026-10-14-claude-s12/lane-pattern-def-report.md` (a stub from a stopped predecessor may exist; overwrite it).
Nothing else. Worker TypeScript is frozen and reviewed: your SQL must match it, not the other way round.

## Read before designing
1. Prior RED report: `docs/handoffs/2026-10-12-claude-s12/lane-native-pattern-definition-report.md` (whole file). Latest run: complete plan 1..249, 23 pass / 226 fail; setup 1–8 pass; first genuine RED = missing storage (#9), missing producer (#10), SQLSTATE 42883 (#14); ACL #116–117 fail 42883 instead of 42501. TAP: `.lane-logs/alt-tap-184038-294674.tap`.
2. The suite itself, all includes, and the README in its directory.
3. BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`: Route Registry rows CMS-03C-12 and cmsPatternLatestRead (~165, 174); Registry invariants (~192–221: DEC-188 immutable definition `version` + private `lifecycle_version`; E13 reserved keys `context|versions|selector|new`; E14 per-owner uniqueness; lineage ids `pattern_id` = id of version-1 row; `supersedes_id`); PatternVersion* request/response contracts; "Pattern versions and linked updates (D9, OD-2)"; "Slice 12 lock order"; Database Schema; Permission/RLS/grants; per-operation authorization matrix; error catalog. Search for `cms_create_pattern_version` (normative name ~1447) and `PatternVersion`.
4. Contracts (frozen): `packages/contracts/src/cms-composition/pattern-version.ts`, `pattern-node.ts`, `key-grammar.ts`, `refusals.ts`, `error-catalog.ts`.
5. Worker adapter (frozen RPC boundary — argument names, JSON envelope, error tokens, If-Match operand form): `apps/worker/src/cms-composition-production-pattern-definition.ts`, `apps/worker/src/cms-composition-production-pattern-definition-latest.ts` (RPC names ~119–120), `apps/worker/src/cms-composition/pattern-definition-ports.ts`, `pattern-definition-response.ts`, and tests `apps/worker/src/cms-composition/pattern-definition-*.test.ts` for the exact RPC request/response JSON and error mapping.
6. Existing storage: `supabase/migrations/20260927290000_cms_composition_authority.sql` (cms_patterns / cms_pattern_versions object-tree/global-key structure), `20260927300000_cms_composition_path_and_tree_bounds.sql` (guard that rejects array forests); template analogues `20260927200000_cms_template_authority.sql` (`cms_define_template` producer + wrapper shape) and `20261013100000`–`20261013100300` (per-owner keys, lineage, latest read — mirror for patterns); governed helpers `20261013300000`–`300830` (lifecycle_version, `cms_governed_pattern_row`, `cms_governed_pattern_closure`, `cms_governed_tree_nodes/blocks` — reuse, never edit).

## Known hazards (address each in your report)
Legacy object-tree versus ordered-forest CHECK; semantic node/props depth and reachable digest/attestations/cycle compatibility; version-row FK versus stable lineage; ambiguous populated-legacy backfill (migrate deterministically or refuse with a clear error — say which and why); immutable guarded definition fields; full definer/trigger/callee privilege closure (every function your SECURITY DEFINER producer calls must be executable by its owner — earlier governed work failed at runtime on two missing EXECUTE grants); concurrent CAS/replay and injected-fault atomicity (all-or-nothing; idempotent replay returns the identical resource; conflicting replay refused).

## Dependencies outside your scope
Nested-pattern positives need real governed CMS-03C-06 submit (exists), 08 assign, 07 decide and 09 activate. 07/08 are built concurrently by lane `governed-a` in its own WIP directory; 09 is not started. Your staged runs do NOT include other lanes' WIP, so those positives stay RED for now. Implement everything on your side, then classify each still-failing assertion `blocked-on-governed-07/08/09` with TAP evidence (exact missing function / SQLSTATE). Never fake them.

## Done
Every assertion not blocked on governed 07/08/09 passes; plan unchanged or grown (never shrunk); zero harness aborts. ACL assertions get 42501 for anon/authenticated with the producer present. Report: migrations (path/lines/SHA-256), each run, test corrections with diffs and spec citations, remaining failures with classification, hazard dispositions, requests to root (populated-DB migration witness, generated types refresh, any Worker mismatch found).
