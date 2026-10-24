# Lane `claude_s12_integration_pins` — S09 inventory pins + small integration tests (delegated by root)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you, EXCEPT that root explicitly delegates to
you the S09 inventory test files named below (normally root-reserved). Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Report: `docs/handoffs/2026-10-22-claude-s12/lane-integration-pins-report.md`.

## Context

Root will promote every reviewed WIP dir into `supabase/migrations/`: batch 1 = `pattern-updates, dec193, block-rules, dec194,
dec195, locale-gate, dec197, dec202, dec205, dec206, governed-recheck, governed-v4, dec208`; batch 2 = `linked-scan`. The
canonical `pnpm db:verify` must then be green, so the S09 inventory pins must already list the final object set. Known red
today (every recent full run): `phase_02_slice_09_r8_api_surface.sql` #4/#13/#14 and
`phase_02_slice_09_sec2_all_schema_definer_rls.sql` #6. Reviews V1–V8 in `docs/handoffs/2026-10-22-claude-s12/review-v*-report.md`
name the missing objects; root's inventory scan in `STATE.md` ("Inventory scan") lists the new `platform_api` entry points.
BE03c "Permission, RLS and grants" (`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`) is now the
authoritative named-RPC list.

## Work

1. Read both S09 files and how they classify objects (reviewed lists, counts, allow-lists). Update them so every new
   `platform_api` function, every new SECURITY DEFINER function and the table `platform_private.taxonomy_merge_recoveries` are
   classified exactly as their reviewed posture is (no blanket allow; each name on its own line with a comment citing its
   lane / DEC). Recount totals from the catalog, never by hand-editing a number to match.
2. Check the other S09 pins that ran green before promotion stay green with the final set (`phase_02_slice_09_sec2_definer_rls.sql`,
   `_schema.sql`, `_p240_authority.sql`, `_evidence_misc.sql`, and any other `phase_02_slice_09_*` file that inventories
   functions, tables, policies or grants — grep for `pg_proc`/`pg_class`/`information_schema` in `supabase/tests/phase_02_slice_09*`).
3. Provider precedence test (root spec, BE03c "Preflight providers registered by Slice 12": "when several pins of the manifest
   fail, the category reports the first reason present in the order `pattern_not_active`, `nested_pattern_not_active`,
   `pattern_digest_changed`, `pattern_block_rules_violated`"): add cases with two failing pins of different reasons to
   `supabase/tests/phase_02_slice_12_block_rules/070-provider.sqlinc` (replace the V2-04(b) BOUNDARY comment), each pair in both
   pin orders.
4. `apps/worker/src/cms-composition/README.md`: it still calls `cms_pattern_linked_update_pending_total` unemitted — fix the
   sentence (the linked-scan job emits it).

## Runs

Stack (exact, the final set): `pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,
block-rules,dec208,governed-v4,linked-scan`. Test files as SEPARATE runner arguments; background; one run per deliberate change.
Final run: every `phase_02_slice_09_*.sql` + `phase_02_slice_12_block_rules*.sql`. Record counts.

## Claim

`supabase/tests/phase_02_slice_09_r8_api_surface.sql`, `phase_02_slice_09_sec2_all_schema_definer_rls.sql`, and any other
`phase_02_slice_09_*` inventory file you must change (name each in the report BEFORE editing; never the shared helper dirs
`phase_02_slice_09_dec108/`); `phase_02_slice_12_block_rules/070-provider.sqlinc` (+ its README); the one Worker README.
Live: reviewers V7/V8 (read-only). No migration edits.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, final run counts, files with before/after SHA-256,
the exact names added per pin, requests to root.
