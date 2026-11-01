# Lane brief — `claude_s12_dec191` (DEC-191 governed read gap: SQL first, then contracts/Worker/Web)

DEC-191 (orchestrator resolution, `.memory/wiki/decisions.md` end; BE03c changelog row "FE03-BE03c read gap")
adds two nullable read members, now in the BE03c schema blocks
(`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`, search `DEC-191`):
- `GovernedActivationResource.supersededVersion` (CMS-03C-09 200): the definition `version` of the lineage's
  previously `active` version that this committed immediate `activate` superseded; `null` for `schedule`, `retire`
  and a lineage's first activation. Idempotent replay returns the stored answer unchanged.
- `GovernedReviewDetailResource.activationSchedule` (CMS-03C-10): the review's most recent
  `cms_governed_activation_schedules` row as `{state, reasonCode}` or `null`; `reasonCode` non-null exactly when
  `state` is `blocked` or `cancelled` (the table CHECK, BE03c :1437; vocabulary :1328).
No new state, vocabulary, authority, lock or write path. Say only what DEC-191 says; do not add members.

## Phase 1 (now): SQL, test-first
Forward migrations only in `supabase/migrations-wip/dec191/`, timestamps `20261014170000`-`20261014170499`, as
anchored patches (exactly-once anchor, compare every non-body `pg_proc` attribute, idempotent) of the promoted
producers: the CMS-03C-09 answer builder (find it from `20261014070*`, `150000`, `160*`) and the CMS-03C-10 detail
read (`20261014010300_cms_get_governed_review.sql` and any later patch of it). pgTAP RED first in a new
`supabase/tests/phase_02_slice_12_dec191*.sql` (+ dir with README), reusing existing governed fixtures read-only by
`\ir`: activate with and without a previous active version, schedule, retire, replay; detail with no schedule,
pending, completed, blocked (each reason the producers can reach), cancelled. Then run the existing governed suites
(activation, schedule, retire, review read) with your WIP staged to prove no regression; their oracles that pin the
exact answer key set may need the new member: list each change under `## Test corrections` with the DEC-191 citation.

## Phase 2 (root releases it after the Web activation fix lane finishes): contracts + Worker + Web
Add both members to `packages/contracts/src/cms-composition/governed-activation.ts` and `governed-review-read.ts`
(+ tests); Worker strict parsing/binding (`apps/worker/src/cms-composition/governed-review-*.ts`); Web drift
guards, activation result line ("Version N is now superseded."), and the review detail's blocked/cancelled reason
copy (FE03 :882, :1118). Do not start phase 2 until root adds a `## Phase 2 released` line here.

## Report
`docs/handoffs/2026-10-14-claude-s12/lane-dec191-report.md`.

## Phase 2 released
`2026-10-15T09:07:54Z`: the Web activation fix lane is GREEN; phase 2 may start once phase 1 is reviewed (root launches it).

## Fix pass 1 (SQL tests only; after phase 2)
From `review-dec191.md` (PARTIAL): F2 add pgTAP cases (a) v1 active, v2 left `draft`, v3 activated => `supersededVersion` = 1
(the previously ACTIVE version, not the previous number); (b) retire the active version, then activate another
approved version of the same lineage => `supersededVersion` null. Run them RED-capable: show each fails on a scratch
mutant of the WIP migration that returns "previous version number" / non-null after retire (staged as a separate lane
name, removed after). F3/F4: correct the report's promoted-migration counts for runs 6-8 (454, not 456) and refresh
moved spec citations in the helper migration COMMENTS only if that changes no executable byte (otherwise leave them and
say so). No change to the WIP migration bodies. Append `## Fix pass 1` to `lane-dec191-report.md`.

## Phase 2 fix pass (review-dec191-p2.md A1, A2)
A1: the `retries_exhausted` schedule sentence says "It stopped after three failed attempts." — false (the SQL blocks at the
fourth consecutive failure, `20261014070100_cms_governed_schedule_state.sql:38-41`). Use number-free wording in the
Slice 11 style ("failed after all retries"); update the pinned row `CmsGovernedReviewDetail.test.tsx:203` (RED first).
A2: build the `activationSchedule.reasonCode` enum in `packages/contracts/src/cms-composition/governed-review-read.ts`
from `CMS_GOVERNED_SCHEDULE_BLOCK_REASONS` (`governed-activation-job.ts`) instead of repeating the five values; contract
tests unchanged and green; `node infra/generate-openapi.mjs --check` still exit 0 (no OpenAPI change expected).
Append `## Phase 2 fix pass` to `lane-dec191-report.md`.
