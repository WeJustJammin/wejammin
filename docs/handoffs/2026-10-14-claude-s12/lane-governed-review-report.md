# Lane: governed-submit independent review (checks 1 and 2)

- Date: 2026-10-14
- Reviewer: independent, read-only (Claude Fable 5.1 subagent). Did not author any reviewed file.
- Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e` (verified by `git rev-parse --show-toplevel && git rev-parse HEAD`).
- Status: COMPLETE. Static analysis only. No database, service, repo script, race module, pg_prove, pnpm or vitest was run; nothing was started or stopped. Only this file was written. Tools used: `sha256sum`, `wc`, `grep`, `sed`, `awk`, `ls`, `stat`, `git rev-parse`, `git ls-files`, `git status`, `git show`, and `python3` that only read files and printed.

## Scope

Finish the two checks the prior independent reviewer did not reach:

1. Thirteen Slice 12 migration digests vs every recorded baseline, plus reset-log application evidence.
2. Exact preservation of the original 48 governed assertions (main + QA020) through the real-foundation rewrite, reconstructed independently from Codex session logs; `plan(60)`; non-vacuity of the 12 added controls; no original assertion moved to weaker setup.

## Frozen manifest re-verified

All seven suite files and the author report hash exactly as briefed (`sha256sum`, `wc -l`):

| File | Lines | SHA-256 | Brief |
| --- | ---: | --- | --- |
| `supabase/tests/phase_02_slice_12_governed_submit.sql` | 295 | `318717a7f17bc2170f6d68994466ded43ef401b5db5ddb6e023d0436117c8253` | MATCH |
| `.../000-fixtures.sqlinc` | 214 | `3b25ff67e2a0a9fc309b78a79e4efbf2969b5db398e058fef2860831297380c5` | MATCH |
| `.../005-real-type-chains.sqlinc` | 173 | `d0b4d9850cc16d9994aebfd410b207284f5bd6768453e83fd95827edba2260b7` | MATCH |
| `.../010-projection.sqlinc` | 48 | `e123571fa3cda70e8f5bd5c400e67e6ccd407fcb7a82a4ff6c838a4a8cc585ba` | MATCH |
| `.../015-dependency-fault.sqlinc` | 152 | `7eaf30b07bb685e54fde6a7a877241ce806edab32f98c1dc59003886371123d5` | MATCH |
| `.../020-idempotency.sqlinc` | 137 | `d5226e03c37825bf95591423abe2f0c6fdd611cabaede605c876444d776b9285` | MATCH |
| `.../README.md` | 65 | `6ff451e0512001642597e5e20cd2bbcca996b0287579d72f9a167717b8a7ffaf` | MATCH |
| `docs/handoffs/2026-10-12-claude-s12/lane-native-governed-submit-report.md` | 445 | `67433be3f06eefa412293eddeb4621b08f847eba4b2a8bdcfed1695cbbabcb0b` | MATCH |

Include graph (from `\ir` lines; no include nests another): main → `support/jwt-claims.sqlinc`, `phase_02_slice_09_dec108/{00-helpers,01-actors,02-chain}.sqlinc`, `phase_02_slice_09_dec119/00-support.sqlinc`, `phase_02_slice_10_rpc/{000-helpers,001-fixtures}.sqlinc`, `phase_02_slice_11_helpers/{000-helpers,001-world}.sqlinc`, owned `000/005/010/015` and (main:288) `020`. All nine tracked shared includes are byte-identical to `HEAD` (`git show HEAD:<path> | sha256sum` = working tree); `jwt-claims.sqlinc` = `1e197105078c019461ea79ab891d08b5203b68edca7cfb8345896f6a12180984`, equal to the taxonomy report's recorded value (T:150). The five owned files are untracked.

## Check 1 — thirteen migration digests

All thirteen `supabase/migrations/20261013300*.sql` files are untracked (`git ls-files` returns none; `git status` shows `??` for each). Digests via `sha256sum`; line counts via `wc -l`.

Baseline discovery: python3 scanned every line of `docs/**/*.md`, `.memory/**/*.md` and `supabase/tests/**` for a 64-hex token on the same line as a `20261013300NNN` stamp, and separately for any 64-hex token equal to a current digest (to catch hash-only lines). A second pass looked for 8/10/12/16-hex prefixes of every current and pre-repair digest on lines without a full 64-hex token: zero hits — no truncated baselines exist in the tree.

Sources: T = `docs/handoffs/2026-10-12-claude-s12/lane-native-taxonomy-definition-report.md` (table :156–170, header "Frozen applied migration | Before = after SHA-256"); G = `.../lane-native-governed-submit-report.md`; S = `.../CODEX-STATE.md`; L = `.../CODEX-LANES.md`; P = `.memory/pipeline/progress/slices/phase-02-slice-12.md`.

| Migration | Lines | Current SHA-256 | Recorded baselines (source:line) | Result |
| --- | ---: | --- | --- | --- |
| `20261013300000_cms_governed_subject_lifecycle.sql` | 181 | `b94529716305457ee09b4a349bf05c2370f53b739e539f7bb878f29b59e7aba3` | T:158 | MATCH |
| `20261013300100_cms_canonical_domain_registry.sql` | 106 | `3a48b4f10929ed10af61f8523cb8857a2ddfbec2c165ec1dd1cd93d9952fefcf` | T:159 | MATCH |
| `20261013300200_cms_governed_review_tables.sql` | 255 | `84066aeff33448ceb6384fd2a056ef2f315a48cd48a29f7d06aafadb1189c252` | T:160 | MATCH |
| `20261013300300_cms_governed_subject_helpers.sql` | 353 | `0b25de2c0c620c3460871b851fe6b26f5e1fa9fc6f25ead1de19a01820b02862` | T:161 | MATCH |
| `20261013300400_cms_governed_frozen_status.sql` | 275 | `979d1e8150d027c87adb0a9af3be4a0370d0a08cee296aa824d01eabbaaa6059` | T:162 | MATCH |
| `20261013300500_cms_governed_review_support.sql` | 292 | `ce85cd2e7254d396c3bfff8146fb3357d3f3f4ff5e1014840baec0426f047eff` | T:163 | MATCH |
| `20261013300600_cms_governed_review_guards.sql` | 298 | `7d83807387958bd1db69b9a45bf6f8f77d16ec2f55d8df66714cde8959f1d2f8` | T:164 | MATCH |
| `20261013300700_cms_governed_activation_schedules.sql` | 168 | `eb50971bcceedaec91a66759f8c6f224b599c71aabfc871a79814a2ad3b6822b` | T:165 | MATCH |
| `20261013300790_cms_governed_authority_lock.sql` | 73 | `8b9f294dd2983b1fdeec825e60946c1a5f3a048f284da0ff2ef687296e15d972` | T:166, G:104, S:622, P:970 | MATCH (4/4) |
| `20261013300800_cms_submit_governed_review.sql` | 280 | `384fe5d569b2f203b4054b21d1bb17b0c9df093ad7739a3c4d04e9a455c94a7e` | T:167, G:105, S:623, P:971 | MATCH (4/4) |
| `20261013300810_cms_submit_governed_review_public.sql` | 42 | `ffa033abe9dc404b1cece59559d54e9fbe379645c66afd39209f94e55aa495fb` | T:168, G:106, S:624, P:972 | MATCH (4/4) |
| `20261013300820_cms_submit_governed_review_binding_fix.sql` | 263 | `45f234534942279e4181b55f342bb4c8c6aa3753462c7833868c6f072ec55aff` | T:169, G:162, G:190, S:656, P:1030 | MATCH (5/5) |
| `20261013300830_cms_governed_submit_hash_privileges.sql` | 107 | `7871c43e09809b6013e47a3fe9e403e58e3160a4a7ae8a1f6b7aeab5f682f55f` | T:170, G:226, S:523, L:144, P:1204, P:1224 | MATCH (6/6) |

Recorded line counts beside baselines (G:104–106 "73/280/42 lines", S:522 and L:143 "107 lines", G:163 "263 lines") all equal current. The eight `300000`–`300700` digests have exactly one recorded source (T); G:108 states they "match pre-patch reads" without printing values. `lane-native-pattern-definition-report.md:34` names 00800 without a digest.

### Pre-repair 00790/00800/00810 (G:46–48) — historical, superseded before first successful application

- G:46–48 record `76db30ea…`, `94e26c7e…`, `2390275f…` under "Historical pre-repair migration hashes used by the failed diagnostic". They are the only MISMATCH rows the sweep produced and are deliberately historical.
- Sequence corroborated from reset logs: `.lane-logs/alt-reset-170200-3880991.log` (27,152 bytes, SHA `9171b93a…` = G:65) applied `300000`–`300700` then failed at `20261013300790…` statement 5, SQLSTATE 42501 `permission denied for schema platform_private` (log :375) — pre-repair 00790 rolled back; pre-repair 00800/00810 never reached. The permission-only patch (released `2026-10-13T21:05:50Z`, G:90) added exactly a `grant create on schema … to wejammin_cms_definer` / `revoke create …` bracket at 00790:66,68, 00800:274,276, 00810:34,36 (G:94–98). Post-patch digests recorded at G:104–106, re-read at S:622–624 and P:970–972, equal current. `.lane-logs/alt-reset-171438-3972779.log` (SHA `1f143c58…` = G:124) is the first reset that applied 00790/00800/00810 and it succeeded. So the patch changed the three files **before** their first successful application; no later edit is recorded or evident (G:108: removing the two added lines per file reproduces the historical hashes).
- `lane-codex-governed-red-report.md` :105/:111/:124 give authoring-time line counts (00800 202, 00810 40, 00790 78) that predate dispatch and the patch; they are proposals, not digest baselines.

### Reset-log application evidence

- Sixth run `.lane-logs/alt-reset-181234-136231.log` (27,582 bytes, SHA `023d53664ff75f6d0a62ad5e2432fc805937c7037e0aa0b024a2cc2106eaf01a` = G:349): lines 366–378 are `Applying migration 20261013300000…` through `…300830…`, thirteen distinct stamps in order.
- Progression by distinct `20261013300NNN` stamps: 170200 → 9 (failed at 00790), 171438 → 11, 172611 → 12 (+00820), 175055/180034/181234 → 13 (+00830). Later `alt-reset-183151-249343.log`, `alt-reset-184038-294674.log` (pattern run), `alt-reset-184540-321925.log`, `alt-reset-185629-376711.log` (taxonomy third run) each list the same thirteen; all seven 13-migration reset logs hash identically to `023d5366…`.
- Limit: the reset log records applied file names only, never bytes; it proves the thirteen names were applied each run, not that the bytes equalled today's digests. Byte evidence is the pre/post-run hash reads at G:342–344 and G:360–361 and T's "before = after" table, all equal to current.
- Sixth-run TAP `.lane-logs/alt-tap-181234-136231.tap`: 6,895 bytes, SHA `a5d28aef8c709640abe957fc6f77caacca212110235297ffd74e64b6a19c2e72` (= G:351), plan `1..48` at line 4, 48 `ok`, 0 `not ok`.

**Check 1 result: no mismatch, no missing baseline, no inconsistency between baselines.**

## Check 2 — exact preservation of the original 48 assertions

### 2a. Reconstruction of prior bytes

Prior bytes are not on disk. The governed lane's session is `~/.codex/sessions/2026/10/13/rollout-2026-10-13T16-54-59-01a1370c-0eab-71e1-bcdb-1f7dd5a7f040.jsonl` (2,346 records). Every `custom_tool_call` whose input is `text(await tools.apply_patch("<JS string literal>"))` and names any governed file, with its `custom_tool_call_output`:

| JSONL line | UTC | Files (hunks) | Outcome |
| ---: | --- | --- | --- |
| 150 | 20:57:39 | 020 (3) | completed |
| 194 | 20:59:19 | main (4), 000 (2) | completed (182/188 were failed attempts) |
| 1136 | 21:54:14 | main (1): `subjectKey,subjectKind` token swap | completed |
| 1372 | 22:05:38 | main (2): `plan(48)`, mint in own statement + control | completed |
| 2015 | 22:40:28 | 000 (11) | completed |
| 2062 | 22:42:38 | 000 (2), 005 Add | completed |
| 2078 | 22:44:28 | 015 Add | completed |
| 2090 | 22:45:16 | main (8), 020 (1), 015 (1) | **failed** (expected lines not found in main) |
| 2104 | 22:45:45 | main (9), 020 (1), 015 (1) | completed |
| 2152 | 22:48:35 | main (1), 005 (4), README delete+add | **failed** (multiple operations target README) |
| 2158 | 22:48:53 | main (1), 005 (4) | completed |
| 2168 | 22:49:27 | README (1) | completed |
| 2180 | 22:49:56 | 015 (4), main (1) | completed |
| 2249 | 22:53:23 | 000 (1) | completed |

All other `apply_patch` calls on 2026-10-13 that mention the governed directory (root session `16-48-03`, lane `02-22-48`, `02-53-57`) target only CODEX-LANES/CODEX-STATE/progress/audit markdown, or predate the sixth run. A scan of every `custom_tool_call`/`function_call` in all 23 session files after 22:12Z for non-patch writes to `phase_02_slice_12_governed_submit*` (`writeFileSync`, `writeFile(`, `appendFile`, `renameSync`, `copyFileSync`, `sed -i`, `tee`, `cp`, `mv`, shell redirection) found only two arrow-function false positives in read-only hash scripts. No other write path exists.

Inversion (python3, in memory; the JS literal decoded with `json.loads`; hunks applied in file order with `+`/`-` swapped, each searched forward from the previous replacement; every main/QA020 hunk matched at exactly one position):

- **main**: current `318717a7…` (295 lines) → invert 2180 → `8739f0f6…` → invert 2158 → `86e8ca06…` (294) → invert 2104 → **`20f696daeb1ed405be88bba9dd47cb6de95279f2399a68c9fcc2d4c3390d92a9`, 283 lines — equals the recorded pre-rewrite SHA (G:326, G:343).**
- **QA020**: current `d5226e03…` (137 lines) → invert 2104's single QA020 hunk → **`52292644ad086c6606e1a71e9b559f9182684847246024cb57d620de88e04f96`, 140 lines — equals the recorded pre-rewrite SHA (G:39, G:182, S:627).**
- Inverter validation: continuing through 1372 and 1136 reproduces `d0502d36c3510082e5cca28eacc941fa592aa1735946d01b6bffbf64e410aef7` (G:272) and `de54ff938c51187da9c53572935015b53eb0f090d1422bc195910a1f8d40aaa7` (G:68) exactly.
- **000 (prior)**: inversion of 2249/2062/2015 was **not** exact (`c2345151…`, 274 lines): patch 2015 hunk 5 is a pure-deletion hunk with no context lines, so its inverse has no anchor, and no insertion position reproduced the target. Reconstructed instead from a complete `N: line` dump in the same session (JSONL line 1585, `custom_tool_call_output` at 22:19:33Z, after the sixth run): lines 1–274 plus trailing newline hash to **`7816408a5a5e1a07b009e1647f467c91c41a296cf5cd15f4d31dc91248a2c92a`**, the executed fixture-file SHA at G:69. Session hash reads at 22:19:28Z (line 1577) and 22:29:52Z (line 1925, "… 274 …000-fixtures") confirm 000 held that digest from the 17:02 run through the sixth run until the 22:40Z rewrite. The prior 000 contains zero pgTAP calls anywhere (so the 48 count is unaffected by it) and its lines 85–102 are the synthetic protected-type activation the author cites (G:27).
- 010: never touched by any patch in any session; its digest `e123571fa3cda70e…` appears in the governed session's hash reads at 20:57, 21:00, 21:04, 22:07, 22:12, 22:13, 22:29, 22:33 (pre-rewrite) and 22:46, 22:53–22:55 (post-rewrite). Unchanged throughout.

### 2b. Enumeration method

Statement-level SQL scanner over each file, following `\ir` recursively from main: tracks `--` and nested `/* */` comments (removed), `'…'` strings (with `''` and `E'\…'` escapes), `"…"` identifiers, `$tag$…$tag$` bodies, and splits on top-level `;`; psql meta-commands are their own statements. A statement counts as an assertion iff, after comment removal and whitespace collapse, it matches `select <fn>(` with `<fn>` in a 150-name pgTAP list (`ok`, `is`, `isnt`, `is_deeply`, `results_eq`, `set_eq`, `bag_eq`, `throws_ok`, `lives_ok`, `matches`, `has_function`, …). Assertions nested inside `create function … $$…$$` or `do $$…$$` therefore do not count, matching the author's exclusion of comments, strings and dollar-quoted bodies. Every top-level `select <ident>(` not in the pgTAP list and not a helper namespace was reported: none unrecognized in either tree. Description = the statement's last string literal; body = the whitespace-normalized statement.

Prior tree = prior main (`20f696da…`) + prior 000 (`7816408a…`) + prior QA020 (`52292644…`) + 010/S10/h11/jwt from disk (unchanged, above). Current tree = disk.

| Tree | plan | main | S10 `001-fixtures` | h11 `001-world` | 005 | 020 | 000/010/015/jwt/S09 | Total |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Prior | `select plan(48)` | 28 | 4 | 3 | — | 13 | 0 | **48** |
| Current | `select plan(60)` | 31 | 4 | 3 | 9 | 13 | 0 | **60** |

This equals the author's static count (main 31 + S10 4 + h11 3 + 005 9 + QA020 13 = 60).

### 2c. Mapping of the 48

Every prior assertion was matched to a current assertion by identical normalized body (then, had any failed, by description). Result: **48 identical, 0 changed, 0 missing, 12 new.** Mapping (prior # → current #, execution order):

- P1–P7 → C1–C7: the seven legacy S10/h11 neighbor controls (`001-fixtures` ×4, `001-world` ×3), byte-identical files vs `HEAD`.
- P8–P35 → C17–C44: all 28 prior-main assertions — six fixture-integrity controls (protected type created by CMS-03A-01, evidence seam resolves protected, both subjects draft in owner scope, 64-hex hash, `app.cms_rpc` restored, two bound type ids), the two `has_function`, subject-A submit/21-member body/open-review freeze/basis+content hash recomputation/GovernedReview row/dependency row/state=review/lifecycle +1/one audit/no outbox, subject-B protected submit and strictest-of basis, capability refusal + no-effect, duplicate refusal + one live review + no-effect, dependency control (P33→C42), `DEPENDENCY_UNAVAILABLE` (P34→C43), no review committed (P35→C44).
- P36–P48 → C47–C59: all 13 QA020 assertions, including the seven added before the sixth run (P41–P48 → C52–C59): valid-grant control, completed cached success and stored response, active-flag-only revocation, `P0001`, `capability_missing`, NULL cached body, scoped no-effects, full grant restoration. The sixth-run TAP lines `ok 33`–`35` and `ok 41`–`48` carry exactly these descriptions.
- New: C8–C16 (005 producer controls), C45–C46 (main fault controls), C60 (main role control). Numbering equals the author's "producer 8–16, fault 45–46 and role 60".

QA020 "real-context substitution" = exactly one hunk (2104): in the malformed-request call (current 020:61–66) the `context` argument changed from a hardcoded object (`actingPartyId` = orgA, `actingContextId 'a9120000-…0001'`, `correlationId 'a9120000-…0002'`) to `pg_temp.s12gov_context()` (the real S09 acting-context binding, as `s12gov_request` already uses at 000:94). The request still carries `subjectKind: null`; the assertion (C51 `INVALID_REQUEST`) is body-identical. No expected value, SQLSTATE, message, compared row set, or set of compared stores changed anywhere in QA020; `s12gov_scope` still serializes full subject/review/dependency/idempotency rows and audit/outbox counts.

### 2d. plan(60) and the twelve added controls

`select plan(60)` at main:30; `select finish()` at main:294; `rollback` at :295; `\set ON_ERROR_STOP on` at :23. Exactly 12 assertions are new. Non-vacuity, each read in full:

- C8 (005:20–32): real `cms_owner_initialization` receipt joined to the owner actor and an active `acting_context_binding`, pinned to `operator_role = 'postgres'`, fixed `authorization_ref a9d10000-…0099` (the real `initialize_cms_owner` call at `01-actors.sqlinc:52–55`) and a matching `operator.cms_owner.initialize` audit event. The legacy forgery helper `pg_temp.s09d_legacy_owner_receipt` (`00-helpers.sqlinc:270–292`, random ref, `current_user`) cannot satisfy it and has no caller in any include the suite loads.
- C9/C10 (005:34–74): `s12gov_grant_proof` joins each CMS-03A-15 probe response id to `cms_capability_grants`, `organization_actor_grant`, `cms_capability_grant_events` (recomputed `binding_context_hash`, `mfa_verified_at`) and a completed `idempotency_records` row; C9 needs count = 1 and all coherent for the designer, C10 count = 2 for editor/specialist **and** `not exists` an active designer grant for designer2 (which is what makes C37's `capability_missing` meaningful).
- C11/C12 (005:76–92): `left join` of an explicit 10-step (ordinary) and 12-step (protected: two assignments/decisions) chain against `s09d_probe`; a missing or failed step yields `coalesce(false)`.
- C13–C16 (005:96–169): `s12gov_chain_proof` joins version/type/artifact/review/dry-run by the chain's recorded ids and recomputes `artifact_hash` (JCS of compiler/zod/manifest/locale), dry-run pass with zero source/target rows and no entries, approval digest with distinct reviewers ≠ submitter, and activation evidence hash (JCS of approval hash/policy hash/version id) plus `cms_review_qualifying_approvers` cardinality and zero unsatisfied slots; each requires count = 2 and `bool_and(coalesce(flag,false))`.
- C45/C46 (main:283–287) consume `s12gov_fault_receipt` written by 015: `exact_refusal` = `P0001` + `DEPENDENCY_UNAVAILABLE` + NULL body + literal detail `{"dependencyClass":"policy"}`; `data_unchanged` = full ordered rows of 21 stores equal before and after the RPC and after restoration. `selected_null`, `scope_refused`, `metadata_only`, `restored` abort the transaction before the receipt if false (015:108,120,130,106,148), so those failure modes surface as a suite abort rather than `not ok` — not vacuous.
- C60 (main:289–292): `s12gov_rpc_receipts` is written by every `s12gov_submit` call (000:123–126); there are exactly 9 call sites (main:90,199,226,239; 015:131; 020:33,48,61,106), three of which are expected successes (subject, protected, replay). Requires count = 9, exactly 3 `00000`, `rpc_user = 'service_role'` and before/after user and role equal. Note `rpc_user` is `current_user` after `set local role service_role` inside the invoker wrapper: it proves the public call was issued under the service_role session role (the SECURITY DEFINER RPC then runs as its definer); the description's "really execute as service_role" is accurate for that boundary.

None is `ok(true)`, a self-comparison, or a count of always-present rows.

### 2e. Setup the retained assertions now run against

Prior setup (exact prior 000:17–25, 85–102, 126–128; prior main:35–40, 252): `orgA`/`personCreator` from S10 `s10_ids`; `authCreator` hardcoded `a9100000-…0001`; `typeA` = h11doc from `h11w_ids` (direct-DB activation with `repeat('b',64)` evidence at `001-world.sqlinc:105–122`); protected type activated by direct DB update at prior 000:85–102; request context hardcoded synthetic; dependency subject bound to S10 `articleType` (direct-DB activation with unregistered placeholder key `cms.entry.author`, `001-fixtures.sqlinc:359–372`).

Current setup: 000:6–14 maps `orgA`/persons/auth ids to S09 actors (`initialize_cms_owner` owner org); 000:32–34 and :94 use `s09d_context` (real acting-context binding); 005:4–18 produces real CMS-03A-15 grants (`s09g_grant`) and maps `typeA`/`typeVersionA`/`dependencyType` → `s12govordinary` and `protectedType`/`protectedVersion` → `s12govprotected`, both built by `s09d_create_type`/`s09d_to_active` (`02-chain.sqlinc`), which call only production RPCs (`cms_create_type_draft`, `cms_start_schema_dry_run`, `cms_claim_schema_migration_lease`, `cms_process_schema_migration_dry_run_batch`, `cms_finalize_schema_migration_dry_run`, `cms_submit_schema_review`, `cms_assign_schema_review`, `cms_decide_schema_review`, `cms_activate_schema`) and contain zero direct-activation patterns (`grep` for `set state = 'active'`, `activation_approval_evidence_hash = repeat`, `update platform_private.cms_content_type_versions` in all four S09 includes: 0). Subjects are minted through `platform_api.cms_define_template` (000:45). No governed key references `h11w_ids` or `s10_ids`; the owned files contain no `s10_rpc_exec`, trigger disabling, `session_replication_role`, or `repeat('b', 64)`.

So no original assertion moved to weaker or synthetic setup: 41 governed assertions (C17–C44, C47–C59) now rest on real producer chains where they previously rested on direct-DB activations and hardcoded contexts; the seven legacy neighbor controls (C1–C7) remain on their unchanged legacy includes, as the author states, and those includes still perform their own synthetic activations for their own types only.

Mechanism change to record (not a defect in preservation): the dependency refusal pair (C43/C44) previously obtained a NULL policy by binding a synthetically activated type whose placeholder key was unregistered; it now obtains it by `s12gov_dependency_fault` (015), which temporarily replaces only `prosrc` of `platform_private.cms_editorial_workflow_policy_evidence(uuid)` with a body returning NULL for the one selected version and raising `P0001/S12GOV_FAULT_SCOPE_VIOLATION` for any other argument, after verifying the resolver's definer/owner/ACL/proconfig metadata, snapshotting 21 stores, and before restoring the exact definition and re-checking evidence and settings. Consequently the suite exercises the command's `DEPENDENCY_UNAVAILABLE` branch on a real type, but the production resolver's own body is not executed for that one call; its "unregistered key → NULL" path is no longer covered by this suite. The fault also requires `current_user = 'postgres'` (015:56), a runtime assumption.

## Observations (non-blocking)

1. Reset logs carry names, not bytes; byte evidence for applied migrations rests on the recorded pre/post-run hash reads (G, T), which equal current.
2. The eight `300000`–`300700` digests have a single recorded source (T); no second independent record exists.
3. The author's "mechanical reversal" claim holds exactly for main and QA020. For 000 it is not mechanically invertible from the patches alone (context-free deletion hunk); the prior bytes were nonetheless recovered exactly from a session dump.
4. The README's disclosed limits stand: S09 Auth/member scaffolding (including the designer2 membership forgery at `01-actors.sqlinc:57–59`) is provisioning, not hosted-identity proof; QA020 audit/outbox remain count-only; only the 015 snapshot uses full rows.

## Verdict

Both checks are complete with exact hash reconstruction (main `20f696da…` and QA020 `52292644…` by patch inversion; prior 000 `7816408a…` by session dump), all thirteen migration digests match every recorded baseline, all 48 original assertion bodies are retained unchanged and now run on stronger setup, `plan(60)` is declared, and the 12 added controls are non-vacuous. Static clearance is not runtime proof: SQL compilation, live ACL expectations, real-chain coexistence with the legacy includes, the fault's `postgres` precondition, and all 60 runtime outcomes remain unverified until a separately released run.

VERDICT: STATIC CLEAR
