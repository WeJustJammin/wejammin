# Lane brief — `claude_s12_retire_cascade` (spec + tracker cascade of DEC-190)

The owner chose option A (DEC-190, appended to `.memory/wiki/decisions.md` at the end; raw record
`.memory/raw/events/2026-10-15.jsonl`). Apply the cascade exactly as scoped in
`.memory/wiki/specs/audits/propagation-scan-governed-lifecycle-2026-10-13.md` §R (and its "Implicit
assumptions" table), using the `propagate-decision-apply` skill (`.claude/skills/propagate-decision-apply/SKILL.md`):
- Tracker/plan acceptance wording: AC083, AC207, AC268 in `.memory/pipeline/progress/slices/phase-02-slice-12.md`
  AND `.memory/wiki/specs/phases/phase-2.md` AND the depth matrix
  `.memory/pipeline/progress/verification/2026-10-11-slice-12-depth-floor.md` — identical text in all three.
  Change only the wording the scan names; never tick, add, remove or renumber a criterion.
- BE03c 171, 1326, 1470, 1492, 1502; FE03 1069, 1798; IA03 267 (and the IA deep-dive line the scan lists if any).
- Also apply these root-ratified spec text corrections (implementation rulings already made; record each as a
  cascade item with its source): BE03c 388 and 1395 and tracker/plan/matrix AC237 `cms.locale_variant` →
  `cms_locale_variant` (`review-locale.md` F1); BE03c 163 wording so a hidden/absent/ineligible TARGET is the
  uniform 422 while a hidden SOURCE is 404 (`lane-related-report.md` ruling); FE03 1050 "over-budget refusal
  against the actual producer" corrected (unreachable; `review-placement.md` B3).
Rules: the Slice 12 acceptance-section SHA-256 WILL change because AC wording changes — record before/after
hashes and the exact diff in your report. Do NOT run `.memory/pipeline/compile.mjs`. Run `pnpm progress:check`
(pinned toolchain, under `flock -s /tmp/wejammin-quiet.lock`) and any spec lint the repo has for these files.
Files: the docs named above only. Report `docs/handoffs/2026-10-14-claude-s12/lane-retire-cascade-report.md`.
