# Lane report — s12_web_pattern_red (QA-RED)

Worktree: /home/rob/.codex/worktrees/phase2-slice12/WeJammin (branch claude/phase2-slice12)
Model/effort: Phils-Charm/deepseek-v4.1-flash, high. Root: gpt-6.1-sol, ultra.
Stage: QA-RED only. No production, contract, spec, manifest, config or lockfile edit.
No stage/commit/push. No test/lint/build/reset/install/runtime command was run (root holds the quiet
and CI locks; heavy commands are HOLD until root release).

## Exclusive files written

- NEW apps/web/src/server/cms-composition-platform-pattern-placement.test.ts
- NEW apps/web/src/server/cms-composition-platform-pattern-placement.test-support.ts
- NEW docs/handoffs/2026-10-12-claude-s12/lane-codex-web-pattern-red-report.md (this file)

No shared support file, contract, registry row, OpenAPI document, route or proxy was modified. The
eight preserved governed migrations were read-only and untouched. Both code files are under the
300-line limit. Edits were made with apply_patch only.

## Canonical reference note

The Astro skill at .codex/skills/astro-framework/SKILL.md points to a canonical bundle at
.codex/skill-library/stack/frameworks/astro-framework/SKILL.md and its references/routing.md; that
canonical reference is missing in this worktree. Fallback used: the actual current first-party proxy
pattern (apps/web/src/server/cms-composition-platform-pattern.ts, cms-editorial-platform-shared.ts,
cms-editorial-platform-bounded.ts), which is the concrete routing/forwarding behavior under test.

## Locked contract this RED targets

packages/contracts/src/cms-composition/pattern-instance.ts:115-174 defines PatternPlacementResourceSchema
as a strictObject of { items: array(CompositionInstanceResource).min(1).max(512) } with checkPlacement:
every row pinned to one revisionId/patternId/patternVersion/linkMode, unique path, unique id, and
consecutive positions (row.position === items[0].position + index).

BE03c CMS-03C-02 (route registry line 160; contract/prose line 1360): 201 PatternPlacementResource, one
row per block root of the pinned forest after DEC-181 expansion, all-or-nothing, at consecutive
positions appended after the slot's greatest in forest order (DEC-175, DEC-181, DEC-185). A row path is
the slotPath joined with "/" and the root key chain, root "/" adding no extra separator (DEC-186).

## Current production behavior (RED source)

apps/web/src/server/cms-composition-platform-pattern.ts:187-200 validates the upstream 201 with
CompositionInstanceResourceSchema (a single row), then requires the row to equal the request
(path === body.slotPath, matching patternId/patternVersion/linkMode/revisionId) and the upstream ETag to
equal the single row version. A placement items list therefore fails the single-row parse and the proxy
answers 502 DEPENDENCY_UNAVAILABLE. GREEN must parse PatternPlacementResourceSchema instead.

## Test matrix (actual boundaries; all tests import the real forwardCmsPatternInstanceMutation)

[DEFECT] = fails against the current code for the intended reason. [GUARD] = passes today and pins a
behavior GREEN must not regress. Prediction, not a gate; the run will confirm.

PatternPlacementResource list relay:

- AC-010 [DEFECT] a legitimate multi-row placement (3 rows) relays as 201 with the exact items body.
- AC-010 [DEFECT] a single-row placement list relays as 201.
- AC-218 [DEFECT] the 1-row, 2-row and 33-row transport positives relay as 201. Each is asserted
  serializedBytes(body) <= 262144 before the call, so a transport positive is proven under the real
  256 KiB ceiling rather than asserted past it.
- AC-218 [DEFECT] the 512-row cardinality bound is controlled by an actual schema parse:
  PatternPlacementResourceSchema.safeParse(placementResource(512)).success === true and
  .safeParse(placementResource(513)).success === false. The fixture length and CMS_PLACEMENT_MAX_ROWS
  checks are kept only as optional size controls. The 512-row list is never sent as a route-201
  expectation.
- AC-218 [GUARD, characterization] a schema-valid but oversized placement list (512 rows, 293569
  serialized bytes) fails closed 502 DEPENDENCY_UNAVAILABLE. The test first asserts
  PatternPlacementResourceSchema.safeParse(oversized).success === true, which isolates the fixture's
  schema validity; today the single-row parse still rejects the list, so the 502 is the current
  characterization and does not yet isolate the transport ceiling. The ceiling is distinguishable only
  once the list relay is GREEN and an oversized body is still refused.
- AC-218 [DEFECT] a placement appended after the slot rows (positions [3, 4], nonzero first position)
  relays as 201; checkPlacement only requires consecutive positions from items[0].position, so a
  nonzero start is valid and never asserted to a specific value.
- AC-218 [DEFECT] rows reached through a nested-pattern key chain (DEC-186) relay as 201.
- AC-218 [DEFECT] a placement into the root slotPath "/" relays as 201.

Request binding and transport:

- AC-010 [DEFECT today via the positive path] the validated body and the allowlisted headers (If-Match,
  Idempotency-Key, X-CSRF-Token, filtered session cookie; no Origin) are forwarded exactly once to
  https://platform-api.internal/api/v1/cms/compositions/pattern-instances.

Admission guards before any upstream call (GUARD; pass today, pin against regression):

- AC-218 invalid binding 503; GET 400; query string 400; cross-origin 403; empty CSRF 403; non-JSON
  media 415; empty Idempotency-Key 400; malformed JSON 400; an unknown body member 422; an If-Match
  that differs from the body expectedVersion 400; a missing Idempotency-Key or If-Match 400. The
  binding fetch is never called.

Malformed and legacy upstream success (fail closed 502):

- AC-010 [DEFECT] the legacy single-resource body is refused 502 DEPENDENCY_UNAVAILABLE.
- AC-218 [GUARD] a non-list body, empty items, 513 items, an extra top-level key, and {} are refused 502.
- AC-218 [GUARD, characterization] a schema-valid but uniformly wrong request binding is refused 502. The
  rows differ from the request in revisionId, patternId, patternVersion, linkMode or blockRegistryDigest,
  or carry a slot-prefix lookalike path (`/mainx/root0` against the request slotPath `/main`). Each
  case first asserts PatternPlacementResourceSchema.safeParse({ items }).success === true; that parse
  isolates the fixture's schema validity, not the cause of the 502. Because production still parses a
  single resource, it rejects every list body today, so this guard is only characterization until the
  positive list relay tests are GREEN at the same boundary. Request binding is a required invariant that
  the paired positive list relay tests (above) hold it to.
- AC-218 [GUARD] a schema-invalid or mixed forest is refused 502: rows mixing revisionId/patternId/
  patternVersion/linkMode, duplicating path or id, with non-consecutive/reordered positions, or with an
  unknown row member. Each case first asserts the schema rejects the body, so the parser is the gate.
- AC-218 [GUARD] a thrown fetch and a non-Response binding result are refused 503; a 200 status,
  malformed JSON, a response bound to a different revision or pattern version, and a response digest
  disagreeing with the request digest are refused 502. The private transport text never reaches the body.

Declared error relay (GUARD): a declared 409/429/503 is relayed at its status with no-store; an
undeclared status (418) and a malformed error body are refused 502.

## ETag / version policy (GREEN)

BE00 version grammar and BE03c:215: CMS-03C-02's `If-Match` and response `ETag` denote the entry
aggregate `version`, not any row `version`. GREEN copies the upstream strong ETag unchanged after
validating it with the existing `QuotedVersionSchema` (strong decimal 1..9223372036854775807); it does
not require `ETag === row.version` and adds no public version field. The fixtures give rows `version`
"7" and the response ETag the distinct entry version, so a relayed 201 proves the ETag is the entry
version. A missing, weak, malformed or overflowing ETag is a 502.

## Bounds-oracle reconciliation (resolved by DEC-188/DEC-189)

Measured with the fixture: a 512-row items list serializes to 293569 bytes (root's Worker fixture was
289473), both over the BE00:488 universal 256 KiB response bound. The owner resolved the conflict with
DEC-188/DEC-189: the CMS-03C-02 decoded JSON response is the one response ceiling exception at 1,048,576
bytes, response-only; its request body and every other request and response stay at 256 KiB. This lane
implements that exception.

## Criteria mapping and out-of-boundary clauses

Mapped to P2-S12-AC-010 (items list relay) and P2-S12-AC-218 (forest invariants, request binding,
transport). Not asserted, and out of this web lane's boundary: SQL all-or-nothing atomicity, the
position value computed under the revision/slot lock, actor/assignment authority and capability
resolution, the DEC-186 248-octet path bound (a server-side refusal the proxy forwards as an upstream
error), and every Worker-owned behavior (the s12_pattern_placement_red lane owns the Worker adapter and
HTTP boundary). No SQL atomicity or auth was asserted from fake bindings.

## First QA wave (run 2026-10-13 under root release)

Prettier --write was applied to both owned files (clean); the focused Vitest was run twice under
flock -s /tmp/wejammin-quiet.lock. Both runs produced the same counts, 8 failed | 9 passed (17).

Run 1 (diagnostic, NOT pinned). Log: lane-logs/s12-web-pattern-focused-red.log, sha256
f4781dc247e22963cdf89c306b006517cf4fb82324a665dd6e2d72130636be9b. Its header records
`node=v26.11.1 pnpm=11.25.0`: the command ran in a login shell, so the shell reset PATH and the pinned
toolchain was not actually used. This run is diagnostic only. An earlier report draft wrongly claimed it
ran under Node v22.23.1; that claim was incorrect and is retracted.

Run 2 (authoritative, pinned). Executed with login:false and shell:bash, invoking the absolute pinned
wrapper /home/rob/.local/share/wejammin-toolchain/bin/pnpm with PATH prefixed inside the flock command, so
no login shell could reset the exports. Pre-run absolute checks: node --version v22.23.1, pnpm --version
11.24.0 (pnpm wrapper resolves to corepack 11.24.0). Log:
lane-logs/s12-web-pattern-focused-pinned-red.log, sha256
ac86bb0a912546356803a2785c4c1a9e73f9ab57782313a0f6cf63b424167171; header `node=v22.23.1 pnpm=11.24.0`.
Result: Test Files 1 failed (1); Tests 8 failed | 9 passed (17); duration 1.43s; VITEST_EXIT=1.

Every failure is an intended defect, not a fixture error: the six PatternPlacementResource list relay
positives, the request-binding/transport positive, and the legacy single-resource inverse all fail
because production still parses a single resource and rejects every list body. The nine guards pass.

After Prettier the test file is 298 lines and the support file 141, both <=300; prettier --check is clean.
No GREEN, production, spec or config edit was made; no full suite, DB, lint, typecheck, build, stage or
commit was run.

## Bounded Web GREEN (2026-10-13)

Owner-approved GREEN for the bounded Web lane (DEC-188/DEC-189). Production files changed:

- apps/web/src/server/cms-editorial-platform-bounded.ts: `readBounded` is parameterized by a maximum
  (the ordinary request and response exports stay hardwired at `CMS_EDITORIAL_MAX_BODY_BYTES` = 262144),
  and the new exported `cmsPatternPlacementBoundedResponseJson` reads the CMS-03C-02 success under
  `CMS_PATTERN_PLACEMENT_MAX_RESPONSE_BYTES` = 1,048,576 with the same fatal UTF-8 decode and
  over-cap refusal/cancel (no truncation).
- apps/web/src/server/cms-composition-platform-pattern.ts: the 201 success parses
  `PatternPlacementResourceSchema` (not a single row), validates every row against the request
  (revision/pattern/patternVersion/linkMode, optional digest equality, a row path descending from
  `slotPath` within 248 UTF-8 octets per DEC-186, unique ids and paths, producer position order), and
  validates the entry-aggregate ETag with `QuotedVersionSchema`, copying it unchanged.

Focused receipt (pinned absolute wrapper, login:false shell:bash, under flock -s /tmp/wejammin-quiet.lock;
node v22.23.1, pnpm 11.24.0): log
docs/handoffs/2026-10-12-claude-s12/lane-logs/s12-web-pattern-focused-green.log, sha256
f41ab941fe71c0478c20d1ccc18cb265ebe476271536b0970507351be97a05ba. Result: Test Files 2 passed (2); Tests
26 passed (26); duration 1.63s; VITEST_EXIT=0. The two suites are the placement proxy tests (including
the 512-row under-budget success, the schema 512/513 cardinality, the distinct entry-ETag positive, the
missing/weak/malformed/overflow ETag refusals, and the over-budget and lying-length 502s with cancel) and
the dedicated bounded-reader tests (1 MiB exact accepted, one byte over refused, lying length refused,
over-cap stream cancelled, fatal UTF-8, ordinary response reader still 256 KiB).

Prettier --write is clean on the touched files. The authoritative root type-check `tsc --build
tsconfig.json` exits 0 with no output (see "Follow-up: setup extraction" below); an earlier focused
`tsc -p apps/web/tsconfig.json --noEmit` showed 43 errors from unbuilt `packages/ui/dist`, which the
root build resolves.

### Unresolved integration issues

1. (resolved) apps/web/src/server/cms-composition-platform-pattern.test.ts was updated under a scoped
   follow-up authorization to the list contract; see "Follow-up: existing oracle and path binding" below.
2. The 1 MiB ceiling is an approved allowance, not a proven producer bound (DEC-189). The fixtures
   establish a schema-valid 512-row body under 1 MiB and an over-cap refusal, but not the actual
   producer's maximum serialized response. That maximum-size-against-real-producer gate remains open.
3. The row-path descendant and 248-octet checks here are the proxy's request-binding re-verification; the
   authoritative refusal (422 at `/slotPath`) stays the Worker/SQL boundary and is out of this lane.

## Follow-up: existing oracle and path binding (2026-10-13)

Owner follow-up authorized two corrections.

**Existing success oracle.** apps/web/src/server/cms-composition-platform-pattern.test.ts (the
pre-existing Slice 9 proxy test) was updated to the locked list contract: its `success` helper now wraps
the row in `{ items: [...] }`, the fixture row gained `position: 0` and its path is `/primary/hero`
(not the bare slot `/primary`), and the success case asserts the list body and a distinct entry ETag
`"42"`. Its error, header and request assertions were preserved; the invalid-ETag case changed from
`"2"` (now a valid entry tag, so not an error) to a weak `W/"2"`, which is genuinely invalid under BE00.
The genuine pre-update failure is recorded at lane-logs/s12-web-pattern-existing-oldcase-fail.log
(1 failed | 4 passed; sha256 89d44c8e24cea3e5e8d1cfbaefa30f39d6b964c375a42fbc8c97f5cf5eff5e53).

**Path-binding defect.** Root review found the first GREEN matcher accepted `row.path === slotPath`
(no block-root suffix) and `row.path === '/'` for the root slot, and a bare prefix match accepted
`/main/../hero`, `/main//hero` and a trailing separator. The matcher now requires the exact slot prefix
plus a `/` and a non-empty node chain validated by the exported `PatternNodePathSchema` (the locked
DEC-175/DEC-186 grammar; the public contract schema is unchanged), plus the 248-octet bound. RED was
proven before the fix: with the pre-fix matcher restored, the new exact-slot/empty/unnormalized/over-248
case failed with `/main: expected 201 to be 502`. The fix is recorded at
lane-logs/s12-web-pattern-path-binding-green.log (3 files, 31 passed; sha256
55b9c75c1c5b74b0b7c5890f8af7a471f1fecd65722e2daf7a7867d537f059b9).

### File inventory (corrected)

Production files changed: exactly two. (1) apps/web/src/server/cms-editorial-platform-bounded.ts owns the
parameterized `readBounded`, the new export `CMS_PATTERN_PLACEMENT_MAX_RESPONSE_BYTES` = 1,048,576, and
the new exported helper `cmsPatternPlacementBoundedResponseJson`. (2)
apps/web/src/server/cms-composition-platform-pattern.ts owns the list parse, `matchesPlacementRequest`
and the entry-ETag validation. An earlier summary's "three production files" was a miscount; the third
file is the test apps/web/src/server/cms-composition-platform-pattern.test.ts. Test files touched: that
existing test, the new placement test and its support, and the extended bounded test.

## Follow-up: setup extraction (2026-10-13)

apps/web/src/server/cms-composition-platform-pattern.test.ts was 314 lines at HEAD and 320 after the
oracle update, over the 300-line test limit. Its existing setup block (the `path`/`revisionId`/
`patternId`/`body`/`resource` fixtures and the `request`/`binding`/`success`/`error` helpers)
was extracted verbatim into a NEW exclusive file
apps/web/src/server/cms-composition-platform-pattern.test-support.ts (97 lines, now exported). The test
file dropped to 245 lines. Semantics and every original assertion are unchanged; no dense line packing
and no production change. The owned placement.test.ts stays 300 lines.

Focused receipt (pinned wrapper, login:false shell:bash, under flock -s /tmp/wejammin-quiet.lock; node
v22.23.1, pnpm 11.24.0): eslint --max-warnings=0 exit 0; prettier --check clean; root `tsc --build
tsconfig.json` exit 0 (no output); focused vitest 3 files / 31 passed. Log
lane-logs/s12-web-pattern-support-extract-green.log, sha256
4d150d99b2c89340e58a409ee1dffa560f1f60facbe190092229b32a7d8d4fcf.

Line counts (all <=300): bounded.ts 210, pattern.ts 261, bounded.test.ts 271, placement.test-support.ts
195, placement.test.ts 300, pattern.test.ts 245, pattern.test-support.ts 97.

## Unresolved limits

- Formatting: Prettier --write was applied to both owned files and prettier --check is clean.
- The canonical astro-framework reference (references/routing.md) is missing; the current endpoint and
  proxy pattern was used as the fallback described above.
- The response-ETag policy is resolved by BE00/BE03c:215 (entry aggregate ETag) and implemented in GREEN.
