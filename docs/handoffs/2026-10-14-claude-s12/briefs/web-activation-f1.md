# Lane brief — `claude_s12_web_activation_f1` (Web activation form fix pass)

Review `review-web-activation.md` (VERDICT CLEAR, SHA `d048659d…`) found three minors to fix before close.
Precedent and context: `lane-web-activation-report.md`. Test-first: each item gets a RED test you run and see
fail for the right reason, then the fix, then green.

1. F1 — `components/cms-governed-review/governed-activation-model.ts:152-208`: a non-empty but unparseable
   schedule local value (e.g. a five- or six-digit year) resolves `{kind:'empty'}`, so the confirmation is titled
   "Confirm scheduled activation" but says "Activate {subject} now." and its button does nothing. Add a schedule
   field error for any non-`resolved` resolution (fixed copy; match the existing schedule-form error copy style),
   and make `confirmationSentence` exhaustive by action (no fallback to the activate sentence; a TypeScript
   exhaustiveness check). FE03 :882, :902.
2. F2 — `use-governed-activation-form.ts:196`, `CmsGovernedActivationConfirm.tsx`: keep the confirmation step
   mounted while `phase === 'pending'` (clear on settle), commit control `aria-disabled` with the pending label,
   width/label preserved; assert `document.activeElement` stays on the commit control during pending. FE03 :1118,
   :1216.
3. F3 — `CmsGovernedReviewDetailIsland.tsx:77-81,113-115`: when the subject is `active` and `retire` is not in
   `permittedNextActions`, show the disabled reason with fixed owner copy naming the missing action. FE03 :1048.
4. Nit 7: rename the describe title at `server/cms-governed-review-platform-command-specifics.test.ts:70`.
5. Retire Danger treatment (review nit 8): only if `DESIGN.md` defines a destructive/Danger button style AND an
   existing token/class implements it in `apps/web` — apply it to the Retire commit control. If none exists, do
   not invent global styles; record it under Open items.
6. `apps/web/src/pages/api/v1/cms/README.md`: name the CMS-03C-09 activation proxy (one line).

## Files
Only the files named above plus their sibling tests. NOT `apps/web/src/server/README.md` (the Web taxonomies lane
holds it), NOT `step-up-required.inventory.test.ts`, NOT any `cms-taxonomy*` file, NOT `CmsGovernedReviewPanel`
mount edits the taxonomies lane may be making (re-read a file right before each edit; if another lane changed
the lines you need, stop and ask root). No Worker, SQL, contracts.

## Gates
Focused Vitest; then full `apps/web` Vitest; `astro check`; eslint `--max-warnings=0` + prettier on touched files;
mutation check of each fix on a scratch copy only (under `<scratchpad>/claude_s12_web_activation_f1/`, never
another lane's script). All under `flock -s /tmp/wejammin-quiet.lock`. Report
`docs/handoffs/2026-10-14-claude-s12/lane-web-activation-f1-report.md`.
