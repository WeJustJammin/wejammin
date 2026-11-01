# Slice 12 race9: more two-session concurrency for pgTAP files

Support fragments for the `supabase/tests/phase_02_slice_12_race9_*.sql` files (lane `claude_s12_db9a`, wave 9; BE03b "Initial revision default template" and
"Write-path lock order and authority fencing"; BE03c concurrency tests; tracker P2-S12-AC-277 and AC-294). They build on the race7 harness
(`../phase_02_slice_12_race7/`, read its README first) and on race8's worlds (`../phase_02_slice_12_race8/`): the committed world, dblink command sessions, held
and sent commands, live lock observation (`pg_blocking_pids`, `pg_locks`, `FOR UPDATE / FOR KEY SHARE NOWAIT` probes), snapshot and restore. Nothing in `race7/` or
`race8/` is edited; these files only `\ir` them.

## Contents

| File                         | Purpose                                                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `010-publication-world.sqlinc` | race8's related-content world plus the Slice 11 publication world: three targets published by CMS-03B-09 and given an unpublish schedule by CMS-03B-07, and three curation sources |
| `020-unassigned-world.sqlinc`  | race8's create world plus a caller (`designer2`) who creates with cms.author but sees two article targets only through a cms.editor grant and assignment                    |
| `030-definition-world.sqlinc`  | race8's create world plus the stashed commands of a caller of the second organization that names organization A's content type and version (CMS-03B-10 create, CMS-03A-04 activation) and default template (CMS-03C-06 submit) |

| Test file                                           | Rows     | What it does                                                                                                                                    |
| --------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `phase_02_slice_12_race9_related_unpublish.sql`     | AC-277   | CMS-03C-05 curation versus the REAL scheduled unpublish (CMS-03B-07 schedule, claim, CMS-03B-20 execute), both orders, plus a waiting control   |
| `phase_02_slice_12_race9_entry_unassigned.sql`      | AC-294   | CMS-03B-10 create whose relation target becomes unassigned while it waits: an assignment revocation (position 2) and the real CMS-03A-17 revoke |
| `phase_02_slice_12_race9_definition_lever.sql`      | AC-294   | a caller of organization B names organization A's content type and version (the real CMS-03B-10 create, CMS-03A-04) and template (CMS-03C-06) while A's rows are held FOR UPDATE: concealed, no wait; plus the default template lock helper at unit level |

## How to add a scenario

Build the world rows with the real producers inside the world transaction, stash the command with `r7_stash_cmd` / `r7_stash_sys`, drive it with `r7_hold` /
`r7_send` / `r7_collect`, observe the wait with `r7_blocked_by` and the row probes, record with `r7_note`, and assert after
`\ir phase_02_slice_12_race7/090-restore.sqlinc` with titles that are whole string literals of the entry `.sql` file (the evidence collector cites a test by its title).
Anything time-dependent that a command re-checks (an accessibility proof, a step-up) is built after the wait, not in the world. Run through the staged ALT runner only;
one world per file.

## Related links

- `../phase_02_slice_12_race7/README.md`, `../phase_02_slice_12_race8/README.md`, `../README.md`
