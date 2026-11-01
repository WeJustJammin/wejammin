# Review R2 report (`claude_s12_review_r2`) — dec194, dec195, locale-gate, dec197, dec202 WIP migrations and their pgTAP

Status: COMPLETE (checkpoint 2; checkpoint 1 recorded scope and evidence base).
Reviewer: independent, read-only. No SQL, docker, supabase, pgTAP or race module was run by this reviewer. Evidence = file bytes, existing TAP
logs (cited by name and line), and one throw-away Python reconstruction of the live `cms_create_entry` source (scratchpad only, not in the repo).
HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`, worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.

## Verdict per lane

| Lane | Migrations | Verdict | Why |
| --- | --- | --- | --- |
| dec194 | 6 (`190000`–`190050`) | **FIX FIRST** | No functional defect found (lock order, serialization, replay, atomicity, ACLs all verified). But the new `cms_taxonomy_merge_recoveries` table contradicts four canonical S09 `cms_` family pins (R2-01) and the spec text it implements (R2-02); both must be decided before the name and shape become immutable. |
| dec195 | 2 | **PROMOTE** | Matches the BE03c `cmsRelatedContentRead` rows and DEC-195 exactly; read == CMS-03C-05 write answer; no lock, no write. |
| locale-gate | 2 | **PROMOTE** | Matches DEC-192 and BE03c 1556/1564; anchored evaluator patch is guarded, reversible and composes with the dec193 patches. |
| dec197 | 1 | **PROMOTE** | Faithful to BE04a:470 and BE04c:345-346/353; default-deny verified; the replay witness copy is byte-equal and guarded by a parity test. |
| dec202 | 2 | **PROMOTE** | Anchored patch reproduces the full live body (verified independently); relation2 → default3 → schema4 order and resolver policy match BE03b 1724-1732/1749. |

Counts by severity: BLOCKER 0, MAJOR 2, MINOR 3, NIT 4. Every finding is a promotion-hygiene, scale-hardening or documentation issue except R2-01, which can change SQL.

To flip dec194 to PROMOTE: decide R2-01 (option A or B) and record the R2-02 ratification. R2-03 and R2-04 change SQL bytes (the pre-filter and two comments) and R2-05 adds assertions; they do not block, but they are cheapest in the same re-stage as option A, because the migrations are immutable afterwards.

## Scope

13 WIP migrations (SHA-256 of the bytes read). Every one is byte-identical to the file staged by the newest all-WIP run
`.lane-logs/alt-staged-pattern-updates+dec193+dec194+dec195+locale-gate+dec197+dec202+dec205+dec206+governed-recheck+repair-b-143013-2012254.manifest`
(checked file by file: 13/13 MATCH; 75 WIP + 461 promoted, 536 distinct timestamps, 0 duplicates across promoted and every WIP lane):

```
8c9f94b119ca71dd86fd27c0f0b594349b9ecf36a063f7ec7565445bd80bdbb4  supabase/migrations-wip/dec194/20261014190000_cms_reconcile_taxonomy_merge_converge.sql (90 lines)
724320cf4770abb7affe681ad4f294b3fbe84ad44f2ddc01d09e668ba31ac198  supabase/migrations-wip/dec194/20261014190010_cms_reconcile_taxonomy_merge_converge_public.sql (43)
1f9ea5165c3a0a7b00bab4dea82677adecf24d0de9c7d44bd5030018787340f5  supabase/migrations-wip/dec194/20261014190020_cms_taxonomy_merge_recovery_identity.sql (58)
e1e60a3a3a0f54531bcac770312f1ae587ce09934e1b6e341602ebb16767ef99  supabase/migrations-wip/dec194/20261014190030_cms_taxonomy_merge_request_serialized.sql (178)
8a67155582f1b874a93369e1babe39de000dfe7082b56596b2e4fe460d52be3d  supabase/migrations-wip/dec194/20261014190040_cms_taxonomy_merge_handler_serialized.sql (129)
b1cb29a4f8dc3e1652b224ab971c15585d4ab86bae6e770ef24b26671935d47c  supabase/migrations-wip/dec194/20261014190050_cms_taxonomy_merge_recovery_serialized.sql (97)
db1b4b5f179e309843a6dda6d97e9a1a4dd6c052bc0d52e5eaf9d818326739c4  supabase/migrations-wip/dec195/20261014200000_cms_get_related_content.sql (150)
13700443f52eb7c436438ba66ba0c2132a3d2a78bf0ec0fd67d3f09ef30bdd0b  supabase/migrations-wip/dec195/20261014200010_cms_get_related_content_public.sql (43)
75ad1184e77d46dc723809e7c6dee09198dca115d4ce6fa471f12e8b07835dbd  supabase/migrations-wip/locale-gate/20261014050600_cms_locale_no_fallback_gate.sql (93)
2718715bdd09381f892631fc933d53ccc623460aabc00af24667f029b6a95254  supabase/migrations-wip/locale-gate/20261014050700_cms_preflight_locale_provider.sql (91)
1117a83f72496887c6b36d100b7fa2635aa4673d699841932291967b1516f3b6  supabase/migrations-wip/dec197/20261016030000_delivery_receiving_contracts.sql (176)
442cdfb9f3d366976ba24cf8140c139b489a45e93cfbaf3e9810c0c1963e9db8  supabase/migrations-wip/dec202/20261022010000_cms_entry_default_template_helpers.sql (100)
b1d23e7d456c415a48a5682ac533bd10b1f15de338dab4a32f28fbfc54c4eec8  supabase/migrations-wip/dec202/20261022010100_cms_create_entry_default_template.sql (141)
```

All ≤ 300 lines, LF only, no tabs, final newline, one `begin;`/`commit;` each, no `TODO`/`BOUNDARY`.

pgTAP, race harnesses and shared fixtures read (SHA-256 of the bytes read; the full list with every fragment is in the scratchpad hash list
`/tmp/claude-1000/-home-rob-Projects-WeJammin/b9132970-591d-437a-89d9-dc4857be5456/scratchpad/scope-hashes.txt`):
`supabase/tests/phase_02_slice_12_dec194_sweep.sql` (`4bb780bd676603ccd2e3b4fba1bc9f0152378c55748a029e8f122b9c5dfd7d12`) and `phase_02_slice_12_dec194_sweep/`
(`000-helpers a7ebf7d8…`, `010-surface e8071389…`, `060-idempotency-expiry da37adfe…`, `070-atomicity 0e4c43bb…`, `090-race-fixture 26131d66…`);
`phase_02_slice_12_dec194_sweep.race.mjs` (`612d11bc…`), `phase_02_slice_12_dec194_outer.race.mjs` (`a5544783…`);
`phase_02_slice_12_related_content_read.sql` (`326fc799…`) + fragments; `phase_02_slice_12_locale_gate.sql` (`4a6c2611…`) + `001-gate.sqlinc` (`2ac0a415…`);
`phase_02_slice_11_delivery_receiving.sql` (`75d0f8e1…`), `…_security.sql` (`240fe16b…`) + fragments (`080-forward-migration.sqlinc` = `1117a83f…`, byte-equal to the dec197 migration);
`phase_02_slice_12_entry_default_template.sql` (`068d5cb198e079424f2793b9c6fee2c0affbee0d8c90766a7192de92ef03eb2b`) + `030-policy-gate.sqlinc` (`60315d8a…`) and the `…_lock/020-race.mjs` (`638cf169…`).

Specs and decisions: BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` (`b47b0567c3f9f6b1445283c835f675102d1f00fb77ba7470c184aa2c0728766c`),
BE03b (`f65889b03b110f18b68393c7cfd9d052466ed1f6be2e9c30683842b04b941580`), BE04a (`4965e2aa65861d6794096aa063b00242fac174eabc7fe12bd5056a92bcdae94b`),
BE04c (`c031910979a773e08bd1a6c8ede20623692489f91c47331333ad2aa8b61b846d`), `.memory/wiki/decisions.md` (`2100e85e9da6f5653f79a2723aa069977c461adfd4d8eca06e1b883bde1e7f85`;
DEC-192 line 5297, DEC-194 5314, DEC-195 5322, DEC-202 5353, DEC-197 5415). Lane evidence: `lane-dec194-sweep-report.md`, `lane-codex-dec194-{durable,green,race,outer-race,rpc-isolation}-*.md`,
`lane-dec195-read-report.md`, `lane-locale-gate-a-report.md` + `review-locale-gate-a.md`, `lane-codex-dec197-sql-red-*.md`, `lane-dec202-report.md`, `CODEX-NATIVE-VALIDATION-2026-10-16.md` (ledger lines 128, 147-148, 171, 179, 188).

Runtime evidence relied on (not re-run): `alt-staged-dec194-050750-3283868.tap` (dec194 suite 135/135 on the six-WIP cluster; `…050004-3232098` and `…043301-3047597` also 135/135);
`…repair-b-143013-2012254.tap` (S10+S11, 177 files / 6,277 tests / 0 `not ok`, includes `delivery_receiving*`, `projection_state*`, `criteria_publish_gates`, `helpers_preflight`, `preflight_registry_schema`);
`…repair-a-135135-1815604.tap` (S12, 72 files / 13,988 tests; only `related_perf` #17 failed, a load-sensitive write/projection p95 unrelated to these lanes; the dec194, dec195, locale-gate and entry-default-template suites passed);
ledger line 128 (six-WIP producer race: twelve concurrent scenarios plus an outer-merge race PASS) and 188 (unchanged Worker HTTP composite, all three producers observed `read committed`).

## Findings

| ID | Sev | File:line | Evidence (short) | Spec | Proposed fix |
| --- | --- | --- | --- | --- | --- |
| R2-01 | MAJOR | `dec194/…190020_cms_taxonomy_merge_recovery_identity.sql:9-28`; tests `phase_02_slice_09_p240_authority.sql:219-223`, `phase_02_slice_09_evidence_misc.sql:223-232`, `phase_02_slice_09_schema/012-trigger-catalog.sqlinc:33-39`, `phase_02_slice_09_sec2_all_schema_definer_rls.sql:111-113` | The table is `cms_`-prefixed but has none of the family shape (no `id/owner_id/state/version/created_at/updated_at`, no BEFORE-row triggers, role-scoped SELECT/INSERT policies instead of the `cms_rpc_context_valid()` gate). The all-WIP TAP `.lane-logs/alt-staged-pattern-updates+dec193+dec194+dec195+locale-gate+dec197+dec202-023928-3189723.tap` fails four canonical pins on exactly this table (lines 5437, 7028, 11274, 11428). | AC-015 (IA envelope), AC-181 (RPC-gate policy form, pinned forced-table set), AC-215 (BEFORE-row guard coverage) | Decide before promotion (the name is immutable): rename to a non-`cms_` private name, or keep it and amend the four pins with documented exceptions. See details. |
| R2-02 | MAJOR | BE03c `:1542` (“writes nothing else”), `:1486-1498` (lock-order table), `:1582` (“exactly fifteen” tables), `:1612` (RPC list); AC-261 `phase-02-slice-12.md:4175`; runbook `cms-taxonomy-merge-converge.md:95`; DEC-194 text `decisions.md:5314-5320` | The implemented design adds a durable private table and a per-party advisory mutex that no normative text mentions; four statements are now false or incomplete. | BE03c `Merge convergence recovery (DEC-194)`; `Slice 12 lock order (DEC-157, DEC-180)`; `Database Schema` | Record the table and mutex as an implementation-tier ratification (raw record via `flushEntry`, never a hand edit of the derived wiki) and cascade the five texts. No SQL change. |
| R2-03 | MINOR | `dec194/…190050_…recovery_serialized.sql:28-34` | The routing scan takes one transaction-scoped advisory lock for every party that has ever had a `failed` job of the type and holds all of them to commit, before any eligibility test. `jobs` rows are never deleted (`guard_jobs` refuses DELETE, `20260830100000_persistence_authority.sql:275-291,364`), so that set only grows and is locked again every minute. | BE03c `:1542` (“at most one Job per party per 15 minutes”) | Route only parties whose current failed head is unmarked (lock-free necessary condition); keep the post-lock re-selection as the authority. |
| R2-04 | MINOR | `dec194/…190030_…request_serialized.sql:1-23,76-78,143-144,157,168-169` | The two edits that add the mutex to the outer merge and to the late enqueue carry no comment, and the file header and both `comment on function` texts still describe only the pre-DEC-194 body; the lock-order rationale lives only in a lane report. (`190040` is documented inline and in its function comment.) | BE03c `:1482-1500` (every writer states its positions) | Add a short DEC-194 comment at each insertion and extend the two function comments; comment-only change. |
| R2-05 | MINOR | `phase_02_slice_12_dec194_sweep/010-surface.sqlinc` (no assertion on the new objects) | No test asserts the posture of `cms_taxonomy_merge_enqueue_lock(uuid)` (owner, empty `search_path`, no API-role EXECUTE) or of the new table (forced RLS, no API-role privilege, definer holds exactly SELECT+INSERT, FK action, no FK from R). Only the generic `cms_`-family catalog scans touch the table, and they currently fail on it (R2-01). | BE03c `:1619` (“positive/negative tests”), AC-261 | Add the assertions listed below to `010-surface.sqlinc`. |
| R2-06 | NIT | `locale-gate` 050600/050700 (sort before 59 promoted files), `dec194` 190000-190050, `dec195` 200000-200010, `dec197` 030000 (each sorts before the promoted tip `20261020203606` only); `infra/workflows/apply-hosted-migrations.sh:47` | Fresh resets and the staged runner apply the interleaved order that was tested. `supabase db push` (no `--include-all`) refuses to insert a file before an already-applied remote version. No shared database has any of the promoted S12 files today (they are uncommitted), so this is a sequencing rule, not a defect. | n/a (process) | Promote all lanes in one commit and push the whole set to any shared database in one go; never deploy a promoted subset first. |
| R2-07 | NIT | `dec197/…030000_delivery_receiving_contracts.sql:169-174` | `projection_consumer_state` has no index led by `projection_id`; the new direct FK is checked by a sequential scan when a projection row is deleted (revoke/purge). The composite FK is covered by the unique `(publication_id, projection_id, consumer)`. | BE04c `:346` | Optional forward migration `create index … on projection_consumer_state (projection_id)`. |
| R2-08 | NIT | `supabase/tests/phase_02_slice_12_entry_default_template/` (4 files) and `…_lock/` (6 files); `lane-dec195-read-report.md` | Directories with more than two files have no README (extensibility rule); the dec195 lane report stays at “IN PROGRESS checkpoint 3 / Files (none yet) / Test corrections (none yet)”. | `extensibility.md` Directory Documentation | Add the two READMEs; add a closing section to the dec195 report (SHA-256 list is in this report). |
| R2-09 | NIT | `phase_02_slice_12_dec194_sweep/060…070`, `README.md` | Labels/headers still say “RED”, “CONDITIONAL (requires the association table)”, “current WIP” although the table now exists and the suite is 135/135. | n/a | Reword when the pin work touches the folder; no behavior change. |

### R2-01 details (MAJOR, dec194): the recovery table breaks four canonical `cms_` family pins

`190020:9-13` creates `platform_private.cms_taxonomy_merge_recoveries(failed_job_id uuid pk → jobs on delete cascade, recovery_job_id uuid, requested_at timestamptz)`,
`:15-25` forces RLS and adds one SELECT and one INSERT policy `to wejammin_cms_definer`, and `:19` grants the definer SELECT+INSERT. The design is deliberate
(no guard may block the FK cascade, DEC-194 durable-admission brief) and I found no security problem in it. The problem is the name: these canonical pins treat every
`platform_private.cms_%` table as a CMS aggregate:

| Pin | Assertion | What the new table does | TAP (line in the 02:39 all-WIP log) |
| --- | --- | --- | --- |
| AC-015 `p240_authority.sql:219-223` | every `cms_` table carries `id, owner_id, state, version, created_at, updated_at` except exactly eight named tables | has none of the six; `have` lists `cms_taxonomy_merge_recoveries:created_at,id,owner_id,state,updated_at,version` as a ninth exception | #73 at 7028 |
| AC-181 `evidence_misc.sql:223-232` | every permissive policy has `qual` and `with_check` equal to `platform_private.cms_rpc_context_valid()` | a SELECT policy has no `with_check`, an INSERT policy has no `qual`: `have: 2 want: 0` | #44 at 5437 |
| AC-215 `012-trigger-catalog.sqlinc:33-39` | every `cms_` table has INSERT, UPDATE and DELETE each covered by a BEFORE-row guard except `cms_operational_alert_deliveries,cms_owner_initialization` | no triggers by design: `have` adds `cms_taxonomy_merge_recoveries` | #452 at 11274 |
| AC-181 `sec2_all_schema_definer_rls.sql:111-113` | the exact set of forced tables named by definer-owned functions is pinned | the reconciler names it; the only difference between `have` and `want` is this table | #6 at 11428 |

(The same run also shows `r8_api_surface` #4/#13/#14 failing because `cms_reconcile_taxonomy_merge_converge` (and the two pattern-update RPCs of another lane) are unclassified; that one is a plain list update, see Promotion prerequisites.)
Root already knows the S09 inventory pins are open (`STATE.md`, “S09 inventory pins … left for root after repairs”), but the three structural pins above cannot be refreshed
mechanically without weakening what they protect, so this needs a decision first.

Options (one decision, recommendation first):
- **A (recommended): leave the `cms_` namespace.** Rename to `platform_private.taxonomy_merge_recoveries` (policies `taxonomy_merge_recoveries_select/insert`). Precedent: the BE00/BE04 private tables
  `projection_consumer_state`, `route_manifest_version`, `publication_projection` carry no `cms_` prefix and so sit outside AC-015/AC-181/AC-215. Only two pins then change: the sec2 all-schema set (+ the table) and `r8_api_surface` (+ the function).
  Touch list: `190020` (table, policies, comments), `190050:42,74`, `dec194_sweep/000-helpers.sqlinc:213-319`, `060`, `070`, `README.md`, `tests/postgrest/support/phase-02-slice-12-dec194-isolation-probe.sqlinc`. The bytes change, so squash
  `190000` into `190050` at the same time (the first body is superseded two files later) and re-run once: the 135-assertion suite, the two race modules and the Worker HTTP isolation composite.
  Cost: re-earning the dec194 evidence on new bytes.
- **B: keep the name, amend four pins.** Add the table as a documented exception to AC-015 (ninth), AC-181 policy form, AC-215 named tables and the sec2 set. Cost: three generic invariants gain a carve-out for a non-aggregate; all existing evidence stays valid.

Recommendation: A. The pins exist so that a future `cms_` table cannot silently lack the envelope, the RPC gate or the guards; a job-recovery identity is not a CMS aggregate, and it is cheap to move now.

### R2-02 details (MAJOR, dec194): normative text that the implementation contradicts

- BE03c `:1542`: “It answers `{ requested }` … writes nothing else”. 190050 also inserts the Q→R row (`:73-81`).
- BE03c `:1582`: “03c persists exactly fifteen private … tables”. The 16th is the recovery table (AC-261 repeats “all fifteen 03c tables use forced RLS”).
- BE03c `:1486-1498` (Slice 12 lock order): the row `cms.taxonomy.merge_converge` says “the positions of the CMS-03C-03 merge it continues (1, 3 and 6)”; the outer merge (`190030:76-78`), the fenced continuation (`190040:42-44`) and the sweep (`190050:34`) now also take the per-party mutex, between position 1 and position 3 (the sweep takes only the mutex, parties in ascending id).
- BE03c `:1612` and AC-261 enumerate the named RPCs and omit `cms_reconcile_taxonomy_merge_converge` and (DEC-195) `cms_get_related_content`.
- Runbook `docs/runbooks/platform/cms-taxonomy-merge-converge.md:95`: “The sweep writes nothing else”; it is silent on the table and the mutex.
- DEC-194 (`decisions.md:5314-5320`) lists the downstream artifacts without the table or the mutex.

The design closes a real gap the original wording had (the receipt that makes “a replayed tick request nothing twice” expires after seven days, `lane-dec194-sweep-report.md` Open item 5), so the code is right and the text is behind it.
Fix: one implementation-tier ratification (raw record per `.claude/rules/memory-capture.md`), then edit the five texts above (and, under option A, use the final table name).

### R2-03 details (MINOR, dec194): lock fan-out of the routing scan

`190050:28-34` loops over `select distinct acting_party_id … where job_type = … and state = 'failed'` and calls the mutex helper for each row before testing anything. Transaction-scoped advisory locks are released only at commit and
each consumes a shared lock-table slot, so one tick holds one lock per party that has any failed job in `platform_private.jobs`, including parties already recovered, already at the 3-generation stop, or whose latest failure is long past.
Because `guard_jobs` refuses every DELETE (`20260830100000_persistence_authority.sql:275-291`), failed jobs are never purged: that set only grows, and the sweep re-locks all of it every minute. The loop stays correct
(the post-lock re-selection is the authority), but the lock set should be the candidate set. Suggested routing query (keeps the ascending party order the lock-order argument relies on):

```sql
select head.acting_party_id
  from (select distinct on (job.acting_party_id) job.id, job.acting_party_id
          from platform_private.jobs job
         where job.job_type = 'cms.taxonomy.merge_converge' and job.state = 'failed'
         order by job.acting_party_id, job.created_at desc, job.id desc) head
 where not exists (select 1 from platform_private.cms_taxonomy_merge_recoveries recovery
                    where recovery.failed_job_id = head.id)
 order by head.acting_party_id
```
(optionally also `and not exists (live job)`). A `pg_try_advisory_xact_lock` that skips a busy party would also work, but it changes the tested “producer-first recovery waits” behavior, so I do not recommend it now.

### R2-04 details (MINOR, dec194): the insertions are undocumented where they live

`190030:76-78` and `:157` add the mutex with no comment and `190030:143-144`/`:168-169` keep the old function comments; the header (`:1-23`) still describes only the CMS-03C-03 order. A reader of the promoted migration cannot tell why `merge` takes a lock before
`cms_reserve`, why the second call is reentrant, or that the position-1 authority must precede it. `190040` is documented (header `:1-7`, inline notes `:37,42,45,60,69,84,109`, comment `:120-121`) and needs nothing. Comment-only edits; re-stage once because the bytes change (fold them into the R2-01 re-run if option A is taken).

### R2-05 details (MINOR, dec194): add these assertions (pg_catalog only, no data needed)

1. `cms_taxonomy_merge_enqueue_lock(uuid)`: `prosecdef`, `proconfig @> {search_path=""}`, owner `wejammin_cms_definer`, no EXECUTE for `public/anon/authenticated/service_role` (same shape as the existing assertions in `010-surface.sqlinc`).
2. The table: `relrowsecurity and relforcerowsecurity`; no privilege for the four API roles; `has_table_privilege('wejammin_cms_definer', …, 'SELECT'/'INSERT')` true and `UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER` false; exactly two policies (select, insert), both permissive and scoped to the definer.
3. The key: `failed_job_id` is the primary key; its only FK is to `platform_private.jobs(id)`; `recovery_job_id` has no FK. Assert the FK action from `pg_constraint.confdeltype` only: a behavioral delete test is impossible because `guard_jobs` refuses every `jobs` DELETE (so the `ON DELETE CASCADE` is inert today, harmless, and matches “purging Q may cascade” if a purge ever exists).
4. Behavior already covered and worth keeping: `060` x1/x2 prove the association survives the audited TTL deletion of the receipt.

### What was verified and found sound (so root need not repeat it)

**dec194.** (a) `190030` bodies equal the promoted `20261014120500` and `20261014120300` bodies line for line except exactly three inserted lines (`cms_act_taxonomy_term`, only for `action = 'merge'`, before `cms_reserve`, after position 1) and one inserted line (`cms_request_taxonomy_merge_converge`); attributes, owner, ACL and comments carry over. `190040` equals the promoted `20261014120810` body plus the mutex, two extra claim fences and a final fence; no lost logic. (b) Lock order: authority(1) → party mutex → CMS receipt → vocabulary(3) → terms(6) for the merge; authority(1) → mutex → fence → capability → 3 → 6 for the continuation; the sweep takes only mutexes, parties ascending. I found no cycle between the three producers, a revocation, an activation, a non-merge term action or two concurrent sweeps; the late call in `cms_request_taxonomy_merge_converge` is reentrant (its only caller is `cms_term_apply_merge`, reached only from the merge). (c) Snapshot reasoning: the three deciding functions (reconciler, handler, outer merge) are VOLATILE plpgsql, so each statement after the mutex takes a fresh READ COMMITTED snapshot, and the STABLE helper they call (`cms_taxonomy_merge_work`) runs inside such a statement; the Worker HTTP composite recorded `read committed` for all three producers (ledger line 188). (d) The Q→R insert and the BE00 acceptance are one transaction on both fresh and replay paths; a marker fault raises `P0001 INTERNAL_ERROR` out of the RPC so job, outbox, audit and receipt roll back (pinned by `070`). (e) Both transports map `deadlock_detected`/`lock_not_available` to `CONFLICT` (`20261014120510:23`, `20261014120820:60`). (f) The wrapper `190010` equals the CMS-03C-19 wrapper pattern (`20261014070510`): definer-owned, `service_role` only, flag restored. (g) The spec’s rule is implemented: failed head per party, no queued/running job, remaining work, 15 minutes measured from the party’s last job activity (an interpretation, documented in `190000:7-14`), 3 consecutive failed generations, key derived from the failed job id, actor/party/correlation copied, `{ requested }` counts fresh acceptances only.

**dec195.** `cms_get_related_content` follows BE03c `cmsRelatedContentRead` row `:1632` and DEC-195 exactly: strict envelope (`entryId` + `context`/`correlationId`), UUID check before any existence answer, absent/foreign/tenant-invisible source = `NOT_FOUND` (one answer, byte-identical, pinned by `003`), visible source without author/editor assignment = `capability_missing` (403), then the current active rule or `{ rule: null }`; ids returned as stored; resource members identical to the CMS-03C-05 answer (same JCS hash recipe, version = current entry version); no write, no lock (asserted by `001`). `search_path` empty, owner definer, `revoke all … from public, anon, authenticated, service_role`, wrapper `service_role` only. The privilege-closure `do` block has precedent (`20261014020500`, `20261014110300`, `20261014140300`) and runs only constant callee names through `to_regprocedure` and `%s` of a regprocedure.

**locale-gate.** `cms_locale_no_fallback_gate`: phase whitelist `submit|schedule|publish|execute`; missing > stale > approval (`:63-74`); approval check only for schedule/publish/execute and only when a `cms_locale_variants` row names the revision; admitted effective states `approved|scheduled|published`; a null field list yields zero resolutions (the resolver `unnest`s it). `050700`: one anchor (`elsif registry_row.provider_key <> 'preflight.' || registry_row.category then`) occurring once, owner/attribute/comment guards, exact-inverse check, `pg_proc` row equality except `prosrc`; the branch is inserted before the registry row exists; registry row `version 2` is strictly newer than the reference-gate row (`cms_preflight_registry_z_newer_guard`). It composes with the dec193 patches (`041700`, `044400`) because their anchors remain intact after this insertion (their guards test for exactly one occurrence). The suite `001-gate.sqlinc` includes the evaluator dispatch (AC-241) and passes the phase through.

**dec197.** Column-for-column against BE04a:470 and BE04c:345-346: six and thirteen columns, every CHECK, both unique keys, six indexes (three per table, including the one-active partial unique), identity `by default` (so an ordinal rewrite reaches the guard’s diagnostic), `NO ACTION` FKs, direct FK created before the composite one, FORCE RLS with zero policies, runtime ACLs stripped from tables, identity sequence and guard (catalog-derived names via `quote_ident`, no user input), default-deny for the two new tables only, no policy, writer or seed. The guard enforces ready-only entry, `ready → active → superseded`, immutable id/ordinal/hash/generation time, write-once `activated_at`, no DELETE. The consumer FKs validate existing rows and abort the whole transaction on an orphan; the table has no writer today. `phase-02-slice-11-delivery-receiving-witness-parity.test.ts` pins the replay copy to the promoted-or-WIP bytes and handles the move at promotion.

**dec202.** Independent reconstruction: live `prosrc` = `20261005018040` body + the E7 tail of `20261010130000` (`tail_template` with `cms_content_entries`/`entry_id`). Each of the four anchors occurs exactly once; applying the four replacements yields exactly: the `default_template_id uuid` declaration; removal of the early `cms_lock_schema_version_shared(version_row.id)`; the new block (default-template lock → schema lock → re-read of the version row → gate) placed after the value loop and before the validator-ref checks; and `null` → `default_template_id` in the first-revision insert. The E7 tail, the completed-replay branch and every later statement are untouched; the order check in the patch (and EDG-09 in the suite) pins relation targets < default lock < schema lock < gate < `cms_complete`. The helper locks only a row of the acting owner (`owner_id` predicate inside the locking statement), the gate maps exactly NOT_FOUND→404, INCOMPATIBLE→422 `["/contentTypeVersionId"]`, WITHDRAWN→409 and re-raises everything else (EDG-06). The FOR SHARE on `cms_template_versions` works through the existing column grant `20261003120100:83`. The existing race modules that drive `cms_create_entry` are not affected by the later schema lock: `phase_02_slice_10_races/010-activation-serialization.mjs` parks the writer at its idempotency reservation or blocks it at position 1 (both before the patched region) and accepts `CONFLICT` or `VALIDATION_FAILED` for the loser (`:240-251`); `012-relation-target-race.mjs` parks at the revision insert (after every lock); `phase_02_slice_09_scan/010-entry-lock-race.mjs` holds the transaction after the call.

Note on BE03b (not a defect of this lane): rule 3 (`:1751`) says a create that waited and finds its version superseded is `VALIDATION_FAILED` at `/contentTypeVersionId`, while the position-4 row (`:1744`) and `cms_lock_schema_version_shared` give `CONFLICT`. The patch preserves the existing behavior (`CONFLICT` under the lock, `VALIDATION_FAILED` when the first unlocked read already sees the superseded state), which is what the S10 race accepts. Root may want one sentence in BE03b to say so.

## Test-correction verdicts

| Lane | Correction | Verdict | Reason |
| --- | --- | --- | --- |
| dec194 | `060`/`070`: association counts normalized to “baseline before x1 + 1” (root-authorized, `lane-codex-dec194-green` §Root-authorized SQL oracle normalization) | ACCEPT | Required: the original global `= 1` contradicted the durable history that `040`/`050` correctly create (Q→j3, j4→j5, j5→j6). Still exact (baseline + 1), still fails when the table is absent (`-1` vs `0`), and the per-job, digest and eligibility oracles are unchanged. |
| dec194 | Worker mocks added to `scheduled-manual-review-retry`, `cms-publication-schedule-sweep-wiring`, `cms-governed-activation-sweep-wiring`; RPC answer added to `production-idempotency-expiry-sweep`; `index-scheduled` counts 7→8 / 8→9 and RPC list (checked at `:38,86,181`, `:75,247`) | ACCEPT | Mechanical consequence of the new scheduled participant (BE03c `:1542`); no assertion removed. |
| dec194 | `cms-taxonomy-merge-converge-runbook.test.ts`: removed `toContain('BOUNDARY')`, the “what really drains an unconverged tail” test and the “nothing guarantees one” assertions; added positive documentation assertions (`:129-149`) | ACCEPT | The removed assertions pinned the absence of a recovery, which DEC-194 reverses; the new tests assert the RPC, tick file, event, metric, `service_role`, bounds and DEC-194. Remember R2-02: the runbook sentence “writes nothing else” must be amended with the spec. |
| dec195 | none recorded (`## Test corrections: (none yet)`); additive entries elsewhere: `core-contracts` component list, `r8_api_surface` classification list (`:163`) | ACCEPT | Additive and required by the new operation. The lane report was never closed (R2-08). |
| locale-gate | `001-gate.sqlinc` fr2 `execute` expectation `passed/-/0` → `failed/locale_variant_not_approved/1` | ACCEPT | DEC-192 and BE03c `:1556`: the approval check applies at execute; a draft revision is none of approved/scheduled/published. Stricter than before, not weaker. |
| locale-gate | 23 added assertions; follow-ups: fr3 `execute` stale case, fr7 approved before the lineage row, plan 60 | ACCEPT | Mutation analysis in `review-locale-gate-a.md` and the root diagnosis (57/3 mutant, 60 PASS) show the precedence assertions kill the intended mutants. |
| locale-gate | fr6/fr7 rows inserted with `h11r_raw_insert` (disables the table’s user triggers for the insert) | ACCEPT WITH NOTE | Slice 11 precedent (`phase_02_slice_11_helpers_effective_state.sql`); rows come from `s11_schedule_row`/`s11_publication_row`; the oracle is the E2 first-match, independent of the producing path; real-command coverage of the same gate exists in `criteria_publish_gates` #32/#33. Lane rules forbid disabling triggers, so when the shared helper is next touched prefer guarded builders like the `h11d_publication` the DEC-197 repair introduced. |
| locale-gate | S11 `helpers_preflight` (registry string, `no_fallback_missing`), `criteria_publish_gates` #32/#33, `preflight_registry_schema` (registry version 99, `version = 1` seed counts) | ACCEPT | Direct consequences of registry row `locale` v2 (BE03c `:1564`); the seed-count assertions now say what they always meant (the migration seeds 17 rows at version 1). |
| dec197 | `phase_02_slice_11_projection_state.sql` and `…_reads.sql`: missing-FK sentinel replaced by validated direct/composite FK assertions and orphan/cross-publication refusals; raw trigger-disabled publication inserts replaced by guarded builders (`h11d_publication`) with hash and review-evidence checks | ACCEPT | The sentinel’s own text says it must be replaced when the FK lands (`20261010165000` header); the replacements strengthen coverage and remove trigger-disabling fixtures. I did not review the unrelated hunks in `helpers/001-world`, `003-registry`, `helpers_manifest`, `helpers_references` (repair-b, outside R2). |
| dec202 | none (`lane-dec202-report.md`: original 132 assertions untouched; fragments `000`/`010`/`020` last modified 2026-10-17, before the lane); 9 added (`EDG-01..09`), plan 132 → 141 | ACCEPT | Additions only; the gate helper tests reach states no producer can create by pointing the gate at existing real template/version pairs (retired, blocked, superseded, incompatible) and forge no row. |

## Promotion prerequisites for root (not findings)

1. **S09 pins** (exact, from the 02:39 all-WIP TAP): `phase_02_slice_09_r8_api_surface.sql` add `cms_reconcile_taxonomy_merge_converge` to `r8a_supporting` and bump the “8 + 10 + N” text and count (tests #4, #13, #14); `phase_02_slice_09_sec2_all_schema_definer_rls.sql:110-113` add the recovery table; the other three pins per R2-01.
2. `pnpm db:types` after promotion (`platform_api.cms_reconcile_taxonomy_merge_converge`, `cms_get_related_content`).
3. `supabase/migrations/README.md` documents only the Slice 12 FIX set (`20261013100000`-`20261013100500`) and the `20261020203606` projection; the governed, pattern, taxonomy, locale, related and these five lanes have no section yet. Add one per promoted lane (directory-documentation rule).
4. Move the thirteen files (or twelve, if `190000` is squashed into `190050`) and delete the emptied `migrations-wip/<lane>/` directories; keep `080-forward-migration.sqlinc` byte-equal (the parity test accepts either location).
5. Run the DEC-202 race module (`entry_default_template_lock/020-race.mjs`, EDTL-C00/A/B) after promotion; the DEC-194 race and isolation evidence is in the ledger but is bound to the current bytes (re-run if R2-01 option A is taken).
6. Spec cascade of R2-02 and the AC-261 inventory text (add the dec194/dec195/dec205/dec206 RPCs and the new table).

## Limits

I did not run any SQL; behavioral claims rest on the TAP logs named above and on reading the bodies. The one script I ran is a read-only text reconstruction of the live `cms_create_entry` source and the four DEC-202 anchors
(`/tmp/claude-1000/-home-rob-Projects-WeJammin/b9132970-591d-437a-89d9-dc4857be5456/scratchpad/dec202-anchor-check.py`, SHA-256 `6c484bd6cb05b9aaeb8a1515b3e5b07434c76bfb88891264db14927d9032fe0b`; run from the repo root, it writes nothing). I did not review the Worker/Web layers of these lanes beyond the test corrections listed, the dec193/pattern-updates lanes (R1), or the native-tracing machinery of DEC-203 (held). Nothing in this report asserts hosted or production behavior.
