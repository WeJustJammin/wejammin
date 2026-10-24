# DEC-193 selected roots and retired-path reuse

Author status: **UNRUN**. Root owns independent review and actual validation.
The initial TEST release did not authorize SQL434–437; their later separate
production release is not changed or accepted by this TEST-only correction.

Driver: `../phase_02_slice_12_dec193_selected_roots.sql`. Entire world and the
fault trigger are transactional and rolled back. Existing carry/CB tests and
all production files remain unchanged.

## Locked contract

BE03c380,520–551,1483,1485,1563,1750,1836–1837 require optional `roots`:
omission places every expanded block root; supplied1–512 unique expanded chains
place only those block roots, ignoring request order. Each element uses complete
ASCII key segments, at most72 segments/4680 characters. Non-root chains are422
at `/roots/{n}`; an override outside the selection is422 at `/overrides`.

Stored slotPath/row-path grammar is not widened. Only selected rows are subject
to the joined248-octet bound. Overrides retain512-character keys,64-key and
depth8 limits. The whole pinned forest remains the registry-digest authority.

Newest version is selected before state: every non-retired head occupies its
path; a retired head is free at its existing position and next version. New
paths alone consume consecutive positions after the slot's maximum across all
history, in forest order. Public items remain position-ordered, not request-
ordered or necessarily forest-ordered when old positions are reused.

## Fixtures and independent oracles

- Shared S09 and pattern-definition fixtures register signed safe blocks and
  build real compiled/active types. Shared placement setup creates patterns and
  activates them through the real governed review/approval/activation chain.
- The initial empty entry/revision/assignment and unrelated position rows are
  labelled existing guarded storage fixtures. No composition guard is disabled,
  historical row mutated, public writer replaced, or active pattern forged.
- Main forest is `[a{leaf},b,c,d]`; `d` uses distinct registered `s12pd.wide`.
  Literal full-forest registry tuples make a selected-only digest discriminable.
- Long chains are actual governed nested patterns. Three reference segments of
  length64 plus leaf lengths52/53 produce row paths248/249; eight references
  plus a64-character leaf produce585. A short sibling proves unselected overlong
  roots are not treated as inserted row paths.
- Expected tuples, override maps and registry identities are caller literals or
  independent arithmetic over the known32×16 fixture. No production expander,
  selector, path allocator, typed-diff expected builder or snapshot assembler
  builds expected placement results.
- Full resource agreement uses the inherited independent legacy-NULL JCS
  resource oracle, restricted to one override per row and safe compact values.
  Every placement here has NULL `detached_tree`; this is not snapshot-hash proof.

## Matrix

`010-request.sqlinc`: direct store-free guard probes for count/uniqueness/type/
ASCII/segment/length limits, plus actual public malformed and non-root requests.
The exact guard signature is checked inside each probe before a dynamic call;
missing/wrong signature is explicit TAP FAIL, never skip or setup abort. Direct
guard success is not evidence that public placement succeeds. A length4681
address necessarily also exceeds a segment limit when the segment count is72;
the suite does not claim those dimensions can be independently violated.

`020-selection.sqlinc`: omitted compatibility, reversed subsets, nested
namespaces, explicit JSON null/scalar/array overrides, linked/plain-detached
placement, unselected occupancy, segment-prefix isolation, selected248/249/585
row bounds, unselected long roots, exact template slots, and512 supplied roots.

`030-retired-reuse.sqlinc`: real public c placement at1, three real unchanged-
target accepts, then removed-root `theirs` retirement to c:v5; real a placement
at13 and retirement to a:v2. Only unrelated guarded rows establish0/12/20.
Request `[d,c,b,a]` must produce these independent tuples in response order:

```text
c:v6@1, a:v3@13, b:v1@21, d:v1@22
```

Old histories remain byte-identical. Separate labelled legacy/scan fixtures
cover non-retired head states, an older retired version beneath an active head,
and reuse at INT_MAX without a fresh-position allocation. These fixtures do not
claim a public writer produces draft/superseded or the scan itself was tested.

`040-atomic-security.sqlinc`: exact CAS/idempotent replay and roots-change
mismatch; hidden-owner/capability/anonymous/pin/compatibility/digest refusals;
actual anon/authenticated database-role denial; unchanged private service ACL;
real64/65 override keys and depth8/9. A transaction-local BEFORE INSERT trigger
raises only when a prior selected row really exists during the same placement,
proving later-insert failure rather than an artificial preflight refusal. Full
before/after images must match, including review/audit/outbox/reservation stores.
The exact key is retried after removing the hook; the retry must succeed and
invalidate the one older live review exactly once. No authority gate is bypassed.
The retry's captured before-image must contain exactly that older open review
at version1, not the already-invalidated latest review. Success retains an exact
total audit delta: one placement audit normally, two when that review is also
invalidated. An independent delta oracle requires exactly the insertion and
invalidation action/target/reason tuples, with the request's real nested-context
auth-user actor, acting party and correlation. It never accepts a duplicate
placement audit or substitutes an outbox count for the required audit identity.

## Evidence limits

Author performed source reads, apply_patch edits and byte/hash/readback inventory
only. No parser, formatter, runtime, tests, DB, process, Git or network invocation.
Root's prior501 run had1182 assertions/1181PASS/1FAIL at the stale unconditional
one-audit oracle. Root's corrected audit diagnostic found exactly one placement
audit and one required review-invalidation audit. These are pre-correction root
diagnostics, not an author run or acceptance of the corrected tests. A
single-session suite does not prove concurrent slot serialization or lock order;
those remain real concurrent-harness obligations. No hosted acceptance claim.
