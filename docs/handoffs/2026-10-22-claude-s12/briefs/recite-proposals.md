# Lanes `claude_s12_recite_{a,b,c,d}` — Slice 12 ledger re-citation PROPOSALS (no ledger edits)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Start EVERY shell command with
`cd /home/rob/.codex/worktrees/phase2-slice12/WeJammin &&`. Toolchain `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH`.
zsh does not word-split: put multi-file commands in a bash script. Use `/bin/ls`, never bare `ls`.
Report: `docs/handoffs/2026-10-22-claude-s12/lane-recite-<x>-report.md`; proposals:
`docs/handoffs/2026-10-22-claude-s12/recite/<x>-proposals.json` (create the dir; write as you go, one criterion at a time,
so a crash loses nothing).

| Lane | Criteria |
|---|---|
| a | P2-S12-AC-001 .. AC-079 |
| b | P2-S12-AC-080 .. AC-124 |
| c | P2-S12-AC-125 .. AC-214 |
| d | P2-S12-AC-215 .. AC-296 |

## Why proposals, not edits

The root is running the Slice 12 evidence runner now; it reads the ledgers when it collects. **Never edit
`tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`, receipts, trackers, specs, tests or product code.** Root applies the
proposals after the next commit, reruns the evidence, and a separate reviewer population refutes them first.

## The ledger and its rules

Ledgers: `tests/contracts/phase-02-slice-12-evidence-ledger-{001-071,072-142,143-213,214-285,286-296}.ts`; types
`tests/contracts/phase-02-evidence-ledger.ts`; rules `scripts/evidence/README.md` ("What the guard rejects", "Filling a
ledger") and `scripts/evidence/ledger-guard-lib.mjs`. Read them. Key rules: a citation names ONE test by exact identity
(vitest: file + full name = describe chain and title joined by one space; pgTAP: file + the `ok N - description` text with
whitespace collapsed; Playwright: file + full title path + `project`; race: file + the exact `ok - …` assertion text);
`verified` = every clause cited, no limitation; `partial` = some cited, limitation names the rest; `unverified` = nothing
cited, limitation ≥ 20 characters; a test that is the ONLY citation of a clause may do that for at most 3 criteria.

## Work, per criterion in your range

1. Read the criterion text and each clause, the current citations, and the spec lines the clause comes from (BE03c
   `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`, FE03 `.memory/wiki/specs/fe/03-cms-content-modeling.md`,
   `.memory/wiki/specs/phases/phase-2.md`).
2. For each **uncited** clause, find tests that PROVE it: the assertion checks the clause's exact behaviour (the value, the
   refusal code, the state transition, the order, the bound), not merely code in the same area. A clause about a refusal
   needs the refusal asserted; a clause with several conditions needs each condition asserted somewhere. Prefer the
   lowest layer that proves the whole clause; cite more than one test where layers split the clause. Read the test body
   and quote the asserting line (file:line) for every citation. Starting hints (stale, 2026-10-22, re-check everything):
   `.lane-logs/s12-claude-intake-20261022/classify-{001-099,100-199,200-296}.json`.
3. Copy identities, never type them:
   - Vitest: `.lane-logs/canonical/final-evidence-20261023T224619Z/s09/vitest-all.json` (full run of 2026-10-24 01:04Z;
     use `node scripts/evidence/list-test-identities.mjs --vitest <that json> --file <substring> --citations`). For these
     eight files use `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_root/uniq8.json`
     instead (titles changed after the full run began): `apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.recovery.test.tsx`,
     `…/governed-review-command-failures.test.ts`, `apps/worker/src/cms-composition/{governed-review-decision-input,governed-review-reads,pattern-definition-admission,pattern-update-admission,taxonomy-definition-write,taxonomy-selector-read}.test.ts`.
     Cite only tests whose status there is `passed`.
   - pgTAP: no full verbose TAP exists yet; take the description from the `.sql`/`.sqlinc` source, collapse whitespace, and
     mark the citation `"identitySource": "static"`. Computed descriptions (`||`, `format(`) must be marked
     `"computed": true` with the value you derived. Prefer the top-level `.sql` entrypoint as `file` when the description is in
     that file; when it sits in a `.sqlinc`, cite the `.sqlinc` (see README "Prefer a top-level pgTAP .sql file").
   - Playwright: do NOT run Playwright at all, not even `--list` (a Playwright start may empty `test-results/`, where the
     root's runner keeps its outputs). Take the title path from the spec source (`test.describe` chain + `test` title) and
     the project names from `playwright.config.ts` / `playwright.s09-real.config.ts`; mark `"identitySource": "static"`.
   - Race: the `ok - …` text from the module source under `supabase/tests/**/races/` or `infra/database-races/`.
4. Also check every EXISTING citation in your range still names a test that exists with that exact identity; list any
   that do not (do not fix them — propose the replacement).
5. Propose the criterion `status` and `limitation` that the guard rules give with your citations applied. A clause no
   test proves is a **gap**: name the missing test (layer, file to put it in, what it must assert, spec line). Never call a
   clause proven to avoid a gap; a justified gap is a good answer (PAT: marker evidence over-claimed ~38%).

## Output format (`recite/<x>-proposals.json`, an array)

```json
{ "criterion": "P2-S12-AC-0NN",
  "clauses": [ { "index": 0, "text": "<verbatim clause>",
                 "add": [ { "tool": "vitest", "file": "...", "title": "...", "project": null,
                            "identitySource": "vitest-all.json|uniq8.json|static|race-source",
                            "computed": false, "evidence": "path:line `expect(...)…` — what it asserts" } ],
                 "staleExisting": [ { "title": "...", "replacement": { … } } ],
                 "gap": null | "missing test: layer, file, what it must assert, spec line" } ],
  "proposedStatus": "verified|partial|unverified",
  "proposedLimitation": "" }
```

Include every criterion of your range (also fully cited ones: `add: []`, `gap: null`). Validate the JSON with `node -e`
before you finish. The report gives counts: criteria by proposed status, clauses newly cited, gaps by layer, stale
existing citations, and the five weakest citations you still proposed (so the reviewers start there).

## Claim

`docs/handoffs/2026-10-22-claude-s12/recite/<x>-proposals.json` and your report only. Read-only everywhere else. Never run
supabase, docker, db, race modules, Vitest suites (the JSON already exists) or Playwright in any form.
Live: root's evidence runner (do not touch `test-results/`), the other three recite lanes.

Final message to root: GREEN / PARTIAL / BLOCKED, report path + SHA-256, proposals path + SHA-256, the counts, requests.
