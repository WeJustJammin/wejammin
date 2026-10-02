# Propagation scan — protected CMS conflict-detail read

**Status:** spec-gap scan only; no new endpoint, browser value projection, or
authorization is approved by this record. Slice 10 criteria stay open.
**Direct decision type:** extend the locked CMS-06 flow with an authenticated,
entry-scoped conflict-detail read before the existing resolve command.
**Origin:** IA03 CMS-06; BE03b endpoint reconciliation, route registry,
`ConflictRecordResource`, and security controls; FE03 CMS-06 native form;
Phase 2 Slice 10 AC-010..015 and AC-053..055.

## Current locked boundary

IA03 requires a same-field conflict to surface the common base, theirs, and
yours values and to preserve both competing revisions until an explicit
choice succeeds. BE03b defines a durable private conflict record and the
`POST /api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve` command,
but its authoritative route registry has no read operation for the record.
`GET /api/v1/cms/entries/{entryId}` returns only the current editable draft;
history/compare returns safe summaries and diff hashes, not the three
editable preimages. The existing `ConflictRecordResource` includes IDs,
hashes, paths, and sometimes proposed yours values, but not the complete
base/theirs/yours value projection required by the form. FE03 calls for a
native conflict form without naming a protected loader. Current code has a
resolve transport but no conflict-detail GET, first-party read proxy, or
native conflict page. Browser table grants remain forbidden.

## Reference classification

| Source | Classification | Consequence |
| ------ | -------------- | ----------- |
| IA03 CMS-06 acceptance and interaction | Explicit requirement | The actor must inspect all three readable preimages before choosing. |
| BE03b eleven-operation reconciliation and route registry | Explicit contradiction | The declared API provides only a resolve POST for CMS-06; an extra route cannot be silently invented. |
| BE03b `ConflictRecordResource` and private conflict table | Consistent but insufficient | Durable metadata and a possible proposed value are not a complete, authorized three-way view. |
| FE03 CMS-06 interaction | Implicit assumption | A native form needs a protected value loader, error mapping, and refresh on moved-base 409. |
| Phase 2 Slice 10 AC-010..015 and AC-053..055 | Downstream dependency | A resolving command alone cannot prove the full CMS-06 user flow. |
| Contracts/Worker/web implementation | Consistent with declared POST only | No guarded read route or native conflict-detail surface exists. |

## Adversarial paths and missing decisions

| Path | Existing protection | Missing contract |
| ---- | ------------------- | ---------------- |
| Happy | Resolve requires explicit choices, If-Match, idempotency, and CAS. | Named GET, strict query/response, and immutable base/theirs/yours values with field provenance. |
| Malicious | Private conflict rows and RLS prevent direct browser table reads. | Read capability/assignment, actor and acting-party binding, 403/404 concealment, and no cross-tenant value disclosure. |
| Stale | Resolve can return typed 409 when the base moves. | A fresh authorized detail read and ETag/version rule before repeating an explicit choice. |
| Degraded | Existing resolve route has bounded deadlines and typed ApiError. | Read timeout/rate/cache controls, partial-value refusal, and retained unsent choices/focus on failure. |

SPEC GAP: IA/BE/FE — the values required for a truthful CMS-06 three-way
choice have no protected read operation. A form must not fabricate values from
hashes, reuse the current-draft read as historical evidence, or expose private
rows directly to the browser.

## Proposed owner decision and cascade

Approve or reject adding a separate protected `GET
/api/v1/cms/entries/{entryId}/conflicts/{conflictId}` operation. If approved,
amend IA03, BE03b, FE03, and the Phase 2 plan together. BE03b must define a
strict bounded conflict-detail resource with exact base/theirs/yours
value/provenance semantics, immutable revision and schema IDs/hashes, current
conflict version/ETag, assignment/read scope, 403/404 disclosure, no-store,
rate/deadline, and 409 refresh behavior. Then add Zod/OpenAPI, private
read-only RPC, Worker route, first-party proxy, native form, and RED→GREEN
tests for legitimate, hidden, revoked, stale, and cross-tenant reads. No
contract or criterion is changed by this scan.
