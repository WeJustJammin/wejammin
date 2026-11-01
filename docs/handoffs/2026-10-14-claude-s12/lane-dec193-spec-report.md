# Lane report — `claude_s12_dec193_spec` (DEC-193 spec cascade)

## Status

DONE (spec and acceptance-criterion text only), 2026-10-15T17:16:06Z. No code, no DB, no tests, no box checked, AC-240 not
touched. Three owner questions and seven requests to root are listed below; where DEC-193 does not determine a detail the
spec applies the option judged most consistent with DEC-193 and BE03c, and each such choice is marked below.

## Scope

Owner-approved cascade of DEC-193 (`.memory/wiki/decisions.md`, "Linked pattern updates let the author decide every
structural change"). Sources read: DEC-193 and its neighbours; BE03c (route registry, validation and error matrices, Zod
contracts and resources, "Pattern versions and linked updates", canonical records, permissions, authorization matrix, data
flow, state machine, events, error coverage, testing, changelog); FE03 Slice 12 surfaces, states, interaction, form,
field-ownership, concurrency and testing rows; IA03 :262, :299, :493 and AC-CMS-12; contracts `pattern-update.ts`,
`pattern-instance.ts`, `pattern-node.ts`; held WIP SQL `supabase/migrations-wip/pattern-updates/*` (140100 expander, 140550
next row, 140600 apply), promoted placement `20261014110300`/`110250`, pattern storage `20261014020000`/`020100`/`020400`, the
table DDL `20260927290000`, the manifest `20261005017560`/`20261014130000`; `lane-pattern-updates-report.md`,
`review-pattern-updates.md`, `review-pattern-updates-f1.md` §4/§6; BE03b D5 comparison and DEC-141 restore text;
`.claude/rules/specificity-standards.md` and `decision-classification.md`.

Edited: BE03c, FE03, the Slice 12 tracker, the Phase 2 plan. IA03 read and NOT edited: IA03 :262, :493 and AC-CMS-12 already
require explicit accept or detach and "never overwrite silently"; DEC-193 refines behaviour inside that rule and names no
IA03 downstream.

## Acceptance-section hash

Tracker `.memory/pipeline/progress/slices/phase-02-slice-12.md`, `## Acceptance Criteria` to EOF:

| When (UTC) | Heading line | SHA-256 | Note |
| --- | --- | --- | --- |
| 2026-10-15T16:55:41Z (lane start) | 2043 | `9950eb5ddcd3df08516ed73a8c65a1acab9bfb794076dfc1f51eb38490820427` | before any edit of mine |
| 2026-10-15T17:15:04Z (immediately before my AC edits) | 2055 | `d44800a1d9b2ab3195797251ff1de954d98f9f65f8dc40da954600da3e5a2b76` | differs from lane start only through concurrent lanes (I had not edited this file) |
| 2026-10-15T17:15:05Z (after my AC edits) | 2055 | `6b639013b3249dee06111a432175180dc34c216a6e735068c6ecc2dc62756d12` | my 17 body edits |

AC-240 guard: the P2-S12-AC-240 line was asserted byte-identical before and after every AC edit (tracker line sha256
`6fe85e0b…`, phase-2 line `95d0a510…`, both unchanged). No `[x]` written (0 checked P2-S12 boxes before and after). The diff
of each file against its pre-edit copy touches exactly AC-028, 112, 113, 114, 117, 119, 120, 122, 123, 214, 215, 218, 243,
245, 247 and 258, and every edited body is identical in both files (compared with link prefixes normalized).

## Files

| File | Lines | SHA-256 before | SHA-256 after |
| --- | --- | --- | --- |
| `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` | 1836 | `d1923ec3685adf59209bac535f9dd893293dc6ccee0f63f09c8e758ebb780d0d` | `f8efabe60661f4a01a78f205c495a6b76a7f3e8051ce186728b8a373bdbace78` |
| `.memory/wiki/specs/fe/03-cms-content-modeling.md` | 2863 | `26cce1270b832758f9462dd501e53796049ab3db1095dd773fa11bc0c4d7f2c1` | `3c9491ec5be317d1db645c42c16bed688dcc4eedc9c2a4ecf0f3f51df7b250f6` |
| `.memory/pipeline/progress/slices/phase-02-slice-12.md` | 2341 | `8eea204a426c71ffaa8c5773b765edb4c6d768f318e50019664cb56b6353e056` | `4c49fb8aca7ac1b7b157192f80424648903293916f0b4aae6a782a29d23ffc92` |
| `.memory/wiki/specs/phases/phase-2.md` | 3853 | `18239bcc0e9193d2443a84589ebfb793e2f10a16e9c213f52684233d012a5a8d` | `7517af5186126809a2a091c6bf919c0de6d3a2e4e14ce409e399bde758b9f3ea` |
| `.memory/wiki/specs/ia/03-cms-content-modeling.md` | 620 | `7d8fecca251e965fbb229acc74e71374dd7eec47bc4aab7c81662be706b0402a` | unchanged |

"Before" is the hash read immediately before my first edit of that file. Every edit was an exact-substring replacement whose
old text was asserted to occur exactly once, applied with a fresh read and an immediate write (other lanes edit BE03c and the
tracker concurrently). The machine log of every old/new text is `<scratchpad>/claude_s12_dec193_spec/applied.jsonl`; every
edit is reproduced under `## Edits (before/after)` at the end of this report.

## Runs

None (spec lane: no DB, no tests, by brief).

## Test corrections

None.

## What the spec now says

1. **Node value and structural collisions.** A diff path's value is the node's `props` plus its block identity and `children`
   (the node paths of its child block nodes in order; a nested reference below the node contributes its expanded roots in
   place). `base`/`theirs` are typed node values (null for a node absent from that version); `yours` stays the override, which
   still replaces `props` whole. `collisionKind`: `removed_root`, then `structure` (block identity or children changed, with
   or without an override), then `props` (the existing rule). An added or removed node is listed once, at its own path.
2. **Removed root.** `theirs` appends a `retired` row; `yours` appends the detached local copy (the row `detach` writes). No
   row is ever left linked and pinned to a version lacking its root; the diff answers retired and detached rows with the
   no-update 200, so nothing is stranded.
3. **Added roots.** The diff lists `newRoots` with the instance's `slotPath`; accept never creates rows; CMS-03C-02 gains an
   optional `roots` to place only named roots; a path is occupied when its newest row is not `retired` (409); a path whose
   newest row is `retired` is free at its kept position (DEC-185).
4. **Detach.** Materializes the root's full subtree (nested references expanded, overrides applied) into the new
   `cms_composition_instances.detached_tree` (pre-order array of 1–512 `{ path, blockKey, blockVersion, props }`), with no
   key-count refusal; the render plan, restore and carry-over resolve it; `props` is `{}` and the pin is provenance only.
5. **Resources and rows.** Zod `PatternInstanceRequest.roots`, `CompositionDiffNodeValue`, `collisionKind`,
   `CompositionUpdateNewRoot`, `slotPath`, `newRoots`, comments on choices and on the placement and update resources;
   validation, error, authorization, registry, data-flow, state-machine, security, testing and changelog rows in BE03c;
   component, interaction, props, form, state, concurrency, field-list, testing and changelog rows in FE03; 16 ACs.

## Implementation-tier choices (DEC-193 does not determine these; each chosen for consistency, with reasons)

| # | Choice | Options considered | Why |
| --- | --- | --- | --- |
| C1 | Detached tree in a new nullable column `detached_tree jsonb` on `cms_composition_instances`: flat pre-order array of `{ path, blockKey, blockVersion, props }` (1–512), CHECK-tied to `link_mode = 'detached'`, `props = '{}'` and the row's root block identity | (a) nested `PatternNode` like `block_tree`; (b) reuse `props`; (c) a child table | (a) the expanded subtree can be deeper than the pattern depth 8 (nested references below the root expand in place), so a depth-8 forest check would refuse valid detaches; (b) `props` already means "overrides" for pattern rows and its 128-key / depth-8 column bound is exactly the refusal DEC-193 removes; (c) adds a sixteenth table and new RLS/grant inventory (AC-261 counts fifteen). The flat array uses the node-path addressing of overrides and diffs (DEC-175, DEC-186) and mirrors `block_tree` + `node_count` as a typed tree column. |
| C2 | Tree node `props` bound: at most 128 keys per object, arrays at most 128, depth 8 | the pattern bound only (64 keys) | An override value may hold up to 128 keys (the CMS-03C-02 `overrides` bound is `cms_json_bounded(…, 128, 128)`); the union bound refuses no valid instance. |
| C3 | An added or removed node is listed once at its own path, not its descendants | list every descendant | A removed root costs one path, so a large removed subtree cannot push the diff past 128 paths (`diff_too_large`) and strand the choice; the parent's `children` change carries the structure. |
| C4 | `collisionKind` precedence `removed_root` > `structure` > `props`, one per path | several kinds per path | `PatternUpdateChoice` is one choice per unique path. |
| C5 | `theirs` on a `structure` collision adopts block identity and children and keeps that path's override only when the target left its `props` unchanged | always drop the override | Matches the existing "a local override on a path the new version did not change is retained"; text overrides keep their rule. |
| C6 | The `retired` row and the detached copy keep the pin of the row they follow (provenance) | pin to the target (WIP); null pin | The target lacks the root (review F1 invariant); a null pin leaves the diff without `pinnedPatternVersion` and the WIP answers a non-pattern row 404, stranding it; BE03c restore already exempts detached rows from "pinned version active". |
| C7 | The diff answers every readable row that is not a linked `active`/`pending_diff` newest version with the no-update 200 | refuse | Brief: the diff must never strand such a row; matches the reviewed WIP fix (R4/F7). |
| C8 | Accept admits linked `active`/`pending_diff` newest versions; detach any linked newest version except `retired`; other rows 422 `COMPOSITION_VALIDATION_FAILED` at `/instances/{n}/instanceId` | a new reason token | Existing "choices/targets schema" 422 cell and the WIP behaviour; no new token, so AC-274's closed list is unchanged. See Q2 for the `retired` exclusion. |
| C9 | Added roots placed through an optional CMS-03C-02 `roots` subset; a path is occupied when its newest row is not `retired`; a retired path is free at its kept position | re-place the whole version (collides); skip occupied paths silently | DEC-193 requires the author can place them without colliding; a silent skip hides real collisions; a root a later version re-adds may meet a path an earlier accept retired, and DEC-185 makes a path's position immutable. |
| C10 | The diff carries `slotPath`, and `newRoots` carry `rootPath`, `blockKey`, `blockVersion` | let the front end infer the slot | CMS-03C-02 needs `slotPath`; the server derives it from the stored slot key, avoiding the WIP B1 path-split inference. |
| C11 | `bulkEligible` is true whenever the target is newer and nothing collides, even with `paths: []` | keep the contract's "changed paths" clause | BE03c :1387 admits bulk "only when none has a collision"; DEC-193 makes the version-only state (only `newRoots`, or nothing) reachable, and FE03 had no state for it (review-f1 §6.1). |

## Open questions for the owner

- **Q1. `yours` on a non-root structural collision.** DEC-193 says only that a removed root kept as `yours` becomes a detached
  local copy. The spec text extends that to every `structure` collision answered `yours`: the instance becomes the detached copy
  of its current content (exactly what `detach` writes) and its other choices change nothing. Alternative: a merged local tree
  (the target with the author's per-path choices applied, keeping the pinned structure only where `yours` was chosen), which
  needs a new merge rule. Recommendation: keep the spec text (it reuses two defined outcomes and invents no merge algorithm).
- **Q2. May detach ever revive a `retired` row?** (asked by review-pattern-updates-f1 §4.) Spec text: no; `detach` admits any
  linked row except a `retired` one, and the author's way to keep a removed root is `yours` at accept time. Alternative: honour
  AC-215's former literal "any linked instance" and let detach materialize a retired row from its kept pin (C6 makes that
  possible). Recommendation: keep the refusal (the removal was the author's explicit `theirs`).
- **Q3. Position of a root a later version re-adds at a path an earlier accept retired.** Spec text: the path is reused at its
  old position (DEC-185: a path's position never changes). Alternative: append at the slot end, which needs an exception to
  DEC-185. Recommendation: keep reuse.

## Requests to root (outside my file claim or outside DEC-193)

1. **BE03b D5 comparison hash.** The block side hash is the JCS of `{blockKey, blockVersion, blockRegistryDigest, mode,
   patternRef, props, bindings}` (BE03b "Revision comparison domains (D5)"). Detached content now lives in `detached_tree`, so
   two revisions that differ only in it would compare equal; BE03b needs `detachedTree` in the side hash (not my file).
2. **Publication gate versus detached rows (pre-existing; DEC-193 makes it reachable for every removed-root `yours`).** The 03b
   manifest `patterns` group takes the pin of every `draft`/`active`/`pending_diff` row regardless of link mode
   (`20261005017560` :233-236 with `20261014130000`), and `cms.pattern.active_digest` (BE03c "Preflight providers registered by
   Slice 12") requires each to be `active`. A detached row pinned to a superseded version (a CMS-03C-02 detached placement after
   a newer activation, a `detach` of a `pending_diff` instance, a DEC-193 detached copy) therefore fails publication
   `pattern_not_active`, and a detached tree's child blocks are absent from the manifest `blocks` group (only the row's
   `block_key` is there). Needs a ruling (for example: a detached row's pin is provenance and leaves the `patterns` group, and
   its tree's blocks join the `blocks` group). Not changed by this lane.
3. **Contracts (DEC-193 downstream).** `pattern-update.ts`: `CompositionDiffNodeValue`, typed `base`/`theirs`, `collisionKind`
   (and its refinement against `collision`), `CompositionUpdateNewRoot`, `slotPath`, `newRoots`, and the `bulkEligible` refine
   (drop the `paths.length === 0` clause). `pattern-instance.ts`: `roots` on the request, and the `checkPlacement`
   consecutive-positions refine (a row on a freed retired path keeps its position).
4. **Held WIP SQL (`20261014140000`-`140610`) and the promoted placement.** D-RETIRE pins the retired row to the target and
   keeps a `yours` root linked (now: keep the prior pin; `yours` writes the detached copy); D-DETACH writes a chain-to-props
   map into `props` (now: `detached_tree`, a new forward migration with its CHECK); D-VALUE compares `props` only (now: block
   identity and children, `collisionKind`); B2 (now: `newRoots`, `slotPath`); the promoted `cms_insert_pattern_instance`
   (`20261014110300` :172-182) refuses any row at a path in any state (now: `roots`, and a retired newest row frees the path),
   which needs a forward migration. The render plan, restore and carry-over producers must read/copy `detached_tree`.
5. **FE03 :1113 pre-existing mismatch (not DEC-193; untouched).** The interaction row lists `pattern_version_not_active` among
   CMS-03C-15's 409s; BE03c makes it 422.
6. **Worker transport.** New members only; no new reason token or status (C8). The 422 at `/roots/{n}` is a new pointer.
7. **Memory.** No memory record written by this lane (brief: spec/AC files only). Candidate pattern for root: a reused bounded
   column (here `props`, 128 keys / depth 8) silently becomes a product refusal when a new kind of content is stored in it.

## Spec citations

DEC-193 (decisions.md :5302); DEC-175, DEC-181, DEC-185, DEC-186 (row, path, position and key-chain rules); BE03c route
registry CMS-03C-02/14/15; validation matrix CMS-03C-02/14/15; Zod `PatternInstanceRequest`, `PatternNodePath`,
`BoundedPatternOverrides`, `CompositionInstanceResource`, `PatternPlacementResource`, the diff and update resources; error
matrix; "Pattern versions and linked updates" (CMS-03C-02 and linked-update paragraphs); "Receiving obligations from Slice 10
(DEC-141)" items 2 and 4; canonical records CompositionInstance row; authorization matrix CMS-03C-14/15; security controls; data
flow; state machine; testing. FE03 Slice 12 surfaces table, Slice 12 definition governance states, Interaction Specification,
Complete component contracts, Form-by-source completeness, contract field list, Navigation/Degradation/Concurrency, Testing
Obligations. IA03 :262, :493, AC-CMS-12. review-pattern-updates.md #1, #2, #3, #5, F1, F3, F4; review-pattern-updates-f1.md
§4, §6.

## Edits (before/after)

Every edit below was applied once per file; the AC edits were applied identically to the tracker and the Phase 2 plan.

#### BE03c B1 decision status — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
remains to be proven by a maximum-size success, and an over-budget refusal exists only at the Worker transport and route); the owner may override the orchestrator items.
````

After:

````text
remains to be proven by a maximum-size success, and an over-budget refusal exists only at the Worker transport and route); the owner may override the orchestrator items. The Slice 12 linked-update cascade (2026-10-15) applies the owner decision DEC-193: a linked pattern update lets the author decide every structural change. The value of a node path for diff purposes is its `props` plus its block identity and `children`; a change of block identity or children is a `structure` collision; a block root the target version removes is a `removed_root` collision that `theirs` retires and `yours` keeps as a detached local copy; the block roots a target version adds are listed as new and placed only by the author, through CMS-03C-02 `roots`; and detach stores the full subtree as a detached local block tree bounded by the 512-node pattern limit, with no key-count refusal. Text overrides keep the existing rule: an override replaces the node's `props`.
````

#### BE03c B2 registry CMS-03C-02 request — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
| PatternInstanceRequest → 201 PatternPlacementResource (one or more rows, at most 512 after expansion, DEC-175, DEC-181;
````

After:

````text
| PatternInstanceRequest (an optional `roots` names the block roots to place, DEC-193) → 201 PatternPlacementResource (one or more rows, at most 512 after expansion, DEC-175, DEC-181;
````

#### BE03c B3 registry CMS-03C-02 positions — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
one row per block root after expansion, all-or-nothing, at consecutive positions appended after the slot's greatest in forest order (DEC-175, DEC-181, DEC-185); server recomputes pattern digest
````

After:

````text
one row per block root after expansion (per root that `roots` names, when present, DEC-193), all-or-nothing, at consecutive positions appended after the slot's greatest in forest order (DEC-175, DEC-181, DEC-185; a row placed on a path whose newest row is `retired` keeps that path's position, DEC-193); server recomputes pattern digest
````

#### BE03c B4 registry CMS-03C-14 — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
strong ETag `"{instance.version}"`; bounded base/theirs/yours values |
````

After:

````text
strong ETag `"{instance.version}"`; bounded base/theirs node values (props, block identity and children), yours overrides, collision kinds and the target's new roots (DEC-193) |
````

#### BE03c B5 validation CMS-03C-02 roots row — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
| CMS-03C-02            | graph/blockRegistryDigest         |
````

After:

````text
| CMS-03C-02            | roots                             | optional; 1–512 unique normalized key chains (`/{nodeKey}(/{nodeKey})*`, at most 512 characters), each the key chain of a block root of the pinned forest after top-level nested pattern references are expanded (the chain its row `path` uses, DEC-181, DEC-186), else 422 at `/roots/{n}`; when present only the named roots are placed, in forest order, and an `overrides` key under no named root is 422 at `/overrides`; absent, every block root is placed (DEC-193) | 422                           |
| CMS-03C-02            | graph/blockRegistryDigest         |
````

#### BE03c B6 validation CMS-03C-14 — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
| CMS-03C-14            | instanceId | UUID path; strict: no query key; a diff over 128 changed paths or 256 KiB is 422 `diff_too_large` |
````

After:

````text
| CMS-03C-14            | instanceId | UUID path; strict: no query key; a diff over 128 changed paths or 256 KiB is 422 `diff_too_large`; a readable row that is not a linked `active` or `pending_diff` row and the newest version of its path (a detached row, a detached copy, a `retired` row, an older version) answers the no-update diff, never a refusal (DEC-193) |
````

#### BE03c B7 validation CMS-03C-15 — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
`choices` only for a single-instance request and covering every colliding path with `yours` or `theirs`; a bulk request containing a colliding instance is 409 `diff_has_collisions`;
````

After:

````text
`choices` only for a single-instance request and covering every colliding path (a `props`, `structure` or `removed_root` collision, DEC-193) with `yours` or `theirs`; a bulk request containing a colliding instance is 409 `diff_has_collisions`; each instance is the newest version of its path and a linked `active` or `pending_diff` row (accept) or a linked row that is not `retired` (detach), else 422 `COMPOSITION_VALIDATION_FAILED` at `/instances/{n}/instanceId` (DEC-193);
````

#### BE03c B8 zod PatternInstanceRequest roots — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
  overrides: PatternPlacementOverrides,
  blockRegistryDigest: Hash.optional(),
  expectedVersion: Version,
});
````

After:

````text
  overrides: PatternPlacementOverrides,
  // DEC-193: when present, only these block roots of the pinned forest are
  // placed, each named by the key chain its row `path` uses after top-level
  // nested pattern references are expanded (DEC-181, DEC-186), for example the
  // `newRoots` of a linked-update diff; unique, each naming a block root (else
  // 422 at `/roots/{n}`), and every `overrides` key lies under one of them
  // (else 422 at `/overrides`). Absent: every block root is placed.
  roots: z
    .array(PatternNodePath)
    .min(1)
    .max(512)
    .refine((value) => new Set(value).size === value.length, 'roots must be unique')
    .optional(),
  blockRegistryDigest: Hash.optional(),
  expectedVersion: Version,
});
````

#### BE03c B9 zod PatternUpdateChoice — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
  // `yours` keeps the local override, `theirs` takes the new pattern value.
  choice: z.enum(['yours', 'theirs']),
````

After:

````text
  // `theirs` takes the target value. `yours` keeps the local override on a
  // `props` collision and, on a `structure` or `removed_root` collision, keeps
  // the author's structure as a detached local copy (DEC-193).
  choice: z.enum(['yours', 'theirs']),
````

#### BE03c B10 zod CompositionInstanceResource — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
  blockRegistryDigest: Hash,
  linkMode: z.enum(['linked', 'detached']),
  conflictState: z.enum(['none', 'pending_diff']).nullable(),
````

After:

````text
  blockRegistryDigest: Hash,
  // DEC-193: a row that carries a detached local block tree (written by
  // `detach`, or by an accept that kept `yours` on a `structure` or
  // `removed_root` collision) is `detached`, its block identity is the tree
  // root's and its `patternId`/`patternVersion` are the provenance of the row
  // it follows, never read to render it.
  linkMode: z.enum(['linked', 'detached']),
  conflictState: z.enum(['none', 'pending_diff']).nullable(),
````

#### BE03c B11 zod PatternPlacementResource — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
// CompositionUpdateResource is a list for CMS-03C-15. The list is in `position`
// order, the forest order of the block roots (DEC-185).
````

After:

````text
// CompositionUpdateResource is a list for CMS-03C-15. The list is in `position`
// order, the forest order of the block roots (DEC-185). With `roots` (DEC-193)
// it holds the named roots only, and a row placed on a path whose newest row is
// `retired` keeps that path's position instead of taking the next one.
````

#### BE03c B12 zod diff resource — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
const CompositionUpdateDiffPath = z.strictObject({
  path: z.string().max(512),
  // The pinned pattern value, the new active pattern value, and the local
  // override; each bounded, schema-typed and omitted (null) when absent.
  base: Json.nullable(),
  theirs: Json.nullable(),
  yours: Json.nullable(),
  collision: z.boolean(),
});
// `paths` is bounded to 128 entries and 256 KiB; an instance with more
// changed paths is refused 422 `COMPOSITION_VALIDATION_FAILED`
// `diff_too_large`.
const CompositionUpdateDiffResource = z.strictObject({
  instance: z.strictObject({
    id: UUID,
    version: Version,
    revisionId: UUID,
    path: z.string().max(512),
    state: CompositionInstanceState,
    linkMode: z.enum(['linked', 'detached']),
    pinnedPatternVersion: z.number().int().positive(),
  }),
  targetPatternVersion: z.number().int().positive(),
  paths: z.array(CompositionUpdateDiffPath).max(128),
  collisionCount: z.number().int().min(0).max(128),
  bulkEligible: z.boolean(),
});
const CompositionUpdateResource = z.strictObject({
````

After:

````text
// DEC-193: the value of a node path for diff purposes, the node's `props` (an
// override replaces them whole) plus its structure: its block identity and its
// `children`, the node paths of its child block nodes in order (a nested
// pattern reference below the node contributes, in place, the block roots it
// expands to, its key leading their chains, DEC-186).
const CompositionDiffNodeValue = z.strictObject({
  blockKey: BlockKey,
  blockVersion: z.number().int().positive().max(2147483647),
  props: BoundedPatternOverrides,
  children: z.array(PatternNodePath).max(512),
});
const CompositionUpdateDiffPath = z.strictObject({
  path: z.string().max(512),
  // The pinned value (null for a node new in the target version), the target
  // value (null for a node the target removed) and the local override, which
  // replaces the node's `props` (null when absent); each bounded and
  // schema-typed.
  base: CompositionDiffNodeValue.nullable(),
  theirs: CompositionDiffNodeValue.nullable(),
  yours: Json.nullable(),
  collision: z.boolean(),
  // DEC-193: exactly one kind per colliding path, null exactly when
  // `collision` is false: `removed_root` (the target removed this instance's
  // block root), `structure` (the target changed the node's block identity or
  // `children`; a collision with or without an override) or `props` (the
  // override differs from the base `props` and the target changed them).
  collisionKind: z.enum(['removed_root', 'structure', 'props']).nullable(),
});
// DEC-193: a block root of the target forest, after top-level nested pattern
// references are expanded (DEC-181), whose key chain the pinned forest lacks;
// accept never creates a row for it, the author places it through CMS-03C-02
// with `roots`.
const CompositionUpdateNewRoot = z.strictObject({
  rootPath: PatternNodePath,
  blockKey: BlockKey,
  blockVersion: z.number().int().positive().max(2147483647),
});
// `paths` is bounded to 128 entries and the whole resource to 256 KiB; an
// instance with more changed paths is refused 422
// `COMPOSITION_VALIDATION_FAILED` `diff_too_large`. An instance with no newer
// `active` compatible version, and every readable row that is not a linked
// `active` or `pending_diff` row and the newest version of its path, answers
// `paths: []`, `newRoots: []`, `collisionCount` 0, `bulkEligible` false and
// `targetPatternVersion` equal to `pinnedPatternVersion`. Otherwise
// `bulkEligible` is true exactly when `collisionCount` is 0, including a
// target that changes none of the instance's paths (DEC-193).
const CompositionUpdateDiffResource = z.strictObject({
  instance: z.strictObject({
    id: UUID,
    version: Version,
    revisionId: UUID,
    path: z.string().max(512),
    state: CompositionInstanceState,
    linkMode: z.enum(['linked', 'detached']),
    pinnedPatternVersion: z.number().int().positive(),
  }),
  // DEC-193: the `slotPath` of the instance's placement (its `path` less its
  // block root's key chain), the slot where CMS-03C-02 `roots` places
  // `newRoots`.
  slotPath: z
    .string()
    .min(1)
    .max(512)
    .regex(/^\/[^\u0000-\u001f]*$/),
  targetPatternVersion: z.number().int().positive(),
  paths: z.array(CompositionUpdateDiffPath).max(128),
  newRoots: z.array(CompositionUpdateNewRoot).max(512),
  collisionCount: z.number().int().min(0).max(128),
  bulkEligible: z.boolean(),
});
// One appended row per listed instance (DEC-193): `active` and linked, pinned
// to the target; `retired`, for a removed root answered `theirs`; or `active`
// and detached, carrying the detached local block tree, for `detach` and for a
// `structure` or `removed_root` collision answered `yours`.
const CompositionUpdateResource = z.strictObject({
````

#### BE03c B13 error matrix CMS-03C-02 — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
| graph/props schema, row path over 248 octets, pattern_version_not_active, pattern_incompatible, nested_pattern_not_active |
````

After:

````text
| graph/props schema, row path over 248 octets, `roots` naming no block root or an override under no named root (DEC-193), pattern_version_not_active, pattern_incompatible, nested_pattern_not_active |
````

#### BE03c B14 error matrix CMS-03C-15 — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
| choices/targets schema, pattern_version_not_active, pattern_incompatible, nested_pattern_not_active | composition limit |
````

After:

````text
| choices/targets schema, an instance in no admitted state (a `retired`, detached or older row, DEC-193), pattern_version_not_active, pattern_incompatible, nested_pattern_not_active | composition limit |
````

#### BE03c B15 placing selected roots paragraph — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
**Linked update (diff, accept, detach).**
````

After:

````text
**Placing selected roots (DEC-193).** `roots`, when present, names 1–512 unique block roots of the pinned forest by their key chains, the chains the row `path`s use after top-level nested pattern references are expanded (DEC-181, DEC-186); only those roots are placed, in forest order, and an `overrides` key under no named root is 422 at `/overrides`; a chain that is not the key chain of a block root of the pinned forest is 422 `COMPOSITION_VALIDATION_FAILED` at `/roots/{n}`. Without `roots` every block root is placed, as above. This is how the author places the block roots a newer pattern version adds (the `newRoots` of a CMS-03C-14 diff): the diff's `slotPath`, the target version as `patternVersion` and `roots` naming them. A new root's key chain differs from the chain of every block root the earlier placement wrote (the version those rows were placed from lacks it), so its path is none of those rows' paths. A row path is occupied when the revision holds a row at that path whose newest version is not `retired`; a placement that would write an occupied path is 409 `COMPOSITION_VERSION_CONFLICT` (slot collision) and writes nothing. A path whose newest row is `retired` (a block root that an accepted linked update removed) is free: the placed row is that path's next `version` and keeps that path's `position`, because a position is immutable per path (DEC-185), while the rows placed on new paths take consecutive positions, in forest order, from one above the slot's greatest `position`.

**Linked update (diff, accept, detach).**
````

#### BE03c B16 linked update diff definition — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
CMS-03C-14 returns the three-way diff: for each node path the pinned value (`base`), the new active value (`theirs`) and the local override (`yours`), bounded to 128 paths and 256 KiB; a path is a **collision** when the override differs from the base and the new version also changed the path.
````

After:

````text
CMS-03C-14 returns the three-way diff of the instance's block root between its pinned version and the target (the newest `active` compatible version): for each node path of the root's subtree, nested pattern references expanded in place with their keys leading the chain (DEC-181, DEC-186), the pinned value (`base`), the target value (`theirs`) and the local override (`yours`), bounded to 128 paths and 256 KiB. **Node value (DEC-193).** The value of a node path is the node's `props` plus its structure: its block identity (`blockKey`, `blockVersion`) and its `children`, the node paths of its child block nodes in order (a nested pattern reference below the node contributes, in place, the block roots it expands to). `base` is null for a node new in the target and `theirs` is null for a node the target removed; `yours` stays the override, which replaces the node's `props` whole and never changes its structure. A path is listed when the target changed its value; a node the target adds or removes is listed once, at its own path, and its descendants are not listed separately (its parent's `children` change carries them). A listed path is a **collision** of exactly one `collisionKind`, the first that applies: `removed_root` when it is the instance's own block root and the target removed it; `structure` when the target changed the node's block identity or `children`, with or without an override, because a structural change is never adopted silently; `props` when the override differs from the base `props` and the target also changed them. Any other listed path is not a collision. The diff also lists `newRoots`, the block roots of the target forest after top-level expansion whose key chain the pinned forest lacks, with the instance's `slotPath`; they belong to no instance, so accept never creates a row for one, and the author places them through CMS-03C-02 `roots` (`Placing selected roots`, above).
````

#### BE03c B17 linked update no-update answer — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
When the instance has no newer `active` compatible pattern version, CMS-03C-14 answers 200 with `paths: []`, `collisionCount` 0, `bulkEligible` false and `targetPatternVersion` equal to `pinnedPatternVersion` (DEC-180, G4); that is not an error and changes nothing, and the front end renders its `no-update` state.
````

After:

````text
When the instance has no newer `active` compatible pattern version, CMS-03C-14 answers 200 with `paths: []`, `newRoots: []`, `collisionCount` 0, `bulkEligible` false and `targetPatternVersion` equal to `pinnedPatternVersion` (DEC-180, G4); that is not an error and changes nothing, and the front end renders its `no-update` state. The same no-update answer is given for every readable row that is not a linked `active` or `pending_diff` row and the newest version of its path (a detached row, a detached copy, a `retired` row, an older version), so the diff never refuses a row it can read (DEC-193). A target that changes none of the instance's paths still offers its newer pin and its `newRoots`: `paths` is empty, `targetPatternVersion` is above `pinnedPatternVersion` and `bulkEligible` is true.
````

#### BE03c B18 linked update accept and detach — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
CMS-03C-15 `accept` adopts the new version for each listed instance: a path changed only by the new version adopts it, a local override on a path the new version did not change is retained, and every collision requires an explicit `yours` or `theirs` choice (a missing choice is 422); it appends an `active` row pinned to the target version. `detach` appends a `detached` row that materializes the instance's current effective content (pinned tree plus overrides) as local props and stops receiving updates.
````

After:

````text
CMS-03C-15 `accept` adopts the target version for each listed instance: a listed path that is not a collision adopts the target value (an override equal to the base is dropped with it), a local override on a path the target did not change is retained, and every collision requires an explicit `yours` or `theirs` choice (a missing choice is 422). On a `props` collision `theirs` takes the target `props` and drops the override, and `yours` keeps the override. On a `structure` collision `theirs` adopts the target's block identity and `children` at that path (an added child with its target subtree, a removed child gone with every override at or below it) and keeps that path's override only when the target left its `props` unchanged. When the target keeps the instance's block root and every `structure` collision is answered `theirs`, accept appends an `active` linked row pinned to the target version, whose kept overrides each name a node of the target tree (DEC-193). On a `removed_root` collision `theirs` retires the instance: accept appends a `retired` row, which the render plan excludes, which CMS-03C-14 answers with the no-update diff and which neither accept nor detach admits. `yours` on a `structure` or `removed_root` collision keeps the author's structure, which no linked row pinned to the target can hold (an override replaces `props` only), so accept appends the instance's detached local copy instead, exactly the row `detach` appends, and the instance's other choices change nothing (DEC-193). No row is ever left linked and pinned to a version whose forest lacks its block root: the `retired` row and the detached copy keep the `(pattern_id, pattern_version)` of the row they follow, whose forest has that root. `detach` appends a `detached` row that materializes the instance's current effective content, the full subtree of its block root in its pinned version with nested pattern references expanded in place and every override applied (an override replaces its node's `props`), as a **detached local block tree** in the row's `detached_tree` (`Canonical records and fields`), and the row stops receiving updates (DEC-193). The tree is bounded by the pattern node limit the pinned version already satisfies (at most 512 nodes, each node's `props` within the pattern and `overrides` bounds), so detach has no key-count refusal; the row's `props` is `{}`, its `block_key` and `block_version` are the tree root's, its `block_registry_digest` is recomputed over the tree's reachable blocks, and its `(pattern_id, pattern_version)` is the provenance of the row it follows, never read to render it. Reads resolve a detached tree: the render plan reads a row that carries `detached_tree` as that tree at the row's `path` (the root block at the row `path`, its descendants from the tree), never from its pin or its overrides; CMS-03C-14 answers it with the no-update diff; restore and the revision-append carry-over copy it unchanged (`Receiving obligations from Slice 10 (DEC-141)`). `accept` admits a linked `active` or `pending_diff` row and `detach` any linked row except a `retired` one, each the newest version of its path; any other named row is 422 `COMPOSITION_VALIDATION_FAILED` at `/instances/{n}/instanceId`.
````

#### BE03c B19 table CompositionInstance fields — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
at most 248 octets; DEC-186); child nodes are never rows. |
````

After:

````text
at most 248 octets; DEC-186); child nodes are never rows. DEC-193: detached_tree jsonb NULL, the detached local block tree of a row that `detach` appends or that an accept appends for a `structure` or `removed_root` collision answered `yours`: CHECK a JSON array of 1–512 node objects in tree pre-order (a node before its descendants, siblings in order), each exactly `{ path, blockKey, blockVersion, props }` with `path` a normalized node path `^/[a-z][a-z0-9_-]{0,63}(/[a-z][a-z0-9_-]{0,63})*$` of at most 512 characters and unique in the tree, the first node's `path` the row's block-root key chain and every other node's `path` that chain followed by one or more segments, `blockKey` the canonical BlockKey, `blockVersion` 1–2147483647 and `props` a JSON object of at most 128 keys per object, arrays of at most 128 elements and depth 8 (the larger of the pattern `props` and the `overrides` value bounds, so no valid instance is refused); CHECK (detached_tree IS NULL OR (link_mode = 'detached' AND props = '{}' AND the first node's `blockKey` and `blockVersion` equal `block_key` and `block_version`)); one pure immutable validator is shared by the CHECK and the producers, as for `block_tree`. |
````

#### BE03c B20 table CompositionInstance write rules — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
copies the position of the row it follows, and the `position` of a `path` never changes (DEC-185). |
````

After:

````text
copies the position of the row it follows, and the `position` of a `path` never changes (DEC-185). DEC-193: a row placed on a path whose newest row is `retired` is that path's next version and keeps its position, and a path whose newest row is not `retired` is occupied (409); accept appends a `retired` row for a removed root answered `theirs` and a `detached_tree` row for a `structure` or `removed_root` collision answered `yours`, both keeping the pin of the row they follow, and never a linked row pinned to a version whose forest lacks the row's block root; restore and the carry-over copy `detached_tree` unchanged. |
````

#### BE03c B21 receiving obligation restore — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
each instance keeps its path, `position` (DEC-185) and link mode and is re-pinned to the current registry, so a pinned block version that is `withdrawn` fails the restore 409 `migration_chain_incomplete`,
````

After:

````text
each instance keeps its path, `position` (DEC-185), link mode and detached local block tree (DEC-193) and is re-pinned to the current registry, so a pinned block version, or a block of a detached tree, that is `withdrawn` fails the restore 409 `migration_chain_incomplete`,
````

#### BE03c B22 receiving obligation carry-over — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
(provenance `carried_from_id`, each copying its source row's `position` unchanged, DEC-185)
````

After:

````text
(provenance `carried_from_id`, each copying its source row's `position` unchanged, DEC-185, and its `detached_tree`, DEC-193)
````

#### BE03c B23 auth matrix CMS-03C-14 — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
instance readable (no newer active compatible version answers 200 with an empty diff, DEC-180 G4)
````

After:

````text
instance readable (no newer active compatible version, and a row that is not a linked `active` or `pending_diff` newest version, answers 200 with an empty diff, DEC-180 G4, DEC-193)
````

#### BE03c B24 auth matrix CMS-03C-15 — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
| instance `pending_diff` or `active` linked (accept) or any linked (detach); entry and instance versions current | visible instance, no edit | hidden/absent instance | explicit choice for every collision; bulk only without collisions |
````

After:

````text
| each instance the newest version of its path: `pending_diff` or `active` linked (accept) or any linked except `retired` (detach, DEC-193); entry and instance versions current | visible instance, no edit | hidden/absent instance | explicit choice for every collision (`props`, `structure`, `removed_root`; DEC-193); bulk only without collisions |
````

#### BE03c B25 security controls — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
Linked pattern changes show a three-way diff; no silent local overwrite.
````

After:

````text
Linked pattern changes show a three-way diff; no silent local overwrite and no silent structural adoption: a block identity or children change, a removed block root and the block roots a version adds each wait for the author (DEC-193).
````

#### BE03c B26 data flow CMS-03C-02 — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
insert one append-only CompositionInstance row per block root of the pinned forest after expanding top-level nested pattern references (at most 512, all-or-nothing, DEC-175, DEC-181) at consecutive `position`s after the slot's greatest in forest order (DEC-185)
````

After:

````text
insert one append-only CompositionInstance row per block root of the pinned forest after expanding top-level nested pattern references, or per root that `roots` names (at most 512, all-or-nothing, DEC-175, DEC-181, DEC-193) at consecutive `position`s after the slot's greatest in forest order (DEC-185; a row placed on a path whose newest row is `retired` keeps that path's position, DEC-193)
````

#### BE03c B27 state machine composition — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
- CompositionInstance: linked/detached instance changes append a new version; linked update collision is pending_diff until explicit accept/detach.
````

After:

````text
- CompositionInstance: linked/detached instance changes append a new version; linked update collision is pending_diff until explicit accept/detach; an accept appends a `retired` row for a removed block root answered `theirs` and a detached copy for a `structure` or `removed_root` collision answered `yours` (DEC-193).
````

#### BE03c B28 state machine scan — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
until an explicit accept (active, newer pin) or detach (detached).
````

After:

````text
until an explicit accept (active with a newer pin, `retired` for a removed block root, or a detached copy, DEC-193) or detach (detached).
````

#### BE03c B29 testing — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
and `detach` (materialized props, no further updates), and the invalidation of the revision's live review by every composition write.
````

After:

````text
and `detach` (the materialized detached local block tree, no further updates), and the invalidation of the revision's live review by every composition write. DEC-193 adds: the node value of a diff path (`props`, block identity, `children`) with `base` null for an added node and `theirs` null for a removed one, each added or removed node listed once; a `structure` collision for a block-identity change and for a `children` change, with and without an override; a `removed_root` collision; `newRoots` and `slotPath`; a target that changes no path answering `bulkEligible` true; `accept` with `theirs` and `yours` on each collision kind (a `retired` row for a removed root, a detached copy for a structural or removed-root `yours`, no linked row ever pinned to a version lacking its block root, every kept override naming a node of the target tree); `detach` of a block root with more than 128 nodes and nested references below it (the full tree stored, no key-count refusal) and the 512-node bound; the render plan reading a detached tree; restore and carry-over copying it; a `retired`, detached or older row answered by the no-update diff and refused by accept and detach at `/instances/{n}/instanceId`; and CMS-03C-02 `roots` placing only the named roots, a chain that names no block root refused at `/roots/{n}`, an override under an unnamed root refused at `/overrides`, an occupied path refused 409 and a path whose newest row is `retired` reused at its position.
````

#### BE03c B30 changelog — .memory/wiki/specs/be/03c-composition-taxonomy-localization.md

Before:

````text
## Dependency References
````

After:

````text
| 2026-10-15 | Slice 12 linked-update cascade (owner decision DEC-193, 2026-10-15; review-pattern-updates.md and review-pattern-updates-f1.md §6: D-VALUE, D-RETIRE, B2, D-DETACH). A diff node value is `props` plus block identity and `children`; `CompositionUpdateDiffPath` gains typed `base`/`theirs` node values and `collisionKind` (`removed_root`, `structure`, `props`), and `CompositionUpdateDiffResource` gains `slotPath` and `newRoots`. A structural change and a removed block root are collisions the author resolves: `theirs` on a removed root appends a `retired` row, `yours` on a structural or removed-root collision appends the detached copy that `detach` writes, and no linked row is ever pinned to a version lacking its block root. `detach` stores the full subtree in the new `cms_composition_instances.detached_tree` (1–512 pre-order nodes, no key-count refusal), which the render plan, restore and the carry-over resolve. A row that is not a linked `active`/`pending_diff` newest version answers the no-update diff; accept admits linked `active`/`pending_diff` rows and detach any linked row except a `retired` one. A target that changes no path of an instance is bulk-eligible. CMS-03C-02 gains `roots` to place the block roots a version adds, and a path whose newest row is `retired` is free at its kept position. Text overrides keep replacing the node's `props`. | /propagate-decision | Decision status, route registry, route field validation matrix, Zod contracts and resources, error matrix, pattern versions and linked updates, canonical records and fields, receiving obligations, authorization matrix, security controls, data flow, state machine, testing, changelog |

## Dependency References
````

#### FE03 F1a component row diff UI — .memory/wiki/specs/fe/03-cms-content-modeling.md

Before:

````text
the diff renders `base`, `theirs` and `yours` per path as a three-way list with colliding paths marked and a radio pair (keep my override, take the new value) per collision;
````

After:

````text
the diff renders `base`, `theirs` and `yours` per path as a three-way list (each node value as its props, its block and its sub-blocks, DEC-193) with colliding paths marked by `collisionKind` and a radio pair per collision, never preselected: `props` "Text changed in the pattern" (keep my override, take the new value), `structure` "The pattern changed this block's type or its sub-blocks" (keep mine, which makes the block a local copy that no longer receives updates, or take the new structure) and `removed_root` "The pattern no longer has this block" (keep it as a local copy that no longer receives updates, or remove it from the entry); a "New in this version" list shows the diff's `newRoots` (block and key chain) and states that accepting the update never adds them, with a _Place_ command that sends `PatternInstanceRequest` (CMS-03C-02) with the instance's `revisionId`, `patternId` and `linkMode`, the diff's `targetPatternVersion` and `slotPath`, `roots` naming the chosen new roots, empty `overrides` and the entry `version` (DEC-193);
````

#### FE03 F1b component row accept outcomes — .memory/wiki/specs/fe/03-cms-content-modeling.md

Before:

````text
`diff_has_collisions` and `revision_not_editable` refetch and keep choices
````

After:

````text
`diff_has_collisions` and `revision_not_editable` refetch and keep choices; an accept result names each instance's outcome: the new pin, "Removed from the entry" for a `retired` row, or "Local copy" for a detached row (DEC-193)
````

#### FE03 F1c component row accessibility — .memory/wiki/specs/fe/03-cms-content-modeling.md

Before:

````text
Per-path radio groups with three labelled values; an unanswered update visibly leaves the instance on its pinned version; no automatic acceptance
````

After:

````text
Per-path radio groups with three labelled values; an unanswered update visibly leaves the instance on its pinned version; no automatic acceptance; each collision's group names its kind and, before the command, the consequence of keeping mine (a local copy with no further updates); the new-in-this-version list is a labelled list whose count is announced politely (DEC-193)
````

#### FE03 F2a interaction row choices — .memory/wiki/specs/fe/03-cms-content-modeling.md

Before:

````text
`CompositionUpdateRequest` with a choice for every collision, the entry `version` as `If-Match`
````

After:

````text
`CompositionUpdateRequest` with a choice for every collision (`props`, `structure` and `removed_root`; keeping mine on a `structure` or `removed_root` collision makes the block a local copy, DEC-193), the entry `version` as `If-Match`
````

#### FE03 F2b interaction row outcome — .memory/wiki/specs/fe/03-cms-content-modeling.md

Before:

````text
announce the new pin or the detach
````

After:

````text
announce the new pin, the detach, the local copy or the removal (DEC-193); a block new in the version is placed only through the CMS-03C-02 _Place_ command
````

#### FE03 F3 props row — .memory/wiki/specs/fe/03-cms-content-modeling.md

Before:

````text
`{ instances, diff: CompositionUpdateDiffResource, choices, onAccept, onDetach }`
````

After:

````text
`{ instances, diff: CompositionUpdateDiffResource, choices, onAccept, onDetach, onPlaceNewRoots }`
````

#### FE03 F4 form row CMS-03C-02 — .memory/wiki/specs/fe/03-cms-content-modeling.md

Before:

````text
led by the reference's key inside an expanded root, DEC-186), optional `blockRegistryDigest`, `expectedVersion`
````

After:

````text
led by the reference's key inside an expanded root, DEC-186), optional `roots` (1–512 unique key chains of the block roots to place, DEC-193), optional `blockRegistryDigest`, `expectedVersion`
````

#### FE03 F5 form row CMS-03C-15 — .memory/wiki/specs/fe/03-cms-content-modeling.md

Before:

````text
`choices` only for a single instance and covering every collision
````

After:

````text
`choices` only for a single instance and covering every collision (`props`, `structure` and `removed_root`, DEC-193)
````

#### FE03 F6 diffState success — .memory/wiki/specs/fe/03-cms-content-modeling.md

Before:

````text
`200 CompositionUpdateDiffResource` with `paths` and `collisionCount`
````

After:

````text
`200 CompositionUpdateDiffResource` with `paths`, `collisionCount` and `newRoots`; a newer version that changes none of the instance's paths shows "No changes to this block" with its `newRoots` and a bulk-eligible accept (DEC-193)
````

#### FE03 F7 concurrency row — .memory/wiki/specs/fe/03-cms-content-modeling.md

Before:

````text
bulk acceptance is offered only when no listed instance collides.
````

After:

````text
bulk acceptance is offered only when no listed instance collides. A `structure` or `removed_root` collision is never preselected and keeping mine names its consequence (the block becomes a local copy that stops receiving updates); a 409 slot collision on _Place_ (the new root's path is already held) refetches the instance list and the diff; a `retired` or detached row offers neither accept nor detach (DEC-193).
````

#### FE03 F8a testing vitest — .memory/wiki/specs/fe/03-cms-content-modeling.md

Before:

````text
the diff collision, bulk-eligibility and choice rules hold;
````

After:

````text
the diff collision, bulk-eligibility and choice rules hold, including the `props`, `structure` and `removed_root` collision kinds with their fixed copy and consequences and the new-in-this-version list with its _Place_ request (DEC-193);
````

#### FE03 F8b testing playwright — .memory/wiki/specs/fe/03-cms-content-modeling.md

Before:

````text
a linked pattern update accepted and detached,
````

After:

````text
a linked pattern update accepted and detached, a removed block kept as a local copy and another removed, a block new in the version placed (DEC-193),
````

#### FE03 F9 contract field list — .memory/wiki/specs/fe/03-cms-content-modeling.md

Before:

````text
  | 'bulkEligible'
  | 'pinnedPatternVersion'
````

After:

````text
  | 'bulkEligible'
  | 'pinnedPatternVersion'
  | 'collisionKind'
  | 'newRoots'
  | 'rootPath'
  | 'roots'
````

#### FE03 F10 changelog — .memory/wiki/specs/fe/03-cms-content-modeling.md

Before:

````text
## Quality Gates Checklist
````

After:

````text
| 2026-10-15 | Slice 12 linked-update cascade (owner decision DEC-193): `CmsPatternUpdateDiff` renders each node value as props, block and sub-blocks, marks every collision by kind (`props`, `structure`, `removed_root`) with fixed copy and never preselects a choice; keeping mine on a `structure` or `removed_root` collision is named as making the block a local copy that stops receiving updates; a "New in this version" list shows `newRoots` and places them only through the CMS-03C-02 _Place_ command with `roots`; the accept result names the new pin, a removal or a local copy; a version that changes none of the instance's paths shows "No changes to this block" with a bulk-eligible accept. Updated the component, interaction, props, form, state, concurrency, field-list and testing rows. | /propagate-decision | Slice 12 composition surfaces, Slice 12 definition governance states, Interaction Specification, Complete component contracts, Form-by-source completeness, Exhaustive BE field ownership, Navigation/Degradation/Concurrency, Testing Obligations, Changelog |

## Quality Gates Checklist
````

#### ACs AC-028 — tracker and phase-2 (identical body edit)

Before:

````text
— Enforce CMS-03C-02: slotPath/overrides; normalized path 1–512 chars; strict overrides max 64 keys/8 depth; 422.
````

After:

````text
— Enforce CMS-03C-02: slotPath/overrides/roots; normalized path 1–512 chars; strict overrides max 64 keys/8 depth; optional `roots` of 1–512 unique key chains, each a block root of the pinned forest after top-level expansion (else 422 at `/roots/{n}`), placing only the named roots, an `overrides` key under no named root being 422 at `/overrides` (DEC-193); 422.
````

#### ACs AC-112 — tracker and phase-2 (identical body edit)

Before:

````text
`base` (the pinned pattern value), `theirs` (the new active value), `yours` (the local override) and a `collision` flag, a `collisionCount` 0-128 and `bulkEligible`;
````

After:

````text
`base` (the pinned node value) and `theirs` (the target node value), each the node's `props`, block identity (`blockKey`, `blockVersion`) and `children`, or null for a node absent from that version (DEC-193), `yours` (the local override), a `collision` flag and a `collisionKind` (`removed_root`, `structure`, `props` or null), the instance's `slotPath`, at most 512 `newRoots` (`rootPath`, `blockKey`, `blockVersion`), a `collisionCount` 0-128 and `bulkEligible`;
````

#### ACs AC-113 — tracker and phase-2 (identical body edit)

Before:

````text
defines a path as a collision when the local override differs from the base and the new version also changed the path,
````

After:

````text
defines the value of a node path as its `props` plus its block identity and `children` and lists each path the target changed (an added or removed node once, at its own path), defines a listed path as a collision of exactly one kind, the first that applies: `removed_root` when the target removed the instance's own block root, `structure` when the target changed the node's block identity or `children` (with or without an override) and `props` when the local override differs from the base `props` and the target also changed them (DEC-193), lists as `newRoots` the target's block roots whose key chain the pinned forest lacks,
````

#### ACs AC-114 — tracker and phase-2 (identical body edit)

Before:

````text
(an instance with no newer `active` compatible pattern version answers 200 with `paths: []`, `collisionCount` 0, `bulkEligible` false and `targetPatternVersion` equal to `pinnedPatternVersion`)
````

After:

````text
(an instance with no newer `active` compatible pattern version, and every readable row that is not a linked `active` or `pending_diff` row and the newest version of its path, such as a detached row, a detached copy or a `retired` row, answers 200 with `paths: []`, `newRoots: []`, `collisionCount` 0, `bulkEligible` false and `targetPatternVersion` equal to `pinnedPatternVersion`, and a newer version that changes none of the instance's paths answers `paths: []` with `bulkEligible` true, DEC-193)
````

#### ACs AC-117 a — tracker and phase-2 (identical body edit)

Before:

````text
which renders `base`, `theirs` and `yours` per path as a three-way list with colliding paths marked and a radio pair (keep my override, take the new value) per collision,
````

After:

````text
which renders `base`, `theirs` and `yours` per path as a three-way list with colliding paths marked by kind and a radio pair per collision that is never preselected (`props`: keep my override or take the new value; `structure` and `removed_root`: keep mine, named as making the block a local copy that stops receiving updates, or take the new structure or remove the block, DEC-193), lists the `newRoots` as new in this version with a _Place_ command through CMS-03C-02 `roots` and states that accepting never adds them,
````

#### ACs AC-117 b — tracker and phase-2 (identical body edit)

Before:

````text
verification covers the collision marking, the 128-path and 256 KiB bounds, `bulkEligible` and the focus on the first unanswered collision.
````

After:

````text
verification covers the collision marking and kinds, the new-root list and its placement request, the 128-path and 256 KiB bounds, `bulkEligible` and the focus on the first unanswered collision.
````

#### ACs AC-119 — tracker and phase-2 (identical body edit)

Before:

````text
`choices` only for a single-instance request and covering every colliding path with `yours` or `theirs` (a missing choice is 422),
````

After:

````text
`choices` only for a single-instance request and covering every colliding path (`props`, `structure` and `removed_root`, DEC-193) with `yours` or `theirs` (a missing choice is 422),
````

#### ACs AC-120 — tracker and phase-2 (identical body edit)

Before:

````text
an instance must be `pending_diff` or an `active` linked instance for `accept` and any linked instance for `detach`, and the entry and instance versions must be current.
````

After:

````text
an instance must be the newest version of its path and `pending_diff` or an `active` linked instance for `accept` and any linked instance except a `retired` one for `detach` (any other named row is 422 `COMPOSITION_VALIDATION_FAILED` at `/instances/{n}/instanceId`, DEC-193), and the entry and instance versions must be current.
````

#### ACs AC-122 — tracker and phase-2 (identical body edit)

Before:

````text
or a choices or targets schema failure (422 `COMPOSITION_VALIDATION_FAILED`),
````

After:

````text
or a choices or targets schema failure or an instance in no admitted state (422 `COMPOSITION_VALIDATION_FAILED`, DEC-193),
````

#### ACs AC-123 — tracker and phase-2 (identical body edit)

Before:

````text
and never accept an update automatically; verification covers theirs-only adoption, retained overrides, mandatory choices for collisions, bulk all-or-nothing, detach and the focus on the first unanswered collision.
````

After:

````text
never accept an update automatically, and name each accepted instance's outcome (the new pin, a removal or a local copy, DEC-193); verification covers theirs-only adoption, retained overrides, mandatory choices for collisions of each kind, a removed block kept as a local copy or removed, bulk all-or-nothing, detach and the focus on the first unanswered collision.
````

#### ACs AC-214 — tracker and phase-2 (identical body edit)

Before:

````text
— Pattern update `accept`: for each listed instance a path changed only by the new version adopts it, a local override on a path the new version did not change is retained, every collision takes the explicit `yours` or `theirs` choice, and the command appends an `active` row pinned to the target version.
````

After:

````text
— Pattern update `accept`: for each listed instance a listed path that is not a collision adopts the target value, a local override on a path the target did not change is retained, every collision takes the explicit `yours` or `theirs` choice (on a `props` collision `theirs` takes the target `props` and `yours` keeps the override; on a `structure` collision `theirs` adopts the target's block identity and `children` there, keeping that path's override only when the target left its `props` unchanged), and the command appends an `active` row pinned to the target version whose kept overrides each name a node of the target tree; on a `removed_root` collision `theirs` appends a `retired` row, and `yours` on a `structure` or `removed_root` collision appends the instance's detached local copy (the row `detach` appends) instead, so no row is ever left linked and pinned to a version whose forest lacks its block root; accept never creates a row for a block root the target adds (DEC-193).
````

#### ACs AC-215 — tracker and phase-2 (identical body edit)

Before:

````text
— Pattern update `detach`: the command appends a `detached` row that materializes the instance's current effective content (the pinned tree plus its overrides) as local props and stops the instance receiving updates, and it is admitted for any linked instance.
````

After:

````text
— Pattern update `detach`: the command appends a `detached` row that materializes the instance's current effective content (the full subtree of its block root in the pinned version, nested pattern references expanded in place, every override applied) as a detached local block tree in `detached_tree`, bounded by the 512-node pattern limit with no key-count refusal, keeps the pin of the row it follows as provenance only and stops the instance receiving updates; it is admitted for any linked instance except a `retired` one, and the render plan, restore and the revision-append carry-over resolve the tree (DEC-193).
````

#### ACs AC-218 — tracker and phase-2 (identical body edit)

Before:

````text
`(revision_id, path)` is unique per version, and an override collision produces `pending_diff` and never overwrites.
````

After:

````text
`(revision_id, path)` is unique per version, and an override collision produces `pending_diff` and never overwrites; an optional `roots` places only the named block roots (how the author places the block roots a newer version adds, DEC-193), a path whose newest row is not `retired` is occupied (409 `COMPOSITION_VERSION_CONFLICT`, nothing written), and a path whose newest row is `retired` is free, the placed row being that path's next version at its kept position (DEC-185, DEC-193).
````

#### ACs AC-243 — tracker and phase-2 (identical body edit)

Before:

````text
each keeping its path and link mode and re-pinned to the current registry, so that a pinned block version that is `withdrawn` fails the restore 409 `migration_chain_incomplete`,
````

After:

````text
each keeping its path, link mode and detached local block tree (DEC-193) and re-pinned to the current registry, so that a pinned block version, or a block of a detached tree, that is `withdrawn` fails the restore 409 `migration_chain_incomplete`,
````

#### ACs AC-245 — tracker and phase-2 (identical body edit)

Before:

````text
as append-only rows with `carried_from_id` provenance unless
````

After:

````text
as append-only rows with `carried_from_id` provenance, each copying its detached local block tree unchanged (DEC-193), unless
````

#### ACs AC-247 — tracker and phase-2 (identical body edit)

Before:

````text
renders a `pending_diff` instance from its pinned version, reads each block-root row of a pattern placement as one block at its own `path` (DEC-175, DEC-181)
````

After:

````text
renders a `pending_diff` instance from its pinned version, renders a row that carries a detached local block tree from that tree, never from its provenance pin or overrides (DEC-193), reads each block-root row of a pattern placement as one block at its own `path` (DEC-175, DEC-181)
````

#### ACs AC-258 — tracker and phase-2 (identical body edit)

Before:

````text
, and every instance version is append-only with `updated_at = created_at` and UPDATE and DELETE rejected.
````

After:

````text
, `detached_tree jsonb` is null or, only on a `detached` row whose `props` is `{}`, a pre-order array of 1–512 nodes `{ path, blockKey, blockVersion, props }` whose first node is the row's block root (DEC-193), and every instance version is append-only with `updated_at = created_at` and UPDATE and DELETE rejected.
````
