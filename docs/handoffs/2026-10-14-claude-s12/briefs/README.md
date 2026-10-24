# Slice 12 lane briefs, 2026-10-14 through 2026-10-21

## Contents

One brief per lane or review, each the launch prompt the lane received: goal,
claimed files, constraints and report path. Names follow the lane: Claude lanes
(`web-*`, `worker-*`, `governed-*`, `taxonomy-*`, `pattern-*`, `hardening-*`,
`locale*`, `dec19x-*`, `fixture-repair*`, `pins-b`, `placement*`, `related*`,
`template-digest` and others), reviewer briefs (`review-*`) and Codex-authored
briefs and plans (`codex-dec197-*` and `codex-dec203-*`, including
`codex-dec203-bootstrap-tcb-cascade-inverse.json`).

## Ownership

The Slice 12 root orchestrator wrote the Claude briefs; the Codex-prefixed files
belong to the Codex session that wrote them. A brief states intent at launch time
and is superseded by the lane's report for what actually happened.

## Extension

Add a brief as `<lane>.md` before launching a lane, state the goal, the exact
files the lane may touch and the report path, and point to
`docs/handoffs/2026-10-14-claude-s12/lane-rules.md` for the binding rules rather
than copying them. Do not edit a brief after launch; write a new one for a
follow-up lane (`<lane>-f1.md`, `<lane>-2.md`).

## Conventions

Briefs name files and decisions exactly (DEC numbers, spec paths) and contain no
credentials, tokens or personal data. Reviewer briefs give the reviewer the code
to read, not the author's conclusion.

## Related links

- `docs/handoffs/2026-10-14-claude-s12/README.md`
- `docs/handoffs/2026-10-14-claude-s12/lane-rules.md`
- `docs/handoffs/2026-10-22-claude-s12/briefs/README.md`
