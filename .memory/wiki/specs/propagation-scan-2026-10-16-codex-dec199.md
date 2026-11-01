# DEC-199 propagation — live nested-pattern publication gate

Owner answer, 2026-10-16: “Also gate entry publication (Recommended).” Canonical decision: DEC-199 in `../decisions.md`.

Live placements (SQL-NULL detached tree) recheck the pinned nested graph's activity and existing same-owner/type compatibility before entry publication. Use the existing `nested_pattern_not_active` reason in the pattern category. Canonical detached snapshots validate their own blocks/digest and never reopen provenance pins. Mixed live and detached placements of the same pin still validate the live placement. Retain existing provider applicability and authorization/error/no-disclosure boundaries.

Source cascade: BE03c Slice12 provider contract; FE03 safe fixed copy; phase plan and Slice12 tracker AC211, AC238 and AC241. AC240 is locale and is unchanged. The pattern category's closed reasons are `pattern_not_active`, `pattern_digest_changed`, and `nested_pattern_not_active`.

Implementation remains TEST-first: private revision-aware currentness plus provider evaluator/registry, typed contracts and fixed Web copy must agree. Preserve manifest provenance identities; keep old one-argument manifest currentness strict for existing callers. Do not add transport statuses, expose nested identifiers or grant new rights. No criterion, external gate, implementation or validation acceptance is claimed by this cascade.
