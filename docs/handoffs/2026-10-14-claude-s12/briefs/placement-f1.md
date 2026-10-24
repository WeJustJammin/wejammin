# Lane brief — `claude_s12_placement_sql` fix pass (staged-runner lane `placement`)

Read `docs/handoffs/2026-10-14-claude-s12/review-placement.md` fully. Root rulings (binding):
1. F1/F6 strict reading of BE03c :1365 / AC-218: an entry with NO template accepts only slotPath `/`; an
   entry WITH a template must name one of the template's slots, and `/` is refused there (removes the
   `root` slot-name collision). Move slot cases onto the templated fixture; RED first.
2. B2: read BE03c :1488 ("slot counts before save") and every related clause; if the spec states a rule for
   a template slot's `maxCount` and/or `allowedBlocks` at placement, implement and test it (RED first); if
   not, record the precise gap in `## Open` with citations.
3. Tests the review lists: assert the 1 MiB ceiling on the padded/raw PostgREST body as well as compact
   bytes (F2); the four defensive refusals `pattern_cycle`, depth, node count, zero roots WITHOUT forging rows
   (the review says they are reachable — find the real path) (F3); `p6` asserts the message token, not only
   SQLSTATE (F4); a 1-root and a 32-root success (F11); replace the D5 verbatim-mirror oracle with an
   independent one or justify (F10).
4. F5 (guard pause inside the one-time backfill) is RATIFIED; keep the header note.
5. F7: keep `revision_not_editable` for archived entries and state it as an explicit decision in the report.
Edit WIP in place (complete files then mv). Lane `placement` (governed-b and baseline-repair `130000` are
promoted). Rerun placement + populated-position. Append `## Fix pass` to your report.
