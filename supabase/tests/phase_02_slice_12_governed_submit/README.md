# Slice 12 governed-submit test support

CMS-03C-06, native lane `native_s12_governed_submit`.

Status: **AUTHORING ONLY / UNRUN**. The previous sixth ALT diagnostic passed 48/48
with synthetic active-type prerequisites. That result does not validate this
60-assertion rewrite. No integrated acceptance, AC tick or signature is claimed.
All six historical receipts remain in
`../../../docs/handoffs/2026-10-12-claude-s12/lane-native-governed-submit-report.md`.

## Foundation and provenance

Unchanged S09 DEC108 00/01/02 and DEC119 00 fragments run first. Actual
`initialize_cms_owner` creates the owner organization/receipt before any legacy
CMS grants exist. Existing disposable local Auth/provider/member scaffolding is
test provisioning only—not hosted Auth, MFA or membership-workflow proof.

Unchanged S10/h11 includes retain their original seven neighbor assertions. Their
raw activation and synthetic approval evidence remain labeled legacy setup.
No governed subject, acting identity, standing grant or bound type derives from
those fixtures. S09 request/session state is explicitly reset across the boundary.

- `000-fixtures.sqlinc`: S09 mappings, real template creation, immutable captures
  and scoped snapshots. Actual `SET LOCAL ROLE service_role` surrounds the public
  governed call in a SECURITY INVOKER wrapper. Only that RPC is caught; role
  changes, restoration and capture DML are outside the handler. SQLSTATE, message
  and PG_EXCEPTION_DETAIL are retained.
- `005-real-type-chains.sqlinc`: real CMS-03A-15 grants; ordinary/protected
  create/compile/dry-run/review/independent-decision/activate chains; nine new
  producer controls. Zero-source dry runs are checked as zero-source, not proof
  of nonempty migrations. Templates use CMS-03C-01.
- `010-projection.sqlinc`: unchanged private read wrappers. Temporary
  `app.cms_rpc` read context is restored exactly; it is not a disabled guard or
  positive state writer. S09's approval selector uses the same read convention.
- `015-dependency-fault.sqlinc`: negative-only NULL-policy seam on one validated
  real version. The exact saved header is reused; only prosrc changes. Every
  other argument, including NULL, raises a scope violation. No positive fallback,
  temporary-table lookup or GUC occurs inside the replacement body. Full relevant
  row snapshots precede/follow the service-role request **before** restoration.
  Exact definition, pg_proc/OID/owner/ACL/comment, settings/role and original
  positive evidence must be restored. Setup/snapshot/catalog/restoration errors
  abort the transaction. No guard disabling, policy-row DML, widened permission,
  applied-file edit or permanent hook occurs.
- `020-idempotency.sqlinc`: original 13 assertions retained; only the malformed
  request's context now uses the real binding. Full replay/mismatch snapshots,
  active-flag-only negative revocation and exact saved grant restoration remain.

## Assertions and limits

`plan(60)` = original 48 + nine producer controls + two fault controls + one actual
role/restoration control. Nine public calls: three successes and six refusals.
A failed setup is never credited as denial.

`s12gov_snapshot` covers full scoped subject/review/dependency rows but excludes
idempotency; audit/outbox are count-only. `s12gov_scope` adds full idempotency rows,
still with count-only audit/outbox limits. The dependency fault separately checks
full ordered rows of all 21 named relevant stores, including audit/outbox. None
proves universal atomicity, races, hosted identity/MFA or remaining acceptance.

Owned SQL stays below 300 lines. Main enables ON_ERROR_STOP and ends in ROLLBACK.
Unexpected error, cancellation or disconnect during a fault must roll back the
whole disposable transaction; never commit with a fault installed. Independent
review and separate root DB release remain mandatory. A live ACL/security
mismatch is a stop, not repair permission. Definition versions/frozen pins remain
immutable (DEC-188); DEC-189's placement ceiling does not apply to this producer.

## Governed-fix addition (2026-10-14)

`030-hash-refusal.sqlinc` is included after the role-control assertion (the control counts exactly nine calls) and adds
14 assertions: a stored-hash mismatch is `VALIDATION_FAILED` with DETAIL `["/subjectHash"]` (BE03c 389, 1259; FE03 1115),
not 409. `plan` is 74 (60 original assertions byte-identical, plus 14). See `../phase_02_slice_12_governed_fix/README.md`.
