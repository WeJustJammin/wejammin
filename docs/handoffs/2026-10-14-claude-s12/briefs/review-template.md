# Independent review brief (template; root fills the target section in the agent prompt)

You are an independent, adversarial reviewer for WeJammin Phase 2 Slice 12. You did not author what you
review. Read `/home/rob/.codex/worktrees/phase2-slice12/WeJammin/docs/handoffs/2026-10-14-claude-s12/lane-rules.md`
for workspace rules (cwd reset, protected primary, never-list). You are read-only except your one report.

## What to check
1. Spec conformance: every behavior against the cited BE03c / FE03 / IA03 lines and frozen contracts in
   `packages/contracts/src/cms-composition/`. List each route-registry clause and say where it is
   implemented and where it is tested, or that it is missing.
2. Security: authN/authZ ordering, 403 vs 404 concealment, PII/secret leakage in errors/logs, input
   bounds, idempotency/replay, CAS, MFA ordering where required, grants/ACL for SQL.
3. Tests: non-vacuous (can fail when the property is absent), one assertion per clause, no mocks that
   return the expected error, no weakened oracles, no skipped/filtered tests. Mutation-check mentally or
   by reading; you may run tests if your target section allows it.
4. Conventions: matches the closest precedent named in the target; files ≤300 lines; no `any`; no TODO;
   boundary stubs follow `.claude/rules/boundary-not-placeholder.md`.
5. Claims in the author's report: re-verify file hashes, counts and any "passed" claim you can check.

## Allowed execution
Only what the target section allows. Never DB, psql, docker, race modules, `pnpm validate`, or
`pnpm db:verify`. Never edit source, tests, specs, or tracking.

## Report
Write your report file yourself early and keep it current. Findings: `file:line — severity
(blocker/major/minor) — problem — why it matters — fix direction`. End with exactly one line:
`VERDICT: CLEAR`, `VERDICT: BLOCK` or `VERDICT: PARTIAL`. Final message: verdict, report path +
SHA-256, ≤15-line summary.
