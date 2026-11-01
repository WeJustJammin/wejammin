# DEC-193 selected-root receiving RED / GREEN handoff

Status: root observed behavioral RED; GREEN authored, FROZEN UNRUN.
Native `gpt-6.1-sol` / `ultra`.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Primary checkout remained read-only.

## Exact released scopes

RED: the two placement test files below plus this handoff. Dispatch line2457
at author start; both full regressions finished before that release.

GREEN: `apps/worker/src/cms-composition/pattern-instance-contracts.ts`,
`apps/web/src/server/cms-composition-platform-pattern.ts`, and this handoff.
Dispatch line2485 at author start, after root observed the actual RED below.
All tests, supports, contracts and configuration remain frozen during GREEN.
No SQL, tracker, primary checkout or unrelated path was changed in either pass.

## RED source basis and bounded receiving defect

BE03c line1485 requires only the named selected roots to be placed, independent
of the order of the request's roots array. Replacing a retired path may retain
its old position and use a positive successor version; new paths append.

At the RED baseline, Worker `pattern-instance-contracts.ts:206-231` and Web
`cms-composition-platform-pattern.ts:171-201` check pins and slot ancestry but
never consult `body.roots`. Consequently a publicly schema-valid response can
contain wrong or extra roots, omit a selected root, or return a selected root's
descendant rather than that exact root. The actual Worker route calls this
guard at line231; its production adapter calls the same guard at line213.
Web checks its matcher before returning201 at lines263-274.

No receiving requirement for a whole-forest count, version1, or consecutive
positions was found. Root's updated public schema requires increasing
positions, allowing gaps. `PatternNodePathSchema` has a512-character limit but
no segment/depth bound; any suffix fitting the stored248-octet path cap also
fits it, including72 short key segments. No placement preview/island consumer
was found in current Web source; the implemented Web consumer is its API proxy.

## Authored oracles

Each file adds one positive test and six independent `it.each` negative cases:

- Positive runs both nested slot `/main/sidebar` and root slot `/`.
- Selected roots are `['/namespace/hero2', '/hero0']`; response rows retain the
  reverse suffix order `['/hero0', '/namespace/hero2']` and producer positions
  `[4, 11]`, row versions `['2', '1']`, and independent entry ETag `"7"`.
- Positive asserts exactly one downstream call, unchanged selected request
  body, status201, unchanged response body/order and entry ETag.
- Negative cases: wrong root, extra root, missing root, prefix descendant,
  root-slot mismatch and nested-slot descendant.
- Every negative first asserts the response fixture passes the public
  `PatternPlacementResourceSchema`, then expects actual receiving status502.

These are receiving-boundary tests, not SQL allocation or expanded-forest
semantic proofs. A receiver can bind the exact selected suffix set but cannot
derive the producer's forest from these response rows. Existing authority,
pin, ETag, malformed forest, private-field, transport and omission-of-roots
oracles remain intact.

Web's sole historical change replaces the obsolete position-gap negative
`[0, 2]` with a genuinely invalid duplicate `[0, 0]`; its schema-invalid and502
assertions are unchanged. Root's new Worker sparse `[0, 2]` / versions
`['2', '1']` positive is unchanged.

## Static preservation evidence

Removing the appended DEC-193 describe block reconstructs the exact Worker
pre-edit bytes, SHA256:

`a5581f1804ab9ae6a17782786dd256da2ff1bb50709765112642650de6940924`

Removing the appended Web block and reversing only the authorized position
candidate `0` back to `2` reconstructs its exact pre-edit bytes, SHA256:

`0afe74e1d4d4d3b98e33bf7f9183d5f48c18db0ea2a643563e6da0f9ac1609c4`

Both reconstruction comparisons matched. No existing assertion, callback,
test title or control flow changed outside that one Web candidate literal.
Pure existing test supports were reused without modification.

## Actual root RED and GREEN implementation

Root observed48 cases:36 PASS,12 meaningful FAIL, no setup abort or skips.
Both new positive tests passed; all twelve negative fixtures were publicly
schema-valid and returned201 instead of the required502. Receipt:

`/tmp/wejammin-native-dec193-worker-red-YLjw7B/roots-binding-red.json`

SHA256 `677d3fb5f83a4439c880149de6e071c67b2b0aed8680a7917df49c5cd4776cf6`.

Both existing guards now build an optional set of exact full selected paths:
`slotPath === '/'` supplies an empty prefix; every other slot supplies its
literal prefix. When roots are supplied, response cardinality must equal that
set's size and every response path must belong to it. Public unique-path
validation makes this exact SET equality. No sorting, request-array order
expectation, inferred forest, or allocation/history logic was added.

When roots are absent, the new checks do nothing. All old schema, row pin,
digest, normalized-descendant, stored-byte, duplicate/privacy and ETag checks
remain. The old consecutive-position comments now describe strictly
increasing, possibly sparse positions. Worker route and production adapter
continue to use their existing shared validator; Web retains its local guard.

Static reconstruction removing only these new checks and restoring those
comments exactly matches both pre-GREEN source hashes:

- Worker: `8483823e783aac6a6e04320629093a5f57fd0ad795dee653cb6dcb0354112f7e`
- Web: `ed40a9a0feecaaf5a8d5cd75daf0156423d03799fbbbee39af93c06bd46e8100`

## Validation boundary and root next steps

No runtime, import, parser, formatter, test, lint, typecheck, DB, Docker,
network or Git command was run by this author. Source readback, byte/hash
comparison and line counting are static checks, not test execution.

GREEN runtime remains UNRUN by this author. Root owns focused confirmation,
mechanical formatting, scoped lint/type checks, broad regressions and
independent review. No passing GREEN or SQL producer proof is claimed here.

## Frozen authored test manifest

| Path | Lines | SHA256 |
| --- | ---: | --- |
| `apps/worker/src/cms-composition/pattern-placement-http.test.ts` | 350 | `fd57d94c7de4681054d44e3f88d226d54a3eed16267548b20b40129ef9d869a1` |
| `apps/web/src/server/cms-composition-platform-pattern-placement.test.ts` | 354 | `f262f78e96c39c4047094851ee68173e677b8b945898de65c333d137d0a60799` |

Both authored files remain below400 lines before root formatting. No extraction
or additional path is needed for this release.

## Frozen authored GREEN manifest

| Path | Lines | SHA256 |
| --- | ---: | --- |
| `apps/worker/src/cms-composition/pattern-instance-contracts.ts` | 243 | `bd0f34c1c95d985a877b44b12519d437ebe19fc75154adb391a3173b38bc4bd7` |
| `apps/web/src/server/cms-composition-platform-pattern.ts` | 283 | `ab8f270a0fff28dbbcef21f16652ae1971f4e778416eb26fc340f1954f6255bd` |

The frozen test hashes above were re-read unchanged after GREEN authoring.
