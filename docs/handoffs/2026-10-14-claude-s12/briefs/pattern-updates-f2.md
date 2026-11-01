# Lane brief — `claude_s12_pattern_updates_sql` fix pass 2 (review-pattern-updates-f1 minors)

Review `review-pattern-updates-f1.md` (VERDICT PARTIAL, SHA `b9ac2990…`): no blocker or major. CMS-03C-13 is cleared
for promotion after R7; CMS-03C-14/15 stay held for owner rulings. Fix in the WIP files (nothing is promoted yet),
test-first, one staged run per deliberate change (lane name `pattern-updates`). Report: append `## Fix pass 2` to
`lane-pattern-updates-report.md`.

1. R7 (selector, do FIRST so 13 can promote): `140300_cms_list_pattern_selector.sql:63-75` runs the 400 parse check
   after 404/403. Move the request parse/shape check before authority (BE03c :175 "BE00 order"), keep concealment
   unchanged; add a test where a malformed request from a caller without access is 400, not 403/404.
2. R4: `140200_cms_pattern_update_plan.sql:125` / `140400:82`: offer an update (and `bulkEligible`) only to
   `active`/`pending_diff` linked heads, matching accept's eligibility (`140600:149`). RED first.
3. R1: `140600:148-150` detach admits every linked state except `retired`: whitelist the states the spec names
   (BE03c :1512 "any linked" = the linked states a producer writes: `draft`, `active`, `pending_diff`), and test that a
   labelled `superseded` fixture is refused.
4. R2: `140600:176`: drop `pattern_cycle` / `pattern_depth_exceeded` from the `/targetPatternVersion` re-raise (they
   are not in the CMS-03C-15 contract list and are unreachable: nested pins are immutable and checked at CMS-03C-12,
   BE03c :1380); add a one-line comment saying why.
5. R3: `080-lock-order.sqlinc`: anchor on the full lock clause including `for share` / `for update`, and assert each
   anchor occurs exactly once.
6. R5: record in the report (Open items / BOUNDARY) that the `draft`-detach behaviour is proven only on a labelled
   fixture no producer writes, next to the `pending_diff` fixture note; both become real when the linked-update scan
   lane exists.
7. R8: mark stale first-pass sections of your report as superseded (Files hashes, D-ELIGIBLE, first Test
   corrections, B3 wording); add current hashes incl. `140605`.
BE03c :1287 already names `revision_not_editable`, `pattern_incompatible`, `nested_pattern_not_active` for CMS-03C-15
(root amendment); cite it.

Files: `supabase/migrations-wip/pattern-updates/*` (no new timestamps needed unless a split is required; use
140000-140699), the lane's own tests, your report. Not contracts, Worker, Web. A Worker lane is building the transport
against your WIP: if a change alters an answer shape or token, write it under `## Changes the Worker lane must know`.
