# Slice11 AC057 assignment-label fixture correction

## Actual correction and full-gate recovery

Native sole fixture260lines hash
eb6aa49950a29dfe740f8b17f373a2c4d9adf800d0aa33ee99fc64ef7ebd992c.
Reverse patch reproduces the entire257line baseline; all32 assertions/titles
and other34 paths unchanged. Independent source review no bounded finding.
Two actual focused32PASS controls with freshCI0/flock/resets0; independent
two-log review no mismatch. No production or assertion change.

Full db:verify SQL333files12764assertions PASS108s after reset/lint0. API
30failed34passed files,10failed608passed172skipped tests,926.04s.
dbVerifyExit1/postReset0; children drained. API setup failures and independent
read/pagination failures remain; races/types/validate UNRUN. Transport timeout
at300s recovered from durable host-child log, not treated as test verdict.
See ac057-fixture-gate-receipts-2026-10-10.json. Acceptance remains0/122.
Prior contract/UNRUN statements below are historical.

Actual full gate after queued producer126 lines: focused12GREEN plus existing
22files197GREEN, all other33 source/QA exact. Full db:verify reset/lint0 then
db:test333files12764assertions, one failure: reads_review assertion16/line118.
db API/races/types and validate UNRUN after first failure. Main postReset0.
Only application TS consumer changed; production SQL remained byte-identical.

## Source-evidenced cause, preserve assertions

Reads_review43–44 creates active rvA then revoked rvX with r11_assign_now.
That helper overrides live-relative starts_at/ends_at, not created_at:
rpc_review/020-decision55–60. Both therefore share fixed created_at from
schema/002-row-builders67. get_editorial_review migration17880:207–208 uses
dense_rank by first_created then reviewer_person_id; bootstrap assigns random
person IDs. Label-sorted states can consequently be revoked/active, while
reads_review116 requires active/revoked. BE03b1409–1416/2002 requires safe
assignment fields and nonidentifier labels, not ordinal-to-state binding.

Select fixture-only repair, no production ordering/policy change. Use existing
h11r_assign builder for rr1-rvX with created_at and updated_at both one second
after the default (2026-10-01T14:00:01Z); preserve identical live-relative
starts_at/ends_at and all other fixture values. Leave rr1-rvA's call unchanged.
This keeps assignment chronology after the synthetic review's creation and
created_at <= updated_at. No public assignment-workflow proof is claimed.
Independent bounded contract review found no issue after this chronology
amendment; native source/actual runtime validation still UNRUN.
Existing big-review fixture already uses explicit created_at. Do not update
stored rows after insertion, change shared helper or any assertion/title/plan.

## Native author gate and sole claim

After clean pushed root checkpoint only, sole existing QA write target:
supabase/tests/phase_02_slice_11_rpc_reads_review.sql.
Baseline257 physical lines/SHA3488f4947253f860031527eb9111bf0976efa3bb421218880c78a6d5aec97e5d.
Exactly replace one revoked-assignment seed call; all32 original actual assertion
identities and bodies unchanged. No commands/tests/DB/Git/network/runtime import/
formatter/new tests/producer or unrelated writes. Native apply_patch. Freeze
line count and release claim. Root will prove reverse-patch whole-file byte
equivalence, independent review, focused repeated32 assertions under freshCI0/
flock/pre/post main-stack cleanup, then rerun complete db:verify and validate.
No assertion weakening, accepted status/code changes, grants/roles or owner
choice. This is deterministic test chronology, not production acceptance.
