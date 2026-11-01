# Lane brief — `claude_s12_locale` fix pass (staged-runner lane `locale`)

Read `docs/handoffs/2026-10-14-claude-s12/review-locale.md` fully. Root rulings (binding):
1. F1 — the event aggregate type is `cms_locale_variant` (underscore), matching the deployed consumer
   grammar `^[a-z][a-z0-9_]{0,63}$` and the spec's own convention elsewhere; the dotted BE03c text is a
   spec defect root will correct at cascade (record the citation in your report). Change every SQL/Worker
   use you own; prove the Slice 11 recheck consumer accepts the envelope (no dead-letter, no retry loop).
2. F2 — you MAY edit `packages/contracts/src/cms-editorial/preflight.ts` (the `locale` provider row only),
   its generated/copied mirrors, and the three Slice 11 pins the review names, so the registered
   `cms.locale.no_fallback_gate` provider and its refusal tokens are contract-known (no scrubbed 500).
   Contract tests for that row must be updated/added, spec-cited. Touch nothing else in contracts.
3. F3 — stored `stale_field_ids` must be exact: compute it after all field values of the revision are
   written (e.g. a DEFERRABLE INITIALLY DEFERRED constraint trigger, or a writer-side call at the end of
   every writer — choose, justify, and pin the review's fixture flow (stored `[title]` vs truth `[date]`)
   with an assertion, RED first.
4. F4 — `locale_variant_not_approved` timing is an OWNER decision (publication business rule). Do NOT
   change its current behavior; describe it precisely in your report (which phases, which states admitted)
   so root can put the options to the owner.
5. AC233 `[]` clause: add the missing test. Minors at your discretion with reasons (`no_plan()`, timing
   asserts in a functional suite → move to a separate perf-tagged assertion or justify).
Files: your existing claim plus `packages/contracts/src/cms-editorial/preflight.ts` (+ its test), the
contract mirror copies and the three Slice 11 pin files the review names. Edit your WIP migrations in
place (unpromoted; keep each file complete at all times). Append `## Fix pass` to your report.
