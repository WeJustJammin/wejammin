# Lane `claude_s12_evidence_path` — citation paths with `[`/`]` (Astro dynamic routes)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you (no DB runs are needed here).
Report: `docs/handoffs/2026-10-22-claude-s12/lane-evidence-path-report.md`.

## Problem (observed by root 2026-10-22)

`scripts/evidence/ledger-guard-lib.mjs:34` `CITATION_PATH = /^[A-Za-z0-9_.@+/-]+$/u` rejects every repository
file under an Astro dynamic route directory, e.g. P2-S12-AC-059 cites
`apps/web/src/pages/api/v1/cms/entries/[entryId]/related-content.test.ts` → "file must be a repository-relative
POSIX path". That is the only non-receipt problem of the Slice 12 guard today.

## Work (debug-by-test)

1. RED: in `tests/contracts/phase-02-evidence-guard-citation-rules.test.ts`, a case proving a bracketed segment
   (`[entryId]`, `[...slug]`) is accepted while `..`, absolute, `./`, backslash, whitespace, `*`, `?` and
   control characters stay rejected. Run it; confirm the failure reason.
2. GREEN: the minimal regex change.
3. End to end: prove the receipt pipeline handles such a path. Read `scripts/evidence/run-slice-evidence.mjs`,
   `receipts-lib.mjs` and `list-test-identities.mjs`; find where a cited file path reaches a vitest/playwright
   CLI filter or a glob (a `[`…`]` is a glob/regex class there). If any step would mis-match, add a RED test and
   fix it (escape or pass the exact path). Do NOT run the full receipt regeneration (root runs it after canonical
   gates); a targeted dry run of the identity listing for the one file is fine.
4. README in `scripts/evidence/` if the accepted path grammar is documented there.

## Claim

`scripts/evidence/*.mjs` (only the files you must change, named in the report first),
`tests/contracts/phase-02-evidence-guard-citation-rules.test.ts`, `scripts/evidence/README.md`. Never edit
ledgers (`tests/contracts/phase-02-slice-*-evidence-ledger*.ts`) or receipts.

Final message: GREEN / PARTIAL / BLOCKED, report path + SHA-256, Vitest counts, files with SHA-256.
