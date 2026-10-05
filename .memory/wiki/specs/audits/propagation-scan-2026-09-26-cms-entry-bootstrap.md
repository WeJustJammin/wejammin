# CMS entry bootstrap and draft-read propagation scan

Owner decision DEC-106 (2026-09-26): add protected initial entry creation and authorized draft-detail reads to Slice 10. IA03 CMS-05 already promises entry create/edit, but the current BE03b route set can only revise an existing active entry with a readable positive base revision. Its history GET returns hashes and summaries, not editable values. Direct browser table grants are revoked.

## Pre-scan and selection

Decision type: CMS authoring API architecture and implementation scope. The owner selected protected create and read routes directly. Explicit CMS-05/CMS-03B-01 references occur in IA03 and its deep dive, BE03b, FE03, the Phase 2 plan and Slice 10 tracker; BE03a and BE03c cross-reference CMS-05 but do not define its transport. Dated session records are historical.

## Classification

| Surface | Classification | Correction |
| --- | --- | --- |
| IA03 CMS-05 and deep dive | Implicit assumption: an assigned active entry and current draft already exist when the flow opens | Specify protected bootstrap of the first entry/revision, then assigned author/edit of existing drafts; no caller-selected authority |
| BE03b route registry, contracts, data flow, authorization, errors and tests | Explicit omission: no create operation can satisfy the positive base-revision guard; no read operation returns editable values | Append stable new operation IDs without renumbering CMS-03B-01 through -09; define strict create and detail contracts, policy-safe 401/403/404, idempotent atomic create, authorized no-store detail read |
| FE03 CMS-05 interaction, route map and data mapping | Explicit omission: editor has no protected draft loader or first-entry command | Add create and detail mapping with generated contracts, safe server-derived context, field-linked errors, focus/unsent-value recovery and canonical refetch |
| Phase 2 Slice 10 plan and tracker | Explicit omission: 60 criteria name only revision, conflict, history and restore endpoints | Add testable criteria for create/detail across contract, policy, state, concurrency, failures and UI; update authored/active totals and depth floor coherently |
| BE03a/BE03c cross-references | Consistent but potentially implicit consumer assumption | Preserve their existing CMS-05 references; inspect for any dependency sentence that assumes revisions are the only entry ingress |
| Runtime code, DB, CI and runbooks | Not yet implemented for editorial workflow | Implement only after contract propagation, with RED→GREEN tests, RLS, audit/outbox and no direct browser table grant |
| Slice 09 and other acceptance gates | Consistent and out of scope | Retain AC209/AC211/AC265/AC266 timing and evidence obligations unchanged |

## Implicit assumptions and invariants

- Initial entry creation is not a special case of CMS-03B-01: that operation retains its existing active-entry and positive-base-revision checks.
- Only the authenticated server may derive actor, acting party, ownership, capability and initial assignment. The request cannot assert them.
- A draft detail response must be limited to the authorized entry, current revision, and schema-valid editable values/provenance; no anonymous or cross-tenant fallback is permitted.
- The collection-create request has no existing resource version to match. Its idempotency/precondition rules must be explicit rather than silently reusing update-only `If-Match` wording.
- Existing nine BE03b operation IDs and Slice 09 implementation/evidence accounting remain stable. New Slice 10 criteria are additive and must not be counted complete before code and verification.

## Apply targets

Record DEC-106; update IA03/deep dive, BE03b, FE03, Phase 2 plan, Slice 10/Phase 2/overall progress accounting, relevant consistency checks, and tests. Compile the spec graph and run relevant consistency/validation gates. The owner already approved the protected create/read routes; no additional permission is required for this scoped propagation.


<!-- spec-graph: auto-generated -->
## Related Specs

### Phases into
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]

### References
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]
