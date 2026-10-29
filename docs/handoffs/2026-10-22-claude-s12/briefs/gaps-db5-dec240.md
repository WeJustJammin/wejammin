# Lane `claude_s12_gaps_db5` — DEC-240: restore records only the vocabularies of carried assignments

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you (ALT pgTAP through the staged runner only;
tar-backup every untracked file before editing it). Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`.
zsh does not word-split; `/bin/ls`, never bare `ls`. Report `docs/handoffs/2026-10-22-claude-s12/lane-gaps-db5-report.md`
(checkpoint early). Debug-by-test: RED first.

## Decision (root DEC-240, `.memory/raw/events/2026-10-29.jsonl`; BE03c 1593 amended + changelog row)

On restore (`supabase/migrations/20261024100700_cms_restore_term_assignments.sql` and whatever later migration now owns the
restore taxonomy carry — find the CURRENT body), a source-recorded taxonomy version whose vocabulary has no carried assignment
is NOT carried: the new revision's `taxonomy_version_ids` hold exactly one current active id per vocabulary with a carried
assignment (the AC-246 writer rule, ascending bytewise like the writers). Today the code keeps the recorded id and the 100700
file carries the comment `(BOUNDARY: 03c states the rule for assignments only)`.

## Work

1. RED: a pgTAP case in a NEW file `supabase/tests/phase_02_slice_12_gaps_db5_restore_versions.sql` — a source revision recording
   versions of vocabulary A (with an active assignment) and vocabulary B (recorded, no assignment; build it the way the existing
   restore suites build their sources, never by disabling triggers) restores to a revision recording only A's current active id;
   controls: A's id is the CURRENT active one (after a successor activation), the order is the writers' order, nothing else in
   the restore changes, and a source with assignments in both vocabularies records both. Run it RED on the ALT runner.
2. Fix forward in a NEW WIP dir `supabase/migrations-wip/gaps-db5/` (timestamp `20261029130000`), anchored patch with inverse
   checks and the populated-DB safety convention of `20261027100020` (statement timeout, typed refusals), comment citing DEC-240 —
   never the word "BOUNDARY". Any existing test that asserted the kept-recorded-id behaviour is a test correction: list it with the
   exact diff and the spec line that changed (DEC-240); never weaken an unrelated assertion. Check every body-hash/digest pin
   suite that pins the patched function (sweep `supabase/tests` for its name) and update pins through the established reversal
   pattern, listing each.
3. The closeout test `tests/contracts/phase-02-slice-12-closeout.test.ts` (test `boundaries: the two SQL BOUNDARY: markers …`,
   ~lines 280-298) fails today because `20261024100700` contains `BOUNDARY:`. Extend it (this is a named test correction) the way
   it already treats the retire-request amendment: the 100700 marker is allowed only because the DEC-240 migration supersedes it
   — assert the superseding migration exists, names DEC-240 and contains no `BOUNDARY:`, and keep the closed-set assertion for
   every other file. Do not edit the promoted 100700 file.
4. ALT runs: your new file + every restore/taxonomy suite the WIP touches + the pin suites, green. Vitest the closeout test.

## Claim

Your new test file, the WIP dir, the closeout test, the named test corrections, your report. Never edit promoted migrations,
ledgers, specs or other lanes' files (lanes unit5 and pwfix6 are active in apps/web).

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, runs (TAP + SHA-256), files with SHA-256, test corrections.
