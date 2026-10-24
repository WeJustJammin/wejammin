# Lane `claude_s12_taxonomy_integrity` — DEC-141 receiving obligations and the `cms.taxonomy.assignment_integrity` provider

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you (ALT pgTAP through the staged runner
only; tar-backup every untracked file before editing it). Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&` (check HEAD is the latest root commit on `claude/phase2-slice12`).
Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`. zsh does not word-split: multi-file commands go in a
bash script. `/bin/ls`, never bare `ls`. Report: `docs/handoffs/2026-10-22-claude-s12/lane-taxonomy-integrity-report.md`
(checkpoint early; keep `## Status` current; write it with a Bash heredoc if Write refuses).

## Spec (the contract — cite lines; never edit specs)

BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`: "Preflight providers registered by Slice 12"
(line ~1574: the taxonomy provider `cms.taxonomy.assignment_integrity` version 1, category `taxonomy`, kind `database`,
a newer registry row replacing the reference gate) and "Receiving obligations from Slice 10 (DEC-141)" (lines ~1576-1590:
1 taxonomy-version resolution `platform_private.cms_resolve_taxonomy_version(...)` in the CMS-03B-03 comparison and the
CMS-03B-04 restore lineage; restore carry of `active` TermAssignments; 5 the 03b `taxonomy` value encoder that fails closed
with `taxonomy_source_unavailable` is replaced), the test line ~1795 ("DEC-141 receiving-obligation tests"), the term
action preconditions (CMS-03C-03 assignment requires the vocabulary's active version to list the entry content type key
and field key) and the typed refusals. BE03b `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` for the
receiving side (taxonomy encoder, comparison, restore, preflight registry). Criteria
`.memory/wiki/specs/phases/phase-2.md`: P2-S12-AC-221 (clause "assigning a term to a field requires …"), AC-224
("not newly assignable"), AC-239, AC-241 (`cms.taxonomy.assignment_integrity` dispatch), AC-242, AC-244, AC-246, and the
current ledger limitations of each (`tests/contracts/phase-02-slice-12-evidence-ledger-214-285.ts`,
`…-143-213.ts`) which name exactly what is unproven. Note the existing guard test
`packages/contracts/src/cms-editorial/preflight.test.ts` "[P2-S12-AC-241] replaces the seeded reference gate only for
categories whose provider a later slice registered" pins the registry today and must change when your row lands (that is
expected: update its expected list to all three providers, citing BE03c).
If the spec is silent on something you need, record a BOUNDARY with the lines; do not invent.

## Precedent

The locale provider `cms.locale.no_fallback_gate` (registry v2 row, provider function, contracts row, preflight tests:
grep `no_fallback_gate` in `supabase/migrations/`, `packages/contracts/src/cms-editorial/`, `supabase/tests/`) and the
pattern provider `cms.pattern.active_digest` — follow them layer by layer.

## Layers (RED first at each; tests are the spec)

1. SQL in NEW WIP `supabase/migrations-wip/taxonomy-integrity/`, timestamps `20261024100000`–`20261024109999` only:
   the resolution function, the provider function and its registry row, the restore carry, the encoder replacement and
   any precondition change; definer ownership, grants, `app.cms_rpc` set/restore on every entry point. pgTAP: NEW
   `supabase/tests/phase_02_slice_12_taxonomy_integrity.sql` (+ dir) — every predicate both ways, each refusal token,
   a context-cleared call per entry point (PAT-031), and the S09 inventory pins if your objects change them (run the
   `phase_02_slice_09_*` inventory files in your final run and fix the pins with each name on its own line).
2. Contracts: the registry row in `CMS_PREFLIGHT_REGISTRY`, reason codes, the encoder token set; contract tests.
3. Worker: any mapping of the new refusal tokens on the routes that surface them (real token form in tests, DEC-226 rule 4).

Staged stack: promoted migrations + your WIP dir. Final run: your suite + every `phase_02_slice_11_helpers_preflight*`,
`phase_02_slice_12_taxonomy*`, `phase_02_slice_10*` restore/comparison file that touches taxonomy, and `phase_02_slice_09_*`
inventory pins; focused Vitest; tsc/eslint/prettier on touched files.

## Claim

NEW `supabase/migrations-wip/taxonomy-integrity/`, NEW `supabase/tests/phase_02_slice_12_taxonomy_integrity*`, the contracts
preflight registry/encoder files and their tests (name them in the report before editing), the S09 inventory pin files
only for names your objects add. Never edit promoted migrations, ledgers, receipts, trackers or specs. Live: other gap lanes
(their claims are in `LANES.md`), root.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, pgTAP/Vitest counts, files with SHA-256,
BOUNDARY items, the AC clauses your tests prove (root re-cites), requests to root.
