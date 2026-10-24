# Lane brief — `claude_s12_web_activation` (Web, CMS-03C-09 form)

Build, test-first, `CmsGovernedActivationForm` (FE03 :882) and its same-origin proxy for CMS-03C-09 POST
/api/v1/cms/governed-reviews/{reviewId}/activation (Worker route exists; RPC/route behaviour in
`docs/handoffs/2026-10-14-claude-s12/lane-governed-worker-report.md` `## Phase 3`, `lane-governed-fix4-report.md`,
`lane-governed-retire-report.md`): radio `activate` (200), `schedule` (202; the shared Time authority module
computing the `ScheduledInstant`, exactly as `CmsEditorialScheduleForm`), and `retire` (200; optional reason
1–256 NFC; named consequence "Entries bound to this version can no longer publish"); `expectedVersion` = review
`version`; unconditional step-up with DEC-111 recovery (FE03 :1179); `canonical_source_unavailable` names the
domain; 200 renders activated + superseded version, 202 "Scheduled, not active"; retire 200's `reviewVersion`
(= expected + 1) becomes the new ETag. Mount on the definition-review detail page per FE03 :1069 as amended by
DEC-190 (Activate/Schedule for `approved`/`blocked`; Retire for `active`, owner-capability holder only,
server `permittedNextActions` authoritative). Remove the "Activation is not available from this panel yet"
copy from `CmsGovernedReviewPanel`. Spec also FE03 :1036–1050, :1171, :1216, :1403, :2668; BE03c row 171 as
cascaded; contracts `governed-activation.ts`.
Files: new `apps/web/src/components/cms-governed-review/CmsGovernedActivationForm*.tsx` (+ helpers),
`apps/web/src/server/cms-governed-review-activation*.ts`, `apps/web/src/pages/api/v1/cms/governed-reviews/[reviewId]/activation.ts`,
edits to the detail page/island and `CmsGovernedReviewPanel` copy, tests, step-up inventory entries for new
401-reading files. Run focused, full web, astro check, eslint, prettier. Report
`docs/handoffs/2026-10-14-claude-s12/lane-web-activation-report.md`.
