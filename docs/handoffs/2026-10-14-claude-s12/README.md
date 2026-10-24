# Slice 12 handoff records, 2026-10-14 through 2026-10-21

## Contents

The second Slice 12 (CMS composition, taxonomy and localization) record set,
written by Claude and Codex lanes in this worktree:

- `lane-rules.md`: the binding rules every Claude lane follows (workspace,
  forbidden actions, database runs, method, report format). Later lane
  directories point here.
- State and resume files: `CLAUDE-STATE.md`, `CLAUDE-LANES.md`,
  `CLAUDE-RESUME-2026-10-16.md`, `CLAUDE-RESUME-NATIVE-2026-10-19.md`,
  `CODEX-RESUME-2026-10-15.md`, `CODEX-NATIVE-VALIDATION-2026-10-16.md`,
  `CODEX-NATIVE-VALIDATION-2026-10-17.md` and
  `2026-10-20-native-resumption-boundary.md`.
- `lane-<lane>-report.md`: Claude lane reports (`lane-governed-*`, `lane-web-*`,
  `lane-worker-*`, `lane-hardening-*`, `lane-dec19x-*` and others) and
  `lane-codex-*.md`: Codex lane reports and receipts.
- `review-*.md`: independent reviews of lanes, each stating its findings.
- `propagation-scan-2026-10-16-codex-dec201.md`: one decision-propagation scan.
- `briefs/`: the briefs the lanes were launched with; `lanes/`: the staged
  pgTAP runner `lane-db-alt-staged.sh` and a web mutation script.

## Ownership

Each file belongs to the lane, reviewer or session that wrote it and records what
that author observed. `lane-rules.md` is owned by the Slice 12 root orchestrator
and changes only on its instruction. Decisions live in
`.memory/wiki/decisions.md`; specifications under `.memory/wiki/specs/`; slice
progress and acceptance under `.memory/pipeline/progress/`. Nothing here is
acceptance evidence by itself.

## Extension

Add new work in a later dated directory (currently `2026-10-22-claude-s12/`)
rather than editing these records. Name lane reports `lane-<lane>-report.md`,
reviews `review-<lane>.md` and briefs `briefs/<lane>.md`. A report lists status,
scope, files with SHA-256, runs, test corrections, spec citations, open items and
requests to root.

## Conventions

Quote paths exactly, record only observed results, and keep credentials, tokens
and personal data out. Codex files keep their `lane-codex-` or `CODEX-` prefix so
their author stays visible. The pgTAP runner in `lanes/` is the only sanctioned
way to run database tests from a lane.

## Related links

- `docs/handoffs/README.md`
- `docs/handoffs/2026-10-14-claude-s12/briefs/README.md`
- `docs/handoffs/2026-10-12-claude-s12/README.md`
- `docs/handoffs/2026-10-22-claude-s12/README.md`
- `.memory/wiki/decisions.md`
