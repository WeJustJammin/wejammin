# S11 submit-contract fixture-only ordinal and weak-ETag correction

Status: source-reviewed selected next fixture design; author UNRUN until current
E7 QA gate and clean pushed checkpoint. No production/schema change.

Sole file tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts.
Native apply_patch/purefsJS source inspection only; no commands/subprocess/tests/
scripts/DB/network/Git/format/canonical flush/other edits. QA400hard350target.
Root owns all actual validation/checkpoints.

## Superseded revision case: actual revision ordinal, not UUID

Existing appendEntryBody call135 passes fixture.draft.revisionId as baseRevision.
packages/contracts/src/cms-editorial/requests.ts22 and BE03b251 require the target
entry positive decimal revision NUMBER, distinct from revision UUID and entry CAS.
Actual old APIlog4811 reports422VALIDATION_FAILED expected201 at141; body validator
rejects beforeRPC. Exact live violation contents remain unobserved.

Obtain actual current draft via existing public CMS03B11 GET route, assert200 and
strict EntryDraftDetailResourceSchema.parse. Extract its actual revisionNumber
using the canonical schema member; source-read exact route/member before coding.
Pass only this ordinal to appendEntryBody's baseRevision parameter. No invented
'1', source-token oracle, direct mutation, new helper or request schema relaxation.
Keep parent revision ID if separately required by request and current entry CAS
operand fixture.draft.entryVersion unchanged; entry version is NOT baseRevision.

Retain original case title:
[CMS-03B-05] superseded revisions refuse revision_not_submittable using the current entry operand.
Append must still succeed201; subsequent older revision submit must still refuse
exact409CONFLICT reasonCode revision_not_submittable using current entry operand;
all refusal/noeffects assertions remain. GET must not warm settings/preflight.

## Weak-ETag case: full duplicate violation array

QuotedVersionSchema request-navigation-security.ts54–64 performs regex plus
continuable range refinement. Root actually imported current installed schema and
safeParse('W/"1"'): failure with two issues invalid_format/custom (empty paths),
local schema-only evidence, NOT actual API response proof.
admission-common.ts51 projects both to closed tuple:
path:'/ifMatch', code:'invalid_value', existing canonical redacted message.

Current exact admission oracle263 has one violation for every dynamic fault.
For weak-etag ONLY expect complete TWO identical projected tuple rows, retaining
order/multiplicity/message; all other dynamic faults keep their original exact
single tuple/status/code/path expectations. Do not filter/dedupe/toMatchObject or
relax shared schema/projector. Read existing message literal/source before editing.
400INVALID_REQUEST/zeroRPC/every durable fingerprint remain mandatory.

Retain [CMS-03B-05] weak-etag is refused before RPC and before every durable effect,
all other titles, request operands and assertions. Source-only diagnosis plus
actual schema parse warrants expected multiplicity; corrected route behavior still
requires root focusedrun. Do not infer opaque hash mismatch contents.

## Delivery

FROZEN/UNRUN; soleclaimreleased; physicalcap; exact authorized changes/new GET
request+strictparser selector provenance; all unaffected statements/oracles exact.
No diagnostic widening/rawdetails, production/contract/SQL/auth/grant changes,
skip/only or acceptance claim. Root runs focused source-backed API tests plus
mandatory full gates; current E7 producer remains separate.
