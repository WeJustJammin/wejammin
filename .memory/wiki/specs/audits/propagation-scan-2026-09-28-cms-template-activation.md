# Propagation scan — governed template activation

**Status:** spec-gap scan only; owner authority decision pending. No activation
operation, capability grant, or event producer is approved by this scan.
**Origin:** IA03 CMS-11 and Event Schemas; BE03c Endpoint Completeness
Reconciliation, API Endpoints, Permission/RLS, Data Flow, and Event Schemas;
Slice 12 CMS-03C-01.

## Locked boundary

CMS-03C-01 creates a draft template candidate. BE03c describes activation as
a separate governed transition: recompute the server digest, verify exact
compatibility, make the active version immutable, then emit the identifier-only
`cms.template.activated.v1` event. Its sole declared template mutation is the
draft-version POST. Neither IA03 nor BE03c assigns the activation decision to
an actor, operation, approval policy, or scheduled-state controller. The
existing template designer grant authorizes drafting and impact preview, not
an inferred activation command.

## Adversarial paths and spec gaps

| Path        | Defined behavior                                                                        | Missing behavior                                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Happy       | Designer submits a valid draft; server derives digest and returns a candidate.          | How an approved candidate becomes active and which human or policy authorizes it.                                                             |
| Malicious   | Draft write requires a current scoped designer grant; RLS denies direct table mutation. | Whether a designer, reviewer, or a separate approver may activate another owner's version; the 403/404 disclosure boundary for that decision. |
| Incompetent | BE00 rejects malformed draft commands and reconciles duplicate draft submissions.       | Activation request shape, stale version and incompatible-block recovery, and whether a scheduled activation is cancelable.                    |
| Concurrent  | Draft creation uses key/version CAS.                                                    | Two simultaneous activations for one template key, atomic active-version switch/outbox emission, and exact replay response.                   |

SPEC GAP: BE § API Endpoints — no governed template-activation operation or
request/success/error contract is registered — callers cannot activate a
candidate through the protected API, while adding an ad hoc route could bypass
review — owner must choose the activation authority and approve a distinct
operation, including scope, expected version, idempotency, and 403/404 rules.

SPEC GAP: BE § Permission, RLS and grants — “separate governed transition”
does not identify the approving actor, evidence source, or whether distinct
humans/MFA are required — a designer could self-approve or activate a hidden
owner's template if authority is inferred from draft permission — owner must
choose designer-only, reviewer-gated, or policy-derived multi-human approval
and decide the scheduled-state semantics.

SPEC GAP: BE § Data Flow — digest recomputation and event timing are described,
but no activation CAS, same-key lock, outbox/idempotency identity, or lost-
response reconciliation is specified — concurrent requests could leave two
active versions or duplicate the event — define one atomic switch with exact
version fencing, same-key serialization, replay, and no event on refusal.

SPEC GAP: FE § CompositionTaxonomyLocalizationWorkbench — the human form covers candidate
definition but no activation/review interaction or recovery state — users
cannot see who may approve or how to recover from stale or blocked activation
— after the owner authority decision, specify the authorized control, status,
and safe 403/404/409/422 recovery without exposing approval internals.

## Cascade after owner decision

Amend IA03, BE03c, and FE03 under the progressive decision lock; register a
strict Zod operation and route/OpenAPI entry; then implement a forward-only
private activation RPC, Worker adapter/route, browser flow, and atomic audit
and outbox tests. Verify both legitimate and cross-owner/unauthorized roles,
stale and duplicate submissions, concurrent switch, dependency drift, and
hosted behavior. This scan changes no locked contract and closes no Slice 12
criterion.
