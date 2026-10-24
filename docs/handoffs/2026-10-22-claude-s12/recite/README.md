# Slice 12 ledger re-citation proposals and refutations, 2026-10-24

## Contents

- `<x>-proposals.json` (x = a, b, c, d): one entry per criterion of the lane's range (a: AC-001–079, b: AC-080–124,
  c: AC-125–214, d: AC-215–296) with proposed citations, clause splits, gaps and the proposed status.
- `<x>-refutation.json`: the separate reviewer population's verdict on every proposed citation (KEEP, DROP or FIX), on
  each split, and the gaps and tests the lane missed.
- `spec-questions.md`: spec-versus-code questions the lanes raised, with the root's research and recommendation.
- `apply.mjs` with `apply-plan.mjs`, `apply-identity.mjs`, `apply-data.mjs`, `apply-limit.mjs`, `apply-lib.mjs` and
  `apply-simulate.mjs`: the deterministic apply of KEEP/FIX citations, accepted splits and computed statuses to the
  Slice 12 ledgers (`node docs/handoffs/2026-10-22-claude-s12/recite/apply.mjs`, `--dry` to check without writing).

## Ownership

Proposal lanes `claude_s12_recite_{a,b,c,d}` wrote the proposals; reviews `claude_s12_refute_{a,b,c,d}` wrote the
refutations; the root orchestrator (`claude_root`) owns `spec-questions.md` and alone applies the result to the ledgers
`tests/contracts/phase-02-slice-12-evidence-ledger-*.ts`.

## Extension

A new pass adds new files (`<x>-proposals-2.json`, `<x>-refutation-2.json`) rather than editing these. Apply only KEEP and
FIX citations and accepted splits, then rerun `node scripts/evidence/run-slice-evidence.mjs --slice 12` and the guard.

## Conventions

Identities are copied from real run output, never typed; computed pgTAP descriptions are marked `computed`. No
credentials, tokens or personal data.

## Related links

- `docs/handoffs/2026-10-22-claude-s12/briefs/recite-proposals.md`
- `docs/handoffs/2026-10-22-claude-s12/briefs/recite-refutation.md`
- `scripts/evidence/README.md`
