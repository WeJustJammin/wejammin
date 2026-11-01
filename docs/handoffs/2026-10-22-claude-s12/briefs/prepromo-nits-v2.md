# Lane `claude_s12_v2_nits` — review V2 follow-ups before promotion (pattern-updates, dec193, block-rules)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you (tar-backup every untracked file before
editing it in place). Start EVERY shell command with `cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`.
Report: `docs/handoffs/2026-10-22-claude-s12/lane-v2-nits-report.md` (checkpoint early; keep `## Status` current).
Read `docs/handoffs/2026-10-22-claude-s12/review-v2-report.md` in full — the findings carry file:line and proposed fixes.
Review V2 already says PROMOTE for all three dirs; this lane only closes its MINOR/NIT items so they are not frozen.

## Items

- **V2-01**: add the PAT-031 restore assertion to the pattern-updates suites: with the caller's `app.cms_rpc` set to a known
  non-'true' sentinel (and separately cleared), call each of the two `platform_api` wrappers (`cms_get_instance_update_diff`,
  `cms_apply_pattern_update`) as `service_role` and assert the caller's value is restored afterwards; make the existing
  "flag does not leak" check at `060-effects.sqlinc:40` able to fail (show it with one mutant run: a wrapper copy that
  skips the restore must fail it).
- **V2-04**: DEC-210 coverage gaps (a) a refusal at `/instances/1/choices` and `/instances/1` (instance index above 0);
  (b) provider precedence when `pattern_digest_changed` / `nested_pattern_not_active` and `pattern_block_rules_violated` are
  both present (cite the BE03c provider reason order; if the spec states no order, record BOUNDARY instead of a test);
  (c) the depth and empty-allow-list cases through the real wrappers, not only the pure helper.
- **V2-05**: delete the dead privilege-closure DO block in `pattern-updates/20261014140410_cms_get_instance_update_diff_public.sql:34-41`
  (it can never act after DEC-215). This changes WIP bytes: run the pattern-updates + dec193 suites after.
- **V2-07**: complete the `supabase/migrations-wip/dec193/README.md` inventory (all 35 files, one line each).

## Runs

Standard stack (dec208 is final now): `pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,
governed-recheck,block-rules,dec208` (`fix-dec193` is README-only now; leave it out). Test files as SEPARATE runner arguments;
background; one run per deliberate change. Final run: every `phase_02_slice_12_pattern*.sql`, `dec193*`, `block_rules*`,
`composition*` file.

## Claim

`supabase/tests/phase_02_slice_12_pattern_updates*`, `phase_02_slice_12_block_rules*`, the one `140410` file, the dec193 README.
Live: `claude_s12_linked_scan` (its own WIP + Worker dir), reviewers V4/V5 (read-only). Never edit other SQL.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, run counts, files with before/after SHA-256, BOUNDARY items.
