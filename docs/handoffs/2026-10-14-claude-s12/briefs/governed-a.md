# Lane brief — `claude_s12_governed_a_sql` (staged-runner lane `governed-a`)

Build, contract-first and test-first, the SQL producers for governed review operations:
- CMS-03C-08 POST /api/v1/cms/governed-reviews/{reviewId}/assignments (create/revoke reviewer assignment),
- CMS-03C-07 POST /api/v1/cms/governed-reviews/{reviewId}/decision (reviewer decision),
- CMS-03C-10 GET /api/v1/cms/governed-reviews/{reviewId} (detail read),
- CMS-03C-11 GET /api/v1/cms/governed-reviews (queue read: scope assigned|submitted|owned, keyset cursor).
CMS-03C-09 activation/retirement/schedule and CMS-03C-19 are OUT of scope (retirement awaits an owner decision).

## Your files (exclusive)
- `supabase/migrations-wip/governed-a/` (exists, empty) — forward migrations, timestamps ONLY in 20261014010000–20261014019999.
- New pgTAP suites: `supabase/tests/phase_02_slice_12_governed_assignment.sql` + dir `supabase/tests/phase_02_slice_12_governed_assignment/`; `supabase/tests/phase_02_slice_12_governed_decision.sql` + dir; `supabase/tests/phase_02_slice_12_governed_reads.sql` + dir.
- Report: `docs/handoffs/2026-10-14-claude-s12/lane-governed-a-report.md` (a stub may exist; overwrite it).
You may INCLUDE (read-only, `\ir`) existing support files such as `supabase/tests/phase_02_slice_12_governed_submit/000-fixtures.sqlinc`, `005-real-type-chains.sqlinc`, and S09/S10 helper includes, but never edit them. Copy what you need into your own directory for variants.

## Read before designing
1. BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`: Route Registry rows CMS-03C-06…11 (~168–173); Registry invariants (governed reviews DEC-137; If-Match operands — review `version`; assignment create/revoke do NOT advance it, a decision does; recent MFA unconditional for 07/08/09 with 03b semantics: 401 `STEP_UP_REQUIRED` before any idempotency reservation); "Governed review machinery (DEC-137, DEC-113, OD-1)"; "Governed policy basis"; "Slice 12 lock order (DEC-157, DEC-180)"; Database Schema; Permission/RLS/grants; per-operation authorization matrix (separation of duties, specialist slots, assignment expiry ≤7 days and ≤ reviewer grant and grantor authority end, `cms.definition_review.assign` derived from the immutable owner-initialization receipt and never grantable); Data Flow / state machine; error catalog; Testing Strategy. IA03 `.memory/wiki/specs/ia/03-cms-content-modeling.md` governed sections; FE03 only for behavior cross-checks. DECs in `.memory/wiki/decisions.md`: DEC-113, DEC-137, DEC-157, DEC-180, DEC-188.
2. Contracts (frozen): `packages/contracts/src/cms-composition/governed-assignment.ts`, `governed-decision.ts`, `governed-review.ts`, `governed-review-read.ts`, `error-catalog.ts`, `refusals.ts` (+ tests for exact shapes).
3. Existing governed SQL (applied, read-only — reuse tables/helpers/guards): `supabase/migrations/20261013300000_*` … `20261013300830_*`, especially `300200` tables, `300300` subject helpers, `300400` frozen status, `300500` review support (`cms_governed_review_resource`, `cms_governed_assignment_resource`, `cms_governed_next_actions`, `cms_governed_owner_capability`, distinct approvals, qualifying decisions, scopes), `300600` guards, `300790` authority lock, `300800`/`300820` the submit producer (copy its producer/wrapper/idempotency/audit/grant conventions), `300810` public wrapper.
4. Governed-submit suite and report for the real-foundation fixture approach and role capture: `supabase/tests/phase_02_slice_12_governed_submit.sql`, its directory and README, `docs/handoffs/2026-10-12-claude-s12/lane-native-governed-submit-report.md` (from "Sixth diagnostic" on). Lessons: real S09 owner initialization, real grants, real producer chains, never synthetic activation; call RPCs under actual `service_role` (not just JWT GUCs) and assert anon/authenticated get 42501; SECURITY DEFINER callee closure needs explicit EXECUTE grants to the definer role.
5. MFA: find how the 03b editorial review decision checks recent binding-bound MFA in SQL (search `supabase/migrations` for `STEP_UP_REQUIRED` and recent-MFA helpers) and reuse that helper; never invent a weaker check.

## Method
Contract-first RED: each suite covers every route-registry clause and spec rule for the four operations — happy paths with exact resource shapes vs the frozen contracts; every refusal with SQLSTATE + message token + DETAIL; 403 vs 404 concealment; separation of duties; specialist slots; strictest-policy counting; first rejection ends review; review CAS (`version`) semantics; MFA-before-idempotency; idempotent and conflicting replay; expiry bounds; revoked assignment loses decide/read; no-effect snapshots on refusal; anon/authenticated 42501; queue cursor bound to complete query and acting scope, ordering `(updatedAt DESC, reviewId DESC)`, default 25 / max 50, filter allowlist. Run once to see genuine RED (missing functions), implement minimal correct producers, GREEN, refactor. Real fixtures only.

## Done
All suites GREEN, zero harness aborts, non-vacuous assertions. Report: migrations (path/lines/SHA-256), suites (plan counts), runs, spec citations per assertion group, any BOUNDARY, requests to root. The RPC names and JSON shapes you choose become the Worker boundary for a later transport lane: document them exactly in a `## RPC boundary` section.
