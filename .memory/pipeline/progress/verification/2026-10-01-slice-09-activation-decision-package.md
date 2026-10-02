# Slice 09 activation authority decision package — owner approved

**Date:** 2026-10-01  
**Status:** owner approved the concrete amendment on 2026-10-02; specification
cascade and implementation pending. Approval closes no criterion. The
pre-cascade baseline is **262/279 active** after the separately verified
AC250 disclosure criterion closed on 2026-10-01. The 17 reopened CMS-03A-04
activation-chain criteria still gate Slice 10 implementation.

**Concrete proposal:** [activation producer contract amendment](2026-10-01-slice-09-activation-contract-amendment-proposal.md).
It specifies successor/dry-run/review/decision/assignment commands, an
owner-only review assignment capability, new evidence/identity invariants,
and the minimum source/template prerequisite correction. This proposal is
approved for locked-contract cascade and implementation, as recorded in the
[exact approval record](2026-10-02-slice-09-activation-amendment-approval.md).
Approval creates no accounts/grants and closes no criteria. The abstract choices
below are historical and superseded by the approved concrete package wherever
the two differ.

## Why the present path cannot pass

1. The initial activation audit found that `cms_activate_schema` required the nested context to contain exactly
   `actingContextId` (`20260902080000_content_schema_registry_authority.sql:4604`),
   but the production Worker's `contextFor` did not supply that key. Sending
   only `{actingContextId}` is not a fix: the service-role `cfg_actor` also
   requires the verified `authUserId` (or an authenticated JWT/GUC), so the SQL
   gate must accept a server-authenticated actor context **and** the binding ID.
   `auth_session_read` now returns the validated per-tab binding row ID as
   `actingContextId` in its service-role-only response (`20261001120000`),
   and the Worker now retains it in the internal authentication session and
   request-keyed CMS registry context. The subsequent [local transport
   remediation](2026-10-01-slice-09-activation-transport-and-disclosure.md)
   now sends it only in the private activation RPC and admits the trusted
   server envelope at that nested gate. Root verified 13/13 adversarial pgTAP
   assertions, the full database suite, and complete local application
   validation. It still stops at `APPROVAL_INVALID` without real review
   evidence; the stable review-binding contract is not implemented. The
   binding ID remains server-side;
   the confirmation can show a disclosure-safe verified-context label and
   recent-MFA status rather than a raw ownership identifier.
2. Activation reads approved CMS candidate evidence from CFG review/approval
   tables, but production CFG commands create only settings reviews and
   `settings.approve` decisions. The CMS version's `approved` transition has no
   production producer. Hand-inserted fixture rows do not satisfy acceptance.
   The current `effective_context_hash` hashes the entire activation context;
   transient request/correlation IDs would make a separately submitted review
   fail to match. A spec amendment must define a stable, server-derived
   actor/party/binding projection for that hash or a dedicated CMS binding.
3. The dry-run worker finalizes only an already leased `dry_running` migration
   plan, while the only plan inserts occur during activation. The initial
   version's zero-row additive report does not provide a successor migration
   path. The eight-operation BE03a registry has no successor-draft authoring or
   pre-activation dry-run command; silently adding either would violate the
   locked route registry.

## Historical owner choices (resolved by the approved amendment)

- **CMS review authority.** Recommended: a dedicated private CMS candidate
  review/decision ledger and protected commands. Alternative: generalize the
  CFG ledger with an explicit CMS candidate type and CMS approver capability;
  do not mislabel schema versions as `setting_value`. Both retain policy-derived
  counts, distinct humans, specialist capability, recent MFA, and frozen
  candidate/policy evidence.
- **Dry-run initiation.** Recommended: protected explicit command that starts
  an immutable report before review and activation. Alternative: start it
  automatically when CMS review is submitted. Both require a protected
  successor-draft command, real migration-plan producer, and the same
  server-verified acting-context path.

The existing `ContentTypeDraftRequest.templateBindings` and
`cms_create_type_draft` **do** produce initial template-binding rows; AC169
does not require an invented initial binding route. However, the sole current
resolver, `cms_template_registry_valid`, checks only template existence across
candidate tables. It does not compare the template's `compatible_type_ids`
with the parent content type, and the "named compatibility RPC" in BE03a:1015
has no defined name or contract. The 2026-10-01 local binding/activation guard
now rejects incompatible owner/type references, but adds no named compatibility
RPC or positive producer. The 03c template producer accepts only already-active
content type IDs, while CMS-03A-01 creates a new draft type; consequently a
valid nonempty initial binding to that new type is not yet
reachable. The successor-draft command is therefore needed for a real
compatibility-aware binding path, not only for migration dry runs. AC169 remains
unchecked, including its activation-dependent immutability proof.

BE03c also says template activation is a separate governed transition and
requires a block-registry digest recheck at that transition. Its template
definition RPC creates draft candidates but supplies no public activation
command or `cms.template.activated.v1` producer. That is a separate Slice 12
positive-path gap: a draft cannot be claimed as an activated public template.
It is not an extra Slice 09 AC169 gate. BE03a's field validation requires a
readable immutable compatible template version, and its binding table requires
immutability after the parent schema activates, not public template activation.

The planning dependency still needs an explicit correction: Slice 12 owns the
03c definition authority but declares Slice 09 complete as its prerequisite.
The concrete proposal brings only immutable template-draft creation and a
named protected compatibility resolver into Slice 09's prerequisite scope,
alongside the minimum source-row/scan authority required for real migration
proof. Remaining Slice 10/12 work stays gated. A fixture template or source row
does not replace these producers; no active public template is claimed.

The choices are confirmed. Cascade from the originating IA/BE03a/FE03
contracts into the Phase 2 plan and Slice 09 tracker, preserve the verified
actor/binding transport regressions, then run RED→GREEN tests for CMS review
approval, dry-run production, and end-to-end activation. Keep all 17
activation-chain criteria unchecked until
those tests cover the non-fixture production path. AC250's separate local
disclosure verification does not prove activation authority.
AC209/AC211 remain post-deployment/post-launch,
and AC265/AC266 remain pre-release gates; none is waived by this package.
