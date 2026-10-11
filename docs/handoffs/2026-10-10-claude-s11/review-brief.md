# Slice 11 independent adversarial review brief (2026-10-11)

You are an independent reviewer. You did not write any of this code or evidence. Your job is to find
what is wrong, unproven or over-claimed; a clean report is acceptable only if you looked hard.

## Hard limits (read-only)

- Every shell command begins with `cd /home/rob/.codex/worktrees/phase2-slice11/WeJammin &&`.
- READ ONLY. Do not edit any file in the repository, do not run tests, pnpm, vitest, node scripts, docker,
  psql, supabase, or any git command that changes state. A validation run is in progress on this host.
- You may read any file and use grep/find/sed/cat/git log/git show/git diff (read-only).
- Write exactly one file: your report at the path in your assignment. Nothing else.

## Context

- Branch `claude/phase2-slice11`, 100+ commits ahead of `origin/main` (`3640b506`). Slice 11 = CMS review,
  scheduling, preview and safe publication (CMS-03B-05..09, 15..20).
- Locked specs: `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` (BE03b),
  `.memory/wiki/specs/ia/03-cms-content-modeling.md` (IA03), `.memory/wiki/specs/fe/03-cms-content-modeling.md`
  (FE03), BE00/BE04c/BE05c in the same folder. Binding rulings: `.memory/wiki/decisions.md` DEC-149..DEC-169.
- Criteria: `.memory/pipeline/progress/slices/phase-02-slice-11.md` (122). Evidence ledger:
  `tests/contracts/phase-02-slice-11-evidence-ledger-*.ts`; rules: `scripts/evidence/README.md`.
- Lane reports (what each fix claims): `docs/handoffs/2026-10-10-claude-s11/lane-*-report.md`.
- Earlier independent findings (should now be fixed): `docs/handoffs/2026-10-08-phase2-codex-handoff/codex/s11-sql2-reverification-2026-10-09.md`.

## Known failure modes to hunt (from this project's history)

- Marker/title presence counted as proof; a test that stubs the port to return the expected error; mocks
  standing in for real Worker + PostgREST + database composition; shape-only assertions; a sibling test
  proving an adjacent clause; per-file totals copied onto criteria; criteria effectively reworded to fit tests.
- "Fixed" tests that were weakened to pass; partial remediation that stopped early; fixtures that assume an
  empty world; security-definer functions missing `search_path = ''`, gates, or RLS assumptions; race tests
  without a real overlap barrier; crypto that verifies after decrypting or compares non-constant-time;
  forward migrations whose self-checks would fail on populated production data.

## Report format

For every finding:

```
### <ID> — <severity: blocking | major | minor> — <verdict>
- Where: <file:line> (and criterion id if applicable)
- Claim examined: <what the ledger/code/report asserts>
- Evidence: <what you read that refutes or weakens it, with exact quotes/lines>
- Required fix: <the concrete change or missing test>
```

End with: totals by verdict and severity, the list of criteria/areas you examined deeply, and anything you
could not verify statically (and why).
