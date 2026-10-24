# Review V4 report (`claude_s12_review_v4`) — governed-recheck WIP after its fix lane

Status: FINAL (2026-10-23 UTC). Independent, read-only reviewer (I authored and previously reviewed nothing in this scope; an earlier V4 attempt was cut off before it wrote a report and
was not consulted). HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`, worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Not run (not permitted): SQL, docker, supabase, pgTAP, race modules, the staged runner. Run: `sha256sum`, `diff`, `grep`, `git status`, read-only `tar -x` of an intake backup into the
reviewer scratchpad, one focused read-only Vitest invocation, read-only greps of the final fix-lane TAP. The only repository file written is this report.

## Verdict

| Lane | Verdict | One line |
| --- | --- | --- |
| `governed-recheck` after `fix-recheck` (4 migrations, new suite `phase_02_slice_12_governed_recheck`, 5 corrected governed suites, Worker module) | **PROMOTE** (actions C1-C4 below, all cheap) | No security or promotability defect in the four files; behaviour matches BE03c Invalidation, G6, Job transport and the lock rows except where V4-02 (promoted callee) and V4-05 (`030200`) show an outcome BE03c permits but root should decide. The seven MINOR items are test-strength gaps, claim-accuracy gaps or those two small behaviour choices; six are NITs. |

Counts by severity (13 findings): **BLOCKER 0, MAJOR 0, MINOR 7, NIT 6.**
R3 resolution (7 original ids): **resolved 5** (R3-07, R3-08, R3-11, R3-13, R3-14), **partially resolved 2** (R3-12: recorded in the header only; R3-20: reordered and header corrected, but proven only textually and
with a residual multi-review cycle), **open 0.**

Actions before the joint promotion step (none needs a new design):

- C1. Delete `supabase/migrations-wip/governed-recheck-red/` and `supabase/migrations-wip/fix-recheck/` before staging or copying: the RED copy has the same four timestamps `20261022030000..030300`
  (python scan of 461 promoted + 78 WIP files: the only duplicates), so a directory-wide stage or promote collides. `030300` is byte-identical in both.
- C2. While the files are editable: replace the handoff-review tags in the immutable headers (`R3-07`, `R3-08`, `R3-12`, `R3-20`) by `DEC-218`, `DEC-207` and section names (V4-10), and decide V4-05
  (skip an activated review in the person invalidation) because it changes `030200` bytes.
- C3. Decide V4-02 before DEC-218 is recorded as satisfied: either a forward migration that makes `cms_governed_frozen_status` re-raise lock failures, or narrow the BE03c sentence and DEC-218 to
  "lock failures outside the block digest".
- C4. Same step as R3 asked (still open, root-owned): `phase_02_slice_09_r8_api_surface.sql` classification and label, `packages/data-access/src/database.types.ts`, BE03c closed RPC list and signature text (V4-12).
- Gate note on PAT-031 (recorded policy: "Every entry point needs a context-cleared test"). I rate the absence of those tests MINOR (V4-04) because I verified, function by function, that each entry point sets the flag before its first forced-RLS read
  and that every outermost one restores it, so no defect is hidden. If root treats the policy as a promotion gate, the verdict for this lane becomes FIX FIRST until the V4-04 include exists; that is a test-only change and moves no migration byte.
- Tests to add before the ledger cites AC-202..204 as proven: V4-01, V4-04, V4-06, V4-07 (no migration impact). Race pairs of V4-03 are root's post-promotion run (Request 4 of the fix lane).

## Scope (SHA-256 of the bytes read; all migration and SQL-test hashes equal the "Files after" table of `lane-fix-recheck-report.md`)

```
0fad12738d3d79c675628d81ac2a8114ae3082b82554c2a89dcbeffa2e3703e2  supabase/migrations-wip/governed-recheck/20261022030000_cms_governed_recheck_verdict.sql (69 lines)
4057f46d4395159a061dca0f8215f3b46dde0d4ca17359654240f5c6259dafcc  supabase/migrations-wip/governed-recheck/20261022030100_cms_recheck_governed_reviews.sql (219)
fa59297541a6c43ae9868cddbac9aa159beeda998d7afd577714d02cf9e01fcb  supabase/migrations-wip/governed-recheck/20261022030200_cms_invalidate_governed_reviews_for_person.sql (157)
8731b987388c0ee14b52d7a7760b33af42fb1c035c00211a23eb89dd0ab3c8e9  supabase/migrations-wip/governed-recheck/20261022030300_cms_governed_recheck_resolve_event.sql (73, unchanged by the fix lane)
7f87728d1b7da65075573b2a7a556fcc21cc5a949e58e4907271efbc0990fcce  supabase/migrations-wip/governed-recheck/README.md
cd88328b9455ddffcdc6aeaa909532ea89679e91f038fb14c6111b884fb8d1d7  supabase/tests/phase_02_slice_12_governed_recheck.sql
f62edc832ab046c5110e40c705c38e78ed305dd4d63e7da5c90177d36ea0b5cb  .../phase_02_slice_12_governed_recheck/002-lapse-helpers.sqlinc
a354df986cf386a461622e4287edc40179161a591ba65207bc6aab7b0346caec  .../005-helpers.sqlinc
c263bcf2e88f9cb1e6c3689f0f6dcf5e0dd21c1baac94640a4a91ad466bb9a01  .../010-setup.sqlinc
2d296a5da3b98128e8f310895b0baa4ed1c0fbdce68467d4b7c23f77ab8084f9  .../020-contract.sqlinc
ab31e853ed964dd2a3ddbf2422ebc30a0fad080732205a7501138e911dec94e0  .../025-lapse-fixture.sqlinc
c5709816e442e439cc9072068a3e10af40575d4aae72c8deecc7c25e15bef473  .../030-person.sqlinc
4c49530ec00581114ef7d1092a25d4bc87259e37dcb0ae5828b6b069066503b4  .../040-recheck.sqlinc
16ec16849967a9ad56fde4da3cf7a28f4c0d1a1eaf1f4d7e2ecefdac237dfddf  .../050-block.sqlinc
a8132331a477271327e173f4010627a26754dc1272a60f9c893d840f1a720ea8  .../060-resolver.sqlinc
3c4a5e99a2a2e836755f4542ba0c02f37c75d4ffc40743e4d7e23c19162d1fa9  .../070-isolation.sqlinc
d6d232540c766939147fa694d18da8ffaebae02db09d66630594d6e3bb7a521f  .../080-tenure.sqlinc
05982a6c77dd43754186d1f0d8326f1e298afa9b52e41706005ba78dfc5e6604  .../README.md
7e8147e4317b98a8bd87983ff4fcdc88dddde6f79103f7e79ec7d85f4eceab37  supabase/tests/phase_02_slice_12_governed_activation.sql
0aac19a8474ba77659a5845230e652b8cf67cf039d2bdac8c2edc79c8ab07c8b  .../phase_02_slice_12_governed_activation/060-invalidation.sqlinc
6fed2e64b535c1cbe5ff303de89a86cd774f71f5dc08c724dd7a527571c09d78  .../095-retire.sqlinc
59d8f1b1906f076a2fdc435b9d1ffbcd6ebecba661546596d7f1c0ddae96e53a  supabase/tests/phase_02_slice_12_governed_decision.sql
1a6968cfb5d0b57a3ffa8b96c97a894a7b6773870bca85ea468a39788b522b1b  .../phase_02_slice_12_governed_decision/050-invalidation-gates.sqlinc
ad09860c858a06379b91392b7b7d56497d0e2661474301da110297f813f62008  supabase/tests/phase_02_slice_12_governed_schedule.sql
e167f57bef6abb4479717b6408b00269ee949f649bad72dae965f43c5b86659f  .../phase_02_slice_12_governed_schedule/055-fire-approval.sqlinc
d007d040adcc5bb241968eb38325e34b09e4afa65eaa441f566ba5bb2de817b7  supabase/tests/phase_02_slice_12_dec191.sql
f30c00e2f3fa84ebf0586048c268ba3a3254cd6ff6816ad40d444a93e0ed1b87  .../phase_02_slice_12_dec191/040-detail.sqlinc
b3ed2abb4d53657bcea920ba4b6d2f59284a154fdff326a492c01ee1e42e1c46  .../phase_02_slice_12_dec191/010-setup.sqlinc
```

Worker module read (`apps/worker/src/cms-composition/governed-recheck/`): `contract.ts` e5862527..., `job.ts` a440f52d... (differs from the lane report `51c5077b...`: later edits of the observability lane), `source-consumers.ts` 91a89147... (same), `rpc.ts` a3c9465e..., `processor.ts` ca5a5339..., `production.ts` bc2f418a..., `message.ts` ff30ef45..., `rpc-names.ts` 6b6bf1d5..., tests unchanged except `observability.test.ts` 1b3a400c... (new, other lane).
`production-async-entrypoint-review-recheck.test.ts` is now `8d84e163...` (the "before" of the fix lane was `04556a5e...`; the fix lane report says it did not edit it, so another lane did).

Read-only evidence sources: BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` (Governed review machinery, Reviewer-authority invalidation on revocation, Job transport, Slice 12 lock order), BE03b promoted equivalent `supabase/migrations/20261005017580_cms_review_invalidation.sql`, `20261013300500_cms_governed_review_support.sql`, `20261014070000_cms_governed_activation_helpers.sql`, `20261013300400_cms_governed_frozen_status.sql`, `20261010164100_cms_dependency_recheck.sql`, `20261002174000_membership_tenure_start_predicates.sql` (live `cms_person_holds_capability`), raw records DEC-207 (`.memory/raw/events/2026-10-22.jsonl`), DEC-218 and PAT-031 (`.memory/raw/events/2026-10-23.jsonl`).

Coverage note: read in full were the four migrations, the governed-recheck driver with all thirteen includes, the Worker module with its tests, and the corrected include of each of the other four drivers (whole fragment or the changed hunk with its surroundings).
The remaining fragments of those four drivers (`governed_activation/000-050, 070-090`, `governed_decision/010-040`, `governed_schedule/010-050, 060`, `dec191/000-030, 050-080`) and the neighbouring suites (`governed_schedule_ladder`, `dec191_exhausted|lineage|pattern`) were not read line by line:
I grepped all of `supabase/tests` for `s12fr_`, `app.cms_rpc`, `lapse` and `disable trigger` (no hit in them besides those cited) and relied on the final TAP for their results.

Method note: a few scratchpad-only commands (listing `/tmp`, extracting the intake backup, assembling this report) did not start with the worktree `cd`; they used absolute `/tmp` paths and touched nothing in `/home/rob/Projects/WeJammin`.

## Evidence

- **Bytes read equal the runs.** The four migrations in the manifest of the final fix-lane run (`.lane-logs/alt-staged-pattern-updates+dec193+dec194+dec195+locale-gate+dec197+dec202+dec205+dec206+governed-recheck+block-rules+fix-dec193+fix-recheck-210911-3790157.manifest`,
  SHA-256 `6eed0364fb082c34f1c8edb380d387d588b497f0bf72cd5cf76040140b7a83ec`) have the SHA-256 listed in Scope (4/4). The TAP of that run (`ac4f75767304a200149ad5c6e5fd6d4784dd36b960134e0f7950c538853dcba9`) shows
  `governed_recheck` 116/116 ok (lines 9040-9215), the lag-fixture controls ok in all five suites (lines 1168, 8528, 8578, 8784, 9105-9107, 9441), and `not ok` only for the four root-owned inventory assertions
  (`phase_02_slice_09_r8_api_surface` #4/#13/#14, `sec2_all_schema_definer_rls` #6).
- **Worker.** `vitest run apps/worker/src/cms-composition/governed-recheck apps/worker/src/production-async-entrypoint-review-recheck.test.ts`: 8 files, 82 tests, 0 failed (JSON reporter output in the reviewer scratchpad,
  SHA-256 `b724717265c09cd1e3c518e59dc92baa1e52d7c62ba7dab59115cebf42e79ccd`).
- **Fix-lane diff verified.** `diff` of the four migrations against the RED copy (`governed-recheck-red/`, the originals) shows only the R3-07/08/13/14/20 edits (new tenure trigger and function, `drop trigger if exists` removed, subject lock before the
  verdict, per-review `exception` block, header text). `diff` of the five corrected suites against the pre-lane originals extracted from `~/.local/share/wejammin-backups/s12-dirty-20261022T052758Z.tgz` shows: the real-revoke control replaced by
  `s12fr_lapse` + one control, one `s12fr_restore`, comments, `plan(57)->plan(58)` in `governed_decision.sql` (net +1 control: the R7 revoke control became a lapse control, the R8 revoke control was kept after a restore) and the `\ir` of the helper in four
  drivers. Every other line is byte-identical.
- **Promotability scan (python).** 461 promoted + 78 WIP migrations: timestamps unique except the RED copy (C1); newest promoted `20261020203606` < `20261022030000`; none of the eight functions or two triggers exists in `supabase/migrations` or
  another WIP lane (grep), so no `create or replace` of a live body and no lost tail; no WIP lane redefines a callee (`cms_governed_invalidate_approved_review`, `cms_governed_frozen_status`, `cms_governed_review_qualifying_decisions`,
  `cms_governed_subject_resolve`, `cms_person_holds_capability`, `cms_dependency_recheck_event_ref`, `cms_dependency_recheck_lineage`); no data statement in any of the four files (no backfill, no constraint validation); lengths 69/219/157/73 (<= 300);
  `git status` shows no modified promoted migration (`supabase/migrations/README.md` is root's).
- **Security read.** All eight functions: `security definer`, `set search_path = ''`, every reference schema-qualified, no dynamic SQL; owner `wejammin_cms_definer` through the `grant create / alter owner / revoke create` bracket
  (`030000:63-66`, `030100:208-211`, `030200:146-150`, `030300:62-65`); `revoke all ... from public, anon, authenticated, service_role`; `execute` granted only to `service_role` on the two `platform_api` wrappers; table grants only to the definer role
  (`030000:63`, `030100:203-207`, `030200:142-145`); RLS untouched; authority: the three `platform_api`/trigger entry points are service-role-only internal operations (BE03c "Permission, RLS, and grants": the internal RPCs `cms_invalidate_governed_reviews_for_person` and the recheck RPC), no caller identity is read (`030-person.sqlinc:121-123` asserts it), so no 404/403 disclosure rule applies; audit carries ids only (`cms_record_audit(..., null actor, owner, 'cms_governed_review', id, token, correlation)`), the only log text is `review <uuid> left live (sqlstate <code>)`.

## Answers to the five questions

### 1. The lag fixture (PAT-031)

**What it is.** `pg_temp.s12fr_lapse(org, person, capability)` (`002-lapse-helpers.sqlinc:20-54`) lets the test-admin recreate `platform_private.cms_person_holds_capability(uuid,uuid,text)` (live body
`20261002174000_membership_tenure_start_predicates.sql:268-290`, STABLE SECURITY DEFINER SQL, owner `wejammin_cms_authority_reader`, never inlined) as `select (<unmodified body>) and not coalesce(<org:person:capability> = any(string_to_array(current_setting('s12fr.lapsed'), ',')), false)`.
The unmodified body still runs for every other triple. `s12fr_restore()` (`:56-75`) replays the saved `pg_get_functiondef` and checks `md5(prosrc)`, ACL and owner. `025-lapse-fixture.sqlinc` proves holds-before, not-after, other person unaffected, accumulation and byte-for-byte restore (TAP 28-31 ok). No row is written and no trigger is disabled.

**Can it hide a real defect?** I found no assertion that depends on behaviour a real lapse would not produce. Reasons, each checked in code:
(a) all nine behavioural use sites (the tenth is the fixture's own self-test, `025`) lapse a person who is only READ, never an acting caller: 030:72-115 (x02, direct person-invalidation calls), 040:26-36 (rev2, recheck verdict), 070:85-106 and 107-125 (approvers of iso3, iso4, recheck verdict), activation 060:31-58 (rev2; the activator is `owner`),
095:206-221 (designer2 `cms.reviewer.policy`; `owner` retires), decision 050:27-61 (rev1; designer2 decides), schedule 055:15-51 and dec191 040:87-95 (rev2; system claim/execute and `owner` commands). So the difference between the stand-in (affects only readers that call the function)
and a real lapse (also affects the readers that query `membership_tenure`/`organization_actor_grant` directly: `cms_require_capability`, the assignment grantor check `20261014010100:208-214`, the activation authority-end check `20261014070400:148`) never matters here.
(b) the only authority reader of every recount is the function: `cms_governed_review_qualifying_decisions` (`20261013300500:19-37`, the `cms_person_holds_capability(review.owner_id, decision.reviewer_person_id, decision.capability)` conjunct), used by `cms_governed_review_distinct_approvals`
(`:41-47`), the activation verdict (`20261014070200:64-77`), the recheck verdict (`030000:42-55`), the decision recount and the person invalidation (`030200:61-65`). The tests are mutation-sensitive to each consumer (delete the recount and the activation succeeds, the control and the refusal assertions fail).
(c) the guard returns the same boolean the unmodified function returns for a lapsed row, so nothing downstream can distinguish them.

**Is the real lapse path proven anywhere?** Only half of it. The REAL reader on a REAL lapsed row: `phase_02_slice_09_evidence_grants.sql:73-74` (`s09g_warp(... -3, -1)` then `not s09g_holds(...)`, `s09g_holds` is the unmodified function,
`phase_02_slice_09_dec119/00-support.sqlinc:81-85`), `phase_02_slice_09_dec119_grant_lifecycle.sql:134-135`; the editorial analogue "found lazily" with a plain UPDATE: `phase_02_slice_11_helpers_preflight.sql:833-836`. The LAZY discovery by a governed recount
with the unmodified reader: nowhere. Since AC-204 every eventful loss invalidates in its own transaction, the lag exists only for a calendar lapse, which a single-transaction pgTAP file cannot make without a clock, a disabled trigger, or a stand-in. The composition
(real reader false on a lapsed row) AND (recount honours the reader) is therefore proven by argument and two separate proofs, not by one test.

**Is activation's defense-in-depth recount proven through the REAL reader?** No. `cms_governed_activation_verdict` reaches `approval_invalidated` (`20261014070200:74-76`) in the suites only through the guard (060 gr7: 31-38; 095 gq2: 206-216; fire-time: 055:15-21, dec191 040:87-90).
The pre-AC-204 versions of these tests used the real CMS-03A-17 revoke (the real reader on a real row); AC-204 made that scenario unreachable (the trigger invalidates first), which is the correct reason for the correction, but the realism went with it.

**Concrete alternatives (finding V4-01).**
(1) Premise and recount function, no disabled trigger, real reader and real row: in the governed-recheck suite, after approving a review with a fresh pool person, run the labelled direct write used by the S11 preflight suite
(`update identity_private.organization_actor_grant set valid_from = current_date - 5, valid_through = current_date - 1 where ... capability_code = 'cms.reviewer'`, precedent `phase_02_slice_11_helpers_preflight.sql:833-834`). It fires the new trigger, so the review is invalidated in that statement
(a calendar-lapse WRITE through the real reader: new coverage of the trigger), then assert `not cms_person_holds_capability(...)` (unmodified function), `s12ga_approvals(review) = 0` and a direct call `select platform_private.cms_governed_activation_verdict(review)` = `'approval_invalidated'`
(the unmodified recount function does not look at the review state). This proves everything except that a STORED `approved` state is still refused by the command, which the guard suites keep proving.
(2) End-to-end lag with the unmodified reader, one witness per recount path (recheck 040-B, decision 050 R7, activation 060 gr7, fire-time 055): `pg_temp.s09g_warp('<actor>','cms.reviewer',-3,-1)` (`phase_02_slice_09_dec119/00-support.sqlinc:111-135`, included by all five drivers). It shifts the REAL aggregate and projection
with the user triggers of those two tables disabled inside one sub-transaction, so the review stays `approved` while the reader is untouched. It is a "disabled trigger" fixture, which the lane rules forbid for new code and the S09 suites use in eight files; root must allow it explicitly.
Keep the guard for the other sites. (3) Minimum: a comment in `002-lapse-helpers.sqlinc` citing the premise tests above and the reason alternative (2) was not used.

### 2. R3-07: does the tenure trigger match 03b, and does a non-ending UPDATE spare a still-authorized reviewer?

| Aspect | 03b `cms_membership_tenure_review_authority` (`20261005017580:425-445` function `cms_review_authority_trigger`, `:503-506` trigger) | governed `cms_membership_tenure_governed_authority` (`030200:138-140`, function `:108-127`) | Match |
| --- | --- | --- | --- |
| events and granularity | `after update or delete ... for each row`, no `WHEN`, no column list | same | yes |
| old row | `cms_invalidate_reviews_for_person(old.person_id, null)` | `cms_invalidate_governed_reviews_for_person(old.person_id, null)` (`:118`) | yes |
| new row | on UPDATE when `(organization_id, person_id)` differs: `(new.person_id, null)` | on UPDATE when `person_id` differs: `(new.person_id, null)` (`:119-122`) | yes in effect (an organization-only change repeats the same person; the function re-evaluates against each review's owner party, so nothing is missed) |
| capability | null | null | yes |
| RPC flag | captured, set `'true'`, restored | same (`:115-124`) | yes |
| other effects | also revokes preview tokens | none (not applicable) | n/a |
| grant trigger | passes null | passes `(old.person_id, old.capability_code)` and the new pair when changed (`:87-106`) | deliberate and now spec text (BE03c "Reviewer-authority invalidation on revocation": "with the old row's person and capability (and the new row's when an update changes them)"); consistent with the qualifying rule, which re-checks only the capability of the slot the decision satisfied (BE03b "Qualifying approvers") |

BE03b names the tenure end as authority revocation (`03b` "Write-path lock order and authority fencing", first paragraph) and BE03c now words both triggers (changelog row "Governed recheck hardening (review R3, lane F4b)"). **Non-ending UPDATE:** the trigger fires on any UPDATE, but the person
invalidation only selects decisions that NO LONGER COUNT: `030200:61-65` (`not exists (select 1 from cms_governed_review_qualifying_decisions(review.id) qualifying where qualifying.decision_id = decision.id)`), which re-asks the unmodified reader
`cms_person_holds_capability(review.owner_id, decision.reviewer_person_id, decision.capability)` (`20261013300500:36-37`): tenure `confirmed`, `starts_on <= current_date <= ends_on`, grant active and inside its window (`20261002174000:274-289`). A still-authorized reviewer is therefore never a candidate.
Tests: `080-tenure.sqlinc:80-85` (`updated_at`-only UPDATE, `tn7` untouched and approvals still 1), `:64-78` (tenure end in another organization), `:47-62` (renewal through CMS-03A-16), `:87-92` (base capability revoked, specialist decision stays counted), `:94-127` (end invalidates approved, scheduled and open),
`:129-136` (DELETE branch). Untested: a tenure UPDATE that changes `person_id`; a person with a second confirmed tenure row. NIT V4-09: the control at `080:74` is vacuous (x11 has no grant in the other organization, so `not holds(otherOrg, ...)` is true before the tenure ends).

### 3. R3-20: is the source-order test enough?

Per-review order now: `030100:134` subject row `FOR UPDATE` (`cms_governed_subject_resolve(kind, id, true)`, `20261013300300:131-207`, position 3) -> `:135` verdict (review read plain, `cms_governed_frozen_status`, block rows `FOR SHARE` in the digest) -> only for a review that no longer holds: review row `FOR UPDATE` (position 5) and then its schedule rows,
inside `cms_governed_invalidate_approved_review` (`20261014070000:166-172, 181-185`). The person invalidation does S -> R -> schedules per candidate in ascending review id, inside the revoking transaction after the UPDATE's own row lock (position 1). This matches BE03c "Slice 12 lock order" rows `cms_recheck_governed_reviews` and `cms_invalidate_governed_reviews_for_person`.
For the subject/block pair R3-20 was about, activation also takes the subject first (`20261014070400:101`) and the block shares later in its verdict (`:157`); its review row lock (`:110`) comes before those shares, which cannot cross the run's order because both sessions first need the same subject row. The single-review cycle R3-20 described (run holds block share, activation holds subject and queues for the block behind CMS-03A-08's pending `FOR UPDATE`, lifecycle waits for the run) is gone.

**Not sufficient as proof.** `070-isolation.sqlinc:142-148` is a text-position test of one function body (`position(...)` and a regex): it does not exercise what `cms_governed_subject_resolve` or the digest lock, does not exercise another session, and cannot see the residual cycle below. BE03c "Authorization, persistence, and concurrency tests" requires the order to be "proven through the real commands: concurrent pairs ... (... revocation versus activation) each end in one committed command and one typed 409 or 403, never a deadlock",
and lists "Template activation versus block withdrawal"; no race module covers the recheck or the person invalidation (grep over `supabase/tests/*.race.mjs`, `phase_02_slice_12_governed_authority/`, `phase_02_slice_11_races/`, `infra/database-races/`: the governed authority module is the CMS-03C-06 submit fence only). Models: `phase_02_slice_10_races/014-revocation-vs-activation.mjs` (grant revocation and tenure end versus activation, the closest to R-3), `phase_02_slice_11_races/031-dependency-recheck-race.mjs` (overlapping runs) and `011-review-decision-race.mjs` B6 (revocation versus decision); the repo's own convention is a race runner next to the structural pgTAP guard, as `phase_02_slice_10_activation_lock_order.sql:1-14` states.
It is not a promotion blocker: a deadlock is detected and typed `CONFLICT`, the fix is a plain reorder, forward fixes are always possible.

**Residual (finding V4-03).** Locks of a successful verdict are kept to the end of the transaction (the sub-transaction commits into its parent), so a multi-review run holds the block share locks of review 1 while it asks for subject 2. Cycle: run holds `B` (share) and wants `S2`; an activation holds `S2` and queues for `B` (share) behind a pending CMS-03A-08 `FOR UPDATE` on `B`; that writer waits for the run's share lock.
PostgreSQL breaks it with `40P01` in whichever party detects it first, and the wrappers type that `CONFLICT`. A sibling cycle (two overlapping runs plus the lifecycle writer: the first run holds a subject and waits for a block share queued behind the writer, the second holds that block's share from an earlier review and waits for the subject) can make the victim a run waiting INSIDE the digest, and there V4-02 turns the error into `dependency_changed`. The header claim "No earlier position follows a later one" (`030100:32-34`) is true per review, not across a run (block rows are in no BE03c position: the header files them under position 3 as "part of the subject's dependency graph", but the BE03c rows list only nested pattern versions there). Cheap fix: lock the subjects of the page first in ascending order, then run the verdicts.

**Race scenarios to name.** R-1 (R3-20): holder H1 = real `cms_activate_governed_subject` of the approved review R of subject S (holds S and R, then block B share in its verdict); H2 = `cms_advance_block_lifecycle(B)` queued `FOR UPDATE`; C = `cms_recheck_governed_reviews(block, B)`. Expect no `40P01` over N seeded interleavings, C waiting on S without holding B, all three ending in one committed command or a typed 409.
R-2: the same with two reviews so that C holds B from review 1 while it waits for S2 (the residual cycle). R-3 (BE03c "revocation versus activation"): `cms_revoke_capability_grant(P, 'cms.reviewer')` (grant UPDATE -> trigger -> S) against the activation of a review P counted on, both orders; today the activation-first order ends in `CONFLICT` for the revoker (V4-05), which must be asserted or changed.
R-4: two overlapping recheck runs for one event (the S11 R1/R2 shape): each review invalidated exactly once, one audit record each, no event.

### 4. DEC-218: isolation

| Property | Where | Tests | Verdict |
| --- | --- | --- | --- |
| unexpected errors isolated per review in a sub-transaction | `030100:132-159` (`begin ... exception when others`); PL/pgSQL `others` does not trap `query_canceled`/`assert_failure`; the rollback also releases the subject lock a poisoned review took | `070:81-103` (verdict fault `XX000` on review 2: counted `unavailable`, left live and byte-identical, the reviews behind it handled), `:105-125` (invalidation fault: nothing half-applied, no audit row, retry succeeds) | yes |
| lock timeout and deadlock propagate as the retryable conflict | `030100:147-148` (`raise`), wrapper `:190-193` (`CONFLICT`); Worker `job.ts:134-142` retries any run failure (`RECHECK_RUN_FAILED`) | `070:127-140` (`55P03` and `40P01` injected at the verdict entry -> `P0001:CONFLICT`, reviews byte-identical) | yes for locks taken by the run and the invalidation; **not** for lock waits inside the digest (V4-02) |
| cursor advances | `030100:126` (assigned before the block), `:169` | `070:86-93` (batch 2 over a poisoned second review returns ITS id; the continuation handles the rest) | yes |
| `unavailable` counted in the run result the Worker receives | `030100:154, 168`; Worker `contract.ts:84-101` (strict, `unavailable` in the sum rule), `job.ts:102, 112` (attribute and metric) | SQL `070`; Worker tests only with `unavailable: 0` (V4-06) | yes in code, untested positive in the Worker |

Consequences to note (not defects): the WARNING carries review id and SQLSTATE only (`:156`); a systemic fault (privilege, RLS, missing table) is isolated the same way and the Worker acks with an info-level success log, visible only as `unavailable` (V4-06); up to 500 sub-transactions each holding a row lock per run (V4-13).

### 5. `app.cms_rpc`: set, restore, and a context-cleared test

Root scan of the WIP bodies (python over `set_config('app.cms_rpc', ...)`, then read):

| Function | Sets `'true'` | Restores | Test with the flag cleared, as the real caller role, asserting rows and restoration |
| --- | --- | --- | --- |
| `platform_api.cms_recheck_governed_reviews` (service_role) | delegates to the private body | yes (`030100:184, 194`) | none |
| `platform_private.cms_recheck_governed_reviews` | yes (`:65`), before the first table read | no, the wrapper restores (only reachable through it) | none |
| `platform_private.cms_governed_recheck_verdict` | yes (`030000:33`) | no (only called inside the run) | none |
| `platform_private.cms_invalidate_governed_reviews_for_person` | yes (`030200:51`) after argument validation | yes (`:79`) | none |
| `platform_private.cms_governed_authority_trigger` | yes (`:96`) | yes (`:103`) | none (030 fires it inside the real revoke command, which already holds the flag) |
| `platform_private.cms_governed_tenure_authority_trigger` | yes (`:117`) | yes (`:124`) | none (080 uses direct DML by the test-admin; the flag state before it is not set or asserted) |
| `platform_api.cms_governed_recheck_resolve_event` (service_role) | delegates | yes (`030300:50, 54`) | none |
| `platform_private.cms_governed_recheck_event_ref` | no: the promoted Slice 11 `cms_dependency_recheck_event_ref` sets it (`20261010164100:116`) | no | none |

By inspection nothing forgets to set the flag before reading a forced-RLS table, and every outermost entry point restores it, so I found no PAT-031 defect. But no test in scope satisfies the PAT-031 rule: no file in the five drivers or the new directory contains `set_config('app.cms_rpc'`
(only `governed_activation/005-lineage-helpers.sqlinc` sets and restores it for a helper). The commands go through `s12ga_rpc`, whose `s09d_session` clears the flag (`phase_02_slice_09_dec108/00-helpers.sqlinc:116-132`, the clear at :124), but the recheck (`s12gb_call`), the resolver (`s12gr_resolve`), the direct person-invalidation calls
and the trigger DML do not, and nothing asserts the value after the call. Resolver and run are the two that matter most: the resolver relies on a promoted callee to set the flag. Finding V4-04, with a concrete include.

## Findings

Severity: BLOCKER (must not promote), MAJOR (fix or record an owner decision before promotion), MINOR (fix or decide, not promotion-stopping), NIT.

| Id | Sev | File:line | Evidence | Spec / decision | Proposed fix |
| --- | --- | --- | --- | --- | --- |
| V4-01 | MINOR (test strength, PAT-031 class) | `supabase/tests/phase_02_slice_12_governed_recheck/002-lapse-helpers.sqlinc:20-54`, `025-lapse-fixture.sqlinc:1-28`; uses `030:72-115`, `040:26-36`, `070:85-125`, `phase_02_slice_12_governed_activation/060:31-58`, `095:206-221`, `governed_decision/050:27-61`, `governed_schedule/055:15-51`, `dec191/040:87-95` | The guard is the only source of `false` for four recount paths (recheck verdict, decision, activation, fire time); no governed test lets the UNMODIFIED reader read a lapsed row, and the lazy discovery with the unmodified reader is proven nowhere. The reader's lapsed-row behaviour is proven only in S09 (`phase_02_slice_09_evidence_grants.sql:73-74`, `phase_02_slice_09_dec119_grant_lifecycle.sql:134-135`; editorial analogue `phase_02_slice_11_helpers_preflight.sql:833-836`). I found no assertion that needs stand-in-only behaviour (answer 1), so no defect is hidden today. | BE03c "Reviewer-authority invalidation on revocation" (defense in depth); BE03b "Qualifying approvers" (lapse of `valid_through` unwinds an approval); PAT-031 | Answer 1, alternatives (1) direct-write premise plus recount-function witness (no disabled trigger), (2) one `s09g_warp` witness per recount path (root must allow the S09 disabled-trigger mechanism), (3) a comment citing the premise tests in `002` |
| V4-02 | MINOR (decision) | promoted `supabase/migrations/20261013300400_cms_governed_frozen_status.sql:219-224` (called by `030000:39`); `030100:145-148`; `070-isolation.sqlinc:127-140` | `cms_governed_frozen_status` swallows any error of `cms_governed_current_digest`, whose block `FOR SHARE` waits (`20261013300400:76-131`; template digest `20260927240000_cms_template_digest_supported_lifecycle.sql:41`) are the likeliest place for `40P01`/`55P03`, and returns `changed`: the verdict becomes `dependency_changed` and a healthy review is invalidated (subject to draft, schedule cancelled, audit) instead of the run raising the retryable `CONFLICT`. Test `070:127-140` injects the SQLSTATE at the verdict entry, where the code is right, so the production path is untested. Activation and decision share the function. Fail-closed direction; needs a real deadlock (no role-level `lock_timeout` in any migration). | BE03c Invalidation (DEC-218 sentence "a lock timeout or deadlock remains the retryable conflict"); BE03b "Write-path lock order" rule 3 ("a lock failure there is `CONFLICT`, never 'not approved'") and rule 6 | (a) forward migration in this step reproducing the single live definition with `exception when deadlock_detected or lock_not_available then raise; when others then return 'changed';` at the digest block, plus a labelled fault on `cms_governed_current_digest` raising `40P01` in `070` that expects `P0001:CONFLICT` and an untouched review; or (b) narrow the BE03c sentence and DEC-218 to the locks the run and the invalidation take, and record the limitation |
| V4-03 | MINOR | `030100:27-34` (header), `:124-161`; `070-isolation.sqlinc:142-148`; BE03c lock row unchanged; no race module | R3-20 fixed per review (subject at `:134`, verdict `:135`), but (i) the proof is a text-position test of one function; (ii) a multi-review run keeps the block share locks of earlier verdicts while it asks for the next subject, leaving a three-party cycle (run, activation, CMS-03A-08 `FOR UPDATE`) that PostgreSQL breaks with `40P01` (a sibling cycle with two overlapping runs can pick a run waiting inside the digest as the victim, where V4-02 turns it into an invalidation); the header's "No earlier position follows a later one" holds per review, not across a run; (iii) BE03c requires concurrent-pair proofs and none exists for the recheck or the person invalidation (models: `phase_02_slice_10_races/014-revocation-vs-activation.mjs`, `phase_02_slice_11_races/031-dependency-recheck-race.mjs`, `011-review-decision-race.mjs` B6). | BE03c "Slice 12 lock order"; "Authorization, persistence, and concurrency tests" (revocation versus activation; template activation versus block withdrawal); BE03b rule 5 | Pre-lock the subjects of the page in ascending order (each in its own sub-block), then verdicts, then invalidations; reword the header and the BE03c row; root runs a race module with R-1..R-4 (answer 3) after promotion |
| V4-04 | MINOR (policy, PAT-031) | all eight functions; `supabase/tests/phase_02_slice_12_governed_recheck/*`, the four corrected drivers | No test clears `app.cms_rpc`, calls an entry point as its real caller role, asserts real rows and asserts the value afterwards (answer 5 table). By inspection every entry point sets or delegates and restores (`030100:65, 184, 194`, `030200:51, 79, 96, 103, 117, 124`, `030300:50, 54`), so no defect; the resolver relies on the promoted `cms_dependency_recheck_event_ref` (`20261010164100:116`) to set the flag. | PAT-031; model `supabase/tests/phase_02_slice_12_fix_template_reads_rpc_context.sql` | New include `090-rpc-context.sqlinc`: per outermost entry point `select set_config('app.cms_rpc','',true)`, call (service_role wrappers under `set local role service_role`; person invalidation as test-admin on a person with a lagging approval; both triggers by a tenure UPDATE and a grant UPDATE of a person with a live approval), assert a non-zero effect and `current_setting('app.cms_rpc', true) = ''`; a negative control (temp definer function leaving the flag `'true'`) proves the probe sees a leak; optionally a real-PostgREST composition spec for the two RPCs like `tests/postgrest/phase-02-slice-11-recheck.apispec.ts` (first-lane Request 5), the one place a cleared-flag or ACL defect would show over the real API |
| V4-05 | MINOR | `030200:52-77`; `20261014070000_cms_governed_activation_helpers.sql:166-172` (state check only); `20261013300600_cms_governed_review_guards.sql:107-111` (guard); contrast `030000:36` | The candidate query is a snapshot before any lock. If an activation of the candidate's subject commits while the revoker waits for the subject lock, the helper re-reads the review under the lock (state still `approved`, `activated_at` set), updates it to `invalidated`, the guard raises `P0001 CONFLICT`, the person function re-raises (`sqlerrm <> 'review_not_open'`, `:74-76`) and the revoking transaction fails on a review it does not concern; the retry succeeds. The recheck verdict handles the same race (re-reads `activated_at` under the lock). Untested. Why it exists here and not for schema activation: the S10 activation locks every tenure and grant row of the owner organization `FOR UPDATE` first, so a revoker waits and "finds nothing left to invalidate" (`phase_02_slice_10_races/014-revocation-vs-activation.mjs` R1); the governed activation locks only the activator's grant rows `FOR SHARE` (BE03c lock row), so the counted approver's grant row is not fenced and the loser is the revoker. | BE03b rule 4 ("if the activation commits first, the revocation waits and then commits"); BE03c concurrency tests ("one committed command and one typed 409 or 403") permits the 409 | Take the subject first in the person function, re-read the review and skip it when it is no longer live or `activated_at` is set, then call the helper; or keep the typed 409 and assert it in race R-3 |
| V4-06 | MINOR (test gap) | `apps/worker/src/cms-composition/governed-recheck/contract.test.ts:74-91`, `job.test.ts:71-77`, `rpc.test.ts`, `production.test.ts:72`; `job.ts:126-127` | Every positive Worker test feeds `unavailable: 0`; the strict result schema (`contract.ts:84-101`), the attribute and metric forwarding (`job.ts:102, 112`) and the rule `invalidated + unavailable <= examined` are untested on the positive side. A run in which all 500 reviews failed (privilege or RLS fault, isolated by `when others`) is acked with an `info`/`success` event. | DEC-218 ("the unavailable count is in the run result") | Contract test accepting `{ examined: 3, invalidated: 1, dependencyChanged: 1, reviewerAuthorityChanged: 0, unavailable: 2 }` and the boundary `invalidated + unavailable = examined`; job test asserting attribute and `cms.governed_recheck.unavailable.total` = 2; consider `telemetry.warn` when `unavailable > 0` |
| V4-07 | MINOR (test gap) | `020-contract.sqlinc:14-16` (kinds accepted with random ids), `060-resolver.sqlinc` (no `cms.pattern.activated.v1`), no `kind = 'pattern'` run in any suite; `005-helpers.sqlinc:11` (random `eventId` in every run); `030100:35, 98-101` | AC-202 names three producer events and AC-203 four kinds. The `pattern` lineage mapping (`030100:102-106` -> `cms_dependency_recheck_lineage('pattern', ref)`) and the resolver mapping `pattern -> pattern` (`030300:28-32`) have no fixture; the missing case is a pattern version that froze a nested pattern (`20261013300400:60-75`) rechecked after the nested pattern's successor activates. `canonical_domain` has no producer event, so only the contract is testable. Also never exercised: the header promise that the audit records carry the source event's correlation id (`030100:35`): `s12gr_run` always sends `gen_random_uuid()` as `eventId`, so the outbox lookup (`:98-101`) finds no row and only the fresh-uuid fallback is covered; no test reads `audit_events.correlation_id`. | BE03c Invalidation; AC-202, AC-203 | One scenario in 040/060: pattern P2 nests P1 and is approved; activate P1's successor; resolve the real `cms.pattern.activated.v1`; run `kind = 'pattern'`; expect `dependency_changed`. In 040-C pass the real `cms.schema.activated.v1` event id and assert `audit_events.correlation_id = outbox_events.correlation_id` for the invalidations |
| V4-08 | NIT | `020-contract.sqlinc:58-66, 79-84` | Owner, `prosecdef` and `search_path` are asserted for four of the seven functions; `cms_governed_authority_trigger` and `cms_governed_tenure_authority_trigger` (and their no-execute ACL) are asserted nowhere (`030:6-13` and `080:35-43` assert the triggers, not the functions). By inspection correct (`030200:87-91, 108-112, 148-155`). | `security-first` rule; repo convention | Add both functions to the metadata and ACL assertions |
| V4-09 | NIT | `080-tenure.sqlinc:64-78` | The first conjunct `not holds(otherOrg, x11, 'cms.reviewer')` is vacuous: pool grants exist in the owner party only (`phase_02_slice_12_governed_assignment/000-world.sqlinc:276`), so it is true before the tenure ends; nothing asserts the UPDATE matched a row. R3-11(b) asked for "the same person holding the capability in two organizations". | R3-11 | Assert the other-organization tenure row is `ended`; grant x11 the capability there if the two-organization case is meant |
| V4-10 | NIT | `030000:14`, `030100:21, 27, 34, 133`, `030200:17` | Immutable headers cite handoff review ids (`R3-07`, `R3-08`, `R3-12`, `R3-20`) that no developer can resolve; DEC-218 and DEC-207 are cited nowhere in the four files. | `extensibility` rule; R3-14 intent | Replace by `DEC-218`, `DEC-207` and section names before promotion |
| V4-11 | NIT | `apps/worker/src/cms-composition/governed-recheck/README.md:21-24` | Says the governed producer rereads through the Slice 11 `cms_dependency_recheck_resolve_event`; the code calls `cms_governed_recheck_resolve_event` (`rpc-names.ts:9`). The file list says "the protected `platform_api` RPC name" (two exist); no word on DEC-218 or `unavailable`. | `extensibility` rule | Fix the sentence, name both RPCs, add the isolation note |
| V4-12 | NIT (root housekeeping) | `supabase/migrations-wip/governed-recheck-red/`, `fix-recheck/`; `phase_02_slice_09_r8_api_surface.sql`; `packages/data-access/src/database.types.ts`; BE03c | (a) duplicate timestamps with the RED copy (C1). (b) R3-09 still open: neither name in the inventory (final-run #4/#13/#14) nor in `database.types.ts` (grep: none). (c) R3-10 still open and BE03c says `cms_recheck_governed_reviews(kind, ref_id, batch)` (also AC-203) while the implementation is `cms_recheck_governed_reviews(p_request jsonb)` `{ eventId, kind, refId, cursor[, batch] }`; `cms_governed_recheck_resolve_event` and the private `cms_governed_recheck_event_ref` are unnamed; the request and result members (`eventId`, `cursor`, optional `batch`; `examined`, `invalidated`, `dependencyChanged`, `reviewerAuthorityChanged`, `unavailable`, `nextCursor`) are lane decisions BE03c never states (harmless: the per-reason metric `cms_governed_review_invalidated_total{reason}` needs the split), so the spec should. (d) The BE03c lock row omits that the run locks the subject of every examined review and the block share locks. (e) R3-07 has a spec edit and a changelog row but no raw DEC record (DEC-218 is isolation only). (f) The fix lane's final run did not include the suites outside Slice 12 that update `membership_tenure` or `organization_actor_grant` against the new tenure trigger (`phase_02_slice_10_activation_lock_order`, `phase_02_slice_10_presence_lease`, `phase_02_slice_11_helpers_invalidation`, `phase_02_slice_09_r3_grants_misc`, `phase_02_slice_09_dec119_future_membership`); by inspection they are unaffected (they pin triggers by name, no governed review exists in their fixtures, the new trigger functions write nothing without candidates), but root's joint run must include them. (g) The fix-lane report says it made no Worker edit, yet its "after" table gives a new hash for `production-async-entrypoint-review-recheck.test.ts` (`8d84e163...`, edited by another lane; content verified). | R3-09, R3-10; BE03c "Permission, RLS, and grants" | Root, in the promotion step |
| V4-13 | NIT | `030100:132-159` | Up to 500 sub-transactions per run, each assigned an xid by its subject row lock; beyond 64 subxids the backend's cache overflows (known snapshot cost for concurrent readers). Bounded by the 500 cap; the earlier run had the same per-review block. | - | Note beside the 500 bound; lower the default batch only if `pg_subtrans` contention shows |

## Lock and flag matrix (cited code)

| Function | Locks, in order | Flag |
| --- | --- | --- |
| `cms_recheck_governed_reviews` per examined live review | subject row `FOR UPDATE` (`:134`, position 3) -> verdict reads (`cms_governed_frozen_status`: plain reads; digest: block rows `FOR SHARE`, after the subject) -> only if the review no longer holds: review row `FOR UPDATE` (position 5) -> its pending/failed_retryable schedules `FOR UPDATE` (`20261014070000:166-172, 181-185`) | sets `'true'`; wrapper restores |
| `cms_invalidate_governed_reviews_for_person` per candidate (ascending review id) | the revoking command's own row lock (position 1) -> subject `FOR UPDATE` -> review `FOR UPDATE` -> schedules, all through the same helper | sets and restores |
| both triggers | none of their own (AFTER ROW on the row just updated or deleted) | set and restore |
| verdict, resolver | none (the digest's block shares run inside the caller's subject lock) | verdict sets; resolver wrapper restores |

## Test-correction verdicts

Fixture rule applied: no direct active-row insert that skips authority, no disabled trigger, labelled forgeries only where no producer exists. The lag fixture writes nothing and disables nothing; its labelled-fault mechanism is the one `070` and `governed_activation/000-world.sqlinc:s12gb_fault_on` already use.

| Change | Verdict | Reason |
| --- | --- | --- |
| `governed_activation/060-invalidation` (gr7): real revoke -> lapse + control + restore | **ACCEPT** (V4-01) | Required: BE03c G6 / AC-204 make the real revoke invalidate in its own transaction, so the stored `approved` state the activation recount must catch can only lag for a calendar lapse. `diff` against the pre-lane original: only the swap, one control (stored state unchanged and recount 0), one restore, comments; every downstream assertion identical. |
| `governed_activation/095-retire` (gq2) | **ACCEPT** | Same; the retire of gq1 under the same lapse still proves retirement needs no live approval. |
| `governed_decision/050-invalidation-gates` + `plan(57)->(58)` | **ACCEPT** | R7 uses the lapse; the original R8 real-revoke control is kept after a restore, so R8 still proves the grant; net +1 control matches the plan; 58/58 in the final run. |
| `governed_schedule/055-fire-approval` | **ACCEPT** | Fire-time recount (CMS-03C-19 / BE03c Scheduled activation): lapse after scheduling, real-clock wait kept, lapse writes nothing. |
| `dec191/040-detail` + `010-setup` comment | **ACCEPT** | One lapse, one control, one restore. |
| four drivers: `\ir 002-lapse-helpers.sqlinc` | **ACCEPT** | Included after the governed-assignment world and before first use; plans unchanged except decision. |
| `apps/worker/src/production-async-entrypoint-review-recheck.test.ts` | **ACCEPT** | R3 accepted it; since edited by another lane: the governed resolver call and both `send` expectations (governed and editorial message) are present, 4 sends; 2 tests green. |
| new suite `governed_recheck` 002-080 | **ACCEPT** with V4-01, 04, 07, 08, 09 | RED was run first against the original migrations (44 not ok, classified harness vs feature in the fix-lane report), then GREEN 116/116; the 080 tenure writes are labelled identity forgeries (no command ends an ungoverned tenure; precedent `s09g_member`). |

## Finding resolution (R3 ids from `review-r3-report.md`)

| R3 id | Original | Resolution | Evidence |
| --- | --- | --- | --- |
| R3-07 | tenure end not wired | **Resolved** | trigger fn `030200:108-127`, trigger `:138-140`; tests `080:35-43, 94-136`; BE03c "Reviewer-authority invalidation on revocation" and changelog row; no DEC raw record (V4-12e) |
| R3-08 | one poisoned review aborts the run and pins the cursor | **Resolved** (DEC-218 option A) | `030100:132-159`; tests `070:81-125`; caveat V4-02 (digest-internal locks), V4-06 (Worker) |
| R3-11 | four test gaps | **Resolved** (4/4) | renewal `080:47-62`; other-organization tenure `:64-78` (control vacuous, V4-09); DELETE branch `:129-136`; base revoked under a specialist decision `:87-92` |
| R3-12 | subject/review interleave across a run | **Partially resolved**: recorded in the header (`030100:32-34`), BE03c row not reworded | residual cycle in V4-03 |
| R3-13 | `drop trigger if exists` on a hot table | **Resolved** | `030200:134-140` has plain `create trigger` for both triggers; the RED diff shows the removal |
| R3-14 | stale line numbers, no README | **Resolved** for migrations, tests and Worker code (grep: no numeric BE03c citation), READMEs present | residual NITs V4-10, V4-11 |
| R3-20 | verdict before the subject lock | **Partially resolved**: subject-first per review (`030100:134-135`), header corrected; proof textual, multi-review residual, no race | V4-03 |

Resolution counts: resolved 5, partially resolved 2, open 0.

## Promotion verdict

**`governed-recheck` (with `fix-recheck`): PROMOTE.** Security (definer, empty `search_path`, owner, ACL, RLS, no dynamic SQL, no payload content), spec correctness (BE03c Invalidation, G6, Job transport, lock rows; DEC-207, DEC-218; the two outcomes to decide are V4-02 and V4-05), promotability (new objects only, forward-only, no data statement, <= 300 lines, timestamps unique once C1 is done) and lock order per review hold. Take C1 and C2 now, decide V4-02 and V4-05, keep C4 in the same step, and queue the tests and race pairs above.

## Requests to root and open questions

1. [root] C1: delete `governed-recheck-red/` and `fix-recheck/` before any directory-wide stage or promote.
2. [root/owner] V4-02: forward fix of `cms_governed_frozen_status` (re-raise lock failures) or a narrowed DEC-218/BE03c sentence?
3. [root] V4-05: skip an activated review in the person invalidation, or keep the typed 409 and test it?
4. [root, lane rule] May the end-to-end real-reader witness use the S09 `s09g_warp` (user triggers of two tables disabled inside one sub-transaction)?
5. [root] Record R3-07 (tenure trigger) as a DEC; do R3-09 and R3-10; run the governed authority race and the new R-1..R-4 pairs after promotion.
6. [lane] Add the tests of V4-01, V4-04, V4-06, V4-07, V4-08, V4-09.
