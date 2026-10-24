# Lane brief — `claude_s12_locale` fix pass 2

Read `docs/handoffs/2026-10-14-claude-s12/review-locale-f1.md` fully. Root rulings: the five out-of-claim
edits are RATIFIED. Now land, test-first where testable:
- D1: `apps/worker/src/async-runtime-review-recheck-claim.test.ts:71-80` (expects `cms_locale_variant` refused)
  and D2: two tests in `apps/worker/src/async-runtime-outbox-poison.test.ts` (rows built under
  `cms_content_entry`) — align with the ruled aggregate type `cms_locale_variant` via the changed contract
  that `parseOutboxClaim` (`async-runtime-parsing.ts:195-204`) uses. Run both files plus the full Worker suite.
- D3: the four `pnpm db:api-test` breakages the review lists — the Slice 11 apispec fixture inserting
  `cms_locale_variants` with `state 'approved'` (CHECK under 050000), `editedSourceFixture` that moves no
  head (nothing fans out after 050310), the envelope pin `cms_content_entry`/`entryId` (~:477-478), and the
  Slice 12 apispec counting the event by `aggregate_id = entryId`. Fix them through real producers where the
  spec allows; you cannot run apispecs (main stack, root gate) — make the edits statically correct, cite
  each, and list them for root to prove at the canonical gate.
- Minors: correct "still drain" wording, remove dead `p_backfill`, fix tgtype in the report (17).
Claim extends to those Worker test files and the named `tests/postgrest/**` apispec files only. Append
`## Fix pass 2` to your report.
