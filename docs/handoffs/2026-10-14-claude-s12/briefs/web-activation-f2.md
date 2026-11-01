# Lane brief — `claude_s12_web_activation_f2` (Web activation fix pass 2)

Review `review-web-activation-f1.md` (VERDICT PARTIAL, SHA `0d4d0fe5…`). Root ratifies the `governed-review-labels.ts`
scope change. Fix, each RED-first (run the failing test, see it fail for the right reason, then fix):
1. Finding 1 (fix before close): `CmsGovernedReviewDetailIsland.tsx:83-84` `awaitingRetire` must also require
   `review.state === 'approved'` (as `awaitingOwner` :77-81 and the producer
   `supabase/migrations/20261013300500_cms_governed_review_support.sql:253-257`). Test: a rejected and an invalidated
   review whose subject is `active` shows no "Only the owner…" copy.
2. Finding 2: on commit, clear the step only after `onDone` has focused the summary heading; on `unknown`, focus the
   frame's "Check the current state" control. Assert `document.activeElement` at each point (FE03 :1118).
3. Nit 5: the frame's pending label follows the SUBMITTED action, not the live radio.
4. Nit 6: `components/cms-governed-review/README.md:54` describes Escape/Cancel as inert while pending.
5. Nit 7: `governed-review-labels.test.ts:68-71` completeness loop covers `activate` and `retire` too.
6. Finding 3 / nit FE03 citation: correct your previous report's survivor (c) account and the FE03 ":1216" citation
   (the clause is :1223) in a new `## Fix pass 2` section of `lane-web-activation-f1-report.md`; save mutation output
   files this time.

Files: the activation form/island/hook/confirm/labels files and tests in `apps/web/src/components/cms-governed-review/`,
its README, your report. A Web taxonomies lane runs concurrently in `apps/web` (it may touch `CmsGovernedReviewPanel`
mounts and `apps/web/src/server/README.md`): re-read each file right before editing; never edit its files.
Gates: focused Vitest; full `apps/web` Vitest; `astro check`; eslint `--max-warnings=0` + prettier on touched files;
mutation check on scratch copies under `<scratchpad>/claude_s12_web_activation_f2/`. All under
`flock -s /tmp/wejammin-quiet.lock`.
