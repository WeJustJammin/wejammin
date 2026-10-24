# Slice 12 lane logs

## Contents

Verbatim `.log` output from Slice 12 validation runs cited by the lane reports in
the parent directory: pattern-placement focused, neighbor and runtime runs
(`s12-pattern-*`), web runs (`s12-web-*`), unit runs (`s12-unit-*`), the
exhaustion SQL and unit RED runs (`s12-exhaustion-*`) and the fallback-typing
focused run (`s12-fallback-*`).

## Ownership

The lane whose report cites a log owns it. A log is an observation of one run on
one date and is not acceptance evidence on its own.

## Extension

Add a new log only for a new run and name it
`s12-<subject>-<kind>[-<timestamp>].log` (for example `-red`, `-green-focused`).
Never rewrite or trim an existing log; a rerun is a new file cited by the report
that needs it.

## Conventions

Keep output unedited, including failures. Logs must contain no credentials,
tokens or personal data; redact before saving if a tool printed any.

## Related links

- `docs/handoffs/2026-10-12-claude-s12/README.md`
- `docs/handoffs/2026-10-12-claude-s12/lane-l0-logs/README.md`
