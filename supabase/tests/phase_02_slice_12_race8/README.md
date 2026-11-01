# Slice 12 race8: more two-session concurrency for pgTAP files

Support fragments for the `supabase/tests/phase_02_slice_12_race8_*.sql` files (lane `claude_s12_db8`, wave 8; BE03c "Slice 12 lock order" and
"Authorization, persistence, and concurrency tests"; BE03b "Initial revision default template" and "Write-path lock order and authority fencing"; tracker
P2-S12-AC-085, AC-277, AC-294). They build on the race7 harness (`../phase_02_slice_12_race7/`, read its README first): the committed world, dblink command
sessions, held and sent commands, live lock observation, snapshot and restore. Nothing in `race7/` is edited; these files only `\ir` it.

## Contents

| File                          | Purpose                                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `010-activation-helpers.sqlinc` | scoped images and counts of a governed review, the lineage lock key and the activator's grant row (CMS-03C-09)                                                                  |
| `020-edtl-world.sqlinc`       | the DEC-202 lock fixture committed (default template T1, bound content type, target entry) plus a concealed target, an approved successor schema and the request stasher       |
| `025-many-relation-world.sqlinc` | a content type with a two-target relation and a second article target (ascending-id scenario)                                                                                 |
| `030-create-helpers.sqlinc`   | counts, version and idempotency readers for the CMS-03B-10 files                                                                                                                |
| `050-locale-world.sqlinc`     | an active localized content type and two entries, with the translation and source-edit commands stashed per entry                                                               |
| `060-locale-helpers.sqlinc`   | readers for the locale file (variant rows, head revision, stale ids, events) and `r8_patch_cmd` (a stashed command with request members replaced, for a retry)                  |
| `080-related-world.sqlinc`    | the related-content world (Slice 10 and 11 preludes and the CMS-03C-05 fixtures) and the stashed curation and unpublish commands                                              |
| `090-related-helpers.sqlinc`  | `r8_conn_plain` (a command session without the service_role switch) and the projection, pin and lineage readers                                                                 |

| Test file                                        | Rows                  | What it does                                                                                                                       |
| ------------------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `phase_02_slice_12_race8_activation_order.sql`   | AC-085                | CMS-03C-09 observed blocked at position 1, the subject row, the lineage's active row and the content type version row            |
| `phase_02_slice_12_race8_entry_create.sql`       | AC-294                | CMS-03B-10 create: target bumped, concealed target, revoked author, ascending target ids, superseded schema, each after a wait    |
| `phase_02_slice_12_race8_entry_default.sql`      | AC-294                | CMS-03B-10 create waits for a retiring default template and answers 409 CONFLICT                                                  |
| `phase_02_slice_12_race8_locale.sql`             | AC-277                | CMS-03C-04 translation versus a source edit, both orders, the retry and the stale row                                              |
| `phase_02_slice_12_race8_related.sql`            | AC-277                | CMS-03C-05 curation versus the unpublish of a pinned target, with and without a lock on the target                                |

## How to add a scenario

Build the world rows with the real producers inside the world transaction, stash the command with `r7_stash_cmd` (an actor of the world) or `r7_stash_sys`,
drive it with `r7_hold` / `r7_send` / `r7_collect`, observe the wait with `r7_blocked_by` and the row probes of the other positions, record with `r7_note`,
and assert after `\ir phase_02_slice_12_race7/090-restore.sqlinc` with titles that are whole string literals of the entry `.sql` file (the evidence
collector cites a test by its title). Run through the staged ALT runner only; one world per file.

## Related links

- `../phase_02_slice_12_race7/README.md`, `../phase_02_slice_12_entry_default_template_lock/` (the DEC-202 world and its race module), `../README.md`
