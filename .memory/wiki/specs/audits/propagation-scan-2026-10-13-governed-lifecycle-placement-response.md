# Approved decision propagation scan — 2026-10-13

Authority: user “approve both and resume”; recorded in
`docs/handoffs/2026-10-12-claude-s12/CODEX-APPROVED-DECISIONS.md`.
Decision types: governed-definition lifecycle identity; one-route response ceiling.
Model: gpt-6.1-sol / ultra. Protected primary checkout is not an edit target.

## Explicit contradictions to correct

- BE03c activation says subject `version + 1`, and its event identity names that
  mutable `version`; this collides with immutable definition numbers and pins.
- BE03c TemplateVersion's lifecycle delta lists `version` as mutable; its generic
  persisted envelope does not distinguish the definition and lifecycle counters.
- Phase 2, Slice 12 tracker and the current depth matrix repeat the old subject
  event-version clause in AC249 and AC250. Correct these together; keep AC237's
  locale and AC250's term counters unchanged. No acceptance boxes change.
- BE00's ordinary 256 KiB response rule has no CMS03C02 exception, despite that
  route's 1–512-row placement contract. Add only the approved 1 MiB response
  exception; keep requests and unrelated response routes at 256 KiB.

## Implicit assumptions to clarify

- IA03's frozen subject version remains the immutable definition identity.
  Add the scoped internal lifecycle counter distinction, not a new public model.
- FE03 submits immutable subject id/hash, while governed decisions and activation
  commands retain the review `expectedVersion` CAS. State that the internal
  counter is not a replacement for any public pin or review version.
- Existing Worker/Web transport positives and the 512-row fixture do not prove a
  universal producer bound. Required implementation validation must derive that
  bound from the real producer, test maximum-size success and over-budget refusal,
  and retain transaction/no-partial-effects coverage.

## Consistent references — no widening

- BE03c raw-body 256 KiB is a request rule; retain it.
- Taxonomy terms and unrelated routes' 256 KiB response refusals remain valid.
- Term, locale and governed review row versions remain their existing CAS counters.
- Historical receipts, old audits, S11 attestations and external gates are not
  rewritten as new acceptance evidence.
- Expired-verifying recovery is an optional, unapproved extension; no cascade.

User confirmation already covers these two scoped corrections and their cascade.
No alternative architecture, new public field, cardinality reduction or universal
limit increase is approved. Apply one correction family at a time, then check
consistency and refresh the project spec graph if the supported tool is available.


<!-- spec-graph: auto-generated -->
## Related Specs

### Phases into
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]

### References
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]
