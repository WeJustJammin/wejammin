# S11 expired publication-schedule lease fence GREEN

Status: producer UNRUN. No author claim released until current legacy seven-path
full gate closes, its receipt/canonical live handoff is saved, and root verifies a
clean pushed exact-origin checkpoint. Root6.1/ultra commands/DB/Git/format/memory;
retained native6astra/high author only pure source reads and native apply_patch.
No commands, child_process, scripts, tests, DB, network, formatting, packages,
Git, nested agents, tracking edits or extra claims. Source review remains static.

Sole proposed claim NEW
`supabase/migrations/20261010140000_cms_schedule_expired_lease_fence.sql`;
prefer250/hard400 lines. Old migrations, all QA, wrappers, role metadata, retry
ladder, operational CMS Job lease-control and all other producers remain frozen.
Ask root for exact extra scope before editing anything else.

## Established failure and locked boundary

Existing real-clock case in
`tests/postgrest/phase-02-slice-11-sweep-outcomes.apispec.ts:256-356`:
`[CMS-03B-20] an expired matching real lease refuses unchanged operands before stale-evidence handling`.
It preserves actual captured scheduleVersion/expectedVersion/lease/evidence,
waits real five-minute expiry, and requires the exact CONFLICT tuple plus complete
fourteen-table no-effects images. No shortened TTL, rewritten lease, fake clock,
skipped retry cases or detached clone. Whole three-case file must run: beforeAll
subjects otherwise remain due and contaminate the isolated third-case claim set.

Actual earlier RED log
`.lane-logs/parent-s11-first-gate-fixtures-db-verify-validate-20261010.log`, SHA256
`cc057eb534a5043e1985907846d3823c260268062108d5d1864a5bf94078bcbb`,
failure at4850; expectedSha ce91984aea2e6ca8 versus actualSha904d73a0fa6d7bc3.
That proves tuple mismatch, NOT a particular actual refusal token (log hides it).
Current full rerun may refresh this observation; do not fabricate its result.

BE03b179/1879-1885/2033 binds the five-minute crash-recovery lease and CAS fence,
completed idempotent replay, and review/preflight/authority execution order.
Current `20261005017740_cms_execute_publication_schedule.sql:144-148,166-170`
checks state and lease ID at both unlocked and locked looks, but never expiry.
The fire clock at173 is sampled only after these incomplete fences.

## Narrow forward replacement

Use a transactional, fail-closed DO replacement of ONLY the existing private
`platform_private.cms_execute_publication_schedule(jsonb)` installed definition.
No helper, public parameter, wrapper, signature, owner or new grant. Preserve
language, volatility, STRICT/security/leakproof/parallel/search_path/ACL/comment
and all pg_proc metadata except prosrc, with before/after equality guards.
Use exact installed `pg_get_functiondef`, function identity and baseline checks;
never build a truncated replacement body or accept drift by best-effort matching.

Original source-only extracted prosrc MD5 is
`7e6119b10a631301001038b8109a989b`; this is not yet a live catalog receipt.
Root must capture/verify live catalog before accepting the migration.
Root now captured LOCAL PostgreSQL17.6 after final reset, freshCI0/shared lock:
live prosrc MD5 matches the above; definition MD5
`3388d4cd7fa395bd1b074882e9389aa5`; owner wejammin_cms_definer, SECURITY DEFINER,
VOLATILE, empty search_path, sole ACL wejammin_cms_definer=X/wejammin_cms_definer.
Role NOLOGIN/NOSUPERUSER/NOBYPASSRLS and no platform_private CREATE. Full catalog
log `.lane-logs/parent-s11-schedule-precision-catalog-ties-baseline-20261010.log`,
SHA256905f799f5a8639186def4ce6e4e5ed78e48bc36de80eadad0fbcf193dc2949c8.
Require this exact definition/body and owner/security/config/ACL baseline; fail
closed on drift. Capture all metadata/comment before replacement and require
post equality, not just the listed fields. No hosted catalog proof assumed.
Require exactly TWO occurrences of the original entire condition, then replace only
those occurrences and prove an inverse replacement restores the complete source:

```sql
if schedule_row.state <> 'executing' or schedule_row.lease_id is distinct from requested_lease then
```

Extend each condition with BOTH `schedule_row.lease_until is null` and
`schedule_row.lease_until <= pg_catalog.clock_timestamp()`. Fresh wall clock at
each fence, including after lock waits; never transaction-start clock or reuse
the first sample. Expiry is inclusive: lease_until equal to now is not live.
Preserve the existing exact CONFLICT SQLSTATE, both completed-replay branches
before the fences, version handling after the fences, global lock order, all
later evidence/authority/CAS/action paths and the fixed five-minute lease policy.
No new durable effects, advisory locks, role changes, lease renewal or backfill.

Freeze exact sole-path source and release claim. Root independently reviews
complete definition inverse/metadata/caps, witnesses the unchanged whole-file
real-clock QA and then exact db:verify/conditional validate with freshCI0/shared
DB lock and final reset. No GREEN or Slice11 closure from static source alone.
