# Entry default-template initialization — proposed contract precision

Status: owner-approved DEC-202 design, NOT implementation release. Native
`gpt-6.1-sol`/`ultra`. Root read original normative clauses and source; a bounded
independent native inventory agrees. Happy-path TEST-only work is dispatched.
Failure mapping approved by the human and recorded immediately in DEC-202.

## Existing normative facts

- FE03:1265–1285, specifically1274: the schema successor default is the template
  new entries start from. The initial content type itself is templateless.
- BE03a:120/206/209, DEC-123: a real successor can replace the exact default and
  binding list using the compatibility resolver against that candidate. New
  type creation accepts NULL only; this does not make all entries templateless.
- IA03:279/285–286: optional schema default, atomic first draft with its entry,
  immutable saved revision carrying recorded schema/template references.
- BE03b:1041–1051: strict EntryCreateRequest has no template operand.1930 uses
  JSON pointer-array DETAIL;1932 conceals404 and bounds safe violations.
- BE03b:1723–1741: relation targets2 precede dependency3 and schema4; recheck
  after waits. Completed idempotency replay must keep its original result.

## Actual gap

Create18040:105–121 resolves and locks the authorized active schema. Its first
revision INSERT:330–339 hardcodes SQLNULL instead of that schema's stored
default. No insert trigger initializes it. Append18045, resolve18050, locale
variant and restore18055 preserve a previously recorded pin; they are not an
alternate initializer. Placement14110300 and manifest17560 consume the stored
revision pin, without latest/default fallback. The earlier restore-template
QA's honest storage seam does not prove this public producer.

## Bounded intended implementation

Derive only the exact authorized active version's `default_template_version_id`.
Preserve SQLNULL when absent. Lock the same-owner template at position3 BEFORE
schema4; re-read/recheck the schema/default after waiting. Resolve compatibility
against that exact type/version with the existing private resolver. Its source
132000:38–57 permits superseded templates and rejects retired/blocked; do not
introduce active-only behavior. Store the derived pin in the first revision.
No new request member, first-binding/latest fallback, composition fabrication,
history rebind, append/resolve/restore changes, or response-shape change.

Do not blindly reuse `cms_successor_template_gate`: its structured violation
DETAIL is not the entry command's pointer-array convention. Preserve actor,
party and author/editor authority, assignment creation, completed replay,
hashes, audit/outbox, E7 tail, wrapper metadata/ACL/comment and deadlines. Use a
new forward-only migration; all executed migrations remain immutable.

Pre-existing source discrepancy: create18040:254 resolves relation targets
after its schema4 lock:121. This needs separate genuine lock-order QA and a
source-backed correction; default initialization cannot silently claim it is
already ordered. Reusing that late block to acquire dependency3 is forbidden.

## Confirmed human choice — DEC-202

Existing resolver tokens proposed for initial default resolution:

| Condition | Proposed existing create response |
| --- | --- |
| Missing/concealed same-owner template |404 NOT_FOUND, no details |
| Incompatible exact default |422 VALIDATION_FAILED, `["/contentTypeVersionId"]` |
| Retired/blocked template |409 CONFLICT |

NULL default stays unchanged; superseded remains eligible. Translate only
these expected tokens and let unexpected faults propagate. No nonexistent
`/defaultTemplateVersionId` request pointer and no new503 semantics. BE03b's
create matrix1920 does not explicitly tie these conditions to the derived
default. The human chose "Use resolver policy (Recommended)"; DEC-202 now locks
this precision. Downstream BE/FE/tracking propagation remains required before
implementation release; no gate is cleared by the choice.

## TEST-first receiving work

NEW `supabase/tests/phase_02_slice_12_entry_default_template.sql`, owned by
native_registry_green_20261016, uses actual governed compatible template,
actual compiled/activated successor with its stored default, actual public
service-role entry creation and literal first-revision pin readback. Include a
real active no-default contrast; do not fake a pin through storage. All fixture
premises must pass before oldNULL is meaningful RED. Enclosing rollback.

Further required coverage after contract precision: real template-slot
placement/manifest; T2 activation without latest substitution; later default
changes without historical rebind; exact replay after withdrawal; concealment,
refusal pointers, injected late-fault atomicity/same-key retry; real two-client
template retirement/schema activation and relation ordering. No canonical,
slice, hosted or phase acceptance follows from this proposal.

## Propagation apply confirmation requested

The scan is `.memory/wiki/specs/audits/propagation-scan-2026-10-17.md`.
Root read original affected clauses and asked the human to confirm minimal
IA/BE/FE/tracking corrections, retaining SQL/Web fixes as OPEN TEST-first work.
Proposed eleven independently testable receiving properties (candidate next
IDs286–296, recheck uniqueness/count at apply): exact default pin, NULL default,
superseded eligibility, concealed/missing404, incompatible422 pointer,
withdrawn409, exact completed replay afterwithdrawal, author/editor-only
authority, relation2/template3/schema4 fencing, unchanged recordedhistory and
full-store late-fault atomicity/same-key retry. No source spec/criterion edit
until the workflow confirmation; existing285 remainunchecked.
