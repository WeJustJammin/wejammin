# Lane brief — `claude_s12_locale_gate_a` (DEC-192: locale approval gate at schedule/publish/execute)

Owner decision DEC-192 (end of `.memory/wiki/decisions.md`, owner chose A on 2026-10-15): in the `schedule`, `publish`
and `execute` phases a locale variant whose revision is not in effective state `approved`, `scheduled` or `published`
fails `locale_variant_not_approved`; `submit` never applies the approval check; missing wins over stale, which wins
over approval. Source finding and fix direction: `review-locale.md` F4 (~:111-125), `lane-locale-report.md` "F4".

## SQL (WIP, unpromoted: edit in place)
`supabase/migrations-wip/locale-gate/20261014050600_cms_locale_no_fallback_gate.sql` (~:65-69) and, if needed,
`20261014050700_cms_preflight_locale_provider.sql`: add the `execute` phase and admit `scheduled` (reconcile with
`cms_revision_effective_state` and 050400:27-33). RED first: change the gate test at `001:110-111` (phase skip → an
`approved|scheduled` pass) and add cases for execute with approved/scheduled/published/other and submit never checking;
run, see them fail, fix, GREEN. Then run the gate suite plus `phase_02_slice_11_helpers_preflight.sql` and
`phase_02_slice_11_criteria_publish_gates.sql` and every locale suite with lane `locale-gate` staged (their 4 known
reds #14/#94 and #32/#33 should go green); classify anything else.

## Spec cascade (owner-approved by DEC-192)
BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` "Locale preflight provider" (~:1428) and the
locale tests line (~:1651) state the phase rule and the admitted states exactly as DEC-192; add a changelog row. The
acceptance criterion P2-S12-AC-240 body appears in `.memory/pipeline/progress/slices/phase-02-slice-12.md` and
`.memory/wiki/specs/phases/phase-2.md`: change only the clause about `locale_variant_not_approved` to DEC-192's wording,
identically in both files (keep each file's trailing source link). Do NOT check any box. Record before/after SHA-256 of
the tracker's acceptance section (`## Acceptance Criteria` heading to EOF; before = the value root records in the
Dispatch Log at claim). Check FE03 and IA03 for any statement of the gate timing and align it only if one exists.
Report `docs/handoffs/2026-10-14-claude-s12/lane-locale-gate-a-report.md` with the exact AC wording diff.
