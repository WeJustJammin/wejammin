# Lane `claude_s12_fix_recheck` (F4b) report

## Status

GREEN (2026-10-22 ~21:45 EDT / 01:45Z). HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`. R3-07, R3-20, R3-08 (BOUNDARY 1), R3-11, R3-13, R3-14 done, R3-12 recorded. Final run 12
(stamp `210911-3790157`, stage `pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,block-rules,fix-dec193,fix-recheck`): 81 files / 18,376 tests;
every `phase_02_slice_12*.sql` passes (governed_recheck 116/116, governed_activation 124/124, governed_decision 58/58, governed_schedule 56/56, dec191 53/53) EXCEPT `locale_observability`
(aborted at test 6, observability lane, not mine); the only `not ok` are 4 root-owned inventory assertions (`phase_02_slice_09_r8_api_surface` #4/#13/#14, which name my two RPCs, and
`sec2_all_schema_definer_rls` #6, dec194's `taxonomy_merge_recoveries`). Worker Vitest (review-recheck entrypoint test + governed-recheck module): 8 files / 82 tests green, no Worker edit by this lane.

## Scope

Pre-promotion fixes of the `governed-recheck` WIP (edited in place) from `review-r3-report.md`: R3-07 (membership tenure end wired like BE03b),
R3-20 (lock order: subject before the digest's block locks), R3-08 (per-review failure isolation), R3-11 (test gaps), R3-13 (no
`drop trigger if exists`), R3-14 (section names in comments, README), R3-12 (NIT, recorded). R3-09 and R3-10 are root files (requests below).

## Plan (as executed)

1. R3-07: second AFTER UPDATE|DELETE trigger `cms_membership_tenure_governed_authority` on `identity_private.membership_tenure` passing `(old.person_id, null)` (and
   `new.person_id` when the person changes), exactly the 03b shape (`20261005017580`). The five suites (plus governed-recheck 030/040) that used a tenure end as their "lag" now
   use a genuine lag that no trigger covers: a standing grant whose term passes by the calendar, reproduced by the LAG fixture (see Design decisions 1).
2. R3-20: per review, lock the subject FOR UPDATE (position 3) first via `cms_governed_subject_resolve(kind, id, true)`, THEN compute the verdict (its block digest takes FOR SHARE on
   the blocks, same position 3), then the review row (position 5) inside the invalidation. Header corrected.
3. R3-08: errors other than deadlock/lock failures are isolated per review inside a sub-transaction (counted `unavailable`, review left live, WARNING with review id + SQLSTATE).
4. R3-11 (4 test gaps), R3-13 (no `drop trigger if exists`), R3-14 (section names, README, comments), R3-12 (recorded in the header).

## Design decisions

1. Lag fixture. The first design moved the session TimeZone one day (UTC-24): it broke every timestamptz read back from text (SQLSTATE 22009 "time zone displacement out of range")
   inside the invalidation and every governed command. A shift below 16 h reaches the next day only from 08:02 UTC, and the opposite shift (yesterday) makes every test grant (valid_from =
   today) read as not started, not only the lapsed one (run 9 proved it). Final design: the test-admin puts a guard in front of the body of `platform_private.cms_person_holds_capability`
   (the single reader every recount uses), so a named `(organization, person, capability)` reads as ended, and restores the function byte for byte (source md5, owner
   `wejammin_cms_authority_reader`, ACL verified). It is the labelled-fault mechanism 070 already uses; no row is written, no trigger runs or is disabled, deterministic at every hour.
2. The tenure trigger passes `(person, NULL)`: a tenure end carries no capability, so every review in which the person no longer counts is invalidated. The function re-evaluates every
   review owner, so a tenure that ends in another organization invalidates nothing in this one (tested).
3. R3-08 per-review isolation counts a failing review as `unavailable` (the existing member) and leaves it live: it is fail-closed because decision and activation recount the same approvals
   (BE03c "As defense in depth ..."), and the cursor advances. See BOUNDARY 1.
4. R3-20 is tested structurally (the subject resolve precedes the verdict call in the function source) plus behaviourally by the 070 faults. A real lock-order proof needs two sessions: that is a
   race module and is root's (Requests 4).

## Files before (SHA-256)

| path | before |
| --- | --- |
| `supabase/migrations-wip/governed-recheck/20261022030000_cms_governed_recheck_verdict.sql` | `abc979f2cad6248f328d2b34ac47a43eb68baa23b4dfc22fc7dce55cd668db61` |
| `supabase/migrations-wip/governed-recheck/20261022030100_cms_recheck_governed_reviews.sql` | `3584619ea700e122935c978385c552880d731f8d9f17c7ac9210c4938d4ed682` |
| `supabase/migrations-wip/governed-recheck/20261022030200_cms_invalidate_governed_reviews_for_person.sql` | `7236f20e86f15199e23291c2ea1418d9c1555f3759e52c2d319e015fcd7ac409` |
| `supabase/migrations-wip/governed-recheck/20261022030300_cms_governed_recheck_resolve_event.sql` | `8731b987388c0ee14b52d7a7760b33af42fb1c035c00211a23eb89dd0ab3c8e9` |
| `supabase/tests/phase_02_slice_12_governed_recheck.sql` | `a736b45472c89fb7e4b65b3f06e1b8684448afd0297b533cf70b9c4b7490b4f1` |
| `supabase/tests/phase_02_slice_12_governed_recheck/030-person.sqlinc` | `6333b60516118ed2dddc2a5cfd0d705d17881dedd4c8693c75478c7e95888983` |
| `supabase/tests/phase_02_slice_12_governed_recheck/040-recheck.sqlinc` | `caae0f37533113af4df78dbaca505d89d3b5130a87110abd07eec02f462c816c` |
| `supabase/tests/phase_02_slice_12_governed_recheck/010-setup.sqlinc` | `bf018bf5d5315b0c804139f58ff025f656a87c83f46409634a84c9338a97e97d` |
| `supabase/tests/phase_02_slice_12_governed_recheck/README.md` | `2332bd07e887cfb6305af40fb0170f74f57fbad7d688655f7033b74b48a75fd1` |
| `supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc` | `16ce585ea82b6b74feb2c5d5374bfe1d7b42ed4397706e8fa4912dc0b1779927` |
| `supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc` | `f4a111630bee6a3ae45516a3110d0f93c38e66cc2e6e4e003a4a6378ba81d33c` |
| `supabase/tests/phase_02_slice_12_governed_decision/050-invalidation-gates.sqlinc` | `31af9dd1ecb384d04648ae5252aa2f2ab214958a49283ed822770b094335705b` |
| `supabase/tests/phase_02_slice_12_governed_schedule/055-fire-approval.sqlinc` | `1303d01c7a34387665d51b8e11e69a150ca525b304c064e90a48e903539a8b37` |
| `supabase/tests/phase_02_slice_12_dec191/040-detail.sqlinc` | `f15940c3e10f380650de4656d9fbc6b3ab3d541eaaac216f4dbac262e929b39c` |
| `supabase/tests/phase_02_slice_12_governed_activation.sql` | `403d76d22d338d3902fa576a01ce619d07f5fc1d566219368ab5e3baa791e4a9` |
| `supabase/tests/phase_02_slice_12_governed_decision.sql` | `ad6165ae850003ff22601bb5a695e02b4f99bf8fcb9d713d83f87e499719b047` |
| `supabase/tests/phase_02_slice_12_governed_schedule.sql` | `82d8a297a8d4194fdeda742af8fccb1366f656484c1a8d88abebd49c7a152f12` |
| `supabase/tests/phase_02_slice_12_dec191.sql` | `986e7c34bb132dbc50864534c94c8769dee49522c068ba2367460615c12f2b7c` |
| `apps/worker/src/production-async-entrypoint-review-recheck.test.ts` | `04556a5eae3198f815e859fb25e8a226ab0952bd3c4dd02321d926e8b9ed218c` |

## Files after (path | lines | SHA-256)

Before-hashes are in the table above (the same paths). New files: `supabase/tests/phase_02_slice_12_governed_recheck/002-lapse-helpers.sqlinc`,
`025-lapse-fixture.sqlinc`, `070-isolation.sqlinc`, `080-tenure.sqlinc`, `supabase/migrations-wip/governed-recheck/README.md`, `supabase/migrations-wip/fix-recheck/README.md`.
Unchanged: `005-helpers.sqlinc`, `050-block.sqlinc`, `060-resolver.sqlinc`, `20261022030300_...sql`. `supabase/tests/phase_02_slice_12_dec191/010-setup.sqlinc`
now `b3ed2abb4d53657bcea920ba4b6d2f59284a154fdff326a492c01ee1e42e1c46` (one-word comment).

| path | lines | SHA-256 |
| --- | --- | --- |
| `supabase/migrations-wip/governed-recheck/20261022030000_cms_governed_recheck_verdict.sql` | 69 | `0fad12738d3d79c675628d81ac2a8114ae3082b82554c2a89dcbeffa2e3703e2` |
| `supabase/migrations-wip/governed-recheck/20261022030100_cms_recheck_governed_reviews.sql` | 219 | `4057f46d4395159a061dca0f8215f3b46dde0d4ca17359654240f5c6259dafcc` |
| `supabase/migrations-wip/governed-recheck/20261022030200_cms_invalidate_governed_reviews_for_person.sql` | 157 | `fa59297541a6c43ae9868cddbac9aa159beeda998d7afd577714d02cf9e01fcb` |
| `supabase/migrations-wip/governed-recheck/20261022030300_cms_governed_recheck_resolve_event.sql` | 73 | `8731b987388c0ee14b52d7a7760b33af42fb1c035c00211a23eb89dd0ab3c8e9` |
| `supabase/migrations-wip/governed-recheck/README.md` | 18 | `7f87728d1b7da65075573b2a7a556fcc21cc5a949e58e4907271efbc0990fcce` |
| `supabase/migrations-wip/fix-recheck/README.md` | 4 | `da617250361a0ec575ce8c531e8fe2ee5a2658761b505556feda2bd6166c117c` |
| `supabase/tests/phase_02_slice_12_governed_recheck.sql` | 52 | `cd88328b9455ddffcdc6aeaa909532ea89679e91f038fb14c6111b884fb8d1d7` |
| `supabase/tests/phase_02_slice_12_governed_recheck/002-lapse-helpers.sqlinc` | 75 | `f62edc832ab046c5110e40c705c38e78ed305dd4d63e7da5c90177d36ea0b5cb` |
| `supabase/tests/phase_02_slice_12_governed_recheck/005-helpers.sqlinc` | 86 | `a354df986cf386a461622e4287edc40179161a591ba65207bc6aab7b0346caec` |
| `supabase/tests/phase_02_slice_12_governed_recheck/010-setup.sqlinc` | 96 | `c263bcf2e88f9cb1e6c3689f0f6dcf5e0dd21c1baac94640a4a91ad466bb9a01` |
| `supabase/tests/phase_02_slice_12_governed_recheck/020-contract.sqlinc` | 84 | `2d296a5da3b98128e8f310895b0baa4ed1c0fbdce68467d4b7c23f77ab8084f9` |
| `supabase/tests/phase_02_slice_12_governed_recheck/025-lapse-fixture.sqlinc` | 28 | `ab31e853ed964dd2a3ddbf2422ebc30a0fad080732205a7501138e911dec94e0` |
| `supabase/tests/phase_02_slice_12_governed_recheck/030-person.sqlinc` | 138 | `c5709816e442e439cc9072068a3e10af40575d4aae72c8deecc7c25e15bef473` |
| `supabase/tests/phase_02_slice_12_governed_recheck/040-recheck.sqlinc` | 111 | `4c49530ec00581114ef7d1092a25d4bc87259e37dcb0ae5828b6b069066503b4` |
| `supabase/tests/phase_02_slice_12_governed_recheck/050-block.sqlinc` | 42 | `16ec16849967a9ad56fde4da3cf7a28f4c0d1a1eaf1f4d7e2ecefdac237dfddf` |
| `supabase/tests/phase_02_slice_12_governed_recheck/060-resolver.sqlinc` | 32 | `a8132331a477271327e173f4010627a26754dc1272a60f9c893d840f1a720ea8` |
| `supabase/tests/phase_02_slice_12_governed_recheck/070-isolation.sqlinc` | 148 | `3c4a5e99a2a2e836755f4542ba0c02f37c75d4ffc40743e4d7e23c19162d1fa9` |
| `supabase/tests/phase_02_slice_12_governed_recheck/080-tenure.sqlinc` | 136 | `d6d232540c766939147fa694d18da8ffaebae02db09d66630594d6e3bb7a521f` |
| `supabase/tests/phase_02_slice_12_governed_recheck/README.md` | 28 | `05982a6c77dd43754186d1f0d8326f1e298afa9b52e41706005ba78dfc5e6604` |
| `supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc` | 122 | `0aac19a8474ba77659a5845230e652b8cf67cf039d2bdac8c2edc79c8ab07c8b` |
| `supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc` | 265 | `6fed2e64b535c1cbe5ff303de89a86cd774f71f5dc08c724dd7a527571c09d78` |
| `supabase/tests/phase_02_slice_12_governed_decision/050-invalidation-gates.sqlinc` | 127 | `1a6968cfb5d0b57a3ffa8b96c97a894a7b6773870bca85ea468a39788b522b1b` |
| `supabase/tests/phase_02_slice_12_governed_schedule/055-fire-approval.sqlinc` | 51 | `e167f57bef6abb4479717b6408b00269ee949f649bad72dae965f43c5b86659f` |
| `supabase/tests/phase_02_slice_12_dec191/040-detail.sqlinc` | 138 | `f30c00e2f3fa84ebf0586048c268ba3a3254cd6ff6816ad40d444a93e0ed1b87` |
| `supabase/tests/phase_02_slice_12_governed_activation.sql` | 45 | `7e8147e4317b98a8bd87983ff4fcdc88dddde6f79103f7e79ec7d85f4eceab37` |
| `supabase/tests/phase_02_slice_12_governed_decision.sql` | 37 | `59d8f1b1906f076a2fdc435b9d1ffbcd6ebecba661546596d7f1c0ddae96e53a` |
| `supabase/tests/phase_02_slice_12_governed_schedule.sql` | 42 | `ad09860c858a06379b91392b7b7d56497d0e2661474301da110297f813f62008` |
| `supabase/tests/phase_02_slice_12_dec191.sql` | 41 | `d007d040adcc5bb241968eb38325e34b09e4afa65eaa441f566ba5bb2de817b7` |
| `apps/worker/src/production-async-entrypoint-review-recheck.test.ts` | 124 | `8d84e16382653b462cede1fa031ba834aa5685e332a3c7f6e267cd9a310252ae` |

## Runs

- PROBE 2026-10-22 15:50 (lane `none`, stamp `155004-2377932`, 12/12 ok): `SET LOCAL TimeZone 'UTC-24'` is accepted and moves `current_date` (also inside a STABLE SQL function)
  exactly one day with no per-transaction caching, so a grant whose `valid_through` is today lapses without any write. TAP SHA-256 `16af15629ba898ecb79002ceb03dc5994f6a2638bd672b30e02b5d877900005f`.
  (First attempt 154750 was a harness error: `like()` does not exist for text,unknown.) The probe file was deleted; the helper re-checks the shift on every use.
- RED/harness 1: 2026-10-22 15:56 EDT (stamp `155632-2415022`; stage `...dec206,governed-recheck-red,fix-recheck`, manifest promoted=461 wip=76): the new tests
  against the ORIGINAL migrations. `governed-recheck-red` is a temporary WIP directory (still present) holding the four ORIGINAL governed-recheck migrations
  (SHA-256 identical to the before-table: `abc979f2...`, `3584619e...`, `7236f20e...`, `8731b987...`), staged instead of `governed-recheck` so the new tests meet the
  pre-fix code. 5 files / 403 tests: 359 ok, 44 not ok (governed_recheck 32/112, governed_activation 6/124, governed_decision 3/58, governed_schedule 2/56, dec191
  1/53). First failing test: governed_recheck #40 (control: the stored approved state of pc1 lags the loss of its counted approver). TAP SHA-256
  `b66f22723516c657b77e321d729b1062c6b9ae48b61e94de93decf561162f5b3`.
- RED/harness 2: 16:01 (`160155-2447876`): governed_decision alone, same stage: 58 tests, 55 ok, 3 not ok (#46-#48). TAP `b123321560880d50277b7581d334d2f610d7f16a15c6540905b9fb562792e8b8`.
- RED/harness 3: 16:06 (`160646-2477683`): governed_decision alone, same stage: 55 ok, 3 not ok (#46-#48), identical to run 2. TAP `7300391d2dedb315388fc15b363f0b38280ebc18994e85d917d65735ceefa7bf`.
- RED/harness 4: 16:09 (`160919-2493385`): the same 5 files as run 1: 359 ok, 44 not ok, identical failing numbers. TAP `b6b15b2333b87f6e1ce7e798a1c7146dfdf41cf85ca9b5fbef27df88bcfa7d6b`.
- Clock probe (`155004-2377932`, lane `none`, 12/12) is the PROBE above; `154750-2363349` was its harness-error predecessor.
- Classification of runs 1-4. Genuine expected RED against the original code: governed_recheck #85-#95 (isolation, 070), #99 (subject locked before verdict),
  #101, #107-#112 (tenure trigger, 080). HARNESS defect of the clock fixture (not RED: it is independent of the migrations): every control or command that runs
  while the session clock is shifted: governed_recheck #40, #42-#45, #47 (030) and their cascade #53-#69 (040, counts shifted by the un-invalidated pc1);
  governed_activation #65-#68, #111-#112; governed_decision #46-#48; governed_schedule #51-#52; dec191 #40. Runs 2-3 changed nothing on the failing numbers: the
  predecessor was iterating on the fixture when it was killed.

- Run 5 (diagnostic GREEN attempt): 2026-10-22 18:37 EDT (stamp `183749-3104975`; stage `pattern-updates,...,dec206,governed-recheck,fix-recheck`, wip=76, the
  edited `governed-recheck`). Same 5 files, temporary DIAG warnings (099-diag.sqlinc) and the UTC-rendered `decidedAt` in `s12gr_facts`. 403 tests, 18 not ok in
  governed_recheck (#43-45, 53, 56-57, 61, 63, 65-66, 68-69, 87-88, 90-91, 94-95), the other four files unchanged (6, 3, 2, 1). Every remaining failure traces to
  one DIAG line: SQLSTATE 22009 `time zone displacement out of range: "...+24:00"` raised inside the invalidation (and in every governed command) while the clock is
  shifted by `UTC-24`. ROOT CAUSE = harness (the displacement must be < 16 h), not a feature defect. The #40/#42/#47-type failures of the RED runs were the second
  harness defect (jsonb `decidedAt` serialized with the shifted zone), fixed by rendering it in UTC. All the former RED tests of the tenure trigger
  (#101, #107-#112), subject-first lock (#99) and part of the isolation tests (#85, #86, #89, #92, #93) passed on the edited migrations. TAP SHA-256
  `35fe5d94931d8abd7dbe6dda93f062bcda38f7dd02d96dd5cbcbcf7a990b945c`.
- Fix after run 5: `s12fr_lapse` now picks east (UTC time of day >= 08:02: `valid_through` = today, zone `UTC-hh:mm`, tomorrow) or west (before 08:02: no write,
  zone `UTC+hh:mm`, yesterday, the grant has not started) so the displacement never exceeds 15:59; the arithmetic is proven for every second of the UTC day in the new
  `025-clock.sqlinc`. The west branch cannot execute at the current wall-clock time (it runs only 00:00-08:02 UTC); its arithmetic and post-condition are asserted.

- Run 6 (HARNESS abort): 2026-10-22 19:13 EDT (stamp `191355-3267281`; stage as run 5 plus `block-rules` per root's note): all 5 files aborted at test 9 with
  exit 3: syntax error in my new `002-lapse-helpers.sqlinc` (`pg_catalog.extract(epoch from ...)` is not valid: `extract` cannot be schema-qualified). Not a feature
  result. TAP SHA-256 `7df7ff29a8881267ef74a06051493ed7447c3dc10c8a7aaa7b58e93a4581cee6`. Fixed with `pg_catalog.date_part('epoch', ...)`.

- Run 7 (HARNESS abort): 2026-10-22 19:44 EDT (stamp `194407-3402038`, same stage as run 6): all 5 files aborted at test 9: `syntax error at end of input` at
  `002-lapse-helpers.sqlinc:77`: a plpgsql `IF ... IS DISTINCT FROM CASE ... WHEN ... THEN ... END THEN` is cut at the first THEN. Not a feature result. Fixed with an
  assigned `v_expected`. (I had no way to syntax-check locally; both aborts cost a queue slot.)

- Run 8 (GREEN attempt with the hybrid clock): 2026-10-22 19:45 EDT (stamp `194516-3410579`; stage `pattern-updates,dec193,dec194,dec195,locale-gate,dec197,dec202,dec205,dec206,governed-recheck,block-rules,fix-dec193,fix-recheck`,
  wip=82) the 5 governed files + DIAG: 407 tests, 405 ok, 2 not ok, both in governed_activation: #65 (060 gr7 control: `s12gb_same` compares a `to_jsonb(...)::text` snapshot taken at
  the base zone with one read under the shifted zone) and #112 (095 `s12gb_ret_effect` compares `to_jsonb(s)` with the jsonb captured earlier). governed_recheck (incl.
  025-clock, 070, 080), governed_decision, governed_schedule and dec191 fully green. Harness defect (timestamptz rendered in the session zone), fixed by `set timezone = 'UTC'`
  on the two helper functions. TAP SHA-256 `700acf83336f41d6ca34324ab6a171ce6ebf342c5300786e1591b44b0152809c`.

- Run 9 (full: all 75 `phase_02_slice_12*.sql` + 5 root-owned Slice 09 catalog/inventory files = 80 files, 14,792 tests, 1,880 s; stamp `195130-3442572`, started 19:51 EDT = 23:51Z, executed
  after 00:00Z): 92 not ok in 8 files. The governed drivers failed AGAIN, differently from run 8: governed_recheck 20/116, governed_activation 5/124, governed_decision 3/58,
  governed_schedule 2/56, dec191 2/53. Cause = HARNESS: the clock fixture's WEST branch (UTC time of day < 08:02), which no earlier run could execute, shifts the date to
  yesterday for EVERY person (all test grants start today), not only the lapsed one (first symptom: governed_recheck #50 "a counted approver who still holds the capability
  invalidates nothing" returned 1). Not fixable without backdating every other grant; a clock shift also needs the 16 h displacement limit. DESIGN CHANGE: the lag fixture no
  longer moves any clock. The test-admin guards the single function every recount reads the authority through (`cms_person_holds_capability`) so a named grant reads
  as ended, exactly the labelled-fault mechanism of 070 (restored byte for byte, verified); deterministic at every hour. The `s12fr_ctx`/`SET timezone` workarounds were reverted.
  Other failures of this run, not mine: `locale_observability` 56/78 (observability lane, in progress), `phase_02_slice_09_r8_api_surface` 3/14 and `sec2_all_schema_definer_rls` 1/33
  (root inventory, Requests 2). TAP SHA-256 `9260662e6ab1506e9f4d04a27ed5db223ffb9792e062c5160476431fb605aaf3`.

- Run 10 (HARNESS abort): 20:27 EDT (stamp `202714-3726889`) (5 governed files, same stage): every lapse call aborted with `unexpected function metadata`: the fixture assumed the
  owner `wejammin_cms_definer`; `cms_person_holds_capability` is owned by `wejammin_cms_authority_reader` (20261003150200). Fixed (one literal). TAP SHA-256
  `c50119509e2fc689f9bc8275ca46f5dd9118c8b106ae397fa05d828afebea613`.

- Run 11 (GREEN, lag-fixture redesign): 2026-10-22 21:01 EDT (stamp `210139-3751041`, 5 governed files, final stage): 407 tests, all ok, `Result: PASS`; TAP SHA-256 `ef2bcd4e9ebfc64791246c553b7157c82fa0e7d29bef4eb6e3379eb8be6a1db8`.
- Run 12 (FINAL, same bytes as run 11): 21:09 EDT (stamp `210911-3790157`), all `phase_02_slice_12*.sql` (75) + `phase_02_slice_09_{evidence_trigger_catalog,r8_api_surface,sec2_all_schema_definer_rls,sec2_definer_rls,p240_authority}`:
  81 files, 18,376 tests, 4 not ok (all root-owned inventory, listed in Status), 1 aborted file (`locale_observability`, other lane). First failing test: `phase_02_slice_09_r8_api_surface` #4.
  TAP SHA-256 `ac4f75767304a200149ad5c6e5fd6d4784dd36b960134e0f7950c538853dcba9`.
- Worker: `vitest run apps/worker/src/production-async-entrypoint-review-recheck.test.ts apps/worker/src/cms-composition/governed-recheck`: 8 files / 82 tests passed (twice, before and after the DB work).
- The temporary DIAG include (`099-diag.sqlinc`) existed only for run 5 and was deleted; no DIAG text remains in the tests.
- Scratch files: `<scratchpad>/claude_s12_fix_recheck/` (launchers, run outputs).

## Test corrections (for independent review; the five suites are untracked, so no git baseline: exact before/after stated)

The predecessor lane (governed-recheck, report `lane-governed-recheck-report.md` Test corrections 2) replaced the "lag" fixture of five suites, a real CMS-03A-17 revoke, by a tenure end
(`update identity_private.membership_tenure set state = 'ended' ...`), a loss no trigger covered at the time. R3-07 adds that trigger, so the tenure end now invalidates in its own
transaction too and cannot be the lag. This lane replaces, in the SAME five places, that tenure UPDATE by `select pg_temp.s12fr_lapse(ownerOrg, <person>, <capability>)` (002-lapse-helpers):
the person's standing authority reads as ended with no write. Every downstream assertion is unchanged; the labelled `ended -> confirmed` tenure re-confirmation in `050` is replaced by
`select pg_temp.s12fr_restore()` before the original real CMS-03A-17 revoke control. No assertion was weakened, no trigger disabled, no governed row written.
- `phase_02_slice_12_governed_activation/060-invalidation.sqlinc` (rev2, review gr7): lapse instead of tenure end; control = snapshot unchanged and live recount 0.
- `phase_02_slice_12_governed_activation/095-retire.sqlinc` (designer2 `cms.reviewer.policy`, gq2): lapse; control = `cms_person_holds_capability` false and gq2 still approved; `restore` after the retire check.
- `phase_02_slice_12_governed_decision/050-invalidation-gates.sqlinc` (rev1, review r7): lapse; `restore` before the R8 real-revoke control; comments reworded.
- `phase_02_slice_12_governed_schedule/055-fire-approval.sqlinc` (rev2, review eb): lapse; header comment.
- `phase_02_slice_12_dec191/040-detail.sqlinc` (rev2, review db): lapse; comment. `010-setup.sqlinc` comment word.
- Drivers: only the header/comment of governed_recheck.sql (fixture list). `phase_02_slice_12_governed_decision.sql` plan(58) from the earlier lane is unchanged.
- `apps/worker/src/production-async-entrypoint-review-recheck.test.ts`: unchanged by this lane (the earlier lane's correction; Vitest below).
Reviewer note: the tenure END (080) and the DELETE branch are now covered as real invalidations; the original lag the five suites prove is still proven, by a genuine calendar lapse.

## Spec citations

BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`, cited by section name (line numbers move): "Governed review machinery" > Invalidation (idempotent job, 500 per run
with continuation cursor, closed reasons, no event); "Reviewer-authority invalidation on revocation (DEC-180, G6)" (the person invalidation in the revoking transaction; "As defense in
depth, activation recomputes the live qualifying approvals under its locks and refuses a short count, so a stored `approved` state that lags a revocation can never activate a subject");
"Slice 12 lock order" rows `cms_recheck_governed_reviews` and `cms_invalidate_governed_reviews_for_person` (3 the subject version row FOR UPDATE before 5 the review rows). BE03b "Review
invalidation" and rule 7 of "Write-path lock order and authority fencing" (authority revocation includes the membership tenure end; `20261005017580_cms_review_invalidation.sql` wires both tables).
R3 findings: R3-07, R3-08, R3-11, R3-12, R3-13, R3-14, R3-20 in `review-r3-report.md`. DEC-207 (revocation invalidates synchronously, never enqueues).

## Open items / BOUNDARY

1. BOUNDARY (R3-08): BE03c is silent on the failure of ONE review inside a recheck run (it says only idempotent, 500 per run with a cursor, "invalidates on any difference"). Implemented: the
   reviewer's proposal, generalizing the existing DEPENDENCY_UNAVAILABLE precedent (counted `unavailable`, left live, never blocking the reviews behind it); deadlock/lock failures stay the
   typed retryable CONFLICT of the wrapper. Missing spec: the per-item failure outcome of the recheck run and whether it needs a new result member or a metric. Root to ratify
   or to name the alternative; a one-line revert (re-raise) restores the former behaviour.
2. R3-07 decision: the tenure trigger is wired as the brief ordered (BE03c 1478/AC-204 text names only the grant revocation); root to record the decision (DEC) and word the Reviewer-authority
   paragraph: "the transaction that revokes a standing capability grant OR ends/deletes a membership tenure".
3. R3-12 (NIT): subject-then-review locks per review in ascending review id are kept and stated in the function header; BE03c could say so. R3-20 is not a race proof (Requests 4).
4. Not done by design: R3-09/R3-10 (root files).

## Requests to root

1. Promote `supabase/migrations-wip/governed-recheck/` (4 files, 20261022030000..030300) after review, then remove the directory; delete the temporary `supabase/migrations-wip/governed-recheck-red/` (the
   four ORIGINAL migrations, kept only to reproduce the RED runs) and `supabase/migrations-wip/fix-recheck/` (README only). Both extra directories are outside my claim list but I created them.
2. R3-09 and R3-10: `phase_02_slice_09_r8_api_surface.sql` (classify `cms_recheck_governed_reviews` and `cms_governed_recheck_resolve_event`; its failures #4/#13/#14 in my full run also name
   `cms_apply_pattern_update`, `cms_get_instance_update_diff`, `cms_reconcile_taxonomy_merge_converge`, other lanes'), `database.types.ts`, BE03c closed RPC list (both names + the private `cms_governed_recheck_event_ref`).
3. Record the R3-07 DEC and the BE03c wording (Open items 2); ratify or amend BOUNDARY 1.
4. Race module for the lock order: revoke/tenure end vs activation vs recheck vs `cms_advance_block_lifecycle` (the only way to prove R3-20 beyond the structural check).
5. `phase_02_slice_09_sec2_all_schema_definer_rls.sql` #6 fails on `platform_private.taxonomy_merge_recoveries` (dec194 lane, not mine).
6. Review/promote the Test corrections above together with the predecessor's Slice 11 wiring test change.
