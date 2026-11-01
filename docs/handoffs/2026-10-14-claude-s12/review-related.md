# Independent review: lane `claude_s12_related` (CMS-03C-05 / CMS-03C-21)

Reviewer: independent, read-only, static only (no DB, no vitest). Target: `lane-related-report.md`
SHA-256 `6c84f6d11bd7dc9acffd46740eea54f52229dca5aa149866c6646b8638ad5a2b` (verified), brief `briefs/related.md`,
TAP `.lane-logs/alt-staged-related-164111-1340214.tap` SHA-256 `6398c48f9209eaa1af9a3a6c6c8b01f7d0d1db999ef46db48a6d59d155b03e01`
(verified). Item 5 of the template (file re-hashing) left to root as instructed. Paths are relative to the worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`; `BE03c` = `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`.

## Summary
The seven WIP migrations implement every CMS-03C-05 / CMS-03C-21 clause I could trace (table below); the root ruling
(hidden SOURCE 404, hidden/absent/ineligible TARGET uniform 422 `related_target_ineligible`) is implemented and tested
consistently in SQL and in the Worker. Exclusions win everywhere, recommendations never widen access, the bounds, the
registry, `eligibleCount`, the 128 cap, CAS, replay and "no event" hold. One major: two single-sample 300 ms
wall-clock asserts sit inside the gate suite. The rest are ratification items and report gaps.

## Findings (file:line — severity — problem — why it matters — fix direction)
1. `supabase/tests/phase_02_slice_12_related_public_targets/003-bound-and-bench.sqlinc:52,56` — major — two
   `cmp_ok(elapsed < 300 ms)` single-sample timings inside the functional suite. BE03c 1633 states a p95 target; one
   sample on a loaded host (the write path runs ~200 `cms_authority_origin` plpgsql calls, 060400:156-188) can go
   `not ok` with no defect and turn the canonical gate red (cf. memory "gates need a quiet host"). Move both timings
   to a non-gating bench fragment or emit them as `diag` with the value; keep lines 58-62 (96 targets, no excluded
   entry) in the gate.
2. `docs/handoffs/2026-10-14-claude-s12/lane-related-report.md` (Open items) — minor — route row 163 and AC-061/062
   say `cms.publication.changed.v1` is "consumed for invalidation"; no consumer exists in `apps/worker/src` and
   nothing is cached (060200 recomputes). Correct behaviour, but the report must record it as a BOUNDARY (the cache
   and its invalidation belong to the Shard 04 projection) so the AC-061 clause is not silently unproven.
3. `supabase/migrations-wip/related/20261014060100_cms_related_derived_candidates.sql:39-49` — minor (ratify) —
   `shared-terms` scores the SOURCE by its publish head for (locale, audience), else its draft. BE03c 1383 wants the
   draft "in an editorial preview": a preview of a source that is published for that pair with a newer draft will rank
   by the published terms. The three-argument signature (BE03c 190) cannot carry the mode; root must either accept
   this proxy (decision 6) or amend the spec/signature. Not fixable inside the frozen signature.
4. `supabase/migrations-wip/related/20261014060400_cms_curate_related_content.sql:226-228` — minor —
   `contentHash` covers `{pins, exclusions, derivedRule{key,version}}` and omits `maxCandidates`; two rule sets that
   differ only in the bound hash identically. Include `maxCandidates` now (the hash recipe is contract-visible and
   hard to change later).
5. `apps/worker/src/cms-composition-production-related.ts:108` with
   `supabase/migrations/20260902080000_content_schema_registry_authority.sql:195` — minor (inherited) — the frozen
   contract `CmsUuidSchema = z.uuid()` admits upper-case hex (its own dedupe lower-cases), `cms_valid_uuid` is
   lower-case only, so a contract-valid request with an upper-case pin reaches the DB and is refused 422 at
   `/pins/{n}` (060300:48). Platform-wide, not this lane's design; lower-case the ids in the adapter before dispatch.
6. `supabase/migrations-wip/related/20261014060400_cms_curate_related_content.sql:134-136` — minor (ratify, not in
   the author's list) — an `archived`/`held`/`deletion_pending` SOURCE is `INVALID_TRANSITION`, which the Worker maps
   to 409 `RELATED_CONTENT_VERSION_CONFLICT` with empty details (`related-content-details.ts:73-82`). Spec-silent;
   the browser sees an unexplained 409. Root to confirm, or choose 404 (conceal) / a typed token.
7. `supabase/migrations-wip/related/20261014060100:39-47,56-61`, `060200:88-92`, `060350:144-151` — minor —
   the lineage-head predicate (max `version` per (entry, locale, audience), `action='publish'`) is re-implemented
   three times beside the existing `cms_lineage_head_observation` (20261005017590:151). Extract one predicate
   (extensibility rule). Also `heads` (060100:56-61) scans every row of the (locale, audience) pair across all
   entries; `cms_publication_versions_lineage_head_idx` needs an `entry_id` prefix, so this is a full scan per call
   at scale — acceptable for the 300 ms bench, note for Shard 04 load.
8. `.memory/pipeline/progress/slices/phase-02-slice-12.md:1902` (AC-062) — minor (spec text) — "duplicate pin
   (409 RELATED_CONTENT_VERSION_CONFLICT)" contradicts AC-036 / BE03c 385 and the frozen contract (`pin_duplicate`
   = 422). Implementation follows 385 (060300:50-51, test 005:32-35). Record for the cascade text fix.
9. `supabase/tests/phase_02_slice_12_related_content/001-world.sqlinc:184-202`,
   `..._public_targets/002-recompute-and-ties.sqlinc:66-86` — minor (root ruling on lane-rule letter) — fixture
   mutations go through `pg_temp.h11_raw_exec` (`phase_02_slice_11_helpers/000-helpers.sqlinc:126-148`), which runs
   `ALTER TABLE … DISABLE TRIGGER USER` for one statement and re-enables on success and on the exception path.
   Confined to setup; the only guard bypassed is `cms_immutable_guard` on `cms_publication_versions` /
   `cms_content_entries`, and no assertion in either suite depends on those rows' immutability (the tie tests depend
   on `created_at` ordering only, 060100:86-87; the rule table's immutability is asserted separately, 004:66-73).
   Lane rules say "never disable triggers"; the Slice 11 helper suites use the same helper, so precedent exists.
10. `apps/worker/src/cms-composition/related-content-routes.ts:134` — minor (inherited, frozen route) — the Worker's
    own 403 carries `CAPABILITY_REQUIRED`, an upper-case token outside the closed lower-case list of BE03c 1304. The
    lane changed only the capability set (diff +3/-1); flag for the owner of the route.
11. Report claims — minor — "Worker 73 tests in related files": static count of the eight `*related*` test files is
    62 `it` blocks (`it.each` expanded to 5); I cannot run vitest, so root should re-run with `--reporter=verbose`.
    "eslint and tsc clean" is unverifiable statically.

## Spec conformance (clause → implemented → tested)
| Clause | Implemented | Tested |
| --- | --- | --- |
| 163 request → 201 `RelatedContentResource` | 060400:219-238; routes.ts:228-234 (201, ETag) | content 003:19-41; production-related.test.ts:361-372 |
| 163 author/editor with source assignment | 060400:129-133 (`cms_authority_origin` under `cms_lock_entry_authority`) | 006:93-100,112-113 |
| 163/1381 hidden source 404 (root ruling) | 060400:123-128 (absent, other tenant, other acting party) | 006:88-92,114-115; Worker test 283-298 |
| 385/1381 ineligible/hidden/absent target uniform 422 | 060400:164-191 (absent, self, inactive, other-owner, unreadable → one token, all pointers) | 006:25-66 (six kinds byte-identical); rpc.ts:19-22,61-70; typed-refusals:62-89 |
| 163 visible source without edit 403 `capability_missing` | 060400:130-133; details.ts:67-72 | 006:94-98,105-106; typed-refusals:107-114 |
| 163 BE00 order, CORS, CSRF, strict JSON, 60/120 per min, 15 s, no-store | routes.ts:82-198 (pre-existing, frozen) | admission/envelope suites (pre-existing) |
| 163 key + If-Match = entry version, CAS, replay | 060400:94-98,139-145,148-152,209-214; `cms_reserve`/`cms_complete` precedent | 003:66-82; 007:9-33; 005:78-86 |
| 163/385 unique pin/exclusion, ≤32/≤64, overlap | 060300:41-77; UNIQUE(source,target,mode,version) + 060350 versions | 005:32-50; 004:19-30 |
| 386 registry `shared-terms`/`same-type-recent` v1, reasonCode equality, `maxCandidates` 1–128 | 060000:23-45,62-74 (CHECK); 060300:88-127 | 002-shape:7-18,54-78; 005:52-75 |
| 387 expectedVersion 400/409 | 060400:94-98 (400), 148-152 (409) | 005:82-86; 007 |
| 1381 append-only replacement, pins as `position` | 060350:40-117 (revoke gone/moved, add new, derived pair) | 004:8-64 (exact histories), 004:66-73 (no UPDATE/DELETE) |
| 1383 candidates = eligible public targets, not source/excluded/pinned, same type for `same-type-recent` | 060100:62-73 | 001:71-129; 002:95-111 (ties) |
| 1383 ranking: shared active terms desc, head `created_at` desc, id asc; `maxCandidates` bounds derived only | 060100:74-94 | 001:79-83,99-109; 002:103-110; 002:34-35 |
| 1383 `eligibleCount` (draft locale, most recent active publication's audience, 0 derived when none, ≤128) | 060350:121-160; 060400:207-208 | 003:84-98; 006:77-78; bench 003:34 |
| 1385 pins first in position order, public eligibility, derived in rank order, exclusions removed, refill, ≤128 | 060200:72-106 | 001:53-69,85-93,120-124; 003:31-42 |
| 190 read-only, recomputed, never stored, no wrapper/route | 060200:31 (STABLE), 114-118 (no API-role execute) | 002-recompute:4-24,43-59; 002-shape:87-95; no-public-targets-route.test.ts |
| 1337-1340 lock order 0/1/2/4; 1357 typed deadlock, key reusable | 060400:123-199; 060500:27-32 (sub-transaction rolls the reservation back) | 007:37-50 (static source assertions, labelled; race module is root's) |
| 1432/1447/1452 schema delta, grants, forced RLS | 060000:59-80; 060100:100-112; 060200:114-118; 060300:134-141; 060350:167-176; 060500:41-50 | 002-shape:20-23,83-118 |
| 1510 transaction order, audit, no outbox | 060400 steps 1-9; 215-217 audit only | 003:60-65 (outbox delta 0), 005:89-93, 006:124-127 |
| 1610 test list for 05/21 | — | every item present except "publication invalidation" (finding 2) |
| 1633 64 targets < 300 ms RPC | — | 003:44-57 (finding 1) |
| 190 callers (Shard 04 projection, S11 recheck); AC-063 Web form; AC-263 metric | not built, other lanes (report says so) | — |

Scrutiny items from the brief, verified: exclusions win at write (060300:68-71 overlap refused; 006:68-78 archived/held
may be excluded) and at read (060200:52-57,97,102 → derived receives `excluded_ids`); the projection lists only entries
with lifecycle `active`, same owner party, head `action='publish'` (equivalent to "active publish row": CHECK
`(action='publish') = (state='active')` and UNIQUE(entry,locale,audience,version), 20261005017080:62-66,85) — an
editor's inability to read c6 never changes the public list and c6 cannot be pinned (006:35); pins ≤32 ordered,
exclusions ≤64 (060300:41-42,61-62); `maxCandidates` bounds derived only (060100:93; 002:34-35); 128 cap with pins
first (060200:79-106; 003:36-41); CAS on the entry aggregate with FOR UPDATE held through the write; replay returns
the stored response byte-for-byte and writes nothing (003:72-82); refusals leave no receipt (005:93, 006:126-127); no
outbox row at all (003:64-65).

## Design decisions (author's 1-10): rulings
1. ACCEPT. `max_candidates` is required to bound derived candidates at projection (1383, 1385) and 1432 names
   `cms_related_rule_valid`; upper-case storage is forced by the existing CHECK (20260927310000:64) and lower-cased
   on output (060200:99); `MANUAL_PIN`/`MANUAL_EXCLUSION` never leave the DB (pins project `reasonCode: null`).
2. ACCEPT. `cms_authority_origin` requires grant + active assignment on the entry (20260928000000:63-76); the
   platform has no owner-party read scope; mirrors `cms_relation_target_visible` (20261005011600:236-262).
3. ACCEPT. `held`/`deletion_pending` are the only pre-Slice 16 hold representation (20261005017510 header; lifecycle
   CHECK 20260926090000:33-34).
4. ACCEPT (see Scrutiny): head = max version, `publish` ⟺ `active`.
5. ACCEPT. Dense 0..n-1 satisfies the contract's strictly-increasing-within-source refine (related-public-target.ts:89-97).
6. RATIFY WITH CAVEAT — finding 3.
7. ACCEPT; "eligible pins" = every pin (all passed D11 at write). Root may want this reading recorded.
8. ACCEPT except `contentHash` recipe — finding 4. `id` = entry id and `version` = next If-Match operand are coherent
   with 1381 ("`If-Match` is the source entry `version`") and tested (003:24-27, 004:27,37).
9. ACCEPT (ratify). 385-386 give the derivedRule row one 422; the closed list (1304) has no other 422 token for this
   operation; the typed token at `/derivedRule/reasonCode` is more useful than a bare VALIDATION_FAILED.
10. ACCEPT. Same raise/map shape as 20261013300800 (`capability_missing`) and the governed lane.
Unlisted decisions root should also see: finding 6 (archived source 409); self-exclusion accepted (060400:178-183
has no `<> entry_row.id`, spec silent, harmless); an ineligible pin's slot is not refilled beyond `maxCandidates`
(060200 comment line 11-12; 1385 "refilled only from the eligible derived candidates" is read as filter-then-rank);
CMS-03C-21 answers `[]` for an unknown source and does not gate on the source's own lifecycle (callers must).

## Security
AuthN before everything (`cms_actor` → UNAUTHENTICATED, 006:120). Concealment ordering: tenant/acting-party → 404,
grant/assignment → 403, lifecycle → 409, reserve, CAS, targets — a caller without edit learns nothing about targets
(006:104-106). Errors carry tokens and pointers only; `safeDetails` scrubs everything else (typed-refusals:134-150);
no ids, owners or reasons leak. Bounds enforced in SQL independently of Zod. Idempotency bound to actor, acting party
and body (`cms_reserve`, 20260930150000:67-105). Definer `NOBYPASSRLS` (20261003120000:31): CMS-03C-21 and the
candidate function rely on the caller's `app.cms_rpc` flag and answer `[]` without it (fail-closed; same as the
locale lane's `cms_resolve_locale_field`). Grants: private functions revoked from PUBLIC/anon/authenticated/
service_role, wrapper service_role only, empty `search_path`, definer-owned; rule table insert+select to the
definer only, forced RLS kept (002-shape:109-118). No PII in audit beyond actor ids (platform standard).

## Tests
Non-vacuous: exact ordered expectations (`c2,srcp,c6,c5,c3`), exact append histories, count deltas against
snapshots, six-way byte-identity for the uniform refusal, registry CHECK probes with a passing control. Fixtures:
publications through the real lineage producer; entries/revisions/assignments/terms hand-written and labelled
(same practice as the Slice 11 helper suites). Weak spots: 007:40-48 are regex-on-`pg_get_functiondef` assertions
(labelled static; concurrency is root's race module); 002-recompute:23-24 is tautological. The two replaced
stub-era Worker tests: the fail-closed-stub test was correctly superseded by the adapter tests; "no implicit allow"
keeps its three assertions but now proves "a throwing fetch is 503" rather than "the port is unavailable" — acceptable
and disclosed. No `.skip`/`.only`/TODO/`any` in the lane's files; TAP has 0 skip/todo.

## Conventions
SQL matches 20261013300800/300820 (envelope, `cms_actor`/`cms_acting_party`, exact keys, reserve/complete, audit,
revoke/grant block, `P0001` + token + DETAIL json). Files ≤300 lines (largest SQL 245, Worker 282; test file 392 ≤400).
READMEs present in both new test directories. Wrapper exception block (060500:27-32) is not in the 20261003120410
precedent but is required by 1357 and matches the locale lane's pending "deadlock → CONFLICT" ruling.

## Claims re-verified
Report SHA ✔. TAP SHA ✔, plans `1..172` + `1..75` = 247 ✔, 0 `not ok` ✔, 0 skip/todo ✔. Per-criterion tag counts
in the report match the TAP exactly (AC-276: 2 tests, unlisted). Worker count and lint/tsc: finding 11.

## Requests to root
Rule on findings 1 (placement of the timing asserts), 3, 6, 9; add findings 2 and 8 to the cascade list; re-run
the Worker suite verbosely for the 73-count. The lane's own request (SEC-2 / API-surface / schema inventory pins
after promotion) stands.

VERDICT: PARTIAL
