# Lane `claude_s12_db9a` report (wave 9: concurrency gaps AC-294 x2, AC-277 U1 guard, AC-277 related unpublish on the production path)

## Status

GREEN (after the follow-up round of 2026-10-31, refute9db 6.1 / 6.3 / 10 and DEC-248). HEAD `85ab5ff0`. Five pgTAP files (one edited, one new in this round, three
new before) run **120 / 120 ok, 5 files, exit 0** on the ALT stack, lane `none` (promoted migrations only; no WIP migration, `supabase/migrations-wip/db9a/` was not created).
Final run `alt-staged-none-185743-1600886`. No product defect was found: every behaviour matched BE03b / BE03c at its first observation (no RED against the spec). No sub-agent,
no race module, no Playwright, no canonical db command; no ledger, receipt, tracker, spec, promoted migration, shared helper, db9b file or another lane's file was touched.
The AC-108 / AC-190 matched pair needed a labelled FALLBACK because the real governed chain refuses the foreign type id (see Follow-up item 5): root should read that caution.

## Scope

Brief `briefs/gaps-wave9-db.md` section db9a, items 1-4. Method as race7 / race8: dblink two-session pgTAP on the race7 harness, the real `platform_api` command as the holder
or contender wherever one exists, waits observed in the live lock manager (`pg_blocking_pids`, `pg_locks`), positions probed from a third session with `FOR UPDATE / FOR KEY
SHARE NOWAIT`, each file restoring the database it commits to (`added_after_restore = 0`, `missing_after_restore = 0` in every file).

## Per-item outcome

| Criterion | Clause | Outcome | Identity (file : scenarios) |
| --- | --- | --- | --- |
| P2-S12-AC-294 item 1 "unassigned" | authority / visibility rechecked after waits | BUILT; per DEC-248 only U1 is cited, under part "authority/" (6 titles); U2 stays in the file, NOT cited | `race9_entry_unassigned.sql` U2 (assignment-level revocation held open: create blocked BY it at position 2, holds the target entry row, not 3 or 4; after release uniform `VALIDATION_FAILED` at `/fields/{relation field}`, nothing written, no idempotency record), U1 (REAL CMS-03A-17 `platform_api.cms_revoke_capability_grant` held open: create blocked BY it; same uniform refusal after commit; grant end plus same-transaction assignment revocation committed; the caller keeps `cms.author`), control U0 (the same create succeeds while visible) |
| P2-S12-AC-294 item 2 "no invisible/foreign definition lock lever" | DEC-245(6) definitions | BUILT; activation / submit rows stay as adjacent evidence (not cited); the part is carried by the CMS-03B-10 rows of the follow-up (see below) | `race9_definition_lever.sql`: a session of org A holds the content type row, all version rows and the default template version FOR UPDATE (key-share probes prove the strength); a caller of org B names A's definitions through CMS-03A-04 `cms_activate_schema` (A's type / version / dry run / plan / approvals) and CMS-03C-06 `cms_submit_governed_review` (`template_version` = A's default template): both answer `P0001:NOT_FOUND`, identical to the outcome for absent ids (no existence oracle), under a 1 s `lock_timeout` while the holder is still open; stores unchanged; positive control: A's own create is observed blocked BY the same holder |
| P2-S12-AC-277 item 3 U1 guard | refute8 `missedGaps` | DONE | `race8_related.sql` U1 assertion now `position(...) = 0 and u1_projection_after <> ''` (title text unchanged, so db8's citation keeps resolving) |
| P2-S12-AC-277 item 4 "related target unpublish" | production path (DEC-245(7)) | BUILT (18 citable titles) | `race9_related_unpublish.sql`: three targets PUBLISHED by CMS-03B-09 and given an unpublish schedule by CMS-03B-07 (about 75 s ahead, no clock forged); claimed by the real claim command; executed by the real CMS-03B-20 `cms_execute_publication_schedule`. O1 executor first, O2 curation first, O3 control with a FOR UPDATE holder on the target entry row |

Deterministic outcome of item 4 (asserted both orders): FOR SHARE (executor, position 0) and FOR SHARE (curation, target at position 2) do not conflict, so **nobody waits** in
either order; the end state is the same (unpublish tombstone `publish:active,unpublish:revoked`, schedule `completed`, the pin stored, the target absent from the public projection
while the projection still lists the source's other candidates). Proof of no-wait: the second command completes under a 1 s `lock_timeout` WHILE the first is still open, and
`FOR UPDATE NOWAIT` on the target entry row is refused (`55P03`) while `FOR SHARE NOWAIT` is granted, before and after. Wait evidence where a wait exists (O3): a holder of the target
entry row FOR UPDATE (what a 03B revision writer takes) is observed blocking BOTH the curation and the execute (`pg_blocking_pids`, `transactionid`); after release both commit.

### Observations that differ from the brief's wording (no defect, no RED)

1. **AC-294 "waits at position 2 while the REAL revocation commits" is not reachable as worded.** Every real revocation seam (CMS-03A-17 grant end, tenure end) updates the grant or
   tenure row first, and every write path share-locks those rows at position 1 (`cms_lock_entry_authority`). So a create overlapping the real revocation waits at POSITION 1
   (the file proves it holds none of positions 2, 3, 4 meanwhile, `00000/00000/00000`) and, after the commit, the first unlocked visibility pass already refuses with the uniform
   `VALIDATION_FAILED`; the second recheck (after the position 2 locks) cannot be reached by the real seam, because a revocation that starts after the create holds position 1
   waits for the create instead (race7 S4a). The position-2 wait with the target going invisible is shown with the assignment-level write held open (U2), which is the exact row
   write the migration's seam performs, labelled as a stand-in: no command revokes a single assignment (db8 open item 1). The two together carry the clause for "unassigned".
2. **Real unpublish does not wait for, nor make wait, the curation** (refute8 MODEL FINDING confirmed). db8's U3 (entry row FOR UPDATE by hand) is an interleaving the production writer
   cannot produce; O3 here is the labelled control. Root may drop db8 rows U3 "blocked BY the unpublishing writer ... (position 2)" and "while it waits at the target the curation already
   owns the source entry row" from the ledger (refute8 DROP MODEL): `race8_related.sql` lines 100, 101.
3. The Worker-verified accessibility evidence of the execute request goes stale (`preflight_evidence_stale`) within the 75 s wait; the file builds each request after the claim (harness
   classification of run 1, see Runs).

## Files (path, lines, SHA-256)

| Path | Lines | SHA-256 |
| --- | --- | --- |
| `supabase/tests/phase_02_slice_12_race8_related.sql` (EDITED, 19 tests; backup `tar` below) | 113 | `be07ada2ded7510b8e2ee099b1794846db89ba0900d28d3c03b62888dfb9d629` |
| `supabase/tests/phase_02_slice_12_race9_related_unpublish.sql` (27 tests, about 80 s: the schedules really fall due) | 194 | `de227df6674e44798fccb9f4c310950cd6b01a18a9f4850e02c6605de7d78d40` |
| `supabase/tests/phase_02_slice_12_race9_entry_unassigned.sql` (21, wait tuples added) | 169 | `89f61015ad31b81afa19410ac641db66b1b4ee9f5c204606ff9672aa638924df` |
| `supabase/tests/phase_02_slice_12_race9_definition_lever.sql` (18: CMS-03B-10 create, unit helper, retitles) | 143 | `a51e5f5e24b3ec8e7f5295ca0346a330f5c3eb6a98257ce8173555ca4175daa2` |
| `supabase/tests/phase_02_slice_12_gaps_db9c_selector_owner_pair.sql` (NEW, 35: matched pair) | 226 | `7e87086520e3ac43e2474489d9b5acd5c00c1218a32bb437501ce3647196fc20` |
| `supabase/tests/phase_02_slice_12_race9/010-publication-world.sqlinc` | 40 | `b349fdc863acdc8c2e57926775cace79bfa842fcb75639a27fbeca433180af4b` |
| `supabase/tests/phase_02_slice_12_race9/020-unassigned-world.sqlinc` | 63 | `7304a7762c1f783c27ccc2083e2f92eedf835f96cb5b7bb3fee0933ee316c17f` |
| `supabase/tests/phase_02_slice_12_race9/030-definition-world.sqlinc` | 44 | `5999ee7ec8aa6b50da051dc00177233b77ad491fdf3d20aaeb973da74c766c20` |
| `supabase/tests/phase_02_slice_12_race9/README.md` | 33 | `0ce7f418f5b73fa526be001dd3b1560d3852275ec5c2e3cd7e02a3ebb702037c` |
| `docs/handoffs/2026-10-22-claude-s12/recite9/db9a-proposals.json` | 488 | `890d1081f508bedbb8456d4199487c31e0c485eb17716acc1e5cfa1c73b9f9c3` |
| `docs/handoffs/2026-10-22-claude-s12/recite9/db9a-race9-final-run.tap` (copy of the final TAP) | 307 | `8ea21b1a5f881ee020a9c5772839cf37de33fc1ebc4fb3b526b9c70bc6a64174` |
| `docs/handoffs/2026-10-22-claude-s12/recite9/db9a-race9-final-run.manifest` | 571 | `7e992cfe261b9fc3187c98ba25314804d266b57ae0c744474e5d8cc01d46067b` |
| `docs/handoffs/2026-10-22-claude-s12/lane-claude_s12_db9a-report.md` | this file | (see the final message) |

Edited existing untracked file: `race8_related.sql` (db8). Backup before the edit: `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_db9a/orig-204443.tar`
(contains that file and the whole `race8/` directory). The race7 / race8 harness fragments are `\ir`-ed unchanged.

## Runs

All through the staged ALT runner, lane `none`, foreground, never wrapped in `timeout`.

| Stamp | Files | Result | Classification |
| --- | --- | --- | --- |
| 164843-1069828 | unpublish | 27 tests, 11 not ok | harness: the execute request carried evidence built in the world, stale after the 75 s wait (`preflight_evidence_stale`); every dependent assertion failed; the world, publish, schedule and claim were green |
| 165056-1079665 | unpublish | 27 / 27 ok | evidence now built after the claim |
| 165939-1113802 | unassigned, lever | lever 13 / 13 ok; unassigned 19 tests, 6 not ok | harness: Idempotency-Key `r9-u0` had 5 characters (bound 8); the visibility fixture note was computed with `app.cms_rpc` unset |
| 170558-1136519 | unassigned | 19 tests, 1 not ok | the fixture-visibility note only (`app.cms_rpc` was empty in the world transaction; the scenario assertions U1 / U2 were already green) |
| 170700-1142470 | unassigned | 19 / 19 ok | - |
| (first round final) 170804-1148885 | race8_related, unpublish, unassigned, lever | 78 / 78 ok | superseded: lever, unassigned and the proposals changed in the follow-up |
| 185043-1573160 | db9c, lever, unassigned | lever and unassigned all ok (CMS-03B-10 NOT_FOUND 52 ms, wait tuples resolved); db9c aborted at line 198 | harness: `is(:'var', ...)` with unknown-typed psql variables (cast to text) |
| 185652-1596569 | db9c | 35 / 35 ok | - |
| **185743-1600886** | **race8_related, unpublish, unassigned, lever, db9c** | **120 / 120 ok, exit 0** | **FINAL on the bytes listed above**: TAP `.lane-logs/alt-staged-none-185743-1600886.tap` SHA-256 `8ea21b1a5f881ee020a9c5772839cf37de33fc1ebc4fb3b526b9c70bc6a64174` (copy in `recite9/`); manifest SHA-256 `7e992cfe261b9fc3187c98ba25314804d266b57ae0c744474e5d8cc01d46067b`; plans 19 + 27 + 21 + 18 + 35 |

(One queued run, task `bb6k0wc6q`, was stopped by its own task id while still waiting for the CI lock, before it ran, and relaunched with all changed files.)

Every non-final run was a harness classification; no product RED. Negative controls inside the final run: U0 (visible target, create succeeds), O3 and the lever controls (the probe sees a
wait when one exists), both polarities of every position probe (`55P03` held / `00000` free), key-share probes proving the lever holder owns FOR UPDATE strength.

## Follow-up round (root message 2026-10-31; refute9db 6.1, 6.3, 10; DEC-248)

1. **Definition lever on CMS-03B-10 itself** (`race9_definition_lever.sql`, L0): organization B (labelled `cms.author` grant row, as db9b) sends the REAL `cms_create_entry` naming A's
   `contentTypeId` + `contentTypeVersionId` while A's session holds the content type row, all version rows and T1 FOR UPDATE: `P0001:NOT_FOUND`, identical (message and DETAIL) to the
   answer for an absent pair; completed in 52 ms (asserted below 900 ms inside the 1 s `lock_timeout`); the holder is probed STILL OPEN after each call (key-share probes `55P03/55P03/55P03`);
   control: A's own create is observed blocked BY the same holder (`pg_blocking_pids`, `transactionid`) and commits after the release.
2. **Unit level, no forgery** (L3): `cms_lock_default_template_shared(T1, B)` under `lock_timeout` 1 s returns `00000` in about 1 ms with A's holder on T1 still open afterwards; control
   `(T1, A)` observed blocked BY the holder and returning after the release.
3. **Label fix** CMS-03C-07 to CMS-03C-06 for `cms_submit_governed_review` in `race9_definition_lever.sql` header, `030-definition-world.sqlinc`, the race9 README (the README line that said the
   file names A's "default template" through the create is corrected) and this report. Retitles (old to new, same file `race9_definition_lever.sql`; the two old titles were cited by my
   first-round proposals only, never applied to a ledger):
   - OLD `a caller of organization B naming organization A's content type and version in a schema activation is refused (not completed, not timed out on a lock) [P2-S12-AC-294]`
     NEW `a caller of organization B naming organization A's content type and version in a schema activation is the concealed NOT_FOUND [P2-S12-AC-294]` (assertion now the positive `= 'P0001:NOT_FOUND'`; the identity-with-absent row stays separate)
   - OLD `every one of those calls returned under a 1 s lock_timeout while the holder of organization A's definition rows was still open: B requested no lock on A's rows (a FOR SHARE would have waited behind FOR UPDATE) [P2-S12-AC-294]`
     NEW `each of the activation and submit calls completed in under 0.9 s, inside its 1 s lock_timeout, and A's holder still owned the definition rows AFTER each call (probed): B requested no lock on A's rows [P2-S12-AC-294]` (elapsed asserted per call)
   The activation / submit rows are not in the proposals any more (adjacent evidence only, DEC-248).
4. **U1 wait evidence** (`race9_entry_unassigned.sql`): the waiter's `pg_locks` tuple lock is read while it is blocked and resolved by ctid: it is on
   `identity_private.organization_actor_grant` at designer2's `cms.editor` projection row, the authority row of position 1 (new title `the lock the create waits on is the revoked grant itself: ...`). The same
   read for U2 shows `platform_private.cms_entry_assignments` at the `cms.editor` assignment over T3 (position 2). U2 is no longer in the proposals (DEC-248); U1 is filed under "authority/".
5. **AC-108 c3 / AC-190 c2 matched pair** (`phase_02_slice_12_gaps_db9c_selector_owner_pair.sql`, NEW): the first owner's labelled clone (a DRAFT copy of a real pattern row, `compatible_type_ids`
   naming its own type AND the second organization's active type), ACTIVE, is not listed to the second organization's author by `cms_list_pattern_selector` nor to its template designer by
   `cms_list_pattern_nestable`, and is listed to its owner by both (control); scratch copies of both readers under test-only names, built from `pg_get_functiondef` inside the rolled-back
   transaction with the one owner predicate removed (asserted `2->1` occurrences of `version_row.owner_id = v_party_id`), LIST the clone to the second organization (the negative arm fails
   without the predicate) and answer the owner identically otherwise. **BOUNDARY + FALLBACK**: the real governed chain cannot activate the clone: the first owner's REAL submit is refused
   `P0001:VALIDATION_FAILED ["/blockTree"]` (asserted) because `cms_governed_current_digest` calls `cms_pattern_blocks_compatible` (`20261014100000:36-38` over `20261014090200`,
   `content_type.owner_id = p_owner_id`). The clone is therefore walked draft > review > approved > active through the guarded lifecycle seam (`app.cms_governed_lifecycle`, lifecycle_version + 1,
   legal pairs, definition columns unchanged, no review / approval row, no trigger disabled) under a labelled forgery, as refute9db 6.3.2 names the fallback. The sensitivity and the owner control are
   real; the activation path of the foreign row is not the producer path, so the proposals carry that caution in `gap`. The coordinator asked for "ACTIVE only through A's real governed chain": that is not possible.

## Test corrections

None to an existing oracle. The one edit (item 3) strengthens `race8_related.sql` U1: `... = 0 and pg_temp.r7_get('u1_projection_after') <> ''`; the title is unchanged.

## Spec citations

BE03b "Initial revision default template (CMS-03B-10, DEC-202)" 1729 ("A concealed/foreign definition must not become a lock lever"); BE03b "Write-path lock order and authority
fencing" 1729-1755 (rule 2 line 1750 "bumped, archived or unassigned between check and use"; the global lock order sentence 1736 names CMS-03A-17 and the tenure end); BE03a
CMS-03A-17 (DEC-119, owner-only revoke under CAS); migration `20261005011300` (revocation revokes the person's entry assignments in the same transaction, DEC-143); migration
`20261005012100` (`cms_lock_entry_authority`: person, tenure, grants, assignments; `cms_lock_relation_target`); `20261005011600` (`cms_relation_target_visible`); BE03b "Schedule
execution (CMS-03B-20)" and migration `20261005017740` (entry row FOR SHARE at position 0); BE03c CMS-03C-05 1700 and Public projection 1571, concurrency tests 1817; migration
`20261013300800` (governed submit: structure, then concealment by unlocked resolve, then the locks). Decisions DEC-143, DEC-157, DEC-202, DEC-245(6)(7).

## Open items / BOUNDARY

1. **AC-294 "archived"**: no writer archives an entry (db8 open item 1, DEC-245(6) keeps it open); `race9_entry_unassigned.sql` carries the "unassigned" flavour only.
2. **AC-294 superseded default under a waiting create** (db8 open item 3): not in this brief, still not exercised.
3. **AC-294 "template" definition shapes**: the template lever is driven through CMS-03C-06 (a template version named as a `subjectId`). Other commands that name a template version or type
   id (`cms_define_template` `compatibleTypeIds`, `cms_create_schema_successor` `defaultTemplateVersionId`) were not driven: their owner-scoped checks are plain SELECTs without a lock
   (`20260927200000` lines 425-440) and the successor needs a full second-organization schema chain. Read, not tested.
4. **AC-277 other parts** (linked update versus local override, duplicate and out-of-order events, restore-epoch fencing): unchanged BOUNDARY readings for the owner.

## Requests to root

1. Apply `recite9/db9a-proposals.json` by clause text: AC-294 c1 (12 rows: U1 under "authority/", the CMS-03B-10 lever rows and the lock-helper unit rows; stays `partial`, limitation in the file),
   AC-277 c2 part "related target unpublish," (18 rows), AC-108 c3 (7 rows) and AC-190 c2 "selectors)" (5 rows) from the matched pair, with the caution of Follow-up item 5 (decide whether a row activated
   by the guarded lifecycle seam may verify the owner predicate, or whether the BOUNDARY keeps both `partial`). Consider dropping db8's two U3 rows (Observation 2).
2. The wave-9 first-round proposals for U2 and the activation / submit lever rows are withdrawn (DEC-248).
3. Runtime for the canonical gate: `race9_related_unpublish.sql` takes about 80 s (schedules fall due in real time); the others take seconds. All are plain pgTAP files that restore the database they commit to
   (`added_after_restore = 0`, `missing_after_restore = 0`); the db9c file is a single rolled-back transaction.
4. Races root must run: none new (no `*.race.mjs` written).
5. Refutation population: please check the lever file's claim "B took no lock" (completion in about 50 ms under a 1 s `lock_timeout` with a FOR UPDATE holder probed still open afterwards, the unit helper call, and the
   blocked controls) and the db9c fallback labelling.
