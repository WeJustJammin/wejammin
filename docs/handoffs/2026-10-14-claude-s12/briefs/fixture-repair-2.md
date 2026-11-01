# Lane brief — `claude_s12_fixture_repair_2` (stale locale-related fixtures)

Source: `lane-locale-gate-a-report.md`: `phase_02_slice_12_locale_related_authority.sql` aborts at line 158 and
`phase_02_slice_12_locale_owner_integrity.sql` fails #13 on promoted migrations alone (diagnostic run
`alt-staged-none-130026-2434276`): their raw `derived` related-rule inserts omit `max_candidates`, which the CHECK from
promoted `20261014060000` requires. Fix the fixtures only (supply a valid `max_candidates` per BE03c CMS-03C-05
validation, 1-128), never weaken an assertion; run both on lane `none` and every suite that includes them; sweep for any
other raw related-rule insert missing it. Report `docs/handoffs/2026-10-14-claude-s12/lane-fixture-repair-2-report.md`.
