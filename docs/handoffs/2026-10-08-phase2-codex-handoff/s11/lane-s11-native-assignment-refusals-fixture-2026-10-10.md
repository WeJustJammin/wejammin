# S11 assignment refusal fixture-only next correction

Status: source-reviewed selected next fixture design; author UNRUN until current
SQL QA wave freezes, actual gates/receipt and clean pushed checkpoint. No producer.

## Sole scope and execution

Only tests/postgrest/phase-02-slice-11-assignment-refusals.apispec.ts.
Native author apply_patch only, purefs/JS source inspection; no commands/subprocess/
tests/scripts/DB/network/Git/format/canonical flush or other edits.
QA hard400/target350. Root executes all actual validation and checkpoint.

## Exact source-backed changes

Old full API gate log parent-s11-first-gate-fixtures-db-verify-validate-20261010.log
4638–4650: the one refusal case stops at MFA_METHOD_REGISTRY is not iterable.
The contracts import at17 has no current export. BE01a method registry112 locks
launch allowedMethods exactly['totp'], independent of enrollment. Remove ONLY
that import and replace [...MFA_METHOD_REGISTRY] at78 with literal['totp'].
This is an independent locked test expectation, not a new contract export or
auth-method policy/provider change.

The same case has latent stale strict details at101–105 and165–169:
remove conflict:'INVALID_TRANSITION' and recoveryAction:'refresh' ONLY for
registered reviewer_not_eligible and assignment_exists details. BE03b1917,
packages/contracts/src/cms-editorial/refusals.ts163–169 and typed-first
apps/worker/src/cms-editorial/workflow-error-details.ts134–148 allow reasonCode
plus expressly named members, not generic conflict members.
Retain exact statuses/BE codes/reasons and every no-effects/CAS/concealment check.

Duplicate revoke's generic details at226 MUST remain:
{conflict:'INVALID_TRANSITION',recoveryAction:'refresh'}.
Its SQL raises generic CONFLICT, not a registered Slice11 reason.
Do not globally rewrite generic conflicts or change error grammar.

## Preservation and delivery

One original title retained verbatim:
[CMS-03B-18] step-up, eligibility, duplicates, expiry bounds, revoke and conflict.
All RPC/reservation/step-up no-effects, freshness loops, expiry bounds, assignment
success, duplicate/revoke/concealment operands and assertions unchanged.
Only exact six approved textual changes; inverse whole-file comparison should be
byte-exact modulo parent formatting. No diagnostic widening or raw response output.

Independent s11_api_foundation_refutation found source-backed stale fixture,
not production defect; old failure proves import setup failure only. Latent typed
oracle changes are source-backed but actual later refusal reasons/no-effects
remain unproven until root focused execution. Return FROZEN/UNRUN, caps/exact
changes/preservation/source mapping and release sole claim.
