# Lane placement report (claude_s12_placement_sql)

## Status
GREEN for the lane's own suites (staged `governed-b,placement`): run 6, 539 tests, all pass (main 516 + position witness 23).
Open items below (B1, B2, B3, concurrency, a Worker mapping gap) are for root; nothing is promoted or staged.

## Scope
CMS-03C-02 `platform_api.cms_insert_pattern_instance` -> `platform_private.cms_insert_pattern_instance`, the DEC-185
`position` column with its populated-table backfill (AC-258 position clause), over the promoted pattern producer and the
governed-b WIP activation. Worker transport files untouched.

## Files (lines, SHA-256)
Migrations, `supabase/migrations-wip/placement/` (range 20261014110000-110400):
- 20261014110000_cms_composition_instance_position.sql  54  4db1ff40f069ce9b5040ed526eee7c21645db399d7e5de5f0443ca0c5af6ed80
- 20261014110100_cms_pattern_placement_nodes.sql  81  7f90bf52a5b68d669aa50083474014135d644275abe09fc5794c53eefa4e3f0d
- 20261014110200_cms_pattern_placement_request.sql  113  c26ccd6fd69e8a1766f149658bacd8d38736ea326b8378997587155bd1a58957
- 20261014110250_cms_pattern_placement_plan.sql  107  84e764d47d98e64ce571a8cd3a80fa4c0fb912353b1b2f3bbfac695676186d5b
- 20261014110300_cms_insert_pattern_instance.sql  289  d10d871c1e6c7308511357e8754a0918f529fc374009e855a55ae577f369c545
- 20261014110400_cms_insert_pattern_instance_public.sql  63  bad71d61b4a85244f73ec653298479b1fd57fcaaa8e3328267db698cab84e22c
Tests:
- supabase/tests/phase_02_slice_12_pattern_placement.sql  45  f7c0b6d7fcbc270b7c6689bfeb9ed9e68b4bfbbb0294346ac87edf46e71d3c4f
- .../pattern_placement/000-fixtures.sqlinc 209 cf882d30...22ba; 010-oracles.sqlinc 217 4a2204da...33a6; 020-schema.sqlinc 56
  84381a57...04ec; 030-patterns.sqlinc 33 9cfd616f...c30c; 040-positive.sqlinc 105 0be1d9f6...163f; 050-refusals.sqlinc 184
  349f24f7...9727; 060-big.sqlinc 69 a5a9ed0b...e13d; 070-supersede.sqlinc 18 2b491c60...7371; populated-position.sql 112
  8842ec8a...56ff; README.md 34 9d34d20d...ee93 (full hashes: `sha256sum` of each file).
All migrations < 300 lines, all test files < 400.

## Runs (stage lane governed-b,placement)
| # | start | stamp | plan | result | TAP sha256 |
|---|-------|-------|------|--------|------------|
| 1 | 17:00:47 | 170047-1457666 | main, placement WIP empty (RED) | 93 run, 61 ok / 32 not ok, then harness abort at 050:40 | 61c548342579efbb75b150cad417d93fcb6853ecb0ee45512e10ec5729e726d3 |
| 2 | 17:12:30 | 171230-1517006 | main + witness | main 304 run, 5 not ok (22,23,163-165) + abort 050:111; witness abort 105 | 8b289fe4968d36883b9d0b650eb9793bccf1b7c966ba41cc1ea917312d75fe45 |
| 3 | 17:14:45 | 171445-1532879 | same | main 161 run, 0 not ok, abort 040:90 (VALIDATION_FAILED from review fixture) | 59d07f79dfa818c410fd340fa59cc5fbf3f4bbc0b680168b27dc69eda8846ae9 |
| 4 | 17:16:11 | 171611-1541505 | same | PASS 505 (main 482 + witness 23) | d8aa58765ce4bbe2f5d7c1d013761895fe5092afeb02e07b5a3329b18a89afb2 |
| 5 | 17:17:22 | 171722-1548237 | same + worst-case size and int32 position tests | 524 run, 1 not ok (461 pos-fits: 22003 integer out of range) | c4b6b22761362837133dbff04e2bfe715c4169c3183aff57be900dbb392a9037 |
| 6 | 17:18:18 | 171818-1555658 | same + pos-max-held | PASS 539 (main 516 + witness 23) | 3458c1bc443d537680054db689da53108806bd95ae9a000036fe615dfe5e31cb |

Classification of every non-green result:
- Run 1: 32 failures = genuine missing feature (no transport/private function, 42883 captured; no `position` column). The abort at 050:40
  was a HARNESS defect (my oracle cast a non-JSON error DETAIL to jsonb), fixed forward. Fixtures were proven on real producers (7 pattern
  chains create/submit/assign/decide/activate, real CMS-03C-01 template, author grants). Assertions in 050-070 were not reached in RED,
  so they have no RED record of their own; they fail trivially without the function and were first exercised in run 2 onward.
- Run 2: tests 22-23 HARNESS (catalog text quotes `"position"`); 163-165 GENUINE DEFECT-class finding, see D1; abort 050:111 consequence of D1
  (the physical revision state is the constant `draft`); witness abort `text || "char"` HARNESS.
- Run 3: HARNESS (the review table admits only an open version-1 row and one live review per revision); fixture rebuilt.
- Run 5: GENUINE DEFECT in my producer (D2): `v_base + row_number` was int4 arithmetic and overflowed at the last position. Test failed first, then
  the fix (bigint arithmetic), run 6 green.

## Findings that shaped the code
- D1: the editability rule must read the DERIVED revision state (`cms_revision_effective_state`, E2), never `cms_entry_revisions.state`
  (constant `draft`). Producer fixed before it ever passed; the composition admission guard uses the same helper.
- D2: int32 `position` overflow, fixed (bigint arithmetic, CONFLICT past 2147483647, last position usable).
- F1 (spec vs reachability, AC-219): under E2 plus the one-live-review unique index, an editable (effective draft) revision cannot carry a
  live review except when a live review has an EARLIER submitted_at than an invalidated one. The placement still invalidates it
  `dependency_changed` in the same transaction (verified on exactly that constructed shape, with its event and version bump). On every real
  path a revision with a live review is effective submitted/approved and refused `revision_not_editable`.

## Behavior implemented (spec lines)
BE03c :160/:1365 one append-only `active` row per block root after DEC-181 expansion, consecutive positions after the slot's greatest of any
state/version (DEC-185), row path = slotPath + key chain (root `/` adds no separator), <= 248 octets (DEC-186, octets proven with 2-byte chars),
digest recomputed (client digest = equality expectation, `block_registry_digest_mismatch`), overrides stored on the owning root row in `props`,
`overrides` keys must name a block node of the expanded pinned tree (a key at a reference node is refused), nested pinned versions must be
active (`nested_pattern_not_active`), lineage cycle `pattern_cycle`, <= 512 roots, entry aggregate version CAS and +1, revision hash and
revision row unchanged, one audit record, no outbox event, idempotent replay (stored body and stored ETag), lock order per :1336-1357
(entry FOR UPDATE, authority rows, pattern rows ascending id FOR SHARE re-read, type version FOR SHARE, live review rows FOR UPDATE).
The ETag is the committed entry version published through `response.headers`; the 201 body is exactly `{ items }`.

## Tests proven (all against the real producer)
Positive: forest expansion and key chains, nested expansion with an override through the expanded root, append after a non-dense and retired
greatest position, per-slot positions, root slot, detached mode, replay and IDEMPOTENCY_MISMATCH, items equal persisted rows with an independent
D5 hash, ETag header equals new entry version, existing rows byte-identical, revision row unchanged.
Refusals (each with exact token, DETAIL where read, and full before/after equality of composition, entries, revisions, reviews, assignments,
idempotency, audit, outbox, grants): stale/mismatched CAS, envelope shape, patternVersion/linkMode/slotPath/digest/override grammar and depth,
hidden owner/revision/pattern 404, visible-no-edit `capability_missing`, anonymous, anon/authenticated ACL 42501, revoked author, old/archived/
open-review revisions `revision_not_editable`, draft/absent/superseded pinned version, incompatible type, digest mismatch, unknown/reference/
chainless override keys, 248 vs 249 octets (bytes not characters), template slot existence, path collision and all-or-nothing on the LAST root,
nested superseded, int32 position boundary.
Maximum: 512 rows (32 refs x 16 roots) with 64 overrides: compact 295,405 bytes; worst case 512 rows of 248-octet quote-escaped paths:
527,341 bytes; both under 1,048,576. The 65-key override bound is isolated by 65 real node keys.
Witness (`populated-position.sql`): reverts the column, loads 7 legacy rows (two versions of one path, two slots, two revisions, paths that sort
differently bytewise vs by locale), replays the migration DDL and proves the dense bytewise rank, shared per path, NOT NULL, CHECK, index, both
guards enabled again, rows append-only again. DDL parity with the migration was diffed (identical).

## Test corrections
The Codex skeleton was replaced wholesale (it was an unrun, setup-blocked outline). Oracle changes against it and why:
- skeleton refusal oracle `P0001:COMPOSITION_VERSION_CONFLICT` / `COMPOSITION_FORBIDDEN` / `COMPOSITION_VALIDATION_FAILED` named HTTP catalog
  codes, which are Worker-side; the SQL convention of every promoted producer (BE03c :1289-1304; cms_create_pattern_version, cms_curate_related_
  content) is P0001 with the bare catalog token or closed reason token as message. Replaced by `VERSION_MISMATCH`, `capability_missing`,
  `VALIDATION_FAILED` + pointer DETAIL.
- skeleton overlong case `/` + 250 `x` is refused by the slot-key grammar (64 chars) before the 248-octet rule; replaced by `/main/` + 237/238 `x`
  (accept/refuse at exactly 248/249) plus a 2-byte-character pair.
No existing frozen oracle outside this lane was edited.

## Open items / BOUNDARY
- B1 root slot key: slotPath `/` has no slot key but `slot_key` is NOT NULL and the render plan orders slots by it. Implemented `root`; the slot key
  of any other path is its first segment and must match ^[a-z][a-z0-9_-]{1,63}$ (single-char or uppercase first segment is 422 at /slotPath). Needs a
  spec ruling (BE03c names neither). Tests 050 `slot-1..10` encode this.
- B2 template slot `maxCount` / `allowedBlocks` at placement: BE03c states no refusal token or rule for CMS-03C-02 ("slot counts before save" in
  Security controls has no token). Not enforced. Needs a ruling; maxCount (<= 128) would also cap a templated placement below 512.
- B3 the over-budget refusal of FE03 :1050 / BE03c :1487 is unreachable: 512 rows of worst-case paths is 0.5 MiB, so no legitimate producer output
  exceeds 1 MiB. The maximum success and the worst-case success are proven; the reachable budget refusals (512 roots, 248 octets, 64 override
  keys, depth 8, int32 position) are proven. The `pattern_nodes_exceeded` 512-root guard is defensive and not exercisable without forging a
  pattern row, so it has no test.
- Concurrency: two simultaneous placements into one slot (no shared/interleaved position), deadlock -> CONFLICT conversion and lock order are NOT
  proven here (single session). Needs root's race module. Entry row FOR UPDATE is the revision/slot lock.
- `state` of a placed row is `active` (carry-over, compare and accept key on active); `conflictState` is `none` for linked, null for detached; bindings `{}`.
- `pending_pattern_version` and `carried_from_id` (AC-258 other clauses) are not added; they belong to the apply/carry-over lanes.

## Requests to root
- R1 `20261005017560_cms_dependency_manifest.sql:233-241` joins `pattern.id = instance.pattern_id`; since the lineage migration `pattern_id` is the
  lineage id (version-1 row id) the manifest `patterns` group is wrong for a placement of version >= 2 (it hashes the version-1 row).
- R2 Worker gap: `cms-composition-production-pattern.ts` maps provider failures through `mapCmsCompositionRpcFailure` whose token table does not
  contain the Slice 12 reason tokens (`revision_not_editable`, `pattern_version_not_active`, `pattern_incompatible`, `nested_pattern_not_active`,
  `pattern_cycle`, `block_registry_digest_mismatch`, `capability_missing`): a P0001 with such a message degrades to the scrubbed 500, never the
  typed 409/422/403 with `details.reasonCode` (the pattern-definition and governed adapters map them via `CMS_SLICE_12_OPERATION_REASONS`). Frozen
  file, so a Worker lane must add it.
- R3 add a contract parity test like `tests/contracts/phase-02-slice-12-pattern-lineage-witness-parity.test.ts` for the markers
  `-- BEGIN/END COMPOSITION-POSITION-DDL` between `20261014110000_cms_composition_instance_position.sql` and
  `supabase/tests/phase_02_slice_12_pattern_placement/populated-position.sql` (I diffed them: identical).
- R4 promotion: all six files in order; the migration disables and re-enables the two row guards of `cms_composition_instances` only inside the
  one-time backfill block (empty table: no-op). Dependent lanes (CMS-03C-14/15, carry-over, render plan) must now use `position`.
- R5 rulings for B1 and B2; race module for the concurrency clauses.

## Fix pass
Status: GREEN. Staged lane `placement` (governed-b and baseline-repair are promoted): run 9, 664 tests, all pass, 0 not ok
(main 641 + populated-position witness 23). Nothing promoted or staged by this lane; the only commit-visible changes are WIP
migrations and the lane's own test files. Rulings applied: root rulings 1-5 of `briefs/placement-f1.md`.

### Files after the fix pass (lines, SHA-256)
Migrations (`supabase/migrations-wip/placement/`): 110000 54 `4db1ff40...6ed80` (unchanged); 110100 84
`9da6e78b41e07402bf5c454311ce590dde7a53b44c54563df275b00185fc3bf2`; 110200 114
`d84728188578c9554c67e3579350f1042faba6c4adc535f9547fc15b1a46045a`; 110250 107 `84e764d4...6d5b` (unchanged); 110300 298
`a9a8942a0d0391382c277f9b7ec18efba15f5690a35d8415f0352d9d918fbce6`; 110400 63 `bad71d61...a22` (unchanged). All under 300.
Tests (`supabase/tests/`): phase_02_slice_12_pattern_placement.sql 46 `50af9cd0dfbcb320d9772038a3fa329077db193fcfc6ab57045302c48d7f4b64`;
dir: 000-fixtures 222 `60c0421f671186373f4dbd67df7a3c7e80855aca025f4020f1602510e8c41964`; 010-oracles 228
`7c7c462de4ea94f60fec4d9199c820b5fcad6c98aca59e7f258c86540695d823`; 020-schema 56 (unchanged); 030-patterns 52
`80f4c7861906fb7043a501ea9bcbec83748044f52f2a4f45aae73b735ecd4936`; 040-positive 121
`a3158b7a84bb28d7112265403cade63e745d813ae8a13dafc5ff7203b6206d41`; 050-refusals 205
`9daa28b15f1d7b96e0a85d96b2cac3241dd28a587462c871de49e69427a539fb`; 060-big 77
`de80e108d6f54f8cf77849cd78ca70fb224b7d8c634f129eb3d0f79e3c9b6fe6`; 065-defensive (new) 75
`eebba4758b6b1270d0ea9cfdf3c2e474f755386a8094fc118b82b3216f0112d2`; 070-supersede 18 (only entry helper renamed);
populated-position.sql 112 `8842ec8a...56ff` (unchanged); README.md 37 `cb966ec812bae9b2bf8f53b735455f05806e5e6017da61e0d8471b6179e3aaa5`.

### Runs (stage lane `placement`)
| # | start | stamp | plan | result | TAP sha256 |
|---|-------|-------|------|--------|------------|
| 7 | 21:50:56 | 215056-2638689 | main only; new/moved tests against the UNCHANGED producer (RED) | 641 run, 23 not ok: 471-474, 476-477, 480-481, 484-485, 488-489, 492-493 (no-template-slot-1..6), 508-511 (root-path-with-root-slot), 519, 529 (root-slot-by-name consequence), 597-599 | 7c3410ea0a484863dba4f420637e7a0f8b4714ec82113a2306cefb9b9a594e11 |
| 8 | 21:55:20 | 215520-2662960 | main + witness, after the producer and expander fixes | 641 run, 2 not ok (597-598) | 6e52a698cbc0f2dadb1959f7e2bb2a4369900dfc846078fab563a1dcc01d9107 |
| 9 | 21:56:31 | 215631-2669857 | main + witness, harness fix | PASS 664 (641 + 23), 0 not ok | 5c93f21c5a20d29c2d78eafabb30d6d560ded2687ca8d62cc2cdb328860a3025 |

Classification:
- Run 7 failures 471-493, 508-511, 519, 529: GENUINE missing behavior (the strict slotPath rule; F1/F6). 519 and 529 are the downstream
  effect of 508-511 (the refused-in-spec `/` placement had succeeded and occupied slot `root`). 597-598: HARNESS (see run 8/9).
  599: GENUINE DEFECT found by the new boundary test (D3 below).
- Run 8: 597-598 HARNESS: the pattern table is row-level secured by `cms_rpc_context_valid()` (20260927290000:163-171); my direct
  helper call did not set `app.cms_rpc` as every producer does, so the nested row was invisible (`nested_pattern_not_active`). The
  diagnostic added in run 8 showed the row active, same owner, same version; the helper now sets and restores the GUC.
- Run 9: green.

### Disposition of every finding and ruling
- F1 / ruling 1 (strict slotPath), DONE, RED first (run 7). 110300 now: no template -> only `/` (any other normalized path is 422
  `VALIDATION_FAILED` at `/slotPath`); templated -> a slot named by the first segment, and `/` is refused whatever the slot names.
  Tests: p4/p4b (template-less root placements, slot `root`, positions 0..3), `no-template-slot-1..6` (`/main`, `/main/more`, `/side`,
  `/fresh/deep/er`, `/root`, `/root/x` refused, full no-effect proof), `no-template-root`, `root-with-template`,
  `slot-not-in-template`, `slot-in-template`. Every former template-less `/main`-style fixture moved onto the real templated
  entry (`s12pl_tentry`, template slots main/side/fresh); the 512-row maximum places at `/` on a template-less entry, the 248-octet and
  worst-case-size cases on the templated slot `main`.
- F6 (part of ruling 1), DONE. A second real template declares a slot literally named `root`; `/` on its entry is refused
  (`root-path-with-root-slot`, RED in run 7) and `/root` is accepted into slot `root` with only its own rows (`root-slot-by-name`,
  asserted rows = exactly the two rows `/root/hero`, `/root/cta`).
- B1 as ruled: closed by the strict reading. The key `root` is used by template-less entries only; no template slot can collide.
- B2 / ruling 2: spec read, NO implementation; the gap is recorded under `## Open` below.
- F2, DONE: `060-big` asserts `padded_bytes <= 1048576` (jsonb text with `", "` and `": "` padding, the raw PostgREST body that
  `readBoundedResponse` bounds) for the 512-row maximum (padded 309,229; compact 292,845) and the quote-escaped worst case (padded
  543,725; compact 527,341), in addition to the compact assertions.
- F3 / ruling 3, DONE (`065-defensive.sqlinc`), without forging any row. Reachable path: the producer's own private expander
  `cms_pattern_placement_nodes(owner, forest, visited)` and plan `cms_pattern_placement_plan(owner, pattern_record, slot, overrides)` take the
  forest document / a record value as INPUT, so a test supplies a synthesized forest and a record built by `jsonb_populate_record` over a
  real row (the stored row is never written; a final assertion proves lineage `pa` still has one version row). Proven: `pattern_cycle`
  (reference to a lineage already on the chain; control: same reference with the lineage off the chain expands to 4 nodes),
  `pattern_depth_exceeded` (128 nested levels expand to 128 nodes, 129 refused), `pattern_nodes_exceeded` (512 roots plan, 513
  refused), zero roots (`VALIDATION_FAILED` at `/patternId`). These are definition-time guarantees re-proven at placement; no route
  input reaches them, which is why they are exercised at the producer's function boundary.
- D3 GENUINE DEFECT (found by the new 128/129 boundary test, run 7 test 599): the depth guard fired on the EMPTY child list of the deepest
  allowed node (entry call at depth 129), so a forest of exactly 128 levels was refused. Fix in 110100: the guard applies only to a
  non-empty forest. Bound itself is a runaway guard (stored versions are limited to 8 block levels per tree and 9 nesting levels at
  definition), documented in the file.
- F4, DONE: `p6` is now `s12pl_refused(... 'CONFLICT', '["/slotPath"]')` (token, DETAIL, no-effect proof).
- F5, RATIFIED by root: the backfill guard pause and header note in 110000 are kept unchanged. R3 (parity contract test) stays a request.
- F7 / ruling 5, DECISION (stated): an archived (or otherwise non-`active`) entry answers 409 `revision_not_editable` at `/revisionId`.
  BE03c :375 is silent on entry lifecycle for CMS-03C-02; the token is on the closed list of :1304; CMS-03C-05's `INVALID_TRANSITION` is
  that operation's own subject-lifecycle refusal and is not on the CMS-03C-02 list. Comment added to 110300; `archived-entry` test unchanged.
- F8 / F9: info, folded into B2 / B3 below. F12 / F13: info, no action (R1 closed by promoted `20261014130000`).
- F10 / ruling 3, DONE: `s12pl_resource` no longer mirrors the producer. contentHash is computed from first principles: the RFC 8785
  text is assembled by hand in the fixed key order (bindings < blockKey < blockRegistryDigest < blockVersion < mode < patternRef < props),
  hashed with `extensions.digest(...,'sha256')`; timestamps formatted with `to_char` directly. The oracle raises if a row has more than one
  props key or non-empty bindings (the only shapes the suite stores), so it can never silently diverge. The D5 key set is cited to
  `20261005010400:877-891`. Passing means the producer's `cms_composition_instance_resource` + `cms_jcs_sha256` equal the hand-built hash.
- F11 / ruling 3, DONE: `c1` (forest of exactly 1 root, `p1r`) and `c32` (exactly 32 roots, `p32`) succeed with full `s12pl_check`.

### Test corrections
None to a frozen or external oracle. Lane-owned oracles changed, with spec citations: template-less `/main`-style fixtures moved to the
templated entry or to `/` (BE03c :1365 / AC-218 strict reading, root ruling 1); `p6` strengthened (F4); `s12pl_resource` rewritten (F10);
`060-big` extended (F2). No assertion was weakened; every previous assertion still runs on a fixture that satisfies the new rule.

### Open
- B2 (template slot `maxCount` / `allowedBlocks` at placement): NOT IMPLEMENTED, gap recorded. Clauses read: BE03c :1488 ("Composition
  graphs reject cycles and enforce protected depth/node/slot counts before save and again before publish"), :1504 (CMS-03C-02 flow: no
  slot-count step), :375-378 (CMS-03C-02 validation rows: slotPath, overrides, graph/digest only), :1304 (closed token list: no slot-full
  token), :1255 and :1581 ("slot collision" / "409 ... slot" = the (revision, path) collision, already enforced as `CONFLICT`), :372-373
  and :482-483 (`maxCount` 1-128, `allowedBlocks` max 32 exist only in the CMS-03C-01 template request), :1606 (slots, required/allowed
  blocks are CMS-03C-01 tests); FE03 :1790/:2466 (template designer only); IA03 deep dive :400 ("Template slot validates required/allowed
  blocks, max counts/depth, reserved regions ..." with no operation named). The spec therefore states THAT a template slot has a
  capacity and an allow-list, and that "slot counts" are enforced before save, but does not state, for CMS-03C-02: (a) which count
  (rows of the slot in this revision; only `active`; distinct paths vs all versions), (b) whether the placement or the resulting total is
  compared with `maxCount`, (c) the meaning of an empty `allowedBlocks` (none allowed vs unrestricted; the suite's real templates now
  declare `[]` with `maxCount` 128), (d) whether `allowedBlocks` matches the pinned `(blockKey, blockVersion)` of each expanded root,
  (e) the refusal status/token/pointer (no member of the :1304 list fits; `VALIDATION_FAILED` at `/slotPath` is a guess). Missing spec:
  a BE03c clause for CMS-03C-02 (validation row + token + counting basis) from the owner or the spec cascade. A maxCount <= 128 would also
  cap a templated placement below 512 rows, so the choice changes the FE03 :1050 maximum scenario (which this suite proves at the root
  slot). Not invented. Needs a spec ruling.
- B3: unchanged and strengthened (F9). The over-budget refusal against the actual producer of BE03c :1487 / FE03 :1050 is unsatisfiable
  as written: the largest producible success (512 maximal escaped paths) is 527,341 compact / 543,725 padded bytes, 52 percent of the
  1 MiB ceiling, so only the Worker transport and route can refuse. Needs a spec correction at cascade (root already recorded this).
- Concurrency (two simultaneous placements into one slot; deadlock -> CONFLICT): unchanged, race module.
- D3's 128-level bound is a defensive runaway guard, not a spec number; if the cascade wants a spec-stated number it must come from BE03c.

### Requests to root
- RT1 promote the six WIP migrations in order (110000-110400); 110100, 110200 and 110300 changed in this pass.
  Files after the change: hashes above.
- RT2 spec ruling for B2 (items a-e above) and the B3 spec correction.
- RT3 unchanged from the first report: R2 (Worker reason-token mapping gap), R3 (parity contract test for the position DDL), race module.
- RT4 downstream lanes that place patterns (CMS-03C-14/15 tests, carry-over, render plan) must use template-less entries only with
  the root path `/` and templated entries only with a template slot path, per the strict rule now enforced.
