# Lane brief — `claude_s12_hardening_5` (review-hardening-4 minors + over-limit file splits)

Review `review-hardening-4.md` (VERDICT CLEAR, SHA `e4e22597…`). Precedent and files: `lane-hardening-4-report.md`.
Test-first where behaviour is involved. Report `docs/handoffs/2026-10-14-claude-s12/lane-hardening-5-report.md`.

1. F1: test the `=== 403` status gate of `forbiddenDetails` in both apps (a `capability_missing` body on a non-403 status
   must not be relayed as a 403 reason); show the test fails when the gate is removed (scratch copy only).
2. F3: the template context/detail reads use their own contract list (`cmsTemplateLatestRead` and the context read's
   operation id in `packages/contracts/src/cms-composition/refusals.ts:199-202`), not CMS-03C-01's, in Worker
   `template-respond.ts:62` and Web `cms-composition-platform-mutation.ts:161`; test that a token only in 03C-01's
   list is not relayed on the reads. If the template context read has no list entry, report that instead of inventing one.
3. F4: test at the `taxonomy-safe-details.ts` layer that CMS-03C-13/14/15 untyped 403s are `{}`; disclose the side effect
   in your report.
4. F2 + F5: correct `apps/worker/src/cms-composition/README.md:28-29,122` (only routes that actually use
   `capability-details.ts`); correct hardening-4 report wording in a `## Corrections (hardening-5)` section of YOUR report
   (CMS-03C-06/07 also publish `separation_of_duties`; the composed test injects `resolveSession` too).
5. Split files over the limits (`.claude/rules/extensibility.md`): `apps/worker/src/cms-composition/locale-routes.test.ts`
   (889 lines, max 400) into cohesive files, and `apps/web/src/server/cms-composition-platform-mutation.ts` (321, max 300)
   by extracting one concern. Pure moves: test counts before and after must match exactly; no assertion changes.
6. Read-only investigation (no code): DEC-186 lists `block_registry_digest_mismatch` for CMS-03C-01 but no template
   producer raises it. Find whether BE03c/DEC-186 requires CMS-03C-01 to refuse a digest mismatch (cite lines) and
   report the gap with a recommendation; do not change SQL.
Files: the files named above and their sibling tests; the two split targets and new files they produce. NOT shared
wiring files or `pattern-*` Worker files (Worker pattern-updates lane), NOT `cms-taxonomy-merge-converge-*` (taxonomy
f2 lane), NOT `apps/web/src/server/README.md` or `cms-taxonomy*` Web files (Web taxonomies lane), NOT
`components/cms-governed-review/**` (Web activation f2 lane). Gates: focused + full `apps/worker` and `apps/web`
Vitest, worker `tsc --noEmit`, `astro check`, eslint `--max-warnings=0` + prettier on touched files, under
`flock -s /tmp/wejammin-quiet.lock`.
7. Also in `apps/worker/src/cms-composition/README.md` (~:29-31): the sentence saying the selector read and linked-update
   authority "still await locked contract decisions" is false since the Worker pattern-updates lane (CMS-03C-13/14/15
   transport GREEN, `lane-worker-pattern-updates-report.md`); reword it to the current state.
