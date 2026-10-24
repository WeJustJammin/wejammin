# Lane governed-a report — CMS-03C-07/08/10/11 SQL producers

Lane: `claude_s12_governed_a_sql` (staged-runner lane `governed-a`). Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD at start
`b16edb54a7a1b698ed8ca15b6085046d4270626e`. Timestamp range 20261014010000–20261014019999 (used 20261014010000–010410).

## Status

**GREEN** (2026-10-14, Sonnet 5.5 relaunch #2). Four operations built contract-first and test-first: CMS-03C-08 assignment,
CMS-03C-07 decision, CMS-03C-10 detail, CMS-03C-11 queue. Three pgTAP suites, plan 68 + 57 + 56 = 181 assertions, all pass in
one staged run with zero harness aborts (final-bytes runs 4 and 6, TAP SHA-256 below). A seven-mutant sensitivity run kills every mutant.
Offline contract check: the exact response bodies the suites produce parse against the frozen zod schemas (22 of 22). Nothing was
run outside the staged runner; no applied migration, shared helper, existing oracle or other lane's file was touched.

## Scope

- CMS-03C-08 POST /api/v1/cms/governed-reviews/{reviewId}/assignments (create / revoke reviewer assignment)
- CMS-03C-07 POST /api/v1/cms/governed-reviews/{reviewId}/decision
- CMS-03C-10 GET /api/v1/cms/governed-reviews/{reviewId}
- CMS-03C-11 GET /api/v1/cms/governed-reviews (scope assigned|submitted|owned, signed keyset cursor)
- OUT (not built): CMS-03C-09 activation/retirement/schedule, CMS-03C-19, the G6 person invalidation, the recheck job.

Design (decided from the spec and the 03b producers, mirrored exactly where the spec says "unchanged"):
- Each operation is a private body `platform_private.cms_*_governed_*(p_request jsonb)` (SECURITY DEFINER, empty search_path, owned by
  `wejammin_cms_definer`) plus a `platform_api` wrapper, EXECUTE to `service_role` only (`revoke all ... from public, anon,
  authenticated, service_role` first), the residual deadlock/lock failure mapped to `CONFLICT` on the two writers.
- Shared helpers (20261014010000): `cms_governed_cas_operand` (the `expectedVersion`/`If-Match` operand), `cms_governed_move_subject`
  (one guarded subject-lifecycle move, `lifecycle_version + 1`, definition `version` untouched, DEC-188) and
  `cms_governed_invalidate_open_review` (an OPEN review to `invalidated` under CAS, subject to draft, one audit record).
- Lock order (BE03c lines 1336-1357, DEC-157/DEC-180): decision = authority rows (1), subject row (3) + dependency graph (3) + bound
  content-type versions (4), then the review row (5); assignment = authority rows (1), then the review row (5) and, for a revoke only
  (it may invalidate), the subject row (3) before the review row. The ten CMS-03B-06 steps are an order of checks, not of locks.
- MFA reuses the 03b/DEC-111 helper `cms_editorial_step_up_instant` (context `stepUpVerified` + `stepUpAt` within -30 s..+600 s);
  it runs before the review is read and before any idempotency reservation.
- Reads: detail is one statement (one snapshot); the queue reuses the shared Vault cursor envelope under the domain `cms-03c-11` and is
  written with bounded work (the 20261010171000 lesson: the caller's assignments are read first as an id array).

## Files

### Migrations (WIP, timestamps 20261014010000-20261014010410)

| path | lines | SHA-256 |
|---|---|---|
| `supabase/migrations-wip/governed-a/20261014010000_cms_governed_review_close.sql` | 159 | `f82589e545882cda3b0151e6b6576ce29c4a3658e1e1fb2b728d31f613671440` |
| `supabase/migrations-wip/governed-a/20261014010100_cms_assign_governed_reviewer.sql` | 281 | `0d3835b34e9efcac4b73c660caa5994c1a12e261cd59820a1a20c5ed6db4413f` |
| `supabase/migrations-wip/governed-a/20261014010110_cms_assign_governed_reviewer_public.sql` | 39 | `3bafee0c003ef2d4e4a8e52fbae12c621f4c2fac7f82fdd631a4cc3d8b57efd8` |
| `supabase/migrations-wip/governed-a/20261014010200_cms_record_governed_decision.sql` | 284 | `b60d3fbbc033db4f93cb341258b495013d4a540ef7b398a1c75df7bcf736a074` |
| `supabase/migrations-wip/governed-a/20261014010210_cms_record_governed_decision_public.sql` | 39 | `671941e3df59431cb264398e2d11992d37888bfb0debd21a970eb3e9ee6b9c05` |
| `supabase/migrations-wip/governed-a/20261014010300_cms_get_governed_review.sql` | 161 | `6637101e407142df45081dbbfbde0037b560cdc692147368e9741638fe0640c1` |
| `supabase/migrations-wip/governed-a/20261014010310_cms_get_governed_review_public.sql` | 32 | `b2795b34abfe33e838cda72e92336572a91ecf7f94141c05b9ad42544271cc19` |
| `supabase/migrations-wip/governed-a/20261014010400_cms_list_governed_reviews.sql` | 275 | `a1407b9bd467a5ca3a62be867eabb4f01591de7aab507cc76e5d8423473054c4` |
| `supabase/migrations-wip/governed-a/20261014010410_cms_list_governed_reviews_public.sql` | 30 | `1d24e71b74fb2819ef743343f760083ebe0b77eac972ad9a5290ddb1b43ee5dd` |

### pgTAP suites and fixtures

| path | lines | SHA-256 |
|---|---|---|
| `supabase/tests/phase_02_slice_12_governed_assignment.sql` | 35 | `55d607ac37265eafee596f4133e160a3bf1841f5c3e0ef0587367590bab6d8f3` |
| `supabase/tests/phase_02_slice_12_governed_decision.sql` | 35 | `43c3671ccbbe7e9a25f41829910ddc4082334c8806722329f2f343bcb4e940f3` |
| `supabase/tests/phase_02_slice_12_governed_reads.sql` | 33 | `5f3f1c58d6aa98633a4fe7a00187b073ae77c0ab372fe66af1750de1782ba31d` |
| `supabase/tests/phase_02_slice_12_governed_assignment/000-world.sqlinc` | 300 | `1004dab5c4c55f81106ba931e52ee37b372e65fc90d34ddf81db5b2bb7fa9456` |
| `supabase/tests/phase_02_slice_12_governed_assignment/010-setup.sqlinc` | 48 | `442f308241edfd31ce543b0dd951794a72291c84d7d8cc0883b5dfe5021fb0bc` |
| `supabase/tests/phase_02_slice_12_governed_assignment/020-create.sqlinc` | 90 | `d4c34b79df49c211bbb7b8582eb61f843436206b0ea1fe9906c7a69ac16367ce` |
| `supabase/tests/phase_02_slice_12_governed_assignment/030-refusals.sqlinc` | 94 | `296b64b9a23c77a1d8177e379360419f576a7640ea3a0799ceea3abf97a2939a` |
| `supabase/tests/phase_02_slice_12_governed_assignment/040-bounds-revoke.sqlinc` | 127 | `878f7ea74d96fdae22dcbca08cc94c5cca763bcbe20b2b41b16ab9cfcce27ea9` |
| `supabase/tests/phase_02_slice_12_governed_assignment/050-limit-closed-authority.sqlinc` | 91 | `2ba560f428844ec20abec21867bb4192a2a2403256edb30f026f016a20df3b4f` |
| `supabase/tests/phase_02_slice_12_governed_assignment/README.md` | 20 | `b58feb0eeee0767966d163a1d72e6d66ae805130164bd718453f87df24820a5f` |
| `supabase/tests/phase_02_slice_12_governed_decision/010-setup.sqlinc` | 60 | `d418348d0c35f77fd530e480221db5958b95306c0b945c125f0a036f95f59ed8` |
| `supabase/tests/phase_02_slice_12_governed_decision/020-gates.sqlinc` | 95 | `7cac67da43963b5a3bb5d3c6d54d78fbd6805a563ff46fe29e77b250111de38e` |
| `supabase/tests/phase_02_slice_12_governed_decision/030-happy.sqlinc` | 64 | `06449a6e9b9d7ea9419c96b8da276237ee1692989f06dffb081a58754374fbb0` |
| `supabase/tests/phase_02_slice_12_governed_decision/040-flows.sqlinc` | 77 | `f8a014adf966a66cd68babef335c8b6034dbe4aacde30af39aecb4afff139896` |
| `supabase/tests/phase_02_slice_12_governed_decision/050-invalidation-gates.sqlinc` | 118 | `5432d89160e0f838993f16f1a981c673f6c5649f20663ac87f5423603e19f17a` |
| `supabase/tests/phase_02_slice_12_governed_decision/README.md` | 16 | `b33361ee8bf549ef2cdd1b44705646afd19d2b0d75c2405fd353670f7dd86377` |
| `supabase/tests/phase_02_slice_12_governed_reads/010-setup.sqlinc` | 79 | `d226ec134e35882f384b51b9d4af190b73b8af49456837dd7aa3a43bfe7d9dd4` |
| `supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc` | 140 | `fdcc2d49af6692d32cbec466d7db302271e576085f056700cfda6e1b3fff86ff` |
| `supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc` | 138 | `7e07174515b7643d13d12c8c39b2c106dd0b1f58639e3760550ab2c7a45b0626` |
| `supabase/tests/phase_02_slice_12_governed_reads/040-cursor-privileges.sqlinc` | 99 | `cd47de552e7cb3944e9117d0f220523c14745778ea2a81e5f0d6f1fa07a8de0e` |
| `supabase/tests/phase_02_slice_12_governed_reads/README.md` | 16 | `55f87e0c64fe21c4b220923876269c631710519203c6b53f902aeac4cb8affcf` |

Every migration is under 300 lines (largest 284); every test file under 400 (largest 300). All table `grant`s in the migrations are
idempotent restatements of grants already held by the definer in 20261013300000-00700; no grant is widened. Function-only migrations: no
table is altered, so no populated-DB migration witness is needed.

## Runs

All runs through `docs/handoffs/2026-10-14-claude-s12/lanes/lane-db-alt-staged.sh ... governed-a <three suites>` (one invocation = one run).
`promoted=373` migrations in every run. TAPs are in `.lane-logs/`.

| # | time UTC (2026-10-14) | stamp | WIP | plan / ran | result | first failing test | TAP SHA-256 |
|---|---|---|---|---|---|---|---|
| 1 | 02:15:52 | 021552-2098780 | 0 | 67+56+55 | RED, 109 not ok (assignment 65 ran/37 failed, decision 54/37, reads 48/35) | assignment 13 (CMS-03C-08 has a named platform API RPC) | `b3f29a9a47dcbcbf15f26b463ae2bbad2f76ab80df84f5cffe806a054e149f31` |
| 2 | 02:20:00 | 022000-2123735 | 9 | 67+56+55, 178 ran | 171 pass, 7 fail | assignment 27 | `87b3fb1eef44d800dbdc54fd73b8d18a9331c3919d374a2d009f46b7b017b2c2` |
| 3 | 02:22:14 | 022214-2138548 | 9 | 67+56+55, 178 ran | **178/178 pass** | none | `8c9552e94b41d66191294a1eb4529400a1f9f700e607523627bdf7e222335eda` |
| 4 | 02:24:17 | 022417-2149824 | 9 | 68+57+56, 181 ran | **181/181 pass, Result PASS** (final bytes) | none | `5a52d44e006d7d5a09be0fbd7eb1234c1289db8f7c0d0cac73955b921a8ab66b` |
| 5 | 02:25:40 | 022540-2158014 | 9 mutated | 181 ran | 17 not ok across the seven mutants (below); WIP restored byte-identical (sha256 check) | assignment 34 | `ab9caeb1c8641b8c7c04a1459ef1e5f5eab1e90cc4c8762273c9ee87721f053f` |
| 6 | 02:27:56 | 022756-2168574 | 9 (manifest identical to the Files table) | 68+57+56, 181 ran | **181/181 pass, Result PASS** (confirmation on the final bytes, after the report) | none | `038d24d773cd8fb4083e23da9ab49e8874e1850cbb32a4ec16b626de8c37da9c` |

Failure classification.
- Run 1 (RED): every failure is a **genuine missing feature** (all four `platform_api` RPCs absent); all fixture controls (S09 owner
  initialization, real CMS-03A-15 grants, the 005 type chains, 6/9/7 real open reviews) passed. Three aborts were consequences of the
  missing functions, not harness defects: a `::regprocedure` cast of a missing function (assignment and decision, last assertion) and a
  NULL cursor handed to a Vault helper (reads); the casts were rewritten with `to_regprocedure`.
- Run 2: seven failures, **none a producer defect**: (a) four table-driven `is()` expectations appended `#` because psql's
  `pg_exception_detail` is the empty string, not NULL (assignment 27, 30; decision 17; reads 47): test expression fixed with `nullif`;
  (b) two assertions called the private SECURITY DEFINER helpers `cms_governed_review_distinct_approvals` / `cms_governed_frozen_status`
  from the bare test session, where the forced-RLS tables answer no row without the RPC context a command holds (decision 26, 35):
  fixed by calling them through `s09d_scalar` (holds `app.cms_rpc` for the statement); the same defect made decision 44 pass vacuously,
  so it now also asserts the count was 1 before the revocation and 0 after; (c) one snapshot compare spanned an unrelated grant
  revocation (decision 48): the mark is now taken immediately before the refusal.
- Run 5 mutants, all killed: M1 grantor-end bound dropped (assignment 34, 35, 37, 38, 39, 45), M2 duplicate_decision check skipped
  (decision 39), M3 satisfied slot always the base slot (assignment 48 and 50, decision 35, 36, 38, reads 11, 29), M4 decision reason
  leaked to every reader (reads 21), M5 subjectKind filter dropped (reads 43), M6 revoke of a counted approval no longer invalidates
  (assignment 50), M7 cursor not bound to the subject kind (reads 50). Every mutant was applied in the WIP files for that run only and the
  files were restored from a byte backup (`sha256sum -c` clean).

## Test corrections

None. No existing test, oracle or shared helper was changed; the governed-submit fragments (`000-fixtures.sqlinc`, `005-real-type-chains.sqlinc`)
and the S09 DEC-108/DEC-119 fragments are `\ir`-included read-only.

## Spec citations

BE03c = `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`; BE03b = `.../be/03b-editorial-workflow-publication.md`.

| Assertion group | Source |
|---|---|
| Route rows, resources, statuses (201 create / 200 revoke, 200 decision, ETag operand = review `version`) | BE03c 169, 170, 172, 173; contracts `governed-assignment.ts`, `governed-decision.ts`, `governed-review.ts`, `governed-review-read.ts`; AC-070, 076, 088, 094 |
| Review `version` is the If-Match operand; assignment create/revoke do not advance it, a decision does | BE03c 215 (If-Match operands), 1306 (machinery), 1540 |
| Unconditional recent MFA, 401 `STEP_UP_REQUIRED`, no idempotency reservation, before concealment | BE03c 216; BE03b DEC-111/E6; error catalog 1276-1304; AC-072, 078, 074, 080 |
| Concealment 404 vs 403, owner-only assignment, receipt-derived owner, submitter/assignee/capability read scopes | BE03c 1458-1482 (authz matrix), 1445-1456; BE03b 1851-1861 scopes; AC-072, 078, 090 |
| Separation of duties (submitter, subject creator never reviewers), uniform `reviewer_not_eligible` | BE03c 1306 substitutions, 1304 typed refusals; BE03b 1863; AC-078 |
| Assignment window <= 7 days, <= reviewer `cms.reviewer` grant day end, <= grantor designer/curator grant day end, 16 active, `assignment_exists` | BE03c 170, 1306; BE03b 1863; AC-077, 079, 080 |
| Decision order of checks, slot derivation, `specialist_slot_unsatisfiable`, `duplicate_decision`, strictest-policy counting, first rejection ends the review, committed `dependency_changed` invalidation, dead-review `reviewer_authority_changed` | BE03c 1306, 1320 (policy basis), 1336-1357; BE03b 1865, 1867, 1869; DEC-137, DEC-157, DEC-159; AC-070..075 |
| Subject lifecycle moves, `lifecycle_version` +1 per transition, definition `version` immutable | BE03c 1306 (subject state machine), 215; DEC-188; AC-073 |
| Revoke of a counted approval invalidates in the same transaction (subject lock before review lock) | BE03b 1863, 1869 (DEC-161); BE03c 1336-1357 |
| Detail redaction (own reason only, owner-only assignments by label, own assignment, no identifier), `permittedNextActions`, live distinct count | BE03c 172, 1445-1456, 1471; contracts `governed-review-read.ts`; AC-088..093 |
| Queue scopes, filters, `(updatedAt DESC, reviewId DESC)`, default 25 / max 50, signed cursor bound to complete query and acting scope, DEC-140 fault classes | BE03c 173, 394, 1264; BE03b CMS-03B-17; AC-094..099 |
| anon/authenticated 42501, service_role only on the wrapper, definer-owned private bodies | BE03c 1445-1456; SEC-2; governed-submit 300810 pattern |
| Idempotent and conflicting replay, committed refusals replay | BE03c 1304 (R5), 1502 data flow; DEC-159; AC-073, 080 |
| Reason bounds counted in code points (256 assignment, 2000 decision) | BE03c 1306 / Database Schema rows for assignment and decision; DEC-158 |

## RPC boundary (for the Worker transport lane)

All four are `platform_api.<name>(p_request jsonb) returns jsonb`, callable by `service_role` only. `context` is the verified Worker
envelope the 03b commands already take: `{ authUserId, actorPersonId, actingPartyId, sessionId?, requestId?, correlationId?, stepUpVerified,
stepUpAt }` (a read sends no step-up claim). A replay of a completed idempotency record sets the GUC `response.headers` to
`[{"x-cms-idempotent-replay": "true"}]` exactly as 03b does.

1. **`cms_assign_governed_reviewer`** (CMS-03C-08). Create: `{ reviewId, action:'create', expectedVersion, ifMatch, idempotencyKey,
   reviewerPersonId, expiresAt, reason?, context }`; revoke: `{ reviewId, action:'revoke', expectedVersion, ifMatch, idempotencyKey,
   assignmentId, reason?, context }`. `expectedVersion` and `ifMatch` are equal decimal strings. Returns `GovernedReviewAssignmentResource`
   (12 members); the Worker answers 201 for create, 200 for revoke. The review `version` is unchanged except that revoking the
   assignment of a counted approval also invalidates the open review (the revoke still answers the assignment resource).
2. **`cms_record_governed_decision`** (CMS-03C-07). `{ reviewId, decision:'approve'|'reject', reason, expectedVersion, ifMatch,
   idempotencyKey, context }`. Returns `GovernedReviewResource` (200), or a **committed refusal envelope**
   `{ "kind":"refusal", "reasonCode":"dependency_changed" | "review_not_open", "details":{} }` (the RPC does not raise; the state
   change is committed and the envelope is the replayable idempotency outcome, stored with status 409). The Worker answers it as 409
   `GOVERNED_REVIEW_VERSION_CONFLICT` with `details.reasonCode` = `reasonCode`. `dependency_changed` returns the subject to draft;
   `review_not_open` here means the review was invalidated `reviewer_authority_changed` because a recorded approval no longer counts.
3. **`cms_get_governed_review`** (CMS-03C-10). `{ reviewId, context }`. Returns `GovernedReviewDetailResource` (29 members); the strong
   ETag is `"{version}"` of the same document.
4. **`cms_list_governed_reviews`** (CMS-03C-11). `{ cursor?, limit?, scope?, state?, subjectKind?, context }` (JSON null = absent).
   Returns `GovernedReviewQueuePage`. The Vault secret `cms_editorial_history_cursor_active` must exist, else `DEPENDENCY_UNAVAILABLE`.

Refusals are `P0001` with the whole message the token and `DETAIL` only where shown:
`INVALID_REQUEST` (malformed shape/ids/header disagreement/malformed cursor); `VALIDATION_FAILED` with DETAIL `["/pointer"]`
(`/expectedVersion`, `/ifMatch`, `/reviewerPersonId`, `/expiresAt`, `/assignmentId`, `/reason`, `/decision`, `/limit`, `/scope`, `/state`,
`/subjectKind`); `STEP_UP_REQUIRED` (401); `NOT_FOUND` (404); `capability_missing`, `separation_of_duties` (403);
`VERSION_MISMATCH` with DETAIL `{"expectedVersion":"..","currentVersion":".."}`, `CONFLICT` (already-revoked assignment, expired/foreign/
tampered cursor, residual deadlock), `review_not_open`, `duplicate_decision`, `specialist_slot_unsatisfiable`, `reviewer_not_eligible`,
`assignment_exists`, `assignment_limit` (409); `expiry_out_of_bounds` with DETAIL `["/expiresAt"]`; `IDEMPOTENCY_MISMATCH`;
`DEPENDENCY_UNAVAILABLE` (503: null policy evidence, missing Vault key).
Audit actions written: `cms.governed.review.assignment.create|revoke` (target = review), `cms.governed.review.decide` (target = decision),
`cms.governed.review.invalidate` (target = review). No outbox event, no job.

## Open items / BOUNDARY

No BOUNDARY (every behaviour is specified). Honest coverage limits for the reviewer:
1. **Subject kinds.** Only `template_version` subjects can be minted through real producers today (CMS-03C-12/-16 are other lanes), so
   these suites exercise templates; pattern and taxonomy subjects share the same kind-agnostic code (resolver, `cms_governed_owner_capability`,
   `cms_governed_move_subject`) but the `cms.taxonomy_curator` branch and the pattern/taxonomy subject paths are not driven here. Re-run the
   assignment/decision/reads flows once those producers promote.
2. **`separation_of_duties` is defense in depth.** The assignment guard and producer refuse the submitter and the subject creator
   (`reviewer_not_eligible`), so no public path reaches the decision check; a submitter without an assignment meets `capability_missing`
   first (the 03b order). The producer keeps the ordered check; the DB guard `cms_governed_decision_guard` is the second fence (not mine).
3. **Concurrency is unproven here.** The lock order is implemented by construction (above); parking-based race proofs and the
   deadlock-to-`CONFLICT` wrapper mapping need a race module, which this lane is forbidden to run.
4. **Queue tie-break.** Ordering is asserted against an independent oracle at millisecond precision; two rows sharing one millisecond
   (the `reviewId DESC` tie-break) cannot be forced without writing governed rows by hand.
5. **Helpers cover OPEN reviews only.** `cms_governed_invalidate_open_review` refuses a non-open review: invalidating an approved review also
   cancels its schedules, which belongs to whoever owns CMS-03C-09 and `cms_invalidate_governed_reviews_for_person` (G6); both can reuse
   `cms_governed_move_subject`.
6. **Governed-table session/relationship RLS** (20261013301400 in the tables file's header) does not exist yet; the readers run as the
   definer under the RPC-context policy only, like the 03b readers before their session-scope migrations.
7. Rate buckets, deadlines, no-store/ETag headers and the 400-vs-422 mapping of `VALIDATION_FAILED` are Worker concerns.
8. Contract conformance was checked offline (a throwaway node script reading the `EVIDENCE` rows the suites print into the TAP and
   parsing them with the frozen zod schemas: 22 of 22); it is not a repo gate.

## Requests to root

1. Independent review of the nine WIP migrations, then promotion in timestamp order (they are function-only; no populated-DB witness needed).
2. After promotion, a canonical `db:verify`, and `db:types` refresh (four new `platform_api` functions).
3. Hand the `## RPC boundary` section to the Worker transport lane; note the Vault cursor key requirement for the queue and the committed
   refusal envelope of the decision.
4. Tell the governed-b (CMS-03C-09/-19) and G6 owners that `cms_governed_move_subject`, `cms_governed_invalidate_open_review` and
   `cms_governed_cas_operand` exist (promoted from this lane) so they do not duplicate them.
5. Re-run the three suites against pattern/taxonomy subjects when CMS-03C-12/-16 promote (open item 1).
