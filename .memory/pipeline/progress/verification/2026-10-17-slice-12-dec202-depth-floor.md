# Slice 12 DEC-202 depth-floor reconciliation — 2026-10-17

Status: owner-approved source/tracking correction only; implementation and acceptance OPEN.

The owner approved applying the DEC-202 documentation corrections and eleven explicit acceptance checks at 2026-10-17T23:38:29Z. The locked policy lives in `.memory/wiki/decisions.md`; the receiving contract is BE03b §Initial revision default template (CMS-03B-10, DEC-202), with FE03 §Initial entry setup and recovery. This record does not replace the historical 2026-10-11 depth-floor derivation.

## Added checks

P2-S12-AC-286–AC-296 cover, respectively: exact active-schema default pin and downstream pin consumption; SQL NULL without fallback; eligible superseded default; uniform missing/concealed 404; incompatible 422 pointer array; retired/blocked 409 plus neutral copy; completed replay before revalidation; real least-privilege author/editor create; actual relation→template→schema locking and post-wait fencing; immutable historical pins; and late-fault atomicity/same-key retry. These are eleven distinct obligations approved by the owner, not evidence inferred from existing storage-seam tests.

## Reconciliation

- Slice 12 plan and tracker each contain exactly 296 unique consecutive acceptance IDs, AC001–AC296, all unchecked.
- Existing 285 criterion lines remain byte-identical in each file. SHA-256 of JSON.stringify of the ordered original criterion-line arrays: plan `97ba139001aae5a0b0b736bebc4302b1a7634dfa2bcbbfe9ac10c0031a3d7100`; tracker `2f54f18619dd48f4741e90e16e488b3840deac5531b8d857a463331e4dbd3bbb`.
- Plan/tracker descriptions and references for the eleven new checks match after normalizing relative link prefixes. AC053 and existing receiving scopes remain unchanged.
- Phase table retains 17 slices and 2,670 active-checked criteria; the active denominator rises from 3,310 to 3,321 and authored total from 3,314 to 3,325. Slice 12 is 0/296; phase completion remains 9/17.
- AC209, AC211, AC265 and AC266 remain authored, unchecked external gates. No new check is passed or waived by this bookkeeping.

## Open implementation evidence

Existing public-create QA is RED at 70/76 (six real stored-pin/through-pin failures across owner, author-only and editor-only callers). It does not yet prove lifecycle/refusal mapping, replay after withdrawal, fault atomicity, real locking, Web copy or hosted acceptance. SQL/Web fixes remain subject to contract-first TDD, independent review, `pnpm db:verify` then `pnpm validate`, and final `/validate-phase` gates. This file records source-count verification only, not a canonical validation run.
