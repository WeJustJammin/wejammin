# Handoffs

## Contents

Dated session handoffs between agents and runtimes for Phase 2, each a
point-in-time statement of repository state, locked decisions, and remaining
work: `2026-10-02-phase2-claude-handoff.md`, `2026-10-03-phase2-codex-handoff.md`
with its `2026-10-03-phase2-codex-handoff/` evidence directory, and
`2026-10-06-phase2-claude-handoff.md` with its launch prompt
`2026-10-06-phase2-claude-prompt.md`.

## Ownership

A handoff records what its author observed on the date in its name. It is not a
specification and not acceptance evidence: locked decisions live in
`.memory/wiki/decisions.md`, specs under `.memory/wiki/specs/`, and slice
progress in `.memory/pipeline/progress/`. A later handoff supersedes an earlier
one only for the state it re-observes.

## Extension

Add a new dated handoff rather than editing an old one, name it
`YYYY-MM-DD-<phase>-<runtime>-handoff.md`, and state the commit and branch it
describes, the verification actually run, and what was not run. Put bulk
evidence in a sibling directory with its own README.

## Conventions

Never copy a measurement into a spec from a handoff, and never record a
passing result that was not observed. Quote file paths exactly and keep
credentials, tokens, and personal data out of every handoff.

## Related links

- `.memory/wiki/decisions.md`
- `.memory/pipeline/progress/`
- `docs/handoffs/2026-10-03-phase2-codex-handoff/README.md`
