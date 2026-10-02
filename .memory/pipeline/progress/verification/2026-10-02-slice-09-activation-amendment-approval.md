# Slice 09 activation amendment — owner approval

**Recorded:** 2026-10-02T02:06:54Z (UTC)  
**Status:** owner approved; specification cascade and implementation pending.  
**Approval:** the user explicitly approved the activation amendment in this task.

## Approved source

[Activation producer amendment](2026-10-01-slice-09-activation-contract-amendment-proposal.md),
as read immediately before recording approval, SHA-256:
`e481bb9046703bbbd5ace3ef60b30d75bf21fb766f77477481e8a4cfcdaf33ca`.
This digest identifies the approved proposal before its status is updated.

## Authorized cascade and implementation

- Private CMS-owned review, append-only decision and bounded assignment records;
  CFG review records remain settings-owned.
- Protected successor, dry-run, review submission, decision, review-detail and
  assignment commands CMS-03A-09 through CMS-03A-14, with the specified
  idempotency, CAS, audit/outbox, privacy and error contracts.
- Approval-only `cms.schema_review` and owner-only `cms.schema_review.assign`;
  assignments cover only read/decide on one frozen review, expire within seven
  days and no later than the grantor's authority, and confer no other authority.
- Server-resolved actor/binding/MFA, stable review-binding evidence, private
  identifiers kept out of browser resources and telemetry, and safe preparation
  and confirmation projections.
- Real successor/dry-run/scan/transform/review producers and the integrated
  first/second activation paths; no hand-inserted evidence substitutes.
- Only the minimum source-row, scan/transform and immutable compatible-template
  prerequisites move into Slice 09. Remaining Slice 10/12 work stays in place;
  public template activation remains a separate Slice 12 contract gap.
- Cascade through IA/BE/FE, capability and route/OpenAPI contracts, the Phase 2
  plan and progress tracking. Add open criteria and recompute the depth floor
  rather than retaining 279 as the final amended denominator.

## Boundaries retained

This approval creates no real account, assignment, grant, provider enrollment,
paid plan, deployment or acceptance receipt. The owner remains the sole admin.
Existing private-binding transport is already authorized and locally verified;
it is retained, not reclassified as an unapproved change.

AC250 remains independently verified and closed, with its regression checks
retained. The proposal's historical “18 reopened criteria” wording is reconciled
to the current 17 open activation criteria plus the already verified AC250;
approval itself closes none of them. Newly specified criteria remain open until
implemented and verified. AC209/AC211 stay post-deployment/post-launch;
AC265/AC266 stay mandatory pre-release gates, authored and unchecked.

The current pre-cascade baseline is Slice 09 262/279 active (283 authored),
Phase 2 8/17 and 1,475/2,011 active-checked. Slices 10–17 remain gated until the
amended Slice 09 implementation requirements pass.
