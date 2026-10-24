# DEC-193 placement-position contract RED authoring — 2026-10-16

Status: new tests authored and statically read back; **UNRUN**. Native
`gpt-6.1-sol` / `ultra`, under Slice 12 Dispatch claim
`native_receiving_contract_20261016` for this two-path test-only task.

Active checkout: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Protected primary `/home/rob/Projects/WeJammin` received no author writes.
Only the new `pattern-placement-position-dec193.test.ts` and this new report
were edited. Production, old tests, specifications and trackers remain frozen.

## Source rule and present mismatch

Approved BE03c `03c-composition-taxonomy-localization.md:1483` defines common
revision/pattern pins, one row per expanded block root and position-ordered
201 `items`. Its selected-root rule at `:1485` permits a free retired path to
be placed at its next row `version`, retaining that path's immutable `position`.
Rows on new paths alone receive consecutive positions, in forest order, above
the greatest position already in the slot.

A reply can therefore contain ascending positions `[1, 10]`: a retained path
at 1 and a new path above a historical slot maximum of 9. The reply does not
include that history or a retired/new discriminator. The public schema can
require ordered distinct positions and common pins; it cannot prove which
paths were retired or that new paths were allocated above the locked slot max.
Those history, forest, locking and transactional allocation proofs remain
server/database obligations and are not claimed by this schema-only test file.

Current `pattern-instance.ts:160-165` instead requires
`row.position === first.position + index`, reporting
`placement_positions_must_be_consecutive`. That rejects the valid mixed reply.
No production correction is authored in this pass.

## New contract witnesses

`packages/contracts/src/cms-composition/pattern-placement-position-dec193.test.ts`
contains the following proof families:

- `DEC-193-POS-01`: positive mixed positions `[1,10]`, `[1,4,10,11]` and the
  int32 endpoints `[0,2147483647]`, each preserving full row values and distinct
  retained/new row-version strings. A retained bigint row version is lossless.
- `POS-02` / `POS-03`: consecutive linked/detached placements and a singleton
  retained path above zero remain valid without renumbering its row version.
- `POS-04` / `POS-05`: unsorted and duplicate positions remain refused at the
  offending row's `position`, independently of row path/ID uniqueness.
- `POS-06`: differing revision, pattern identity, pattern version, nullable
  pin values and link mode remain refused at the offending row.
- `POS-07` / `POS-08` / `POS-09`: duplicate paths/IDs, malformed UUIDs and bad
  path shape/control characters/length remain refused at the specific field.
- `POS-10` / `POS-11` / `POS-12`: position int32/type limits, required row
  keys and canonical positive bigint row-version strings remain enforced.
- `POS-13` / `POS-14`: unknown authority/session/signing/history fields and
  extra wrapper keys remain refused. No invented history marker is required.

Every pin/path/identity/security negative uses a valid consecutive-position
baseline, so the present sparse-position defect cannot mask the intended
refusal. Positive sparse cases assert the complete reply plus exact returned
positions and row versions; parsing must preserve order rather than sort or
renumber the response. No schema history inference is made from row versions.

## Frozen legacy assertion requiring later root cascade

Existing `pattern-instance.test.ts:357` test
`[P2-S12-AC-218] gives every row its own path and consecutive positions in forest order`
still expects `{ items: [row(0), { ...row(1), position: 2 }] }` to be refused
at `items.1.position` (`:363-368`). This is the obsolete universal-gap refusal
that will contradict the approved ordered-distinct public boundary after a
production correction. It is preserved byte-for-byte here, together with all
its duplicate-path, reverse-order and consecutive-positive assertions. Root
must explicitly claim and reconcile that narrow oracle cascade after actual
RED; this author has no old-test edit authority in the current pass.

## Static fingerprints and next gate

New test file: 227 lines, SHA-256
`356b4e26f9412bc29cd70822bb2b6259b1b5ef747cfa5c8f645f5bd52594b779`.
Frozen production `pattern-instance.ts`:
`fd545e8d2e0d5cac03020b3c0ffa48d23e285b9b21362018da9281d27fd7e63b`.
Frozen old `pattern-instance.test.ts`:
`6a9d61548ae9d8b384382b86247f21a4a44b78cabea56c3bbe1e43256afc61d5`.
Approved BE03c source:
`0960adbde1cbcb2ff3d6a6bb1608d9669bb4cc8f8bf57e3045d86c88b1c82181`.
The frozen-source/test hashes match this pass's pre-edit reads.

No runtime, tests, formatter, lint, type-check, build, git, network or SQL
commands were run by this author. No RED/GREEN, case-count, coverage,
acceptance or completion claim is made. Root next: run the new file and prove
attributable sparse-position RED with no setup failure before releasing a
minimal ordered-distinct guard correction and the separately claimed legacy
oracle cascade. Then validate both files and obtain native independent review.

## Native GREEN author continuation — ordered distinct reply positions

Status: bounded correction authored and statically read back; **UNRUN**.
Native `gpt-6.1-sol` / `ultra`, under the new three-path claim for
`pattern-instance.ts`, `pattern-instance.test.ts` and this owned report only.
The new placement-position test file remains frozen.

Root observed actual RED: 52 cases, 49 PASS, three valid sparse replies FAIL,
zero setup failures. Receipt:
`/tmp/wejammin-native-dec193-worker-red-YLjw7B/placement-contract-red.json`,
SHA-256 `7adfa98c3dff690a0aa346900d8ea5e49368b6580852645af25fc31c5e3be641`.
This is root's reported pre-correction evidence; the author has not run tests.

`checkPlacement` now compares each row's position with the previous row and
refuses `position <= previous.position`, reporting
`placement_positions_must_be_strictly_increasing` at the same row-position
path. Strict increase enforces both order and distinctness without renumbering
or sorting. The previous consecutive-offset predicate is removed. Common
revision/pattern/version/link pins, UUID/path/ID validation and uniqueness,
strict row/wrapper fields, required values and bounds are unchanged.

The explanatory response comment now states increasing positions with valid
gaps from retained retired paths; forest/history allocation remains a server
proof. No producer history is inferred from public rows or their row versions.
No public request, SQL, Web, OpenAPI or producer behavior is changed.

The one legacy test at original `pattern-instance.test.ts:357` now names
position order. Only its `[0,2]` gap refusal becomes a successful complete
round-trip assertion. Its duplicate-path refusal, reverse-order refusal and
later-start positive, and every other legacy callback/assertion, are unchanged.
This completes only the authorized oracle cascade identified above; it does
not remove position validation.

Static scope proof: reversing exactly the source guard/message/comment edits
recovers the pre-pass production SHA-256
`fd545e8d2e0d5cac03020b3c0ffa48d23e285b9b21362018da9281d27fd7e63b`.
Reversing exactly the legacy title and `[0,2]` assertion edits recovers
`6a9d61548ae9d8b384382b86247f21a4a44b78cabea56c3bbe1e43256afc61d5`.
These checks prove all other bytes in those files were preserved.

Author freeze fingerprints:

- Production: 198 lines, SHA-256 `93caccad084cf036dc60480e1171d808ec85832033044eec6b4c76e6e1995178`.
- Legacy tests: 378 lines, SHA-256 `67bb54b5c253393f68060da443f815eb7d70cd18c91362fabc17edb2eb5d8d4c`.
- Frozen new tests: 227 lines, unchanged SHA-256 `356b4e26f9412bc29cd70822bb2b6259b1b5ef747cfa5c8f645f5bd52594b779`.

No runtime, tests, formatter, lint, type-check, build, git, network or SQL
commands were run by this author. Root next: focused new/legacy contract GREEN
and native independent readback, with applicable type/lint/format gates.
All post-correction executable outcomes remain UNRUN here. No acceptance,
production database, delivery or slice-completion claim is made.
