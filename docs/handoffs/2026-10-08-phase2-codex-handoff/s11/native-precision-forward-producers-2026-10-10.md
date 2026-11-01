# S11 native private precision forward producers

Status: NOT RELEASED. Requires QA95 receipt/canonical/static save, exact-origin clean
pushed checkpoint, and root genuine six-digit legacy seed BEFORE these files exist.
S11 remains0/122. No acceptance closure, PR or external evidence.

## Common source-only author constraints

Active only /home/rob/.codex/worktrees/phase2-slice11/WeJammin.
Root6.1/ultra owns every command/runtime/DB/formatter/Git/canonical mutation.
Native6astra/high authors use ctx JavaScript fs/path reads and native apply_patch.
No shell/process commands, tests, DB/container/network, nested agents or other edits.
Read the complete schedule-nanosecond-implementation-contract-2026-10-10.md and
relevant original sources before writing. No old migration, test or guard edits.
No helper, public field/clock, account, grant, owner, trigger or policy creation.
Each new migration prefer250/hard400 lines. Report scope/cap problem before editing.
Freeze own paths and report exact intended replacements/guards; runtime UNRUN.

Five exact paths, four independent authors:

| Author lane     | Only writable paths                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| storage         | supabase/migrations/20261010150000_cms_schedule_precision_storage.sql                                                                        |
| admission       | supabase/migrations/20261010151000_cms_schedule_precision_admission.sql                                                                      |
| claim/deviation | supabase/migrations/20261010152000_cms_schedule_precision_claim.sql; supabase/migrations/20261010153000_cms_schedule_precision_deviation.sql |
| workflow        | supabase/migrations/20261010154000_cms_schedule_precision_workflow.sql                                                                       |

Guarded textual amendments operate on the installed live full prosrc and
pg_get_functiondef, never a copied partial body. Resolve exact signature once;
record complete pg_proc minus prosrc plus comment; enforce captured source and
definition MD5 before changing anything, count each old anchor exactly once,
apply replacements to source/full definition, and EXECUTE only that definition.
Reverse all replacements and require exact original full source/definition,
same OID, and byte-equal pg_proc-minus-prosrc/comment after CREATE OR REPLACE.
Owner wejammin_cms_definer, existing security/search_path/ACL/args/result/volatility
remain exact; no ALTER OWNER or GRANT. All changes transactional/fail closed.
Do not change unrelated helper functions in multi-function original migrations.

Actual local PostgreSQL17.6 baseline, after both expired-lease fences:

| Signature suffix in platform_private       | prosrc MD5                       | definition MD5                   |
| ------------------------------------------ | -------------------------------- | -------------------------------- |
| cms_schedule_publication(jsonb)            | e85fdaf10947771bb99578a9d9d30dea | 8812de6db2019816ced766bd06ab5d13 |
| cms_claim_due_publication_schedules(jsonb) | d7b9b41bd73522bfe2bcafac97ac3c41 | 4878897acb07591ff12fe415f23c3b1e |
| cms_execute_publication_schedule(jsonb)    | a11ba874590aca9ee36bf2034f6b7e52 | 2aa35af2e98c7e2556c024dbdfea3ae6 |
| cms_get_entry_workflow(jsonb)              | e94ace68cc866a54e222e3475a7d9621 | d3af3c9af78d91422955d845ac756867 |
| cms_schedule_state_guard() UNCHANGED       | be0cf18d76840b6722c28d7f85170dfb | 904d575199e4e15058531f7ba5065e43 |

Baseline owner/security/ACL/search_path metadata is recorded in the root catalog
receipt logs. OIDs vary across reset; exact OID/metadata preservation applies
within each migration, not across independent database resets.

## storage: two columns and intentional constraint replacements only

Read 20261005017070_cms_publication_schedules_reconcile.sql and the foundation
20260927090000_cms_editorial_support_authority.sql. Existing state guard compares
full row JSON except explicit mutable fields: new private fields automatically
remain immutable. MUST NOT replace/amend that function or any trigger.

Add local_datetime_submicro_ns and resolved_utc_submicro_ns, SMALLINT NOT NULL
DEFAULT0 and named CHECK0..999. Existing timestamp columns remain untouched.
Replace cms_publication_schedules_identity_unique with the same members/order,
adding local remainder adjacent to local_datetime. Replace only the existing
offset check with exact NUMERIC epoch-nanosecond difference including both
remainders, inclusive -12h/+14h; no BIGINT nanosecond epoch or float.

Root fresh actual relation owner postgres, RLS=true/forcedRLS=true; ACL exactly
postgres=arwdDxtm/postgres and wejammin_cms_definer=arw/postgres. Current old defs:

- UNIQUE (entry_id, revision_id, action, local_datetime, timezone, audience)
- CHECK ((((local_datetime - (resolved_at_utc AT TIME ZONE 'UTC'::text)) >= '-12:00:00'::interval) AND ((local_datetime - (resolved_at_utc AT TIME ZONE 'UTC'::text)) <= '14:00:00'::interval)))

In a single transaction acquire ACCESS EXCLUSIVE BEFORE snapshots, with
lock_timeout5s fail-closed. Capture relation owner/ACL/RLS/forcedRLS and other
unchanged relation properties; complete old attribute/default metadata, all
other constraints/indexes/triggers/policies and state-guard source/definition/
metadata/comment. Compare unchanged objects exactly after DDL. Intentional
exceptions are two new attrs/defaults/checks, replacement identity constraint/
backing index OIDs+definition, replacement offset constraint OID+definition;
no other object mutation. Never claim all schema bytes unchanged.

Retain real old rows: stream ordered-ID per-row canonical JSONB SHA256 and a
rolling SHA256/count before DDL; repeat after excluding exactly the two new
keys; require same count/hash and all new values0. Constant-size rolling state,
not JSONB_AGG or an all-rows string. Do not output actual row content/PII.
Existing full-row values/created_at/updated_at/version/state/lease/evidence must
be identical. Empty fresh-reset proof is honestly empty; root separately seeds
an actual accepted six-digit row to witness nonempty retention. No backfill,
NOT VALID, grant bypass or silent repair on constraint failure.

## admission: exact parser/storage/offset/horizon/detail only

Read original 20261005017710_cms_schedule_publication.sql.
Unique old anchors cover vars near65, six-digit regex119/135 and casts123/139,
offset211-212, horizon215-216, detail219-220, INSERT251-258.
Admit at most9 fractional digits while retaining all malformed/calendar/refusal
handlers. Private vars local_submicro_ns/resolved_submicro_ns; right-pad fraction
to9, last3 as remainder, absent fraction0. Truncate original valid fraction to6
BEFORE timestamp casts, never cast9 then truncate. Preserve offset suffix.
Persist both remainders explicitly in INSERT columns/values.

Offset compares complete local and resolved NUMERIC epochs+remainders.
Inclusive horizon is actual accepted_at microsecond instant plus60s/366*86400s;
absolute NUMERIC comparisons avoid session-timezone/DST duration changes.
DETAIL minUtc/maxUtc preserve sampled microseconds using inline UTC formatter,
not auth_iso_time millisecond truncation. No new helper/public precision field.
Preserve exact request-string initial echo/replay/completed202 resource/receipt,
identity members, all authority/preflight/waits/CAS/lock/error behavior.
Existing private preflight ABI receives floored component; UTC day is preserved.
Separate raw evaluator effectiveAt rounding seam is not fixed in this lane.

## claim/deviation: unchanged recovery/retry/lease/CAS semantics

Read 20261005017730_cms_claim_due_publication_schedules.sql (multiple functions).
Only amend exact claim signature above: entire pending due comparison includes
resolved remainder; retry next_attempt_at predicate unchanged; timestamp/rem/id
in BOTH due selection and aggregate return order. Carry resolved remainder in
RETURNING for private ordering, without adding public claim fields.
Keep whole expired recovery loop, batch/SKIP LOCKED, five-minute lease, all locks,
retry15/60/300s and terminal semantics/source bytes otherwise untouched.

Read original 20261005017740_cms_execute_publication_schedule.sql PLUS latest
20261010140000_cms_schedule_expired_lease_fence.sql. Amend installed POST-LEASE
definition only at its unique old deviation assignment262. Preserve both null/
expired fences, completed replay ordering, CAS, sampled actual_at and effects.
Complete inline scalar RHS: explanatory NUMERIC d =
(extract(epoch from actual_at)-extract(epoch from schedule_row.resolved_at_utc))
*1000000000 - schedule_row.resolved_utc_submicro_ns.
q=pg_catalog.div(d,1000000000), r=pg_catalog.mod(pg_catalog.abs(d),1000000000).
Return q+sign(d) iff r>500000000 or r=500000000 with abs(q) odd; otherwise q.
INLINE each complete d occurrence: no new dependency variable or SELECT subquery.
Cast only final seconds to BIGINT. EXTRACT is unqualified PostgreSQL special
syntax; do not write pg_catalog.extract(...). DIV/mod/abs/sign are qualified.
Installation must abort unless actual old double .5/1.5/2.5/-.5/-1.5/-2.5 tie
results remain [0,2,2,0,-2,-2]. Actual pg_catalog.div(numeric,numeric) is immutable,
internal, non-SECDEF, numeric; -5/2 quotient=-2, remainder=-1. No float or ordinary
numeric division on near-half nanoseconds. This is local baseline preservation,
not a new product/hosted rounding policy. QA95 whole RHS is decisive.

## workflow: exact UTC reconstruction only

Read 20261005017900_cms_get_entry_workflow.sql.
Unique old formatter187 for listed.resolved_at_utc becomes inline UTC to_char
six fractional digits, lpad(private resolved remainder::text,3,'0'), and Z.
Canonical padded9 digits includes real6-digit legacy values followed by000.
No shared auth_iso_time change, helper/grant/public field, pagination/review/
publication/ETag/read-scope behavior change. listed.* already carries new fields.

## Root acceptance order, never author-run

1. Confirm clean pushed checkpoint and all QA/frozen hashes.
2. Root real six-digit API seed before author files exist; capture full row hash.
3. Freeze all five files; root reads, static-refutes and applies lexically ordered
   migrations to that populated DB without reset; independently compare legacy
   full row images excluding only new keys and require zero remainders.
4. FreshCI0/shared lock, reset and original QA95/new genuine API/pure suites,
   whole lease/outcomes/composition and positive/removal recovery-proof witness.
5. Exact pnpm db:verify; pnpm validate only after0; fix first failure, finalreset.
6. Record every changed test title/body, row/function/catalog hashes, honest
   runtime limits and canonical/livehandoff; clean push before next producer wave.
