# Pattern-placement payload reconciliation — owner approved DEC-189

Root: `gpt-6.1-sol`, `ultra`. The owner approved the scoped correction; specification cascade is
in progress. Production transport limits have not yet been changed or accepted.

## Current authority and evidence

- BE03c CMS-03C-02 registry (line 160) and placement rule (line 1360), under DEC-181,
  allow an `items` list of 1–512 composition rows after nested-pattern expansion.
- BE00 global input/collection limits (line 488) cap ordinary JSON responses at 256 KiB.
- The Worker production adapter defaults to `MAX_DEFAULT_RESPONSE_BYTES = 256 * 1024`
  (`apps/worker/src/cms-editorial-production-types.ts:65`).
- The Web proxy's streamed reader stops at 262144 decoded bytes
  (`apps/web/src/server/cms-editorial-platform-bounded.ts:34,53,64`).
- Root calculated the exact serialized current Worker fixture for 512 rows: 289473 bytes,
  exceeding 262144 by 27329. This is derived fixture evidence, not a runtime test result.

The cardinality contract alone does not establish that a schema-valid body fits the transport
budget. The existing 512-row transport-positive oracle therefore cannot identify only a list-parser
defect. No universal byte cap may be widened silently to make it pass.

## Approved resolution — implementation and producer-bound validation pending

Keep the 512-row placement contract and apply a CMS-03C-02-only, response-only ceiling of 1 MiB
through the originating locked-spec correction workflow. Requests and unrelated routes remain at
256 KiB. The owner explicitly approved this recommendation with “approve both and resume” on
2026-10-13; DEC-189 records it. The 256 KiB/revised-placement alternative was not selected.

The 1 MiB proposal is not a proven universal bound on every schema-valid response. After approval,
validation must derive a maximum from the actual producer's bounded paths, timestamp encoding and
other serialized fields, then prove maximum-sized successful bodies and over-budget refusals. The
current fixtures establish the 256 KiB conflict, not that every allowed placement fits 1 MiB.

## QA boundary before a decision

Worker and Web lanes separate direct schema cardinality tests (512 accepted, 513 rejected)
from bounded transport positives (1, 2 and 33 rows). Oversized schema-valid bodies characterize
the current fail-closed transport limit. These subsets do not prove SQL atomicity, a new response
ceiling, or complete Slice 12 acceptance. Response ETag semantics remain a separate integration
question: the list has no aggregate version and no invented public field is authorized.
