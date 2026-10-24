# Lane: DEC-193 public contracts (Codex)

Current native continuation: **public-contract GREEN authoring frozen UNRUN**.
Exact `gpt-6.1-sol` / `ultra` authored the bounded implementation after root's
fresh behavioral RED. See the final section for current scope and hashes.
No passing-test, consumer completion or acceptance claim.

## Historical RED authoring record

Task name: /root/phils_dec193_contract_red_20261016
Date: 2026-10-15 America/New_York (report written 2026-10-16 UTC).
Model: Phils-Charm/deepseek-v4.1-flash / high (exact; no fallback used).
Status: **UNRUN / RED test frozen - no acceptance claim.** Root owns validation, review, planning and the separate GREEN release.

## Authority and boundary

- Worktree: /home/rob/.codex/worktrees/phase2-slice12/WeJammin, branch `claude/phase2-slice12`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`.
- Primary checkout /home/rob/Projects/WeJammin is READ-ONLY; never written or read-modify-written.
- Edits use apply_patch with absolute paths only.
- Test-only execution author: no production contract, export, old-test, fixture, consumer, spec or SQL edit. No tests, lint, type, build, DB, runtime, network or git mutation was run.
- Every assertion imports only schemas the package already exports (`@wejammin/contracts`), so a case fails on the behavior it asserts, never on a missing module (avoids module-absence RED).

## Exact two writable paths (only these)

1. `packages/contracts/src/cms-composition/dec193-contract-migration.test.ts` (new) - 383 physical lines, 13 `it` cases.
2. `docs/handoffs/2026-10-14-claude-s12/lane-codex-dec193-contract-2026-10-16.md` (this file, new).

No other path was written. No new-file claim beyond these two was needed.

## Case frontier (from the 6.1 evolve-contract inventory)

The suite is the executable form of the owner-approved BE03c DEC-193 cascade (spec SHA-256 `0960adbde1cbcb2ff3d6a6bb1608d9669bb4cc8f8bf57e3045d86c88b1c82181`).

1. **Typed diff node value / collisionKind** (`diff-1`..`diff-8`): roundtrip of `base`/`theirs` as `{ blockKey, blockVersion, props, children }` with `slotPath`, `newRoots` and a per-path `collisionKind`; exactly one kind on a collision and null otherwise; a legacy scalar or props-only `base`/`theirs` rejected with a deep issue path (not only an unknown envelope field); over-bound/unknown/snapshot node fields rejected; ordered `children` accepted at 512 (within the 512-node cap, not the authored 32) and rejected at 513; `props` keep existing JSON kinds (scalars, arrays, nulls) with no invented object-only coercion; snapshot/authority members refused.
2. **Public address / stored caps** (`choice-1`, `caps-1`): a 72-segment 4680-ASCII `choice` path accepted, a 73-segment or malformed one refused; old short paths unchanged; the actual override key (512-char `PatternNodePath`) and slotPath bounds stay; a >512 override key is still rejected and is not widened.
3. **roots** (`roots-1`): omitted `roots` valid; 1-512 unique full addresses roundtrip; empty, duplicate, 513 and malformed root addresses refused at deep paths.
4. **bulk/no-update** (`diff-7`): a newer target with `paths: []` and collision 0 is `bulkEligible` true (including explicit `newRoots`); a no-update target equals the pin requires `paths: []`, `newRoots: []`, collision 0, `bulkEligible` false; inconsistent counts/kinds and bad pin ordering refused; the 128-path and 262144-byte caps preserved (`diff-8`).
5. **Preserved controls** (`controls-1`): 32-instance bound, 128-choice bound, bulk-request-with-choice refusal, duplicate instance, and If-Match agreement retained as a meaningful matrix rather than the whole duplicate old suite.
6. **Privacy** (`privacy-1`): no owner, session, provenance or snapshot field accepted.

## Predicted failures (current contract vs DEC-193) - UNRUN, not observed

| Case | Predicted result today | Reason |
| ---- | ---------------------- | ------ |
| diff-1, diff-2, diff-3, diff-4, diff-5 | RED | `CompositionUpdateDiffPathSchema` still types `base`/`theirs` as `JsonValueSchema` and has no `collisionKind`; the node-value shape is not yet enforced. |
| diff-6, diff-7 | RED | `CompositionUpdateDiffResourceSchema` has no `slotPath` or `newRoots`. |
| diff-8 | Mixed | the 128-path / 262144-byte caps still hold, but the same case carries the new node-value shape, so it is RED until the node value lands. |
| choice-1 | RED | `PatternUpdateChoiceSchema.path` is `PatternNodePathSchema` (max 512), so a 72-segment 4680-character address is refused. |
| caps-1 | GREEN (negative) | the 512-char override key and slotPath refusals already hold and must stay; asserted so a widening would break. |
| roots-1 | RED | `PatternInstanceRequestSchema` has no `roots` member; the strict object refuses it. |
| controls-1 | GREEN (retained) | existing CMS-03C-15 controls; asserted to prevent regression. |
| privacy-1 | GREEN (retained) | strict objects already refuse these members. |

`CompositionDiffNodeValue`/`CompositionUpdateNewRoot`/`ExpandedPatternNodePath` are the names the current BE03c spec prose uses but the contracts package does not export today; the test never imports them and reaches their behavior only through the exported request/diff/instance schemas. Genuine assertion RED is therefore expected on `diff-*`, `choice-1` and `roots-1`; the retained-control and negative cases are expected GREEN and are there to catch a widening.

## Compatibility reading

- The package is private `0.0.0`; primary `main` is absent and the WIP RPCs support a controlled UNRELEASED v1 cutover; no hosted-absence proof is claimed. Strict old validators make the new typed members a breaking change, which is intended for the unreleased cutover.
- Owner-locked `/api/v1` paths are kept; no `v2` and no dual-shape acceptance is invented.
- Actual placement override keys remain 512 and the actual row/slot norms are unchanged; the public address type grows without widening them.

## Source hashes (read-only, this turn)

| Path | SHA-256 |
| ---- | ------- |
| dec193-contract-migration.test.ts (new) | `3ef900f60627f4744fbb36dd94cdf1669f1b02cf0e5a6b9e7e8818190e277d22` |
| .memory/wiki/specs/be/03c-composition-taxonomy-localization.md | `0960adbde1cbcb2ff3d6a6bb1608d9669bb4cc8f8bf57e3045d86c88b1c82181` |
| packages/contracts/src/cms-composition/pattern-update.ts | `585338970347fbcc0afdacaae5d111bc79a905240c619b6cffd8a86b05a7ab85` |
| packages/contracts/src/cms-composition/pattern-instance.ts | `51df99be8eb092775d7db7f6a7e5e2a9009280294bc3b9cffc0b018a5dc97dea` |
| packages/contracts/src/cms-composition/key-grammar.ts | `8503bfcfa13ab090a6261f91cb02a649b06eacfef04a4ac355796430d2980d8c` |
| packages/contracts/src/cms-composition/pattern-node.ts | `cddb1997392fa0c54a0ad23d23a2130a69be0e69b5262c8e6b23b5187d38f2fa` |
| packages/contracts/src/api-error.ts | `25e5b83fdeffc6d1670aab4363ab204f455f63526b668544caf9a78d0ef7bd90` |
| docs/handoffs/2026-10-14-claude-s12/lane-codex-dec193-spec-2026-10-15.md | `9ad85e0022d0ca035ed7964fec4cb4c9951cb8d825a9c992cfe2cad39a190985` |

## Not done (root-owned)

- No test, lint, type-check, build, DB, runtime or network execution. The predicted failures above are static readings of the current schemas, not observed output.
- No production contract edit; no publication; no acceptance claim. Root observes RED before the actual contract GREEN and owns the separate GREEN release.
- The diff is not committed; git mutation is out of scope.

## Requests to root

- None blocking. If root wants the public address behavior pinned as a standalone named export test rather than through the carriers, that needs a new-file claim.

## Root RED receipt (observed by root, exact)

- Command: root ran the bounded test file with the JSON reporter; no setup or import failure.
- Receipt: `/tmp/wejammin-codex-dec193-contract-red-0n5Wy1/red.json` (24023 bytes), log `/tmp/wejammin-codex-dec193-contract-red-0n5Wy1/red.log`.
- Totals: `numTotalTests` 13, `numPassedTests` 3, `numFailedTests` 10, `numTotalTestSuites` 4, `numPassedTestSuites` 1, `numFailedTestSuites` 3.
- FAIL (10): diff-1, diff-2, diff-3, diff-4, diff-5, diff-6, diff-7, diff-8, choice-1, roots-1.
- PASS (3): caps-1, controls-1, privacy-1.
- Failure modes match the predicted RED: diff-1 `unrecognized_keys` `collisionKind` at `paths.0..3` and `slotPath`/`newRoots` at the resource root; the remaining diff cases `AssertionError: expected false to be true`; choice-1 (512-char `PatternUpdateChoice.path`); roots-1 (strict `PatternInstanceRequest` lacks `roots`). No module-absence failure.

## Bounded TEST-ONLY correction pass (same two paths, root-requested)

Four corrections, no production contract edit, no weakening, still one test file under 400 physical lines:

1. **DIFF duplicate address removed.** The non-colliding `PLAIN` member of `DIFF` now addresses `/hero/plain`, distinct from the `/hero` `structure` path, so `DIFF` carries four distinct paths. The `plain` helper keeps its `/hero` default for the single-path cases, so those cases are unchanged.
2. **Actual 512-unique `roots` positive assertion added.** `roots-1` now parses a `roots` list of 512 unique addresses (`addrs(512)`) and expects a roundtrip, in addition to the earlier `MAX_ADDRESS`+`/hero` pair, so the title's `1-512` claim is exercised at the bound.
3. **Over-limit oracles made unique.** The 513 `roots` case uses `addrs(513)` (unique) and the 513 `newRoots` case uses `addrs(513).map(root)` (unique), so a failure can only come from the over-limit bound, never from a duplicate-value oracle.
4. **`diff-2` tightened.** A bogus `collisionKind` is asserted at `paths.0.collisionKind` (with the input refused); a `collisionKind` on a non-colliding path and a null `collisionKind` on a collision are asserted refused with an issue under `paths.0`.

Compaction to stay within 400 lines (396 now): the 9-line header comment became 5, the `Schema` type alias is now `Parameters<typeof issuePaths>[0]` instead of a 6-line literal, the three collision-kind string constants share one line, and `root` is one line. No assertion was removed or weakened.

Corrected file SHA-256: `1aed4ac99117f3f72787cfa964532df159d93f8378721c4b83d9bbc20dd9355e` (396 lines, 13 `it` cases). The four failing new-surface clusters (`diff-*`, `choice-1`, `roots-1`) remain the genuine RED; `caps-1`, `controls-1`, `privacy-1` remain the retained GREEN guards.

## Handoff after correction

Root re-runs the same two-path test to confirm the corrected RED, then performs the exact three-module contract release (`pattern-update.ts`, `pattern-instance.ts`, and the `ExpandedPatternNodePath` carrier in `key-grammar.ts`). No standalone named-export test is needed now. No production release by this lane.

## Native public-contract GREEN authoring — 2026-10-16

- Task: `/root/native_dec193_contract_green_20261016`.
- Author: exact `gpt-6.1-sol` / `ultra`, user-authorized native takeover.
- Status: **UNRUN; frozen for root focused validation and independent review**.
- Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
- Exclusive ten-path claim already exists in S12Dispatch,
  `.memory/pipeline/progress/slices/phase-02-slice-12.md:2241-2243`.
  This author did not write tracking or acceptance criteria.
- Protected primary `/home/rob/Projects/WeJammin` was not written. No test,
  lint, type-check, formatting tool, build, DB, application runtime, network or
  git command ran. Static filesystem/context-mode reads and absolute apply_patch
  edits only. No source, spec, OpenAPI, generated doc or consumer outside the
  released public-contract/test/report paths changed.

### Authority, locked source and root choices

The approved scan
`.memory/wiki/specs/audits/propagation-scan-2026-10-15-codex-dec193-choice.md:6-28`
records owner answers **"Honor each choice (Recommended)"** and **"Apply listed
corrections (Recommended)"**. The five fixes remain authority: honor every
explicit choice; represent every admitted subtree privately; scope no-update
to pattern-origin rows with positive provenance pins; cascade typed contracts
and actual consumers; reconcile tracking without acceptance ticks. This lane
implements only the released public-contract part.

Root design is recorded in
`docs/handoffs/2026-10-14-claude-s12/lane-codex-dec193-spec-2026-10-15.md:29-44`:
B/L/T resolution; simultaneous choices in chosen reachable topology; atomic
422 for inconsistent complete answers; private parent-indexed snapshots;
retained prior provenance for retired/detached results; explicit new-root
placement; 512 expanded children; public full-address bounds. Resolver/storage
consumers remain separate work and are not claimed implemented here.

Exact locked BE03c source read before authoring:

- `03c-composition-taxonomy-localization.md:509-551`: override path bound,
  expanded public addresses and optional unique placement roots.
- `:1182-1218`: strict NodeValue, nullable typed base/theirs, local props
  override yours, required nullable collisionKind, and new roots.
- `:1219-1254`: 128 paths / 256 KiB, positive-pin no-update, required slotPath,
  512 new roots, and newer collision-free bulk eligibility without changed paths.
- `:447-463`: existing bounded pattern props, reused from PatternNodePropsSchema.

TDD, evolve-contract, TypeScript/Zod, Vitest and context-mode skills guided the
strict cutover, bound reuse and static handoff. Root's observed RED precedes
production authoring; author execution remains prohibited.

### Implementation and preserved boundaries

1. `key-grammar.ts` exports ExpandedPatternNodePathSchema and inferred type:
   1-72 ASCII key segments, each 1-64 characters, maximum 4680 characters.
   The terminal assertion rejects trailing characters including line terminators.
   PatternNodePathSchema retains its exact existing 512-character validation;
   only its comment now distinguishes placement overrides.
2. `pattern-update.ts` widens only choice addresses and re-exports the new diff
   module through the existing public export chain. Existing 32-instance and
   128-choice limits, duplicate checks, bulk-choice restriction, strict headers
   and strong If-Match equality remain intact. No dual legacy diff parser.
3. New `pattern-update-diff.ts` exports CompositionDiffNodeValue,
   CompositionUpdateDiffPath, CompositionUpdateNewRoot schemas/types and the
   existing diff API/resource names. NodeValue is strict blockKey, positive
   int32 blockVersion, bounded pattern props, and at most 512 ordered full child
   addresses. base/theirs are NodeValue|null; yours remains JsonValue|null.
   collisionKind is required, closed and nonnull exactly on collisions; the
   server still derives collision precedence from the actual trees.
4. Diff slotPath is required, safe and 1-512 characters. newRoots is required,
   capped at 512 and unique by rootPath. Paths remain unique and capped at 128;
   total serialized resource remains capped at 262144 bytes. Target below pin
   is refused. Equal target/pin requires empty paths/newRoots, zero collisions
   and bulkEligible false. A newer collision-free target requires bulkEligible
   true even with no changed paths. Positive pin is required; the server still
   checks readable pattern provenance, linked active/pending newest-row
   eligibility and the newer compatible version. No standalone pin fabricated.
5. `pattern-instance.ts` adds only optional roots: supplied lists have 1-512
   unique expanded addresses; omission stays compatible. Parser preserves input
   order; server must resolve membership and place selected roots in forest
   order. Override keys stay at 512 characters with existing 64-key/depth-eight
   limits. Stored row/slot paths retain 512 characters; SQL's 248-octet row-path
   rule is untouched.

### Exact historical test cascade

Only `pattern-update-diff.test.ts` changed among the five claimed historical
tests. All six `it` cases and all unrelated assertions remain.

- Valid diff/no-update fixtures gain required slotPath/newRoots.
- nodeValue wraps base/theirs props with block identity and ordered children;
  collisionKind is null for false and `props` for the props collision.
- The 128-path and byte-cap fixtures use typed values. Heavy props still carry
  2100 text characters per path; intended sole refusal remains diff_too_large.
- One obsolete oracle accepting bulkEligible false on a newer collision-free
  diff now expects refusal, as BE03c:1229-1231 requires true. Its positive clean
  case and every original negative/count/privacy assertion remain intact.
- key-grammar.test.ts, pattern-update.test.ts, pattern-instance.test.ts and
  core-contracts.test.ts remain byte-unchanged. Public component registry names
  did not change, so no core-registry oracle edit is needed. No new tests or
  assertions were added after production authoring.

### Fresh RED and freeze hashes

Static inspection verified root's fresh pre-implementation receipt
`/tmp/wejammin-native-resume-red-k1uRiH/red.json`, SHA-256
`7984b894edff9c55751a08245519eb52e3b9810106215da8428937c82bf27bb8`.
Contract suite: 13 assertions, 3 passed, 10 failed, empty suite message; no
setup/import abort. This is RED evidence, not current GREEN.

Paths below are worktree-relative; line counts count newline characters.

| Path | Lines | SHA-256 |
| ---- | ----- | ------- |
| packages/contracts/src/cms-composition/key-grammar.ts | 110 | `d467b64f0f616b51ff0cec6e7968186b9376b7afcc93c82f84feed6dceeb78fb` |
| packages/contracts/src/cms-composition/pattern-update.ts | 138 | `5562cd77b3f508b6e6413f3e0dbf10654ea7dc3e24ab84b6052f3c502431ed5a` |
| packages/contracts/src/cms-composition/pattern-update-diff.ts (new) | 179 | `6b539317ab22ec79a6e9090a25215016dff53448492f39c625ed9d850d0befe9` |
| packages/contracts/src/cms-composition/pattern-instance.ts | 195 | `fd545e8d2e0d5cac03020b3c0ffa48d23e285b9b21362018da9281d27fd7e63b` |
| packages/contracts/src/cms-composition/pattern-update-diff.test.ts | 226 | `455177fb83d9e9648a1508d8a2959f6eb768b376c50de1d8ff70f25ff27fbb39` |
| packages/contracts/src/cms-composition/key-grammar.test.ts (unchanged) | 147 | `f8d05c55ee7c0e8c3ddcf2df7b073b9decbf9dcc3a3e36e60257d3c2abf20ea8` |
| packages/contracts/src/cms-composition/pattern-update.test.ts (unchanged) | 246 | `7b0dbc24b412eb76752bca76aae20b0385ffd92a346eda31f2defc782854c002` |
| packages/contracts/src/cms-composition/pattern-instance.test.ts (unchanged) | 381 | `6a9d61548ae9d8b384382b86247f21a4a44b78cabea56c3bbe1e43256afc61d5` |
| packages/contracts/src/core-contracts.test.ts (unchanged) | 347 | `906f43c7614ed99c52a5c7acb44360b1bb91b5b7c76776959e8f5f955da2c9cd` |
| packages/contracts/src/cms-composition/dec193-contract-migration.test.ts (root-formatted, author unchanged) | 393 | `0b4e58ec7197db935b80d8113ba809def7bd841120d6ad5412038c15f9ca2825` |

All four production modules remain under 300 physical lines. Frozen test hash
identifies exact bytes despite historical differing line-count labels. The
report's own final hash is supplied separately to root after this append.

### Root continuation

1. Reconfirm hashes; run focused migration/adjacent contract tests, lint and
   type-check, then independent review. No author validation was run.
2. Dispatch separately claimed Worker/Web/SQL consumers and focused RED tests
   against this shape. Resolve forest order/membership, collision derivation,
   actual newest-row/provenance admission and mixed tree choices there.
3. OpenAPI/docs generation, full validation, tracking, promotion and acceptance
   remain root-owned. No slice/phase completion, commit, push or hosted
   acceptance is claimed.

### Independent review oracle correction — 2026-10-16

Root released only `pattern-update-diff.test.ts` and this owned report for a
single correction. Independent review was BLOCK for the malformed-candidate
loop at test lines 171-185: it spread `diff.bulkEligible: false` but set zero
collisions with a newer target. That envelope was independently invalid under
BE03c:1229-1231, so an optional-`yours` defect could survive the missing-yours
candidate. Other production schema review was CLEAR, as reported by root.

The loop now explicitly sets `bulkEligible: true` beside `collisionCount: 0`.
All six malformed candidates and the existing refusal assertion are unchanged;
each refusal now exercises the candidate rather than the inherited bulk flag.
No production schema, frozen migration test or other file was changed by this
correction author. The test is 226 lines, SHA-256
`455177fb83d9e9648a1508d8a2959f6eb768b376c50de1d8ff70f25ff27fbb39`.

Root reported a focused pre-format run of **37 files / 314 passing tests** and
**ESLint 0 errors** before this correction. These are root-owned results,
not tests run by this author and not validation of the corrected test bytes.
Root also mechanically formatted the frozen migration test; its current 393
newline-terminated lines hash to
`0b4e58ec7197db935b80d8113ba809def7bd841120d6ad5412038c15f9ca2825`.
The earlier `1aed4ac9...` hash remains the historical RED source identity.
The current freeze table above reflects the root formatting and this correction.

Correction is **frozen UNRUN**. Root will run the optional-yours negative
control, restore the canonical production schema, rerun GREEN and obtain an
independent readback. No author test, lint, type, build, runtime, git or network
execution; no acceptance claim.

## Root corrected-oracle validation and independent readback

Root's memory-only optional-yours Vite transform loaded once and changed only
the required `yours` member to optional. `/tmp/wejammin-native-dec193-yours-mutant-hCxg2e/mutant.json`
records six cases / five PASS / one meaningful FAIL at the corrected historical
negative case, not an import/anchor failure. Receipt SHA-256:
`a402a2bc271888d6b8761ea1dbbf7d236f1b595a2a8ac9e60c0d1552a4a6ebf0`.
Canonical source was never written by this mutation.

Final unmodified `/tmp/wejammin-native-dec193-green-xRuxg9/green-final.json`
records 37 files / 314 PASS / zero FAIL. Receipt SHA-256:
`a275aa36783f75e4cb03ddb73f06304bb29749163c7048cf5e5e2516470cc7c1`.
Native independent readback is CLEAR: the sole correction makes each surrounding
negative envelope valid; its removal restores the prior reviewed test hash;
all four production module hashes retain their reviewed identity. Both runtime
receipt hashes verified by the reviewer. This clears only the bounded contract
correction; actual Worker/Web/SQL consumers and slice acceptance remain open.
