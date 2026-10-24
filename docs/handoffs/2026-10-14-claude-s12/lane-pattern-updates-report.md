# Lane pattern-updates report (claude_s12_pattern_updates_sql)

## Status
GREEN for the lane's own suites after the fix pass: final staged run F3 (lane `pattern-updates`) 2144 tests (selector 274, diff 518, updates 1325, populated-pending 27), 0 not ok, `pg_prove` exit 0 (the first-pass run was 1914).  Nothing is promoted,
staged or committed.  Open items (B1-B5, concurrency, Worker mapping) and requests are below for root.

## Scope
CMS-03C-13 `platform_api.cms_list_pattern_selector`, CMS-03C-14 `platform_api.cms_get_instance_update_diff`, CMS-03C-15
`platform_api.cms_apply_pattern_update` (names from tracker AC-261), over promoted placement (`20261014110*`), pattern definition
(`20261014020*`), governed activation and the lineage manifest pin (`130000`).  Plus the `pending_pattern_version` column of AC-258 (the
pending clause), which CMS-03C-14/15 read and the later linked-update scan writes.  Worker transport files untouched.

## Files (lines, first 16 hex of SHA-256; full hashes by `sha256sum`)
**SUPERSEDED (first-pass listing): the hashes of 140200, 140300, 140400 and 140600 below are the first-pass bytes and 140605 is missing; the current hashes are in `## Fix pass 2` (final inventory) at the end of this report.**
Migrations, `supabase/migrations-wip/pattern-updates/` (range 20261014140000 - 140610, all under 300 lines):
- 20261014140000_cms_composition_instance_pending_version.sql  42  ac79470b6509afff
- 20261014140100_cms_pattern_update_nodes.sql  81  dc5ac6c39ece5ba7
- 20261014140200_cms_pattern_update_plan.sql  197  23199194e02c0f09
- 20261014140300_cms_list_pattern_selector.sql  207  c1254456c7a7df29
- 20261014140310_cms_list_pattern_selector_public.sql  65  aec26d0673a2119d
- 20261014140400_cms_get_instance_update_diff.sql  125  aba571b4c76156ac
- 20261014140410_cms_get_instance_update_diff_public.sql  43  9dde7629cf5a62e5
- 20261014140500_cms_pattern_update_check.sql  146  885de34d8cbc19c5
- 20261014140550_cms_pattern_update_next_row.sql  81  e767b52fe96d7407
- 20261014140600_cms_apply_pattern_update.sql  297  001250ffe7a4e410
- 20261014140610_cms_apply_pattern_update_public.sql  61  5ed9e15ec367998b
Tests (`supabase/tests/`, all under 400 lines, READMEs in each directory):
- phase_02_slice_12_pattern_selector.sql 32 83643130; phase_02_slice_12_pattern_selector/{000-selector 100 b51e3c6d, 010-paging 91 319aff1a, 020-authority 47 c435b5e8}.sqlinc
- phase_02_slice_12_pattern_update_diff.sql 34 6f893cf2; phase_02_slice_12_pattern_update_diff/{000-schema 39 4ea68881, 010-diff 125 089be351, 020-states 33 e5bf6b24, 030-bounds 33 d0db67a4, 040-authority 42 ff2bf8ad}.sqlinc
- phase_02_slice_12_pattern_updates.sql 39 030da4a7; phase_02_slice_12_pattern_updates/{000-oracles 116 6b72c847, 005-schema 15 faa88ed1, 010-accept 84 5774b4e7, 020-detach 43 4069ba55, 030-envelope 74 f6557929, 040-refusals 115 90621505, 050-bulk 67 49f7ddb9, 060-effects 51 044034b7}.sqlinc, populated-pending.sql 124 a752cd1d
- phase_02_slice_12_pattern_updates_common/{000-helpers 197 715eeb98, 010-world 138 704bb4e4}.sqlinc (shared world, reuses the placement and pattern-definition fixtures by `\ir`, read-only)
No other file was touched (the placement, pattern-definition and governed suites are included, never edited).

## Runs (stage lane `pattern-updates`)
| # | start | stamp | plan | result | TAP sha256 |
|---|-------|-------|------|--------|------------|
| 1 | 22:29 | 221536-2771061 | selector + diff + updates, WIP empty | HARNESS: world fixture props violate the block props schema (only `title` string admitted), 33-root pattern over the 32-root bound | (superseded) |
| 2 | 22:31 | 223028-2849084 | same | HARNESS: pu-big 33 roots; `is(bigint,integer)`; late `st1` placement on a superseded pin | (superseded) |
| 3 | 22:32 | 223224-2857993 | same | HARNESS: raw select of a column absent in RED | (superseded) |
| 4 | 22:34 | 223405-2866753 | same | HARNESS: fixture `created_at` / `updated_at` from two clock_timestamp() calls break the snapshot-time CHECK | (superseded) |
| 5 | 22:35 | 223539-2874001 | same, WIP empty = RED | selector 267 run / 59 not ok; diff 288 / 61; updates 442 / 197; no abort; every not ok is 42883 (function absent), a NULL body of an absent function, `ERR:42703` (column absent) or a probe that proves the absent column rule | 8e5a01d25792043a06e250ce6f3eda765699b69c84db85332e8b907a6a6af8cb |

Classification: runs 1-4 are HARNESS defects of my own fixtures (fixed forward, listed above), none a feature RED. Run 5 is the genuine
RED: all three suites complete and every failure is the missing feature.
| 6 | 22:37 | 223720-2881609 | 11 WIP migrations + the three suites + populated-pending | migrations applied; selector 18 not ok, diff 2, updates abort at 010-accept:8 | (superseded) |
| 7 | 22:38 | 223847-2888467 | same | updates 8 not ok of 1140; selector, diff, witness all ok | (superseded) |
| 8 | 22:40 | 224028-2896127 | same | updates 2 not ok (724-725) | (superseded) |
| 9 | 22:42 | 224205-2903550 | same, final bytes | PASS 1914 (selector 267, diff 480, updates 1140, populated-pending 27), 0 not ok | f5e29afaa1654a78450aa0436d3c0fc0f5f3ebe151c411094c7c3da0fcbd1912 |

Classification of runs 6-8 (all HARNESS or my oracle, no product defect found by a test):
- Run 6: the oracle `s12pu_oc` appended `#` when `pg_exception_detail` is the empty string (18 + 2 not ok, every one with the right token and no
  detail); the check helper named a variable `item` that collided with an alias (abort).  Fixed in the oracle.
- Run 7: `ifmatch-differs` used ifMatch "2", which equalled the entry's real version, so the request SUCCEEDED and accepted `ap10/hero`;
  the later refusals on `ap10` (`r-instance-stale`, `c-no-collision-at-all`) and the second-author success then ran against a consumed entry.
  The test was wrong (ifMatch "99" now); the producer was right.
- Run 8: `c-partial` used `ap5`, which an earlier accept had consumed; it now uses the untouched two-collision entry `dif4`.
No migration was changed after run 6: the eleven WIP files of the final run are the first-written bytes (apart from the formatting fixes made
before run 6).  Nothing was weakened to pass; no assertion was removed.

## Test corrections
**SUPERSEDED: this first-pass statement is out of date; see `## Test corrections (fix pass)` and `## Fix pass 2`.**  None.  No frozen or external oracle was edited; every oracle changed during the lane is my own (listed under the runs).

## Behavior implemented (spec lines)
CMS-03C-13 (BE03c :175, :398, :1266, :1363, :1474; AC-106..111): author/editor in the owner party (the designer capability is not enough, no
entry assignment needed), content type in the owner party else 404, ACTIVE compatible versions only, order (patternKey bytewise ASC, patternVersion
DESC), signed cursor domain `cms-03c-13` bound to actor, party, type and limit (tampered/expired/foreign: 409 CONFLICT, malformed: 400
INVALID_REQUEST, no Vault key: DEPENDENCY_UNAVAILABLE), limit 1-50 default 25, pageVersion = high-water update instant (UTC microseconds) of ALL the
owner's compatible versions in any state ("1" when none) so a supersession or retirement moves it.
CMS-03C-14 (BE03c :176, :399, :1267, :1367, :1475; AC-112..117): assigned author/editor on the instance's entry (hidden/absent/non-pattern: one uniform
404; visible without edit: 403 capability_missing), three-way diff base/theirs/yours per changed node path, collision = override differs from base AND
the new version changed the path, bytewise path order, 200 empty diff with target = pinned when no newer active compatible version (also for a
detached, retired or superseded row), 422 diff_too_large (>128 changed paths or >262144 octets of RFC 8785 text) at /instanceId, reads lock and
write nothing.  The read is of the NAMED row (any version row of a path, as stored).
CMS-03C-15 (BE03c :177, :400, :1268, :1336-1357, :1367, :1476; AC-118..123, AC-219, AC-258; DEC-181, DEC-185): store-free envelope check first
(INVALID_REQUEST / VALIDATION_FAILED with pointer), every instance resolved and concealed (uniform 404), one entry, entry FOR UPDATE, authority
re-proved (403), idempotency reservation and replay (stored body and ETag), entry CAS, current draft revision in effective state draft, content-type
version FOR SHARE, each instance the HEAD of its path with its own version (409 VERSION_MISMATCH + instanceId), target pattern rows and nested closure
FOR SHARE ascending id and re-judged under the lock (422 pattern_version_not_active at /targetPatternVersion), bulk with a collision 409
diff_has_collisions, a single instance needs a choice for exactly its colliding paths (422), live review rows FOR UPDATE, one appended row per
instance at the next version and the SAME position, entry version + 1, live review invalidated dependency_changed, one audit record, no event of its
own, all-or-nothing, items in request order, ETag = the committed entry version.

## Implementation decisions (the spec is silent; each is tested; ratify or override)
- D-VALUE: the value of a node path is the node's `props` object; an override replaces it; a chain is the slash-joined node keys from the placed root
  (nested-reference keys lead it, DEC-186).  Basis: the only per-node data in a pinned tree besides block identity, and the key space placement already
  stores overrides in.  base/theirs/yours are `props` objects or JSON null (absent node, or no override).
- D-ACCEPT: accept drops the override of every changed path unless it is a collision kept with `yours`; overrides on unchanged paths stay; an override equal
  to the base is not a collision and is dropped; the block identity (key/version) and digest are the target's.
- D-RETIRE: a block root the target version no longer has: adopting the removal appends a `retired` row (pinned to the target); `yours` on that root keeps the
  row `active` with its override.  Roots the target ADDED have no row and are not materialized by accept (no instance exists for them; see B2).
- D-DETACH: detach appends an `active` row, `link_mode = detached`, pin kept (its origin), props = for every node at or under the root the override else the
  pinned node props (plus any other override held).  More than 128 keys cannot be stored (table bound) and is VALIDATION_FAILED at the instance pointer.
- D-ELIGIBLE [SUPERSEDED by fix passes 1 and 2: detach admits a linked `draft`, `active` or `pending_diff` head and refuses `retired` (owner conflict) and `superseded`; accept stays `active`/`pending_diff`]: accept and detach need a linked `active` or `pending_diff` head.  The spec says "any linked (detach)"; detaching a `retired` row would resurrect
  a removed row, so retired/superseded/draft heads are refused (422 VALIDATION_FAILED at `/instances/i/instanceId`).
- D-CHOICES: a choice for a path that is not a colliding path, and any choice on detach, is VALIDATION_FAILED at the choice pointer.
- D-ENTRY: all instances of a request must belong to one entry (the request has one entry If-Match); a different entry is VALIDATION_FAILED at the instance.
- D-ARCHIVED: an archived entry is `revision_not_editable`, as CMS-03C-02.
- Selector pageVersion over all compatible versions in any state (see above) rather than only the listed rows.
- Audit actions `cms.composition.pattern.update` (accept) / `.detach`, reasons `CMS_PATTERN_UPDATE_ACCEPTED` / `CMS_PATTERN_DETACHED`.
- The expander `cms_pattern_update_nodes` duplicates `cms_pattern_placement_nodes` with a `strict` flag (a diff's pinned base must resolve nested
  versions that were superseded after placement; a placement/accept target requires them active).  Not extracted into the promoted function.

## Open items / BOUNDARY
- B1 (placement stores no root chain): `cms_composition_instances` keeps no placement path, so the root chain of a row is inferred as the shortest slot-prefix
  split of `path` whose suffix is a root chain of the pinned tree with the row's block identity.  Ambiguous only if one tree has both root chain `/b`
  and `/a/b` and the rows could be `/main/b`-under-slot-`/main/a` versus `/main/a/b`; such a row resolves to the shortest prefix.  Needs a stored
  `root_chain` (or the slotPath) column written by CMS-03C-02 to be exact.  Not enforced beyond the documented rule.
- B2 (new roots on accept): a root ADDED by the target version has no instance; accept neither creates a row for it nor refuses.  BE03c 1367 says only
  that each existing row is diffed/accepted independently.  Needs a ruling (probably: a re-placement CMS-03C-02 of the added root).
- B3 [RESOLVED in fix pass 1: the contract list now has `revision_not_editable`; the "Contract frozen" remark below is first-pass text] (CMS-03C-15 reason list): `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-15']` is `capability_missing, diff_has_collisions, pattern_version_not_active,
  pattern_incompatible, nested_pattern_not_active`.  The producer also raises `revision_not_editable` (FE03 885, AC-123 and the closed 409 list of BE03c 1304 name it; BE03c 1268 does NOT, the earlier citation was wrong; FIXED in the fix pass: the contract list now has it)
  and `nested_pattern_not_active`.  Contract frozen; root/Worker lane must add `revision_not_editable` or the Worker degrades it to 500.
- B4 (VERSION_MISMATCH detail): entry level `{"expectedVersion","currentVersion"}` (as CMS-03C-02); an instance-level mismatch adds `"instanceId"`.
  Whether the Worker forwards it is the Worker lane's call; the catalog code is `COMPOSITION_VERSION_CONFLICT` either way.
- B5 (D-VALUE) is the largest interpretation: if the owner means whole-node replacement or per-field overrides, plan/next_row change in two functions.
- Concurrency NOT proven (single-session suites): two simultaneous updates of one entry (the entry FOR UPDATE serializes them and the second sees a moved
  head: VERSION_MISMATCH), a target supersession racing an accept (the target rows are FOR SHARE and the governed activation takes the active row FOR UPDATE),
  and the deadlock/lock-timeout to CONFLICT conversion in the transport.  Needs root's race module.
- The linked-update scan (`cms.pattern.linked_update_scan`, AC-212/213) is not in this lane; its output (`pending_diff` rows) is a labelled fixture here
  (guarded insert under `app.cms_rpc`, one function in `000-helpers.sqlinc`).  `cms_composition_instance_resource` (placement, promoted) answers
  conflictState `none` for any linked row; for a `pending_diff` row it should be `pending_diff` (CMS-03C-15 never returns one; the scan lane/reads must).
- B6 (fix pass 2, R5): the linked `draft` and `superseded` head behaviours are proven only on labelled fixtures no producer writes (`s12pu_staterow` in `phase_02_slice_12_pattern_updates_common/020-world-adoption.sqlinc`, next to the `pending_diff` fixture `s12pu_pending`): detach of a `draft` head is admitted (`dr1`), detach/accept of a `superseded` head is refused (`sp1`), a `draft` head is offered no update (diff `s-draft-head`). All become real when the linked-update scan / draft-writing lane exists; until then the fixtures stand in and are labelled as such in every file that uses them.
- `carried_from_id` (AC-258) is not added: it belongs to the carry-over lane.

## Requests to root
- R1 promote the eleven WIP migrations in order (140000 - 140610).  After promotion update the inventory pins (API surface 3 new `platform_api` RPCs, definer/RLS
  allowlists for the eleven new private functions, trigger inventory unchanged, schema pin: one new column and one new CHECK on `cms_composition_instances`).
- R2 add a parity contract test for the markers `-- BEGIN/END COMPOSITION-PENDING-DDL` between `20261014140000_..._pending_version.sql` and
  `supabase/tests/phase_02_slice_12_pattern_updates/populated-pending.sql` (diffed identical at the final run).
- R3 Worker lane: map the CMS-03C-13/14/15 SQL tokens (see RPC boundary) and publish ETags as listed; add `revision_not_editable` to the contract reason list for CMS-03C-15 (B3).
- R4 rulings for B1, B2, B5; a race module for the concurrency clauses.
- R5 dedupe follow-up: make `cms_pattern_placement_nodes` a wrapper over `cms_pattern_update_nodes(.., strict := true)`.

## RPC boundary (for the Worker lane)
All three are `platform_api` functions, SECURITY DEFINER, EXECUTE for `service_role` only.  Every request is the Worker envelope: the route members below plus
`context` (the verified server actor) and optional `correlationId`; exact keys (an unknown or absent member is `INVALID_REQUEST`).  SQL errors are
SQLSTATE `P0001` with the message token below and the DETAIL as noted.  The platform catalog code mapping is the composition catalog `cms.03c.composition.v1`.
Common tokens: `INVALID_REQUEST` 400; `UNAUTHENTICATED` 401; `capability_missing` 403 `COMPOSITION_FORBIDDEN` (reasonCode); `NOT_FOUND` 404
`COMPOSITION_NOT_FOUND`; `VERSION_MISMATCH` and `CONFLICT` 409 `COMPOSITION_VERSION_CONFLICT`; `IDEMPOTENCY_MISMATCH` 409; `VALIDATION_FAILED` 422
`COMPOSITION_VALIDATION_FAILED` (DETAIL is a JSON array of one pointer); reason tokens `pattern_version_not_active`, `nested_pattern_not_active`,
`diff_too_large` 422 and `revision_not_editable`, `diff_has_collisions`, `pattern_cycle` 409 (the token is the message, DETAIL a pointer array);
`DEPENDENCY_UNAVAILABLE` 503.

CMS-03C-13 `platform_api.cms_list_pattern_selector(jsonb) -> jsonb`
- request: `{ contentTypeId: uuid text, cursor?: string|null (<=512), limit?: 1..50|null, context, correlationId? }`; the cursor is passed through unchanged (SQL verifies it).
- response: exactly `PatternSelectorPage { items, nextCursor, pageVersion }`.  ETag: the Worker derives `"<pageVersion>"` (no header is set by SQL).
- refusals: 409 `CONFLICT` (foreign-bound, tampered or expired cursor: restart from the first page), 400 `INVALID_REQUEST` (malformed cursor), 503
  `DEPENDENCY_UNAVAILABLE` (no Vault signing key), 404 `NOT_FOUND` (absent content type or hidden party), 403 `capability_missing`.  Safe read: no audit, no outbox.

CMS-03C-14 `platform_api.cms_get_instance_update_diff(jsonb) -> jsonb`
- request: `{ instanceId: uuid text, context, correlationId? }`.
- response: exactly `CompositionUpdateDiffResource`.  ETag: the Worker derives `"<instance.version>"` from the body.
- refusals: 404 `NOT_FOUND` (absent, hidden or non-pattern), 403 `capability_missing`, 422 `diff_too_large` (DETAIL `["/instanceId"]`).  Safe read.

CMS-03C-15 `platform_api.cms_apply_pattern_update(jsonb) -> jsonb`
- request: `{ action: 'accept'|'detach', instances: [{ instanceId, expectedVersion (decimal string), choices? }], targetPatternVersion (accept only, number), expectedVersion
  (entry, decimal string), ifMatch (the same unquoted string), idempotencyKey, context, correlationId? }`.
- response: exactly `CompositionUpdateResource { items }` in request order; SQL sets `response.headers` to `[{"etag":"\"<committed entry version>\""}]` (also on replay: the stored version).
- refusals and DETAIL: `VERSION_MISMATCH` DETAIL `{"expectedVersion","currentVersion"}` (entry) or `{"expectedVersion","currentVersion","instanceId"}` (instance, or a non-head row);
  `revision_not_editable` `["/instances/i/instanceId"]`; `pattern_version_not_active` `["/targetPatternVersion"]`; `diff_has_collisions` `["/instances/i/instanceId"]`;
  `VALIDATION_FAILED` with the pointer of the offending member (`/action`, `/targetPatternVersion`, `/instances`, `/instances/i/...`, `/instances/0/choices[/j[/path|/choice]]`).
- a deadlock or lock timeout is converted by the transport to the retryable `CONFLICT` token (same Idempotency-Key may be retried).  Audit: one record per request; outbox: only the
  review-changed event of a live review the write invalidated.

## Spec citations
BE03c 175-177, 215, 398-400, 1266-1268, 1294, 1304, 1336-1357, 1359-1367, 1426, 1474-1476, 1587-1588, 1612; FE03 884-885; tracker P2-S12-AC-106..123, AC-212 (consumer), AC-219,
AC-258 (pending clause), AC-261; contracts pattern-selector.ts, pattern-update.ts, refusals.ts; DEC-175/176/180/181/185/186.

## Fix pass
Checkpoint 1 (start): fix pass opened against review-pattern-updates.md items F2, F3, F5, F8, B3 and the parity test.  No run yet.
Checkpoint 2: B3 done test-first. `packages/contracts/src/cms-composition/refusals-operations.test.ts` expected list gained `revision_not_editable` for CMS-03C-15 (RED: 1 failed / 32 passed), then `refusals.ts` list changed (GREEN: `vitest run packages/contracts/src/cms-composition` 34 files / 283 tests pass).
Checkpoint 3: item 6 done. New `tests/contracts/phase-02-slice-12-pattern-updates-pending-parity.test.ts` (3 tests, passes against the unchanged files; mutation check: changing one byte of the WIP migration marker region makes 2 of 3 fail, file restored byte-identical, sha256 verified). Also re-ran apps/web consumers of CMS_SLICE_12_OPERATION_REASONS (4 files / 102 tests pass).
Checkpoint 4: tests written (RED not yet run): updates suite gained 020-world-adoption (block v2, pu-v, pu-nn/pu-dd, labelled draft heads), 070-adoption (block identity + independent digest oracle, nested_pattern_not_active at /targetPatternVersion), 075-eligibility (draft detach ok, draft accept refused), 080-lock-order (static source-order check); s12puc_check now asserts block identity and an independent digest; selector gained 030-retirement and 400 for malformed contentTypeId; diff gained 400 for malformed instanceId, non-head row answered empty, a labelled-retired-fixture note, and the 262144/262145 byte-boundary pair. Migrations unchanged so far; next: one RED run on the staged runner with the WIP migrations unchanged.
Run F1 (RED, 02:50 queued, run 02:55:49, stamp 025058-3872970, WIP migrations unchanged from the first pass, plan selector+diff+updates+populated-pending): selector 274 run / 10 not ok; diff 518 / 5 not ok; updates ABORT at 205 tests (HARNESS: s12puc_digest was defined in 000-oracles, after the world file that uses it; moved into 020-world-adoption).  Genuine REDs: selector malformed contentTypeId (6 cases) and the retire case (269/270/272/273: the retire command was refused P0001, message unknown, pu-f v1 - subject changed to pu-h v4 and a diag added, classified HARNESS/unknown until the next run); diff non-head row still offered an update (412), malformed instanceId still VALIDATION_FAILED (504/507/510/512).  TAP sha256 a657561f16899e7c724673cb038b1a890121984a85201fecfa119e47a7905872.
Checkpoint 5 (resumed by a successor lane agent, 2026-10-15 ~04:45): found the predecessor had edited, AFTER Run F1 (02:55) and without a checkpoint, migrations 140200 (plan: only the head of a path offered a live update), 140300 and 140400 (malformed contentTypeId / instanceId = INVALID_REQUEST), 140600 (lock order 3 before 4; detach of draft allowed, retired refused; nested/cycle/depth pointer re-raised at /targetPatternVersion), a new 140605 (privilege-closure DO block split out of 140600 to keep it under 300 lines), and tests 000-oracles, 020-world-adoption (digest helper moved: the F1 harness abort), selector 030-retirement.  Those bytes have never run.  New fact from root: CMS-03C-09 `retire` is now PROMOTED (supabase/migrations/20261014160000-160200); the F1 refusal of the selector retire case (pu-h v4) was the pre-promotion BOUNDARY refusal, so it is re-classified HARNESS/stale-environment, not a feature defect; the next run exercises it for real.  Plan: review the post-F1 edits against the F1 TAP, then Run F2 on the current bytes.
Run F1b (written by the PREDECESSOR agent, which was still alive and concurrent until 04:41:45 and has been stopped by root; 04:39, stamp 043933-195446, 12 WIP files: my own accidental copy of two stale non-lane migrations from my scratch dir had first been refused by the runner, "collides with a promoted migration", and were removed; they were never lane files): selector 0 not ok and diff 0 not ok (every F1 RED now green), updates ABORT: HARNESS defects of mine (an apostrophe inside a string in 000-oracles ended the literal -> psql "mismatched parentheses"; pu-v block keys 'rootA'/'rootB' violate the lowercase key grammar -> 422 /blockTree).  Fixed in the tests; no migration change.
Checkpoint 6 (successor): runs are numbered F1 (RED), F1b (predecessor, harness-aborted), F2 (successor RED by reverse mutation), F3.. (GREEN).  Because the predecessor edited migrations 140200/140300/140400/140600 before any RED of the updates suite could run (F1 aborted at its world), the F2/F3/F5/pointer fixes have no recorded RED.  To recover a genuine RED I reverse-mutated ONLY two WIP files in place (backup in the lane scratch dir, restored afterwards, sha256 verified): 140600 (position-4 lock moved before position 3; detach refuses `draft` too; the nested/cycle/depth pointer back to `/patternId`) and 140550 (accept keeps the head's block identity and registry digest).  Mutated sha256: 140600 b10ba0b6390c6b85..., 140550 0d057ffe26a81083...  Originals: 140600 56e4c8b1a0f7e51f..., 140550 e767b52fe96d7407... (restored, verified).  Run F2 staged exactly those mutated bytes (manifest .lane-logs/alt-staged-pattern-updates-044103-204593.manifest) together with the predecessor's last test edits of 04:41:20 (000-oracles apostrophe fix, 070-adoption, 020-world-adoption lowercase keys).
Run F2 (successor, RED by reverse mutation, run 04:41:03-04:42:25, stamp 044103-204593, plan selector+diff+updates+populated-pending, 12 WIP files of which 140600 and 140550 were the MUTATED bytes above): selector 274 run / 0 not ok, diff 518 / 0 not ok (so every F1 RED of selector and diff is GREEN on the final migrations 140200/140300/140400 and the retire case runs against the promoted CMS-03C-09 retire), populated-pending 27 / 0 not ok, updates 1307 run (plan 1..1307, no abort) / 9 not ok, exactly the mutated behaviours and nothing else: 1270, 1271, 1278, 1279, 1287 (F5: accept kept `s12pd.block@1` where `@2` is wanted, and the head digest 77f454d5... where the independent version-2 digest ec35bc05... is wanted, for both roots, incl. the block-version-only root), 1291 and 1295 (the nested-superseded 422 pointed at `["/patternId"]`, wanted `["/targetPatternVersion"]`), 1297 (detach of a linked draft head refused VALIDATION_FAILED, wanted success: F3), 1307 (lock order `0 < 1 < 4 < 3 < 5`, wanted `0 < 1 < 3 < 4 < 5`: F2).  Classification: genuine, mutation-reconstructed RED for F2/F3/F5/pointers; the digest assertion is shown able to fail.  TAP sha256 ac5e3b6f4d7a817049edc9f2fc54b71f3cbb97aa53a178625f6c31c943935cbf.  Mutated files restored from the scratch backup; sha256 verified equal to the originals (140600 56e4c8b1a0f7e51f, 140550 e767b52fe96d7407).
Run F3 (GREEN, successor, 04:43:22-04:44:55, stamp 044322-217963, plan selector+diff+updates+populated-pending, 12 WIP files = the FINAL bytes listed below, manifest .lane-logs/alt-staged-pattern-updates-044322-217963.manifest confirms 140600 56e4c8b1... and 140550 e767b52f...): `pg_prove` exit 0, "All tests successful", selector 274, diff 518, updates 1325, populated-pending 27 = 2144 tests, 0 not ok.  TAP sha256 d944f9f30f3653de95b8d161a862470bbcb0ec3da89e41448a05ff381db73932.  The nine reverse-mutation REDs of Run F2 (F2 lock order, F3 draft detach, F5 adoption and digest, `/targetPatternVersion` pointers) are green on the real bytes; the selector retire case (CMS-03C-09 retire, now promoted) runs for real and passes (moves `pageVersion` with no version row added); diff non-head, malformed-UUID 400, byte-boundary pair and selector malformed `contentTypeId` pass.  Also after F3: `vitest run tests/contracts/phase-02-slice-12-pattern-updates-pending-parity.test.ts packages/contracts/src/cms-composition/refusals-operations.test.ts` 2 files / 25 tests pass.

### Fix pass outcome per item
1. F2 (lock order) DONE: `cms_apply_pattern_update` takes position 3 (target and nested pattern version rows FOR SHARE) before position 4 (content-type version FOR SHARE), as the placement precedent and BE03c 1338/1342; test `080-lock-order` (static source-order check, `0 < 1 < 3 < 4 < 5`) failed `0 < 1 < 4 < 3 < 5` under the reverse mutation (F2).  A single session cannot observe the acquisition order dynamically; the race module is root's.
2. F3 (detach eligibility) DONE for `draft` and PARTIAL by design for `retired`: detach now takes any linked head except a `retired` one (draft head detach tested: 075-eligibility, red under mutation; accept of a draft head stays refused, BE03c 1476 names only pending_diff/active for accept).  `retired` detach stays refused 422 VALIDATION_FAILED at `/instances/i/instanceId`; the precise spec conflict is in `## Owner decisions pending`.
3. F5 (adoption) DONE: `070-adoption` adds block v2, `pu-v` (rootA: block version AND props change, rootB: block version only), asserts the heads are `s12pd.block@2` with the independent digest `s12puc_digest(array[2])`; `s12puc_check` asserts block identity and digest for every update; version-1 rows keep v1 and its digest.  Mutation check (Run F2): keeping the head's identity/digest fails 1270, 1271, 1278, 1279, 1287 with have/want visible, so the digest assertion can fail.
4. F8 DONE: malformed `contentTypeId` (6 cases) and `instanceId` (3 cases plus a no-DETAIL check) are 400 `INVALID_REQUEST` with no DETAIL (migrations 140300, 140400; red in F1); the nested/cycle/depth refusals of CMS-03C-15 point at `/targetPatternVersion` (red under mutation, 1291/1295); the diff offers no live update on a non-head row (140200 `cms_pattern_update_plan`; red in F1 412); the hand-inserted `retired` fixture is labelled in the diff suite header, `020-states.sqlinc` and the README (the real retire producer is exercised in 010-accept rm1); byte-bound pair 262144/262145 and the retirement-only `pageVersion` move are tested (030-bounds, selector 030-retirement) and green.
5. B3 DONE: `revision_not_editable` added to `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-15']` in `packages/contracts/src/cms-composition/refusals.ts` with its contract test (Checkpoint 2); the BE03c 1268 citation is corrected above (FE03 885, AC-123 and BE03c 1304 name the token; 1268 does not, and the matrix cell of BE03c 1268 still omits it, which root must amend).
6. Parity test DONE: `tests/contracts/phase-02-slice-12-pattern-updates-pending-parity.test.ts` (Checkpoint 3), passes.

### Final file inventory after the fix pass (changed or new since the first pass; sha256 first 16 hex)
- 20261014140200_cms_pattern_update_plan.sql 200 06902b4bc99c8932; 20261014140300_cms_list_pattern_selector.sql 207 32831382f2e5fdb4; 20261014140400_cms_get_instance_update_diff.sql 125 926c0a7d7d0e109a; 20261014140600_cms_apply_pattern_update.sql 279 56e4c8b1a0f7e51f; NEW 20261014140605_cms_apply_pattern_update_closure.sql 39 58339980aa933cb2 (privilege closure split out of 140600; run it with the set: it is part of the staged 12 files).  Unchanged: 140000, 140100, 140310, 140410, 140500, 140550 (e767b52fe96d7407), 140610.
- Tests new in the fix pass: `phase_02_slice_12_pattern_updates_common/020-world-adoption.sqlinc`, `phase_02_slice_12_pattern_updates/{070-adoption,075-eligibility,080-lock-order}.sqlinc`, `phase_02_slice_12_pattern_selector/030-retirement.sqlinc`; edited: updates `000-oracles.sqlinc`, selector `010-paging`, diff `020-states`, `030-bounds`, `040-authority`, the three suite drivers and the READMEs.  All under 400 lines (largest 197).
- Contract: `packages/contracts/src/cms-composition/refusals.ts`, `refusals-operations.test.ts`; `tests/contracts/phase-02-slice-12-pattern-updates-pending-parity.test.ts`.

## Test corrections (fix pass)
One change to an existing, independently reviewed oracle, root-authorized (B3): `packages/contracts/src/cms-composition/refusals-operations.test.ts`, the expected reason list of CMS-03C-15 gained `revision_not_editable` (spec: FE03 885, AC-123, BE03c 1304); RED 1 failed / 32 passed before the `refusals.ts` change, 34 files / 283 tests green after.  No pgTAP oracle written by another lane was edited; every pgTAP oracle changed in the fix pass is this lane's own.

## Owner decisions pending (behaviour as implemented; NOT to be changed without a ruling)
1. D-VALUE (override replaces the node's props).  The value of a node chain is the node's `props` object.  An override stored under a chain replaces that whole object; it is not merged field by field.  A collision is: the row holds an override for a chain AND the override differs from the base AND the target changed that chain.  Choosing `yours` keeps the override and so drops every other change the target made to that node's props.  The diff compares `props` only: a change of a node's block identity, child order or structure is not shown, although accept adopts the target root's `blockKey`/`blockVersion` and the target registry digest.
2. D-RETIRE (a root the target version no longer has).  Accept appends a `retired` row pinned to the target version, unless the author chose `yours` on that root's collision: then the row stays `active`, pinned to a target whose tree has no such root.  Consequence (review F1): the diff and detach of that row answer NOT_FOUND (`cms_pattern_update_plan` / `effective_props` cannot find the root in the pinned tree) and no further accept is possible, so the row is stuck.  Related (F4): an override kept with `yours` on a removed node names no node of the new pinned tree (BE03c 1365 says each names one); detach re-materializes it; an override on a child of a retired root with no override on the root itself cannot be kept (only a collision on the root can carry `yours`) and is dropped.  Detach of a `retired` head is refused 422 VALIDATION_FAILED at `/instances/i/instanceId`: BE03c 1476 and AC-120 say "any linked (detach)", but the detach row is `active`, so it would resurrect a root the pattern removed, and the pinned tree has no such root to materialize.  Spec conflict: "any linked" vs the append-only state model; needs the ruling D-RETIRE together with the F1 consequence.
3. B2 (a root the target ADDED).  No row is created and none is refused; the entry claims the target version but renders without the new block.  CMS-03C-02 refuses any slot path that already has a row in the revision (any state), so "re-place it" is not available for a retired root either.
4. D-DETACH 128-key limit.  Detach materializes one props key per node chain at or under the root; more than 128 keys (also the depth 8 and 262144-octet bounds of `cms_json_bounded`) is 422 VALIDATION_FAILED at `/instances/i/instanceId`, a refusal the BE03c 1268 catalog does not list.

## Requests to root (fix pass; replaces R1 and R3 where they differ)
- R1 promote TWELVE WIP migrations in order (140000 - 140610, including the new 140605) from `supabase/migrations-wip/pattern-updates/`; same inventory-pin updates as before.
- Amend BE03c 1268 (CMS-03C-15 refusal cell) to name `revision_not_editable` (and the `nested_pattern_not_active` the producer raises); the contract list is already amended.
- Worker lane: CMS-03C-13/14 malformed ids are now `INVALID_REQUEST` (400) in SQL; CMS-03C-15 `nested_pattern_not_active`/`pattern_cycle`/`pattern_depth_exceeded` carry `["/targetPatternVersion"]`.
- Rulings on the four owner decisions above; the race module for the concurrency clauses (dynamic proof of the lock order).

## Fix pass 2
Checkpoint 1 (2026-10-15T09:09:59Z): fix pass 2 opened against review-pattern-updates-f1.md (R1-R8). R7 first. R7 test written (selector 020-authority: validation precedes capability/NOT_FOUND, authentication still first); RED run queued on the staged runner (lane pattern-updates, selector suite only), migration 140300 unchanged.
Checkpoint 2 (resumed by a successor agent, 2026-10-15T11:33Z): the predecessor died before recording its R7 RED run; it finished afterwards and is recorded here. Run R7-RED (stamp 050909-355720, selector suite only, WIP migrations unchanged: 140300 was the first-pass-plus-F1 bytes `32831382f2e5fdb4`): 288 tests, 6 not ok (260, 261, 262, 263, 265, 266, all "validation precedes authority": o-nocap-limit, o-nocap-limit-text, o-nocap-type, o-nocap-type-null, o-other-limit, o-other-type). Classification: all six GENUINE missing feature (have `P0001:capability_missing`, want `VALIDATION_FAILED#["/limit"]` / `INVALID_REQUEST`: the 400/422 check runs after 403). No harness failure, no abort. Passing in the same run: the cursor cases (the signed wrapper already parses the cursor first), the owner-with-capability cases (o-absent-limit/-cursor), the well-formed 403/404 controls (o-nocap-wellformed, o-absent-wellformed: concealment unchanged), the anonymous 401 control. TAP `.lane-logs/alt-staged-pattern-updates-050909-355720.tap` SHA-256 `172f734f8cec853bb640a8211fda61b3cffb6e865e6a326b0920c158c05c0647`.
R7 fix written (140300): contentTypeId, limit and cursor SHAPE are parsed right after `cms_acting_party` and before person/party-visibility/capability; the cursor's BINDING (queryHash, expiry: CONFLICT) stays after the content-type check. Header order comment rewritten. Pre-edit bytes kept in the lane scratch dir. R7-GREEN run queued next (selector suite only).
Checkpoint 3 (2026-10-15T11:34Z) R7 GREEN, ready for root to promote CMS-03C-13: Run R7-GREEN (local 07:32:57-07:33:55, stamp 073257-899668, selector suite only, 12 WIP files, manifest `.lane-logs/alt-staged-pattern-updates-073257-899668.manifest` confirms 140300 = `3936f614edf256462932c124b4c92a13000035b7596c964dc9ac2ba60e4f8635`): `pg_prove` exit 0, "All tests successful", 288 tests, 0 not ok; all 12 "validation precedes authority" cases (incl. the six R7-RED failures 260-263, 265, 266) are ok; concealment controls (well-formed 403/404) and the anonymous 401 stay ok. TAP `.lane-logs/alt-staged-pattern-updates-073257-899668.tap` SHA-256 `0c048233e795f5c67aaa83b062e6b410aeded4957a54cd47e381230a73793fdb`. Final 140300: 214 lines. Only 140300 changed for R7 (no answer-shape or token change; only order: malformed contentTypeId/limit/cursor is now 400/422 for a caller without access, was 403/404). Next: R4 (diff suite RED test already written: 020-states `s-draft-head`; then 140200 fix).
Checkpoint 4 (2026-10-15T11:40Z): R4, R1, R3 tests written and R8 (stale first-pass sections marked superseded above) done; R5 recorded below. Tests: diff `020-states` gained `s-draft-head` (labelled linked `draft` head of `ver3`, whose newer active version 3 would otherwise be offered: expects empty paths, target = pinned, bulkEligible false) [R4]; updates `020-world-adoption` generalised the fixture helper to `s12pu_staterow(tag, path, state)` (`s12pu_draftrow` is now a one-line wrapper) and placed `sp1` with a labelled `superseded` head, `075-eligibility` gained `e-sp1-detach` and `e-sp1-accept` (both 422 VALIDATION_FAILED at `/instances/0/instanceId`) [R1]; `080-lock-order` now anchors on the FULL lock clauses (`... for update`, `... order by locked.id for share`, the content-type `for share`, the review `order by ... for update`) and asserts each occurs exactly once [R3]. Migrations edited (real WIP dir) AFTER the RED run was staged separately: 140200 (offer only for `active`/`pending_diff`), 140600 (detach whitelist `draft`/`active`/`pending_diff`; only `nested_pattern_not_active` re-pointed to `/targetPatternVersion`, one-line comment why) [R4, R1, R2]. R2 has no test: both dropped tokens are unreachable (nested pins immutable, closure checked at CMS-03C-12, BE03c 1380) and not in the contract list.
RED run for R4/R1/R3 (queued 07:35 local, diff + updates suites): to keep the real WIP bytes untouched while the run waits for locks, it stages a COPY of the unfixed 12 files in `supabase/migrations-wip/pattern-updates-r3mut/` (lane name `pattern-updates-r3mut`, removed after the run) in which only 140600 is mutated (position-3 lock `order by locked.id for share` -> `order by locked.id`) so the strengthened R3 check can be seen to fail. Expected RED: diff `s-draft-head` (R4), `e-sp1-detach` (R1), the lock-order clause checks (R3, mutant). Everything else GREEN.
Run F2-RED (local 07:35:13 queued, ALT lock 07:50:13, stamp r3mut-073513-915768, lane `pattern-updates-r3mut`, plan diff + updates, 12 unfixed WIP bytes with 140600 mutated in its position-3 lock clause only; manifest `.lane-logs/alt-staged-pattern-updates-r3mut-073513-915768.manifest`): reset ok, no abort, both plans complete (diff 527 run, updates 1337 run); 10 not ok, exactly the intended REDs and nothing else. Genuine missing behaviour: diff 431/432/434 (`s-draft-head`: a linked `draft` head was offered target 3, one path, bulkEligible true, wanted target 1, empty, false) [R4]; updates 1326-1329 (`e-sp1-detach`: detach of a labelled `superseded` head SUCCEEDED, SQLSTATE 00000, wanted the 422 refusal) [R1]; note `e-sp1-accept` 1330-1332 already passed (accept admits only active/pending_diff). R3 mutant RED: 1335 (a full clause absent), 1336 (`0:1 1:1 3:0 4:1 5:1`, wanted every clause once) and 1337 (`3 < 0 < 1 < 4 < 5`) when the `for share` of the position-3 clause is removed. The old anchor check (`cms_pattern_versions locked`) would have PASSED that mutant. Classification: genuine RED for R4, R1, R3 (mutation-reconstructed for R3); no harness failure. TAP SHA-256 `da5ee560061096566cc211eade39de9a3cefc4109667cc43af5bcfcf4063872c`. The mutant directory was removed afterwards; the real WIP files were never mutated.
Run F2-GREEN (local 07:53:18 queued, ALT lock 07:55:29, stamp 075318-1014818, lane `pattern-updates`, plan selector + diff + updates + populated-pending, the 12 FINAL WIP files; the manifest `.lane-logs/alt-staged-pattern-updates-075318-1014818.manifest` equals the worktree hashes of all twelve, verified file by file): `pg_prove` exit 0, "All tests successful", 4 files, 2179 tests (selector 288, diff 527, updates 1337, populated-pending 27), 0 not ok. Every F2-RED failure (diff 431/432/434, updates 1326-1329) is ok on the real bytes; the strengthened lock-order checks pass on the real 140600 (each full clause once, `0 < 1 < 3 < 4 < 5`). TAP `.lane-logs/alt-staged-pattern-updates-075318-1014818.tap` SHA-256 `e6684feeab3bbd410215125cb2db5e0a0b0a2cfdaaa8459bae86257ba8c6415f`.

### Fix pass 2 outcome per item (review-pattern-updates-f1.md R1-R8)
- R7 DONE and checkpointed separately (Checkpoint 3: selector GREEN 288/288, stamp 073257-899668): parse before authority in 140300; cursor binding stays after.
- R4 DONE: 140200 `cms_pattern_update_plan` offers an update (hence `bulkEligible`) only to a linked `active`/`pending_diff` head; RED diff 431/432/434, GREEN.
- R1 DONE: 140600 detach whitelists `draft`/`active`/`pending_diff` (BE03c 1512 "any linked" = the linked states a producer writes); a labelled `superseded` head is refused (`e-sp1-detach`, RED 1326-1329, GREEN); `retired` stays refused (owner conflict D-RETIRE, unchanged).
- R2 DONE (no test: both tokens unreachable and outside the contract list): the `/targetPatternVersion` re-raise in 140600 now covers only `nested_pattern_not_active`, with the reason in a comment. `pattern_cycle` / `pattern_depth_exceeded`, if the shared expander ever raised them, would surface unchanged at `/patternId`; nested pins are immutable and their closure was checked at CMS-03C-12 (BE03c 1380), so the case cannot occur. The `nested_pattern_not_active` test (070-adoption) stays green.
- R3 DONE: `080-lock-order` anchors on the FULL lock clauses and asserts each occurs exactly once; RED under a mutant that removed the position-3 `for share` (1335/1336/1337), GREEN on the real file. It remains a static source check (no run-time order, no callee locks, no deadlock conversion: the race module is root's).
- R5 DONE: recorded as B6 in Open items.
- R8 DONE: stale first-pass sections marked SUPERSEDED/RESOLVED in place (Files, D-ELIGIBLE, first Test corrections, B3); current hashes below incl. 140605.
- R6 (spec debt): BE03c :1287 already names `revision_not_editable`, `pattern_incompatible` and `nested_pattern_not_active` for CMS-03C-15 (root amendment after the review); the contract list and the producer match it. No lane change.
- R9 (info, out of brief): the non-strict diff still offers `pu-dd` v2, which accept refuses with `nested_pattern_not_active`; unchanged, UX call for root/owner.

### Test corrections (fix pass 2)
None to any oracle written by another lane. Own-lane test changes only: diff `020-states` (added `s-draft-head`), updates `020-world-adoption` (generalised fixture helper `s12pu_staterow`; `s12pu_draftrow` is now a wrapper; added `sp1`), `075-eligibility` (added `e-sp1-detach`, `e-sp1-accept`), `080-lock-order` (stricter anchors; the old three assertions are replaced by four stronger ones), selector `020-authority` (validation-precedes-authority cases, written before the R7 RED). Nothing weakened.

### Changes the Worker lane must know
- CMS-03C-13: a malformed `contentTypeId` / `limit` / `cursor` shape is now `INVALID_REQUEST` (400) / `VALIDATION_FAILED ["/limit"]` (422) BEFORE the 403 `capability_missing` / 404 `NOT_FOUND`, so a caller without access sees 400/422 for a malformed request (BE03c 175 "BE00 order"). A well-formed request is concealed and authorized exactly as before; the cursor's binding (foreign/expired: 409) is still judged after authority. No token or answer shape changed.
- CMS-03C-14: a linked `draft` head (not producible today) is answered with an empty diff, target = pinned, `bulkEligible: false`. No shape or token change.
- CMS-03C-15: detach of a `superseded` head is `VALIDATION_FAILED ["/instances/i/instanceId"]` (unproducible today). `pattern_cycle` / `pattern_depth_exceeded` are no longer re-pointed (unreachable); `nested_pattern_not_active` still carries `["/targetPatternVersion"]`. No new token.

### Final file inventory after fix pass 2 (lines, first 16 hex of SHA-256; the twelve match the F2-GREEN manifest)
Migrations `supabase/migrations-wip/pattern-updates/`: 140000 42 ac79470b6509afff; 140100 81 dc5ac6c39ece5ba7; 140200 201 32773f926ac96919 (changed); 140300 214 3936f614edf25646 (changed, R7; full `3936f614edf256462932c124b4c92a13000035b7596c964dc9ac2ba60e4f8635`); 140310 65 aec26d0673a2119d; 140400 125 926c0a7d7d0e109a; 140410 43 9dde7629cf5a62e5; 140500 146 885de34d8cbc19c5; 140550 81 e767b52fe96d7407; 140600 282 1160f326cf4ba954 (changed); 140605 39 58339980aa933cb2; 140610 61 5ed9e15ec367998b. All under 300 lines. No new timestamp.
Tests changed in fix pass 2: selector/020-authority 71 22e5add9e9cc5cef; diff/020-states 60 57e6df1ac3b0058f; updates/075-eligibility 24 e24019cc3b2b93ec; updates/080-lock-order 28 8ed89724c8c83ea7; updates_common/020-world-adoption 82 d719fc91b9161329.

## Status (fix pass 2)
GREEN. Final staged run F2-GREEN 2179 tests (selector 288, diff 527, updates 1337, populated-pending 27), 0 not ok, `pg_prove` exit 0. Selector (CMS-03C-13) was GREEN earlier at checkpoint 3 and is cleared for promotion after R7; CMS-03C-14/15 stay held for the owner rulings (D-RETIRE / D-VALUE / D-DETACH / B2) and the race module. Nothing promoted, staged or committed.

## Requests to root (fix pass 2)
- Promote the twelve WIP migrations in order when CMS-03C-13 is promoted (the selector chain is 140300 + 140310; I did NOT run the selector against a subset of the twelve, every run used all twelve, so which of 140000/140100/140200 it needs is unverified); the selector R7 bytes are 140300 `3936f614...` (Checkpoint 3). CMS-03C-14/15 (140400-140610) per your hold.
- Race module for the lock clauses (the static check cannot prove run-time order); owner rulings as in the earlier sections.
- Correct the F2 incident note in the tracker (the F1 review found F2 valid evidence, not "not evidence for either").
