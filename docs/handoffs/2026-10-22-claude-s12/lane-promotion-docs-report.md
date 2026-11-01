# Lane report: claude_s12_promotion_docs

## Status
GREEN. Documentation only; no SQL, DB, docker, supabase, pgTAP, vitest or pnpm command was run (canonical db:verify was running).

## Scope
Document the 80 migrations promoted on 2026-10-23 in `supabase/migrations/README.md`, retire the per-lane WIP READMEs and
empty lane directories, update `supabase/migrations-wip/README.md`.

## Files
| path | before SHA-256 | after SHA-256 |
| --- | --- | --- |
| `supabase/migrations/README.md` (tracked) | `93e3ae009a6f86aa3046f366c4be12e646fec8d947c917a85fba0ac15840a2b9` | `0ddb3a73fdf8b56eadb6277badbd8cf8ac9b44bc48134387cbc2002a6f4add9d` |
| `supabase/migrations-wip/README.md` (untracked) | `5d6aebc3fa46c77ea2a564d0e910b9d802a54fe0a289008e305598ba666df10e` | `b2ed4623d8474ce7389e19cc1633c49dedef42c52b03204ed359ba405b312434` |
| `supabase/migrations-wip/block-rules/README.md` | `4f7a7de013c1ab11d8f8c462b2e4ff2ff7629d459ef7107cb611f057ca023c3e` | deleted |
| `supabase/migrations-wip/dec193/README.md` | `c36ea9fbf6bbe77f0c6dafeb266d866d01326d6172631f18a2f976739fd4fdab` | deleted |
| `supabase/migrations-wip/dec208/README.md` | `52ed73d86cb55f8cab9d9f77d26fe8230143ce25e1fa3cccbbeafa256a528d61` | deleted |
| `supabase/migrations-wip/governed-recheck/README.md` | `f4155499792a1e9a7e8ad369488f55f31d29d983183730ad9280145a40d1076a` | deleted |
| `supabase/migrations-wip/governed-v4/README.md` | `e776c2b7ecf1e7f6fa5d2c7fcd9320eb157df3bbaf22092560d3d07595263091` | deleted |
| `supabase/migrations-wip/linked-scan/README.md` | `19320700f51fbc66dca405e743f232f64f97c36ef4bb7e2734ad3f7c3b8df6a7` | deleted |

All 14 lane directories (pattern-updates, dec193, block-rules, dec194, dec195, locale-gate, dec197, dec202, dec205, dec206,
governed-recheck, governed-v4, dec208, linked-scan) were removed; eight of them (pattern-updates, dec194, dec195,
locale-gate, dec197, dec202, dec205, dec206) held no README, so their sections come from the headers of the promoted SQL
files and the lane reports in this directory and `../2026-10-14-claude-s12/`.
Backups before the untracked edits/deletes (lane rule): `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_promotion_docs/orig-wip-readmes-20261023T060945Z.tar` (all 7 WIP READMEs)
and `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_promotion_docs/orig-migrations-README.md`.

## Added content
One `##` section "Slice 12 joint promotion of 2026-10-23 (80 migrations)" with an intro (manifest path, the
`supabase migration up --include-all` note) and 14 `###` sections in order of each lane's first timestamp: locale gate,
pattern updates, DEC-194, DEC-195, DEC-197, DEC-193, DEC-202, DEC-205, governed recheck, DEC-206, DEC-210 block rules,
DEC-208, linked-update scan, governed frozen-status (DEC-221). Each section's paragraph repeats the promoted-together and
`--include-all` note. Placed before `## Related links`.

## 80/80 check (script, run after the edit)
```
manifest entries: 80
listed exactly once: 80/80
### sections: 14
per-section counts: 2 9 5 2 1 35 2 2 4 2 6 4 5 1 (sum 80)
```
Also checked: every bullet file is in the manifest, each section's files all come from one source dir matching that
section, and all 80 files exist in `supabase/migrations/`.

## Open items
- Behavior statements come from the dir READMEs, the promoted files' own header comments and the lane reports; DEC-205 to
  DEC-221 titles are not in `.memory/wiki/decisions.md` (raw records only), so those are cited by number with the wording
  of STATE.md and the READMEs.
- Other documents still cite the deleted WIP README paths (`.memory/pipeline/progress/slices/phase-02-slice-12.md`,
  `docs/handoffs/2026-10-22-claude-phase2-s12-inventory.json`, several lane and review reports). Those are historical
  records and were not edited.

## Requests to root
None.
