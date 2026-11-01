# Independent review — lane `claude_s12_governed_a_sql` (governed-a)

Reviewer: independent adversarial reviewer (did not author). Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD
`b16edb54a7a1b698ed8ca15b6085046d4270626e`. Static review only: no DB runner, no tests executed, no
source/test/spec/tracking file touched. Report path: this file.

Paths below are relative to the worktree. `M-xxxx` = `supabase/migrations-wip/governed-a/20261014M-xxxx_*.sql`
(`010000` close helpers, `010100`/`010110` assign + wrapper, `010200`/`010210` decide + wrapper,
`010300`/`010310` detail + wrapper, `010400`/`010410` queue + wrapper). `A/`, `D/`, `R/` = the test directories
`supabase/tests/phase_02_slice_12_governed_{assignment,decision,reads}/`. BE03c =
`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`; BE03b = `.../be/03b-editorial-workflow-publication.md`.

## Status

Reviewed in full: the nine WIP migrations (1,300 lines), the three suite drivers and fifteen fragments (1,536
lines), the author report, the frozen contracts (`governed-assignment.ts`, `governed-decision.ts`,
`governed-review.ts`, `governed-review-read.ts`, `refusals.ts`, the aliased 03b modules), the registry rows
(`platform-registries.ts` 1975–2078), BE03c rows 168–173, 192–221, 390–394, 1250–1305, 1306–1357, 1433–1435,
1445–1482, 1496–1544, 1601–1625, BE03b 1721–1742 and 1851–1880, DEC-113/137/157/180/188, the applied governed
baseline (`300000`, `300200`, `300300`, `300400`, `300500`, `300600`, `300790`, `300810`, `300820`), the 03b
precedents (`20261005017620`, `017630`, `017880`, `017890` + `20261010171000`), and the shared helpers each
producer calls (`cms_editorial_step_up_instant`, `cms_lock_person_authority`, `cms_editorial_reason_valid`,
`cms_person_holds_capability`, `cms_review_person_eligible`, `cms_entry_tenant_visible`, `identity_actor_person`,
`cms_reserve`/`cms_complete`/`cms_request_hash`, `cfg_acting_party`, `cms_exact_keys`, `cms_valid_version`,
`cms_raise_version_mismatch`, `cms_signed_cursor_{open,seal_page,require_key}`, `auth_iso_time`).

Result: implementation conforms to the cited spec rows and the frozen contracts, mirrors the 03b precedents
where BE03c says "unchanged", and the 181 assertions are non-vacuous. No blocker, no major. Nine minor
findings/observations below, mostly test-oracle wording and inherited spec gaps.

## Author claims re-verified

| Claim | Check | Result |
| --- | --- | --- |
| Report SHA-256 `4b90d0b7…633d` | `sha256sum` | matches |
| Final TAP `.lane-logs/alt-staged-governed-a-022756-2168574.tap` SHA `038d24d7…da9c` | `sha256sum` | matches |
| 181/181 pass, plans 68+57+56, `Result: PASS` | `grep -c '^ok '` = 181, `^not ok` = 0, plans `1..68 1..57 1..56`, line 309 `Result: PASS` | matches |
| Manifest `promoted=373 wip=9` | manifest line 1 | matches |
| Nine migration SHA-256s and 22 test-file SHA-256s in the Files table | `sha256sum` over all 31 files | all 31 match |
| Run 1 genuine RED (0 WIP) | `021552` TAP: 58 ok / 109 not ok, plans 67/56/55, first `not ok 13 … has a named platform API RPC` | matches (the 12 earlier passes are the 9 governed-submit chain controls + 3 fixture controls) |
| Run 5 mutants: 17 not ok | `022540` TAP: 164 ok / 17 not ok; set = assignment {34,35,37,38,39,45,48,50}, decision {35,36,38,39}, reads {11,21,29,43,50} | matches the M1–M7 attribution exactly |
| Largest migration 284 lines, largest test file 300 | `wc -l` | matches (284 < 300; 300 < 400) |
| "No grant is widened" | `300000:168` already grants `select, update` on the three subject tables to the definer; `300200:243-250` grants reviews/assignments `insert, select, update` and decisions/dependencies `insert, select`; `300300:327-333` grants the type tables; `300500:267-272` grants `cms_owner_initialization` | every grant in `010000:142-147`, `010100:272-274`, `010200:275-277`, `010300:147-154`, `010400:262-266` is a restatement |
| No other lane defines the three helpers | grep of `supabase/ packages/ apps/ docs/` | none outside `governed-a/` |
| "22 of 22 contract parses" | 24 EVIDENCE lines in the TAP = 22 resources + 2 refusal envelopes; eight bodies checked by eye against the zod shapes (below) | consistent (not re-executed: static only) |

EVIDENCE bodies checked against the frozen schemas (all pass by inspection): `a1` (12 members, `capability`
`cms.definition_review`, `actions ["read","decide"]`, window 20 h, ms-`Z` instants), `rv-counted` (`reason: null`
nullable, `version "2"`), `d1` (21 members; `decidedAt` set iff approved; `invalidatedReason` null; base slot
first), `r7-dead`/`r6-changed` (`{kind, reasonCode, details:{}}`), `g-rev1` (policyBasis sorted by label then key,
`reason` null + `mine` false for a non-decider, `assignments []` for a non-owner, `myAssignment` two members,
`distinctApprovalCount` 1 ≤ approvals), `q-rev1` (three items strictly in `(updatedAt DESC, reviewId DESC)`,
`assignmentEndsAt` set for `assigned`, `pageVersion` = µs epoch of the max `updatedAt`), `w1` (`assignmentEndsAt`
null for `owned`; cursor decodes to exactly `{expiresAt, keyId, lastReviewId, lastUpdatedAt, queryHash, signature}`,
440 chars ≤ 512, `expiresAt` = issue + 86400), `q-nonmember` (`items []`, `pageVersion "1"`).

## Route-registry clause map

### CMS-03C-07 decision (BE03c 169, 390, 1260, 1346, 1468; BE03b 1865 via 1308)

| Clause | Implemented | Tested |
| --- | --- | --- |
| `GovernedDecisionRequest` strict keys; `capability`/`stepUpAt` unknown; UUID; `decision` enum; reason SafeText 1–2000 code points NFC | `010200:65-87` (`cms_exact_keys`, `cms_editorial_reason_valid(…,2000,true)`) | `D/020-gates.sqlinc:34-65` (13 structure cases incl. control char, markup, braces, 2001, non-NFC) |
| `expectedVersion` = review `version`, `If-Match` equals it (215) | `010000:20-42` shared operand; `010200:76` | `D/020:40-45`, `D/020:84-88` (VERSION_MISMATCH DETAIL `{expectedVersion,currentVersion}`) |
| Unconditional recent MFA, 401 `STEP_UP_REQUIRED` before any reservation, before concealment (216) | `010200:90` after structure, before the review read (`:94`) and `cms_reserve` (`:119`) | `D/020:7-31` (missing/stale 11 min/future +2 min/hidden review/stranger; zero idempotency rows; snapshots identical) |
| 404 for a review the caller cannot read; 403 for readable without effective assignment | `010200:94-103` (owner mismatch, empty scopes → `NOT_FOUND`), `:104-112` (`capability_missing`) | `D/020:68-83` (absent, other org, non-member via claimed party, no scope, unassigned → 404; submitter → 403) |
| Position 1 authority lock, then reservation, then `open` + CAS on committed row | `010200:115-133` | replay `D/030:50-55`, mismatch `:56-59`, closed `:60-64` |
| Lock order 1 → 3 (subject `FOR UPDATE`) → graph → 4 → 5 (DEC-157/DEC-180) | `010200:136-140` (`cms_governed_subject_resolve(…,true)`, `cms_governed_lock_graph`), review `FOR UPDATE` `:142`/`:155` | by construction only (race modules forbidden to the lane; author states this) |
| Dependency/policy-basis recheck commits the invalidation, subject → draft, committed 409 envelope `dependency_changed` | `010200:141-152` → `010000:91-137` → `010000:44-86` | `D/050-invalidation-gates.sqlinc:61-92` (real DEC-108 successor activation changes the bound type; review invalidated v2, subject draft lifecycle 3, audit 1, status 409 stored; replay identical; later decision `review_not_open`) |
| Separation of duties (submitter, subject creator) | `010200:165-167`; also `300600:204-207` guard | not exercisable through public commands (finding F-1) |
| `duplicate_decision` | `010200:168-173` | `D/040-flows.sqlinc:62-67`; mutant M2 killed |
| Standing `cms.reviewer` grant | `010200:174-176` | `D/050:55-58` (grant revoked by real CMS-03A-17) |
| Assignment effective now, re-read under the review lock | `010200:104-112`, `:178-185` | `D/050:6-19` (expired → 403; revoked → 404) |
| Satisfied slot = first unfilled specialist slot held, else base; `specialist_slot_unsatisfiable` | `010200:188-208` | `D/040:26-59` (policy→base, base→unsat→policy); mutant M3 killed |
| Dead review (a counted approve no longer counts) → invalidated `reviewer_authority_changed`, committed `review_not_open` envelope | `010200:209-216` | `D/050:22-52` (live recount 1 → 0 proven before/after revocation; version 3; replay identical) |
| Decision row appended before the review advances; server-derived reviewer/slot/MFA instant/frozen hash/comment hash | `010200:219-227` | `D/030-happy.sqlinc:22-35` (every stored column asserted) |
| First rejection ends the review; last required approval approves; CAS `version + 1` | `010200:228-255` | `D/040:5-23`, `:68-77`; `D/030:12-21`, `D/040:34-43` |
| Subject `review → approved` / `→ draft`, `lifecycle_version + 1`, definition `version` untouched (DEC-188) | `010200:256-260` via `010000:44-86` | `D/030:36-45`, `D/040:10-15`, `:41-42`, `:74-75` |
| One audit record, no event, completed idempotency record with status 200 | `010200:262-267` | `D/030:36-45` (audit 1, outbox 0 on review and subject aggregates) |
| 200 `GovernedReviewResource` (21 members) | `cms_governed_review_resource` (baseline `300500:119-157`) | `D/030:7-11` exact key list; EVIDENCE `d1` |
| Wrapper: service_role only; deadlock → `CONFLICT`; definer-owned, empty `search_path` | `010210:7-37` | `D/050:95-110` (anon/authenticated 42501 on the wrapper; service_role 42501 on the private body; `prosecdef`, `proconfig`, owner) |
| Rate buckets, 15 s deadline, no-store, 400-vs-422 mapping, `Location` | Worker concerns (author item 7) | n/a |

### CMS-03C-08 assignment (BE03c 170, 391, 1261, 1347, 1469; BE03b 1863 via 1308)

| Clause | Implemented | Tested |
| --- | --- | --- |
| Discriminated `create`/`revoke` strict keys; UUIDs; offset-ISO `expiresAt`; optional reason 1–256 code points NFC, no SafeText exclusions (DEC-158 b) | `010100:64-124` | `A/030-refusals.sqlinc:6-39` (11 cases incl. a create carrying `assignmentId`); `A/040-bounds-revoke.sqlinc:41-44` (256 code points = 512 octets stored whole) |
| `expectedVersion` = exact review `If-Match` | `010100:94` via `010000:20-42` | `A/030:61-65` |
| Unconditional step-up before the review read and before reservation | `010100:127` | `A/020-create.sqlinc:68-90` |
| Receipt-derived owner (`cms_owner_initialization` match), `cms.definition_review.assign` never grantable; 404 concealed/cross-owner; 403 capability denial or no valid designer/curator grant, for create and revoke, proved twice around the position-1 locks | `010100:132-157` (`cms_governed_review_scopes` `300500:61-117`; `cms_governed_owner_capability`) | `A/030:42-58`; `A/050-limit-closed-authority.sqlinc:47-60` (real CMS-03A-17 revocation → 403 for create and revoke; re-grant → ok); `:63-67` (the real grant command refuses `cms.definition_review.assign`; no such grant row) |
| Reservation after the two-pass proof; exact replay; changed body `IDEMPOTENCY_MISMATCH` | `010100:160-167` | `A/020:53-65`; `A/040:83-88` |
| `review_not_open`; CAS | `010100:173-182` | `A/050:32-44`; `A/030:61-65` |
| Uniform `reviewer_not_eligible` (absent, cross-org, non-member, banned/ungranted, submitter, subject creator) | `010100:186-193` | `A/030:68-81` (six cases, one token); `A/040:50-57` (submitter otherwise eligible; same human assignable elsewhere) |
| `assignment_exists`; 16 unexpired active → `assignment_limit`; partial unique | `010100:194-205`; `300200:130-132` | `A/030:84-86`; `A/050:4-29` (16 real humans, 17th refused, revoke frees a slot) |
| Expiry > now, ≤ 7 days, ≤ reviewer `cms.reviewer` grant day end, ≤ grantor designer/curator grant day end; `expiry_out_of_bounds` at `/expiresAt` | `010100:206-221` | `A/040:5-18` (8 d, past, now, beyond a 1-day grantor grant), `:21-47` (renew grantor to 30 d by real CMS-03A-16; beyond 1-day reviewer grant; 7 d + 1 min; 6 d 23 h accepted); mutant M1 killed |
| Insert active v1 with server-derived grantor, `cms.definition_review`, `['read','decide']`; 201 | `010100:222-230` | `A/020:4-50` (12-member body, stored row, status 201 in the idempotency record) |
| Revoke: `NOT_FOUND` for another review's/unknown assignment, `CONFLICT` already revoked, `version + 1`, 200 | `010100:232-252` | `A/040:60-104` |
| Review `version` never advances on create or non-counted revoke; subject untouched | no review UPDATE in the producer | `A/020:36-41`, `A/040:72-82` |
| Revoke of a counted approval invalidates `reviewer_authority_changed` in the same transaction; subject (pos. 3) locked before the review (pos. 5) | `010100:170-172` (subject `FOR UPDATE` before `:173-176`), `:244-247`, `:257-261` | `A/040:107-127` (review v3 invalidated, `decided_at` null, subject draft lifecycle 3, two audit records); mutant M6 killed |
| One audit record, no event, completed record with 201/200 | `010100:254-264` | `A/020:42-50`, `A/040:72-82` |
| Wrapper ACL and definer closure | `010110:7-37` | `A/050:68-85` |

### CMS-03C-10 detail (BE03c 172, 393, 1263, 1449, 1471)

| Clause | Implemented | Tested |
| --- | --- | --- |
| Path UUID only; any other key 400 | `010300:35-40` | `R/020-detail.sqlinc:129-138` (`b-extra`, `b-bad-id`) |
| 404 hidden/absent/cross-owner/non-member; 403 visible without read scope | `010300:47-57` | `R/020:120-138` (absent, other org, claimed party, no scope, revoked assignee, assignee of another review) |
| Scopes: submitter, non-revoked assignee, owner-capability holder, receipt owner | `cms_governed_review_scopes` (`300500:61-117`) | `R/020:4-11`, `:85-117` |
| Safe read: writes nothing | no write statements | `R/020:139-140` (snapshot incl. audit/outbox/idempotency) |
| 29-member `GovernedReviewDetailResource`; `blockRegistryDigest` nullable; `policyBasis` by label then key, ≤ 64; live `distinctApprovalCount` | `010300:59-135` | `R/020:12-39` |
| Decision rows: safe metadata; `reason` only to its decider; `mine` | `010300:82-93` | `R/020:42-54`; mutant M4 killed |
| `assignments` owner-only, display labels, no ids; `myAssignment` own active only; no person/actor/party identifier anywhere | `010300:94-128` | `R/020:55-77` (nine identifiers searched in four reader documents) |
| `permittedNextActions` by role and state | `cms_governed_next_actions` (`300500:192-262`) | `R/020:78-82`, `:91-117` |
| Strong ETag `"{version}"` | `version` member (string) | Worker concern |
| Wrapper ACL | `010310` | `R/040-cursor-privileges.sqlinc:55-83` |

### CMS-03C-11 queue (BE03c 173, 394, 1264, 1472; DEC-140)

| Clause | Implemented | Tested |
| --- | --- | --- |
| Filter allowlist `scope`/`state`/`subjectKind` + `cursor`/`limit`; closed enums; limit 1–50 default 25; null = absent | `010400:53-90` | `R/030-queue.sqlinc:121-138`, `:85-95`, `:114-118` |
| `assigned` (active assignment, bounded by an id array read first), `submitted`, `owned` (designer → template+pattern, curator → taxonomy); non-member → empty page | `010400:130-176` | `R/030:20-78` against an independent oracle (`R/010-setup.sqlinc:62-79`); item-by-item equality `:31-45`; revoked assignment unlisted `:64-71` |
| Order `(updatedAt DESC at ms, reviewId DESC)`; keyset `<`; limit + 1 | `010400:150-175` | `R/030:98-118` (walk 2,2,2,1 covers all seven exactly once); contract `followsInKeysetOrder` on EVIDENCE |
| Signed cursor over shared Vault envelope, domain `cms-03c-11`, bound to actor, party, scope, state, subjectKind, limit | `010400:92-94` (hash), `:230-255` (signed wrapper) | `R/040:23-39` (scope, state, limit, kind, actor, tamper, expired → `CONFLICT`); mutant M7 killed |
| Malformed cursor 400; expired/tampered/foreign 409 | `010400:96-128` (structure → `INVALID_REQUEST`; hash/expiry → `CONFLICT`); opener MAC | `R/040:40-50` |
| Missing Vault key → `DEPENDENCY_UNAVAILABLE`, never an unsigned page | `010400:246` | `R/030:3-5` |
| 12-member item, `assignmentEndsAt` only for `assigned`; `pageVersion` decimal string | `010400:190-203`, `:219-223` | `R/030:25-30`, `:46-49`, `:50-57` |
| Writes nothing | — | `R/030:137-138`, `R/040:51-52` |
| Wrapper ACL (stays with the migration owner like `20261005017890`, the only role that reaches the Vault helpers) | `010410` | `R/040:55-83` |

## Security

- **AuthN/AuthZ ordering.** Both writers: structure → step-up (`cms_editorial_step_up_instant`, DEC-111 −30 s/+600 s) → concealment → authority locks → reservation → state/CAS → work. This is the 03b order (`017630:93-186`, `017620:88-216`) and satisfies BE03c 216 ("401 before any idempotency reservation") and 1482 ("structural malformed input is 400 before existence checks"). A raised refusal rolls back the reservation; only the two envelope returns commit.
- **Replay never leaks a cached body to a caller who lost authority.** Replay is evaluated after the owner proof (`010100:160`) / after concealment and the effective-assignment check (`010200:119`).
- **403 vs 404.** Writers conceal a review the caller has no scope on (404) and refuse a scoped caller without the required authority (403); the detail answers 403 to a confirmed member without scope. Each matches its own spec row and the 03b precedent (observation O-2).
- **No PII/secret leakage.** Refusal messages are tokens; DETAIL carries only JSON pointers or the two version strings; resources carry no person, auth user or party id (asserted `R/020:70-77`); audit rows are identifier-only; the cursor payload contains a query hash and a review id, not the actor.
- **Input bounds.** Reason bounds in code points; `expiresAt` grammar + cast guard; cursor ≤ 512 octets, exact members, regexes; limit 1–50; `expectedVersion` ≤ 19 digits ≤ bigint.
- **Idempotency.** `cms_request_hash` strips `idempotencyKey`/`correlationId` and reduces `context` to `actingPartyId`/`actingContextId`, so the binding is body + target + expected version + acting party, and a replay with a fresh step-up instant/session id replays (spec 1493). Committed refusals are stored with status 409 and replay identically (`D/050:48-52`, `:86-92`).
- **CAS.** Review `version` is the operand for 07/08 (BE03c 215); assignment create/revoke never advance it (no review UPDATE in `010100`; asserted `A/020:36-41`, `A/040:72-82`); a decision, an invalidation advance it by one under `where version = v_review.version` (`010200:246-255`, `010000:118-128`); the baseline guard `300600:72` enforces `+1`.
- **Lock order.** Decision 1 → 3 → graph → 4 → 5 (`010200:115,136,140,142/155`); assignment 1 → (3 for revoke) → 5 (`010100:152,171,173`); the invalidation and subject-move helpers take no lock an earlier position would precede (`010000:1-4`). No inversion against the baseline submit (`300820:93-98`) or the 03b writers.
- **Grants/ACL.** Every private body: `security definer`, `set search_path = ''`, owner `wejammin_cms_definer`, EXECUTE revoked from public/anon/authenticated/service_role; wrappers EXECUTE to service_role only; asserted at runtime for all four wrappers and all private bodies (`A/050:68-82`, `D/050:95-108`, `R/040:55-81`). The two new SECURITY DEFINER helpers (`cms_governed_move_subject`, `cms_governed_invalidate_open_review`) perform no authorization of their own; they are reachable only by definer-owned bodies and superusers, the same trust model as the baseline helpers.
- **MFA instant stored** on the decision row and re-validated by the baseline guard window (`300600:229-232`).

## Tests

- 181 assertions read individually. Each compares an exact token string (`<sqlstate>:<message>` + DETAIL), an exact key list, an independently built row, or a before/after store digest (`s12ga_snap`: full-content hash of review, assignments, decisions, dependencies, subject row; md5 of all idempotency rows; audit/outbox counts). No mock returns the expected error: every command runs through the real `platform_api` wrapper under `set local role service_role` with role restoration asserted (`000-world.sqlinc:27-50`, role-control assertions in each suite).
- No `skip`/`todo`, no filtered assertions, no TODO markers (grep clean). Plans equal the assertion counts.
- Fixtures: real S09 owner initialization, real CMS-03A-15/16/17 grants, real CMS-03C-01 templates, real CMS-03C-06 submissions, real CMS-03C-08 assignments feed the decision and read suites, a real DEC-108 successor activation produces the changed dependency. The only app-domain forgery is the S09 labelled `membership_tenure` insert inside `s09d_grant_via_rpc` (`phase_02_slice_09_dec108/00-helpers.sqlinc:309-320`); the pool bootstrap also inserts `auth.users` rows directly (`A/000-world.sqlinc:266-267`), the S09 pattern (`01-actors.sqlinc:25`). The tenure forgery is used in setup and, as a labelled control step, mid-suite for `rev3` (`A/050:6-7`); no governed row is inserted by hand anywhere.
- Mutation sensitivity: seven mutants killed by 17 assertions (run 5); attribution verified against the TAP not-ok set.
- Mental mutation of the producers: dropping any refusal token, the version untouched rule, the counted-revoke invalidation, the slot derivation, the reason redaction, a filter or a cursor binding member fails a named assertion. Residual survivors: finding F-1 (separation branch), F-4 (event on a non-review aggregate from the assignment command), F-5 (expired assignee read).

## Conventions

- Precedents followed: producer + wrapper shape, two-pass authority proof, reservation point, envelope refusals, grants block, error tokens with DETAIL — all byte-pattern-equivalent to `017620`/`017630`/`017880`/`017890`, with the BE03c 1308 substitutions (owner capability per subject kind, subject creator, `cms.definition_review`). Queue wrapper ownership mirrors `017890` (migration owner reaches the Vault helpers).
- Files ≤ 300 lines (migrations) and ≤ 400 (tests); READMEs present and substantive in all three test directories; no `any`/TODO; no boundary stubs.
- `cms_governed_cas_operand` is `stable` without `security definer` (reads only its argument) — acceptable.

## Findings

Severity scale: blocker / major / minor. None blocker or major.

- **F-1** `010200:165-167` — minor — the `separation_of_duties` branch is untested and unreachable through public commands: `010100:186-193` and the guard `300600:166-168` refuse the submitter and the subject creator at assignment time, and `submitted_by`/`created_by` are frozen, so no assigned reviewer can later become either. Why it matters: a mutant deleting the branch survives the suites. Spec intent (BE03c 1308 ten ordered checks, 1468, 1492) is belt-and-braces, and the producer keeps the check, so this is accepted as untestable-by-construction under the lane rules (no forged assignment rows, no disabled triggers). Fix direction: none for this lane; root may add a sentinel in a diagnostic run that inserts an assignment as superuser with the guard trigger disabled, outside the canonical suites.
- **F-2** `010200:65-71` (and `010100:70-89`) — minor — an unknown body key (`capability`, `stepUpAt`) raises `INVALID_REQUEST` (400) while BE03c 390 and the 422 column of 1260 call a body unknown key 422 (`GovernedDecisionRequest` comment agrees). Precedent `017630:94-101` is identical and the Worker's `strictObject` parse refuses unknown keys with 422 before any RPC, so the SQL token is reachable only if the Worker forwards unknown keys. Fix direction: none in SQL; the Worker lane keeps zod as the 422 source; note in the RPC boundary that `INVALID_REQUEST` covers the SQL-side unknown key.
- **F-3** `010100:239-241` — minor (inherited spec gap) — revoking an already-revoked assignment raises a bare `CONFLICT` with no reason token. BE03c 1304 requires every governed 409 to carry one closed `details.reasonCode`, and the CMS-03C-08 list (`refusals.ts:158-165`) has no token for this case; 03b `017620:298-300` is identical. The author's RPC boundary lists the case under `CONFLICT` but the report says "No BOUNDARY". Why it matters: the Worker lane cannot build a contract-valid 409 body for it without a decision. Fix direction: root records it as a spec gap (add a token, e.g. reuse `review_not_open`/`assignment_exists`, or state that a reason-less 409 is permitted for a re-revoke, as DEC-140 permits for cursors); no SQL change until decided.
- **F-4** `A/020-create.sqlinc:42-45` — minor (weak oracle) — "emits no event" is asserted only as `outbox_events where aggregate_id = review = 0`; an event emitted on the subject aggregate would pass (the decision suite checks both aggregates, `D/030:40`). Fix direction: compare the global outbox count before/after the create (the `s12ga_snap` digest already carries it).
- **F-5** `D/050-invalidation-gates.sqlinc:13-15` — minor (assertion text over-claims) — the message says an expired assignee "still reads the review" but only the decide refusal is asserted; no read with an expired-but-active assignment exists in any suite (the reads suite covers revoked only, `R/020:127`). Fix direction: add a `s12ga_get` for `rev2` on R8 after the sleep asserting `ok`, or reword.
- **F-6** report `## Runs` rows 4–5 — minor (process) — three assertions (plans 67/56/55 → 68/57/56) were added between run 3 (GREEN) and run 4 without a recorded RED, and all seven mutants were applied in one run, so per-mutant attribution is by reasoning rather than observation. The attribution is consistent with the not-ok set. Fix direction: none required for promotion; future lanes run one mutant per run or record which assertions were added post-GREEN.
- **O-1** (observation, spec) BE03c 1347 lists positions 1 and 5 for CMS-03C-08, but a revoke that invalidates must update the subject row, so position 3 must precede 5; `010100:170-172` does exactly that (correct, conservative) while the spec row omits it. Fix direction: amend 1347 to "3 the subject version row (`FOR UPDATE`, revoke only)".
- **O-2** (observation, spec, inherited) a confirmed member with no read scope is 404 from the decision command (`010200:100-103`) but 403 from the detail read (`010300:54-57`); each matches its own row (169 vs 172) and the 03b precedent, and the detail therefore discloses existence to any confirmed member. Not a lane defect.
- **O-3** (observation) the queue reuses the Vault secret `cms_editorial_history_cursor_active` with a distinct HMAC domain `cms-03c-11`, the shared-envelope design of `20261005010400`; domain separation keeps a 03b cursor unverifiable here. Not tested cross-domain (the MAC check is baseline-tested); the key name is a naming smell only.

## Answers to the scrutiny list

- Separation of duties: the decision path has its own ordered check (`010200:165-167`) and the guard a second; the author's "unreachable through public commands" is correct (F-1).
- Specialist slots / strictest-policy counting: the basis is frozen at submit (`300300:246-322`), the decision consumes `required_decision_count`/`required_capabilities`, derives the slot exactly as BE03b 1865 (7) and (9), and a changed basis is caught by `cms_governed_frozen_status` (BE03c 1322). Verified by R3/R4/R7 flows and M3.
- First rejection ends the review: `010200:229-230`, `246-255`, guard `300600:87`; R2/R5.
- Committed refusal envelopes stored as 409: conformant with BE03c 1502 ("the `invalidated` outcome is a committed 409"), BE03b 1865 (4), DEC-159 (2) and the 03b producer (`017630:220-225`, `293-296`); `details: {}` is what the frozen `plainDetails('dependency_changed')` permits (03b's `dependencyHash` member would violate it).
- Expiry bounds: `010100:206-221`; grant rows are unique per `(organization, person, capability)` (PK, `20260901040000:249-262`), so the unordered `select into` is deterministic; eligibility (`active`, dates) is proven before the bound is read.
- Revoked assignment loses decide and read: scopes require `state <> 'revoked'` (`300500:103-110`); decide → 404 (`D/050:16-17`), read → 403 (`R/020:127`), queue → unlisted (`R/030:64-71`).
- Queue cursor: bound to actor, party, scope, state, subjectKind, limit (`010400:92-94`), the 03b members plus `subjectKind`; order and limits as specified; Vault key reuse per O-3.
- MFA helper reuse: `cms_editorial_step_up_instant` (`20261005017600`) after structure, before the review read and the reservation, both writers.
- Lock order: as above; revoke takes the subject before the review.
- Definer closure and grants: proven by the GREEN run and the 42501 assertions; no grant widened.
- Non-vacuity: all 181 read; residual weak oracles F-4/F-5 only.
- Forgery confinement: the labelled tenure forgery is fixture provisioning (setup and one labelled mid-suite control); no governed row is forged; the pool's `auth.users` inserts are the S09 account pattern.

## Requests to root

1. Promote the nine migrations in timestamp order (function-only; no populated-DB witness needed), then canonical `db:verify` and `db:types`.
2. Record F-3 as a spec gap for CMS-03C-08 (re-revoke 409 token) before the Worker transport lane maps `CONFLICT`.
3. Hand the author's `## RPC boundary` to the Worker lane together with F-2 (SQL `INVALID_REQUEST` for unknown keys; zod is the 422 source) and the `kind: 'refusal'` branch.
4. Optional test hardening before the next re-run (F-4, F-5); not required for promotion.

VERDICT: CLEAR
