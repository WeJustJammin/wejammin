# Lane brief — `claude_s12_governed_retire_sql` (staged-runner lane `governed-retire`)

Implement CMS-03C-09 `retire` per DEC-190 (end of `.memory/wiki/decisions.md`), test-first. Today the promoted
producer (`supabase/migrations/20261014070*`, as patched by `20261014150000`) refuses `retire` with
`VALIDATION_FAILED ["/action"]` and writes nothing. Retire must: require the resolved subject `active` (else 409
`subject_not_retirable`); keep authentication, unconditional binding-bound recent MFA before any reservation,
disclosure-safe review resolution, current subject-kind owner capability proved under the existing lock order
(BE03c 1336–1357), review `version` If-Match/`expectedVersion`, idempotency and transactional audit; need NO
fresh approval and NO dependency/policy/provider/preflight validity; commit `retired`, lifecycle +1, the
retirement timestamp, audit and exactly one subject-kind event (template/pattern/taxonomy event types per BE03c
1546–1554); leave definition version and pins unchanged; take the lineage advisory lock last like activate.
Contract `packages/contracts/src/cms-composition/governed-activation.ts` (retire reason 1–256 NFC, 200 resource).
Forward anchored-patch migration (precedent `20261014150000`), range 20261014160000–20261014169999. Add cases to
`supabase/tests/phase_02_slice_12_governed_activation.sql` + dir (replace the "retire refused" assertion — a
ruling-forced test correction, report it). RED first. Then confirm the Worker route (already forwards retire;
`apps/worker/src/cms-composition/governed-*`) maps the 200 and `subject_not_retirable` correctly — add Worker
tests if missing (Worker files claimed for retire mapping only). Report
`docs/handoffs/2026-10-14-claude-s12/lane-governed-retire-report.md`. Lane `governed-retire`.
