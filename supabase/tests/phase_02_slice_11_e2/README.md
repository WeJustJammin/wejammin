# Slice 11 E2 (derived revision state) pgTAP fragments

The executables `../phase_02_slice_11_e2_*.sql` are the Supabase discovery entrypoints for BE03b
"Derived revision workflow state (E2)" (lane S11-3d, tracker `P2-S11-AC-085` and `P2-S11-AC-086`): the
physical `cms_entry_revisions.state` is the constant `draft`, and every browser-visible
`EntryRevisionState` is derived by `platform_private.cms_revision_effective_state` (set form
`cms_revision_effective_states`) from review, schedule and publication evidence. The forward migrations
`20261005018000` to `20261005018090` rewire the Slice 10 reads and write responses to the helper and,
last, narrow the `cms_entry_revisions_state_check` constraint to `state = 'draft'`.

| Fragment                      | Content                                                                                                                                                                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-derived-evidence.sqlinc` | `pg_temp.e2_evidence(revision, state)` attaches the committed evidence that derives a state (an open, approved, rejected or invalidated review; an approved review plus a pending publish schedule; a publish lineage row); `e2_revision` appends one more physical-draft revision |

## How to seed a non-draft revision

A suite never stores a workflow state. It inserts the revision as `draft` and attaches the evidence:

```sql
\ir phase_02_slice_11_e2/000-derived-evidence.sqlinc   -- after the Slice 10 RPC fixtures
select pg_temp.e2_evidence(:revision_id, 'approved');
```

A revision INSERT invalidates every older live review of the same entry and locale (the Slice 11
trigger `cms_entry_revisions_review_invalidation`), so append all revisions of an entry before you attach
evidence to any of them. The Slice 10 keyset helper `pg_temp.s10k_seed(..., p_derived_state)` does this
for one entry per call.

| Entrypoint                                   | Covers                                                                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `phase_02_slice_11_e2_state_check.sql`       | the stored state is closed to `draft`: every other label is refused by the table rule, with the guard triggers off                                  |
| `phase_02_slice_11_e2_adoption.sql`          | structure: the reads, the four write responses, the classifier and the composition guard call the helper and never read or hard-code a state        |
| `phase_02_slice_11_e2_reads_entries.sql`     | CMS-03B-13 items and `state` filter over all six derived states, filtered paging, cursor/epoch independence from the derived state, CMS-03B-11      |
| `phase_02_slice_11_e2_reads_history.sql`     | CMS-03B-03 items and `state` filter, concealment of derived scheduled/published revisions under another acting party, comparison-target concealment |
| `phase_02_slice_11_e2_scan_entries.sql`      | CMS-03B-13: batches of 200, the 1,000-candidate scan bound, the bound cursor, the probe, 1,231 entries; the helper batches are counted              |
| `phase_02_slice_11_e2_scan_history.sql`      | the same for CMS-03B-03 with 1,231 revisions and a concealed candidate that still counts as scanned                                                 |
| `phase_02_slice_11_e2_composition_guard.sql` | CMSCOMP-DRAFT-TARGET over the derived state: admitted only on a draft, an invalidated review returns the revision to draft                          |
