# DEC-193 selected-roots producer TEST freeze

Author: native `gpt-6.1-sol` / `ultra`, `native_dec193_contract_green_20261016`.
Status: **author UNRUN**. Initial eight NEW TEST/document paths were claimed in
S12 Dispatch2026-10-16 15:30UTC. The later audit-oracle correction owns only000,
040, README and this report. All production, old carry/CB tests and shared
fixtures remain untouched by this TEST release. SQL434–437 was authorized later
under a separate claim; this correction does not change or accept that source.

Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.

## Authority and observed source gap

Locked source `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`:

- BE03c380 and520–551: optional1–512 unique expanded root chains; complete ASCII
  segments, max72/max4680; omitted-compatible; override keys stay512.
- BE03c1483/1485: select actual expanded block roots, forest-order new-path allocation,
  per-selected-root override scope, joined row cap248, position-ordered response.
- BE03c1485/1563: newest non-retired head occupies a path; newest retired head is free
  at the next version and unchanged position; all prior versions immutable.
- BE03c1750/1836–1837: explicit selected-root/retired reuse receiving obligations;
  expanded public addresses do not widen stored slot/row path limits.

At the initial TEST freeze, direct source reads confirmed promoted request guard
`supabase/migrations/20261014110200_cms_pattern_placement_request.sql:41–43`
does not permit roots. Current404 uses whole-forest plan at167, rejects any
history at171–180, inserts version1 at204 and fresh positions at213. The old
plan's248-byte check110250:48–54 runs over every root, before any selection.
These are implementation gaps, not grounds to weaken valid CB-REPLACE input.

Root-supplied existing full-carry diagnostic:322 tests/58 failures/no abort,
`.lane-logs/alt-staged-pattern-updates+dec193+locale-gate-111056-936218.tap`,
SHA256 `a92772971d7856cb1239a67dbc50b9f866fb8f7b8be5c1944f167795425716b7`.
This is prior root evidence, not an execution or result of the new suite.

## New test design

The driver includes existing signed registry, active compiled type, real pattern
definition/governed activation and public placement/update harnesses. It does
not load a future selected-plan/allocation helper or expected-diff builder.
Store-free guard probes check the exact existing signature inside each case;
absence/wrong signature produces explicit TAP FAIL before dynamic invocation.
Those probes cannot substitute for the separate real public placements.

Expected public tuples, per-root override maps and registry identity tuples are
independent literals. The512-root/64-override expectations use independent
arithmetic over the documented32-reference×16-root signed fixture. A distinct
registered wide block on unselected d discriminates whole-pin from selected-
subtree digest. The independent inherited resource oracle covers only legacy-
NULL snapshots and one override per row, exactly the placements used here.

The mixed fixture publicly places c at1 and a at13. Three public unchanged-
target c accepts yield v2/v3/v4, and public removed-root `theirs` accepts yield
c:v5 retired and a:v2 retired. Guarded unrelated rows establish0/12/20 only.
Reverse request `[d,c,b,a]` has literal result, in response position order:
`c:v6@1,a:v3@13,b:v1@21,d:v1@22`. No history/state/version of those writer
results is fabricated or edited. Separate labelled legacy/scan receiving
fixtures cover other non-retired states, retired-beneath-active and INT_MAX reuse.

Real governed nested patterns provide selected248/249/585 chains and a short
unselected-long-root sibling. Pure exact4680/72 and other wire limits remain
distinct from actual stored-row path eligibility. A4681-character address with
72 segments necessarily also violates a segment bound; no false independence
claim is made.

Every public refusal captures exact SQLSTATE/message/DETAIL where specified and
full before/after row images. Real anon/authenticated roles test ACL, not JWT-only
role simulation. The later-selected-insert hook raises only after a prior real
selected row is visible within the same statement. Full rollback, live review
preservation, exact-key retry, single invalidation/event, CAS, audit, ETag and
immutable history are checked. Hook creation/removal is transactional, never a
disabled write guard or fake writer output.

## Validation boundary

TDD and surgical-development skills kept this release test-first and limited
to the exact claim. Source-only authoring used apply_patch. Complete readback of
driver and all five SQL includes, README and this report was performed; byte,
line-count and SHA256 inventory is metadata inspection, not SQL execution.
No parser, formatter, tests, runtime, DB, process, Git, network or promotion ran.
No post-correction TAP total, passing claim, concurrent race proof or hosted
acceptance is asserted. Root owns independent source review and actual
validation. No shared progress file was edited.

## Root-released audit-oracle correction

Root's staged501 run completed1182 assertions/1181PASS/1FAIL: only
`sr-fault-retry: one audit event` had2/want1. TAP:
`.lane-logs/alt-staged-pattern-updates+dec193+locale-gate-122119-1369069.tap`,
SHA256 `1ed36e712f0f644ed3adbcc496a1fd485fd71d6dd1b92683be53359691540c4b`.
Root's corrected real before/after audit diagnostic observed exactly
`cms.composition.pattern.insert` targeting the first inserted root and
`cms.entry.review.invalidate` targeting the review, not a duplicate insertion:
`dec193-selected-audit-diagnostic-corrected.log`, SQLexit0, same1182/1FAIL,
SHA256 `b9f3499bb8ac6ab18bc2c8c521b3f34ecac51f7256c807b2a9e3cdd9ce80e700`.
The earlier diagnostic aborted on nonexistent `o.body` and supplies no evidence.
These are pre-correction root receipts, not author execution or acceptance.

BE03c1483 requires transactional live-review invalidation; BE03b1863 says the
invalidation writes its own audit and event, and2116 names invalidation as a
`cms.entry.review-changed.v1` producer. Existing404:228–239 invalidates live
reviews then records the separate placement audit;437 leaves that tail intact.
Promoted17580:259–263 skips non-live reviews and300–305 emits the invalidation;
`cfg_emit_effects` in20260901071500:23–36 writes its audit and outbox atomically.
The old helper's unconditional total1 was therefore wrong for this fixture.

000 now retains an exact total2 iff `p_invalidation`, otherwise1, and the old
first-item insertion-audit assertion. A new full-row before/after delta oracle
requires the exact action/target-type/target-id/reason set and nested request
context's `authUserId`, `actingPartyId` and `correlationId` as real actor/party/
correlation. The invalidation target comes from the before-image live reviews,
not current state or the already-invalidated latest review. 040 separately
binds that live before-image set to exactly the original older review, open at
version1. All old refusal, rollback, replay, CAS, outbox and review assertions
remain. No production defect or production change is claimed.

Source-only literal inverse of000's added audit block/declarations/request image
and corrected count reproduces its previous full SHA256
`8936f4ef52e4e56211cce143407809a470683b32a4bd3c8089f0c774b5e69b0c`.
Removing only040's new before-image premise reproduces previous full SHA256
`01800cda55ace909068daec6cff59c9cfaa8dd0a980c835ccd9a02ae7d3fe02c`.
These are byte-preservation checks, not SQL parse or execution proof.

## Frozen source manifest

Root-released TEST-only correction: the success helper retains its actual public
state assertion and, on refusal, emits the captured diagnostic then returns.
This avoids null-body success-oracle cascades without hiding the first state
FAIL or altering any success, independent refusal or full-row oracle. Still UNRUN.

Paths relative to the worktree above. Lines exclude the final empty split entry;
all SQL includes are below300 lines. Report's own SHA is supplied separately to
root, avoiding a self-referential hash.

| Path | Lines | Bytes | SHA256 |
|---|---:|---:|---|
| `supabase/tests/phase_02_slice_12_dec193_selected_roots.sql` |30|1544|`fc10db8e95cf2486c0692fc2afed2a92b8a4721566662861befaa62af9cdb853`|
| `supabase/tests/phase_02_slice_12_dec193_selected_roots/000-fixture.sqlinc` |209|14277|`9605a054fde5f97d863f34aaf13a938abb0a4c33d36e07460dd85c0b4fa95186`|
| `supabase/tests/phase_02_slice_12_dec193_selected_roots/010-request.sqlinc` |76|5134|`0cd51a1f0aefe7750b6af6bc0db05274e14a645137110de5f53696bf7296f9f5`|
| `supabase/tests/phase_02_slice_12_dec193_selected_roots/020-selection.sqlinc` |89|6313|`602e220892d3adc0ffc4b0b587e390fc4f86fc748026818cb6706cc166325c5a`|
| `supabase/tests/phase_02_slice_12_dec193_selected_roots/030-retired-reuse.sqlinc` |122|8559|`dd667a5d9d9cecfd045ac4545c95dd8ebd8eaa2bc4a76749452d41df877b454b`|
| `supabase/tests/phase_02_slice_12_dec193_selected_roots/040-atomic-security.sqlinc` |135|9575|`463607143f6cc785afbc8ab47784ce9f42732283a12ecb750b97177ad4ab8a9b`|
| `supabase/tests/phase_02_slice_12_dec193_selected_roots/README.md` |106|6424|`67fb4bc747d9f86ed16be26ecc42b19998c0c6b54fd06dfae472d984e7e6b994`|
