# Lane brief — `claude_s12_pattern_updates_sql` fix pass (staged-runner lane `pattern-updates`)

Read `docs/handoffs/2026-10-14-claude-s12/review-pattern-updates.md` fully. Edit WIP in place (unpromoted).
Fix test-first ONLY the items below; the product decisions (D-VALUE override-replaces-props, D-RETIRE removed
roots and the F1 stuck-row consequence, B2 added roots, D-DETACH 128-key limit) are with the OWNER — do not
change their behaviour; describe current behaviour precisely in `## Owner decisions pending`.
1. F2: CMS-03C-15 lock order per BE03c 1338/1342 and the placement precedent (position 3 before 4).
2. F3: detach eligibility per BE03c 1476 / AC-120 — any linked instance (cite and test `draft` and `retired`;
   if detaching a `retired` row would resurrect it, report the spec conflict precisely instead of guessing).
3. F5: assert the adopted block identity on accept; make the digest assertion able to fail (mutation check).
4. F8: malformed UUIDs → 400 per the validation matrix; correct `/patternId` pointers on 15 refusals; diff
   must not offer live updates on non-head rows; label the hand-inserted `retired` fixture honestly; add the
   byte-bound and retirement `pageVersion` tests.
5. B3 (root-authorized contract change): add `revision_not_editable` to the CMS-03C-15 reason list in
   `packages/contracts/src/cms-composition/refusals.ts` (FE03 885, AC-123) with its contract test; fix the wrong
   BE03c 1268 citation.
6. Parity test for the `COMPOSITION-PENDING-DDL` markers (model: `tests/contracts/phase-02-slice-12-pattern-placement-witness-parity.test.ts`).
Lane `pattern-updates`. Append `## Fix pass` to your report.
