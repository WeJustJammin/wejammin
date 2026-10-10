# S11 exact schedule nanoseconds: bounded implementation contract

Status: derived implementation choice; new QA and producers UNRUN. No author
claim released. Current seven-path legacy full gate and its receipt/clean pushed
checkpoint precede any author. No acceptance criterion closed by this document.
Root6.1/ultra commands/DB/Git/format/canonical; native6astra/high source authors.
No new accounts, grants, helpers, public clock/precision members or hosted proof.

## Locked requirements and observed gap

BE03b266-267/1823-1834 permits real local datetime with at most nine fractional
digits, exact selected resolved instant, a pinned Worker tzdb and SQL's offset
sanity plus inclusive60s/366d horizon. BE03b1885 requires rounded actual-minus-
scheduled deviation. Existing nine-digit schedule-actions39-58 failed earlier
422 versus202 and failed again in the current unfinished full API run; no full
gate conclusion yet. This is an existing implementation omission, not a new
product time policy or permission to weaken request/authority oracles.

SQL17710:119/135 limits six digits; casts123/139 round surplus precision.
Initial/replay response already echoes verified request strings191-197/279-281;
Worker schedule-routes67-76 forwards verbatim. Preserve those paths.
DDL17070:69 unique identity loses submicroseconds; its offset check105-108 also
uses quantized timestamps. Claim17730:264-266 and aggregate290 lose due/order
precision. Execute17740:262 loses half-second deviation distinction. Workflow
17900:187 further truncates stored time via shared millisecond formatter.
Regex-only acceptance is therefore insufficient.

## Chosen private representation, public ABI unchanged

Retain required timestamp columns, with their admitted values truly FLOORED to
six fractional digits before any PostgreSQL cast (never cast9 then truncate).
Add private `local_datetime_submicro_ns` and `resolved_utc_submicro_ns`, each
SMALLINT NOT NULL DEFAULT0 CHECK between0and999. The exact value is timestamp
component plus this nanosecond remainder. Existing valid six-digit rows get0,
preserving their actual instants; do not pretend to recover precision never
stored. These supplement, not replace, the locked timestamp columns.

For an admitted ISO fractional component, right-pad to nine digits and use last
three as remainder; no fraction yields0. Trim only digits beyond first six in
the original valid string before casting; preserve date, time, offset and all
validation/refusal behavior. Fractions .12345678 and .123456780 have same pair;
.123456788 and .123456789 have distinct pairs. Reject malformed calendars/leap
seconds/ten digits exactly as existing admission requires. Offset normalization
must preserve fractional remainder while the timestamp cast normalizes UTC.

Replace exact schedule identity constraint with same existing members plus the
local remainder; preserve audience/timezone/entry/revision/action semantics.
Add resolved remainder to due ordering, including returned claim aggregate
ordering. Existing state guard compares complete row JSON except explicit
mutable state/lease/CAS fields, so new private identity fields remain immutable;
do not exclude them or relax review/owner lineage/state guards.

Use exact NUMERIC nanoseconds for arithmetic: epoch of each floored timestamp
times1000000000 plus its remainder. No float/date_part, millisecond conversion,
BIGINT overflow for otherwise valid years, or text lexicographic instant compare.
Parser remainder variables are local_submicro_ns and resolved_submicro_ns;
persist them in the corresponding private columns. Claim RETURNING must carry
the resolved remainder through to the returned aggregate's ordering.
Offset sanity includes BOTH local and resolved remainders and retains inclusive
-12h/+14h. Horizon compares complete scheduled instant to actual accepted_at
microsecond instant plus inclusive60s/366d. Refusal min/max must represent the
actual sampled bounds without the shared millisecond formatter's loss.
Pending due uses the complete instant; failed_retryable retains its unchanged
next_attempt_at rule. Preserve SKIP LOCKED/batch/CAS/lease/retry/recovery behavior.
Deviation computes exact NUMERIC difference before nearest-second rounding.
Preserve the existing target backend's exact half-tie results rather than
silently changing overload semantics. Original round(double precision) has
platform-dependent ties; round(NUMERIC) uses away-from-zero ties, per the
[official PostgreSQL rounding documentation](https://www.postgresql.org/docs/current/functions-math.html).
Root captured actual PostgreSQL17.6 after the active gate drained, freshCI0/shared
DB lock. For .5,1.5,2.5,-.5,-1.5,-2.5 the existing double overload gives
[0,2,2,0,-2,-2], versus numeric [1,2,3,-1,-2,-3]. Preserve the former baseline.
Receipt log `.lane-logs/parent-s11-schedule-precision-catalog-ties-baseline-20261010.log`,
SHA256905f799f5a8639186def4ce6e4e5ed78e48bc36de80eadad0fbcf193dc2949c8;
all five installed prosrc MD5s match original source, complete metadata retained
in that log. This is live LOCAL backend evidence, not hosted Supabase proof.
Use exact arithmetic for non-ties; a bounded
tie branch may delegate ONLY an exactly representable half-integer to the
unchanged existing backend overload. It must never convert a near-tie1ns value
to float and erase its distinction. Unit proof covers both ties and neighbors.

Workflow reconstructs exact stored resolved UTC from floored six digits plus
three-digit remainder using inline reviewed built-ins in the existing function.
Canonical padded nine digits are allowed; no shared auth_iso_time change or new
formatter helper/grant. Initial accepted response and idempotent replay keep
original verified strings and exact existing completed receipt/resource headers.
Never rebuild them from timestamps or claim request echo alone proves persistence.

## Existing preflight compatibility and explicit limit

Main source review plus independent readonly review: command support17700:280-305
receives timestamptz and forwards private JSON member `effectiveAt` through
auth_iso_time. Evaluator17570:562-585 only compares its UTC date to inclusive
publisher valid_through; other categories use current authority/checker freshness,
not an exact scheduled instant cutoff. Genuine flooring preserves UTC date,
including23:59:59.999999999. Passing the floored component through unchanged
existing preflight ABI is sufficient for these current scheduled-time checks.
No new remainder in evidence, global clock, helper or authority assumed.

Direct evaluator nine-digit effectiveAt cast17570:218-246 can independently
round across midnight. That separate seam is NOT silently claimed repaired by
this schedule representation. If selected later, it needs its own source-grounded
parser/UTC-day tests and unchanged-ABI forward amendment. Future providers with
exact timestamp cutoffs would also need a selected precise transport; they are
not assumed implemented or proven here. Checker evaluatedAt freshness is a
separate existing operand and remains untouched.

## Required mutation-sensitive QA, not source-token acceptance

1. Genuine API acceptance, exact Worker forwarding and receipt/replay response;
   independent complete stored pair projection; actual workflow read exact
   instant and no-effects; equivalent fresh-key spellings identity conflict with
   no effects; distinct1ns schedules coexist with distinct identities and exact
   storage/workflow. Original nine-digit case stays frozen and must also pass.
2. Actual shortPublisher grant valid_through: final covered UTC day at
   23:59:59.999999999 accepts through BOTH command and preflight; next UTC midnight
   refuses authority_ends_before_schedule with complete fourteen-group no-effects.
   Never manufacture the grant, fake a clock or rewrite a schedule.
3. Existing pure Worker resolver with explicit integer nowMs and UTC pinned zone:
   each inclusive horizon bound at-1ns/equal/+1ns, exact min/max error details and
   1ns local/resolved mismatch. Integer clock matches Date.now production precision;
   do not invent arbitrary fractional Number clock precision as a new contract.
4. SQL direct real persistence/identity/immutable-row tests and narrow projections
   of COMPLETE installed arithmetic expressions over deterministic scalar inputs.
   Resolve exact signatures/OIDs and pg_get_functiondef; unique live anchors,
   no cached/reference/fallback expressions or silently omitted terms. Separate
   extraction-validity assertions from decisive arithmetic assertions; mutations
   must fail values, not only extraction/setup. SELECT-only typed inputs/pure
   reviewed built-ins; reject writes, delimiters, unknown calls/table dependencies.
   Record live source hashes and owner/security/search-path/ACL metadata.
5. Complete pending/retry due predicate and ordering; full offset/horizon bounds;
   deviation around +/-half-second1ns, reconstructed fractions/midnight/offsets.
   Actual clock sample can seed adjacent scalar comparisons, not a fake global
   clock. Existing genuine sweep proves actual operand/completion integration.

Installed-expression unit proof covers expression arithmetic only, NOT parser
assignment/INSERT columns/branch reachability/sampling-after-waits/lock/RLS/CAS
or absence of another path. Genuine persistence/workflow/API and sweep assertions
must independently cover those boundaries. No real-clock1ns E2E claim.

Forward producers must be small dedicated migration files (prefer250/hard400),
with fail-closed exact installed-body/definition inverse and unchanged metadata
guards for existing functions. Do not edit old migrations or CREATE/ALTER OWNER/
GRANT helpers. Root captures actual catalog before producer acceptance, freezes
all authored source, witnesses RED then GREEN and exact db:verify/conditional
validate/finalreset. If a cap or exact-source guard needs additional scope, stop
and report before editing. No current criterion/evidence ledger progress change.
