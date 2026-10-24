# Claude Phase 2 resume — live state

Resume here after any interruption or context compaction. Owner prompt: resume from
`docs/handoffs/2026-10-12-claude-s12/CODEX-CLAUDE-HANDOFF-2026-10-13.md` and continue Slices 11–17
through `/implement-slice` and the final `/validate-phase`.

## Fixed facts

- Active worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`,
  HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`. Slice 12 work is uncommitted by design; no commit,
  push or PR change is authorized.
- Protected primary `/home/rob/Projects/WeJammin` at `37c0a86`, two untracked paths. Read-only.
- Backup of all modified/untracked files at resume:
  `/home/rob/.local/share/wejammin-backups/s12-dirty-20261014T053729Z.tar.gz`
  (SHA-256 `2205105ae55a187bb1ef61b3fbf928aca763f5c9582cbd74d302108b97779eef`, 150 files).
- Slice 12 acceptance section SHA-256 (changed 2026-10-15 by the DEC-190 cascade, owner-approved) must stay
  `9950eb5ddcd3df08516ed73a8c65a1acab9bfb794076dfc1f51eb38490820427` until a refutation-audited tick or an owner-approved cascade.
- Model routing (owner /goal 2026-10-14): orchestration on the strongest model at highest effort;
  execution on Sonnet 5.5 high. Root is `claude-opus-5-5` / `xhigh` (no self-switch to `max` or Fable).
  Execution lanes: `general-purpose` + model `sonnet` (`claude-sonnet-5-5`); per-call effort cannot be
  pinned this session. Independent reviews/audits: `claude-fable-5-1`. Agent definitions
  `~/.claude/agents/wejammin-executor.md` (sonnet/high) and `wejammin-reviewer.md` (fable/max) load
  only in a new session. Codex quota was at 98%; reviews go to fresh Claude reviewer agents.
- Lane briefs live in `briefs/<lane>.md`; relaunch a lane by pointing a new agent at lane-rules + brief.

## If a usage limit killed the lanes

Relaunch each killed lane as `wejammin-executor` with: lane-rules + its `briefs/<lane>.md` + "a
predecessor was killed mid-work; first read your report and every file in your claim, run
`git status --porcelain -- <your paths>`, and resume from the last recorded run; do not redo finished
work and do not rerun identical bytes". Check `.lane-logs/alt-staged-*` for runs not yet recorded.
Burn reference 2026-10-14: 5-hour window ~49% in the first 27 minutes (Fable lanes' reading phase plus
two restarts); weekly all-models 7%, Fable 10%.

## Owner decisions pending

1. ANSWERED 2026-10-15: owner chose A (DEC-190); cascade + retire implementation in flight. (was: Retirement branch of CMS-03C-09 (propagation scan
   `.memory/wiki/specs/audits/propagation-scan-governed-lifecycle-2026-10-13.md` §R). Do not apply the
   cascade or implement retire until the owner answers.
3. ANSWERED 2026-10-15T16:53:54Z: owner chose A (DEC-192); lane claude_s12_locale_gate_a. (was: Locale publication gate F4
   (`review-locale.md`): BE03c's literal `locale_variant_not_approved` would fail every locale revision at
   submit; options: (A) enforce only at schedule/publish/execute with `scheduled` admitted (reviewer's
   reading, recommended), (B) enforce at submit too and require approved variants before review,
   (C) other. Gate provider 050600/050700 stays unpromoted until answered.
5. (queued after F4, before #4) Linked pattern update semantics (`review-pattern-updates.md`): override replaces vs merges node props (structure/block changes adopted on accept); removed roots (retire vs keep detached); roots ADDED by the target version (append on accept vs ignore); detach 128-key limit. Ask as ONE bundled decision with 2–3 coherent option sets.
4. (queued after F4) Designer nested-pattern picker: CMS-03C-13 authorizes authors/editors for one content type; the pattern designer (`cms.template_designer`) needs nestable active patterns compatible with ALL `compatibleTypeIds`. Options: (A) new protected supporting read for designers (owner scope, active, compatible with every listed type) — recommended; (B) widen CMS-03C-13 to designers with a multi-type filter; (C) manual key entry verified by the latest read.
2. Whether local checkpoint commits are authorized (not yet asked; Slice 11 AC045 "same change" closure
   needs a commit, so this must be asked before Slice 11 can close).

## Lanes

See `CLAUDE-LANES.md`. Wave A (started 2026-10-14 ~05:55Z): governed review (read-only), pattern-def
SQL, taxonomy-def SQL, governed-a SQL (07/08/10/11).

## Plan (dependency order)

1. Governed review → if STATIC CLEAR, one governed 60-case diagnostic via staged runner, lane `none`.
2. Wave A GREEN → independent review per lane → root promotes WIP migrations → populated-DB witness
   for migrations that alter tables with rows → `db:types` refresh.
3. Wave B: governed-b (CMS-03C-09 activate/schedule, then retire after owner answer; CMS-03C-19 jobs);
   pattern placement CMS-03C-02 SQL; taxonomy terms CMS-03C-03/-17/-18 + terms read; Worker routes for
   CMS-03C-06…11.
4. Wave C: pattern selector/diff/update CMS-03C-13/14/15; related CMS-03C-05/-21; locale CMS-03C-04/-20.
5. Wave D: Web pages and islands (CMS-11/12/14/15/16 + governed review UI), apispecs (composed real
   stack), E2E, accessibility, performance; spec-cascade obligations AC189–279.
6. Evidence ledger refresh → separate-population refutation audit → `pnpm db:verify` → `pnpm validate`
   → tracking → Slice 12 close. Then Slice 11 AC045, Slices 13–17, `/validate-phase`.

## Run log (root-visible receipts)

- 2026-10-14T06:00Z governed review STATIC CLEAR (`lane-governed-review-report.md`, SHA `01e3b2f9…`).
- 2026-10-14T05:57Z governed 60-case diagnostic (staged, lane none): 60/60 PASS. TAP
  `.lane-logs/alt-staged-none-015702-2001860.tap` SHA `f1900c7c…`. Diagnostic, not acceptance.
- 2026-10-14T06:29Z full lane-none ALT baseline (promoted only, 373 migrations): 383 files, 15,612
  tests, FAIL. TAP `.lane-logs/alt-staged-none-022909-2174717.tap` SHA `22649836…`. Expected red (WIP
  absent): governed assignment/decision/reads, pattern/taxonomy definition + populated-lineage, pattern
  placement skeleton (11–18). Baseline regressions to repair: S09 `p240_authority` #76,
  `r8_api_surface` #4/13/14, `schema` #448, `sec2_all_schema_definer_rls` #6/12, `sec2_definer_rls` #11;
  S10 `ev_eb_publication_scope` #2; seven S11 suites abort early (`checker_render_plan`,
  `criteria_publish_gates`, `helpers_manifest`, `helpers_preflight`, `recheck_index`, `recheck_run`,
  `rpc_reads_gate`) — the `cms_pattern_versions.lifecycle_version` fixture. Repair lane runs AFTER WIP
  promotion so inventory pins (API surface, definer/RLS allowlists, schema) are updated once.

## Next-action queue (root, in order) — updated (estimated time; see correction in Dispatch Log)

PROMOTED so far: taxonomy-def `030000`–`030400`; governed-a `010000`–`010410`; governed-fix `040000`/`040100`.
Running (may be killed by the 5-hour cap; relaunch per the section above):
locale (`briefs/locale.md`), governed-b (`briefs/governed-b.md`), pattern-def fix pass (`briefs/pattern-def-f1.md`).

00000000000000. (2026-10-15T17:05:30Z) OWNER ANSWERS today: F4=A (DEC-192), linked updates=author decides (DEC-193), merge recovery=
    automatic sweep (DEC-194), related content=protected read (DEC-195). Remaining owner items: #4 designer nested-pattern
    picker; #2 commit + GitHub-issue authorization; approval of AC-082/088 wording for DEC-191 (orchestrator resolution).
    In flight: polish B, hygiene 2, polish A f1, DEC-194 sweep, fixture repair 2 (Sonnet); DEC-193 spec author, locale-gate
    review, taxonomies f3 review (Opus). QUEUED: DEC-195 full-stack lane (`briefs/dec195-read.md`); locale-gate promotion
    after review; DEC-193 spec review then pattern-updates WIP rework; related f2 minors.
0000000000000. (2026-10-15T16:33:07Z) Window reset 16:30Z (next ~21:30Z). PROMOTED today: selector 140300/140310, template-digest 180000,
    DEC-191 170000-170200 (460 promoted; verified 1198/1198). WIP left: pattern-updates (10, held owner #5), locale-gate (F4).
    RUNNING: Web taxonomies f3 (resumed), Web polish B (resumed), pins pass B, Worker hygiene 2; Opus: review polish A
    (resumed), re-review related f1 (resumed), spec-cascade review. AFTER: canonical `pnpm db:verify` then `pnpm validate` on a
    quiet host once lanes drain (expect pattern-updates suites and locale gate pins red until owner rulings); Web composition +
    locale pages; linked-update scan lane; FE03 :1601 step-up wording + AC-082/088 DEC-191 wording (needs owner approval).
000000000000. (2026-10-15T13:25:04Z) PROMOTED: selector 140300/140310; template-digest 180000 (457 promoted). Related-content lane PARTIAL:
    SG-S12-03 no saved-rule read; interim ruling = page refuses saving until resolved; owner question #7 queued (add protected
    read `cmsRelatedContentRead` returning stored ids — disclosure to another author of the same owner — vs keep boundary);
    related relay 422 drops `related_target_ineligible`+pointer (fix pass after review). Running: DEC-191 p2, Web polish A,
    Web taxonomies f2, Opus review of related. OWNER QUEUE: #3 F4 (asked) -> #5 linked-update bundle -> #6 merge recovery
    (AC-226) -> #7 related-content read -> #4 nested picker -> #2 commit + GitHub-issue authorization.
00000000000. (2026-10-15T12:21:20Z) DEC-191: SQL review PARTIAL — promote 170000-170200 ONLY together with phase 2 (two-way strict-parse
    break); after phase 2: small SQL test pass (F2 superseded-vs-previous cases, retire->activate null), then joint promotion.
    Web taxonomies BLOCK -> fix lane f1 running (Option A reserved probe id). Worker pattern-updates CLEAR. Running:
    hardening-5, web-related, dec191 p2, web-taxonomies-f1, worker-hygiene-1. Queued: Web polish 3e (designer FE03 :1173
    read retry 250/750 ms, frame button id, Danger style, submit-only disable, blur validation, URL after create).
0000000000. (2026-10-15T11:59:00Z) Worker taxonomy-terms f2 CLEAR. QUEUED Worker hygiene pass: m-f2a guard-logging test, nits, redundant
    403 branch in `taxonomy-term-details.ts`. Check hardening-5 leaves worker tsc clean (TS2352 at
    capability-missing-refusals.test.ts:313 seen 11:54Z mid-edit).
000000000. (2026-10-15T11:32:51Z) Usage limit killed all 7 agents ~09:10Z; window reset 11:30Z; all 7 relaunched with resume prompts
    (same lanes as 00000000). Next window reset ~16:30Z. Expect another kill ~1 h in with 7 agents: on relaunch, check
    `.lane-logs` for runs that finished after death and hand them to the resumed agent.
00000000. (2026-10-15T09:09:01Z) IN FLIGHT: Web taxonomies; Worker pattern-updates transport; DEC-191 SQL phase 1; pattern-updates f2;
    Worker taxonomy-terms f2; Opus reviews of Web activation f1 and hardening-4. DONE GREEN: Web activation f1, hardening-4.
    QUEUED after Web taxonomies: `apps/web/src/server/README.md` (CMS-03C-09 proxy, stale :170-171 insertion-RPC sentence,
    `cms-composition-platform-capability.ts`); split pass for over-limit files (`locale-routes.test.ts` 889 lines,
    `cms-composition-platform-mutation.ts` 321); Web polish 3e incl. shared CMS destructive-button (Danger) style for Retire;
    DEC-191 phase 2 after phase 1 review; selector promotion after pattern-updates f2 R7.
0000000. (2026-10-15T08:59:28Z) pattern-updates delta review PARTIAL (no blocker): QUEUED `briefs/pattern-updates-f2.md` (R7 first, then
    promote ONLY 140300+140310 under the ALT lock with a lane-none selector verification run; 14/15 held for owner #5).
    Executor cap held at 5 Sonnet; next free slots: pattern-updates-f2, then worker-taxonomy-terms-f2. BE03c :1287 amended.
000000. (2026-10-15T08:52:23Z) IN FLIGHT: Web taxonomies; hardening-4; Worker pattern-updates transport; Web activation f1; DEC-191 SQL
    phase 1 (`briefs/dec191-read-gap.md`); Opus review of pattern-updates fix pass. DONE: Worker taxonomy-terms f1 review
    CLEAR; cascade 3d part 2 (BE03c merge-convergence disposition). QUEUED: `briefs/worker-taxonomy-terms-f2.md` (next free
    slot); DEC-191 phase 2 after f1; graph-only refresh + independent review of cascade 3d text (BE03c 215, IA03 272,
    DEC-191 schemas, merge disposition). OWNER QUESTIONS in order: #3 locale F4 (asked); #5 linked-update bundle (now
    five items from the pattern-updates lane); #6 merge-convergence recovery (AC-226); #4 designer nested-pattern
    picker; #2 commit + GitHub-issue authorization. DEC-191 told to owner as overridable.
00000. (2026-10-15T08:50:20Z) Added: Web activation fix lane f1 (`briefs/web-activation-f1.md`) running; review-web-activation CLEAR.
    DEC-191 (orchestrator resolution, owner may override) written to BE03c + decisions.md + raw; lane `briefs/dec191-read-gap.md`
    QUEUED (launch when an executor slot frees; phase 2 only after f1 finishes). Queued too: re-run Worker taxonomy-terms
    mutation battery (contaminated 03:47-04:00 local); `apps/web/src/server/README.md` CMS-03C-09 + stale sentence after
    Web taxonomies; tell the owner DEC-191 in the next user message.
0000. (2026-10-15T08:47:20Z) IN FLIGHT NOW: Web taxonomies; hardening-4; Worker pattern-updates transport (`briefs/worker-pattern-updates.md`,
    against unpromoted WIP); Opus reviews: Web activation form, Worker taxonomy-terms fix pass (`-f1`), pattern-updates
    fix pass (`review-pattern-updates-f1.md`). pattern-updates fix pass GREEN F3 2144/0 (TAP `d944f9f3…`); promote 12 WIP
    (140000-140610) after a CLEAR review; its five owner items join owner question #5.
000. (2026-10-15T08:44:20Z) CURRENT IN FLIGHT (supersedes the IN FLIGHT line of 00.): pattern-updates fix pass (successor agent only;
    predecessor stopped after a duplicate-agent incident, see Dispatch Log), Web taxonomies (`briefs/web-taxonomies.md`),
    hardening-4 (`briefs/hardening-4.md`), Opus review of the Web activation form (`review-web-activation.md`), Opus delta
    review of the Worker taxonomy-terms fix pass (`review-worker-taxonomy-terms-f1.md`). Web activation form GREEN
    (report SHA `4e2bd94b…`). Before relaunching any lane: TaskStop its predecessor and kill its queued staged runs.
    Queued after these: stale `apps/web/src/server/README.md:170-171` sentence (after Web taxonomies releases it);
    Web polish 3e; cascade 3d (part 1 DONE 2026-10-15T08:45:47Z: BE03c 215, IA03 272; left: merge-convergence disposition after the
    delta review, graph-only refresh `node --input-type=module -e "import('./.memory/pipeline/spec-graph.mjs').then(m=>m.buildSpecGraph({projectRoot:process.cwd()}))"`,
    review of cascade text); Worker transports for CMS-03C-13/14/15 (after pattern-updates promotes).
00. (2026-10-15T07:15:20Z) RESUME POINT (root context near compaction).
    Routing: executors `wejammin-executor` (Sonnet 5.5 high); routine reviews `general-purpose`+model `opus`;
    Fable reserved for the final refutation audit (weekly Fable 82%, all-models 71%).
    PROMOTED: taxonomy-def, governed-a/fix/fix2/fix3/fix4, pattern-def, block-compat, governed-b, locale (gate pair
    parked `migrations-wip/locale-gate/` pending owner F4), related, baseline-repair `130000`, placement,
    taxonomy-terms (incl. f2 `120810`/`120820`). Acceptance-section SHA-256 now `9950eb5d…` (285 open) after the
    owner-approved DEC-190 cascade + follow-up.
    RETIRE PROMOTED (`20261014160000`–`160200`, review version +1). IN FLIGHT: Web activation form
    (`briefs/web-activation.md`), Worker taxonomy-terms transport DONE (Opus review `review-worker-taxonomy-terms.md` in flight), pattern-updates fix pass (`briefs/pattern-updates-f1.md`; CMS-03C-14/15 also wait for the
    owner's linked-update decisions — queued question #5).
    OWNER QUESTIONS: #3 locale F4 ASKED (awaiting); then #5 linked-update semantics bundle; then #4 designer
    nested-pattern picker; then commit authorization (needed for Slice 11 AC045).
    NEXT (unblocked): Web activation form (CMS-03C-09 incl. retire) after retire promotes; hardening-4 (3c);
    Web polish (3e); cascade pass 3d (BE03c 215 retire version wording, IA03 272, graph-only refresh);
    pins pass B (r8 API surface, sec2_all forced tables, trigger inventory, new functions — after remaining SQL
    promotes); Worker transports for CMS-03C-13/14/15/17/terms read/03 term actions/merge-converge job
    (RPC boundaries in lane reports); Web pages for taxonomies (`/taxonomies/new`, `/:taxonomyId` with
    `CmsTaxonomyVersionDesigner`, `CmsTaxonomyTermForm`), composition (`/entries/:id/composition`), locale
    (`/entries/:id/locales/:locale`), related (`/entries/:id/related-content`); linked-update scan lane
    (pending_diff on pattern activation, D9/OD-2); apispecs (composed real stack); E2E; a11y; perf;
    `db:types`; canonical `db:verify` → `validate` on a quiet host (perf suites out of the gate); evidence
    ledger refresh; Fable refutation audit; tracking + session log; then Slice 11 AC045 (needs commit
    authorization) and Slices 13–17, `/validate-phase`.
0. (done) At 15:31Z reset, in parallel: scoped review of locale (`lane-locale-report.md`, SHA `edf63d93…`; 10 WIP
   migrations, 156/156, six edited existing suites, ratification items), scoped delta review of the
   pattern-def fix pass (SHA `414566c0…`), Worker phase 2 (`briefs/governed-worker-p2.md`), and check
   governed-b review (`lane-governed-b-report.md`, SHA `f65d5830…`, GREEN 473/473 with pattern-def) then promote pattern-def + governed-b together. Then 4a governed deprecated-block fix and 4b spec investigation.
1. On each lane result: scoped Fable review (root does hash/manifest checks itself; reviewer focuses on
   spec conformance, security, test non-vacuity) → promote under `flock /tmp/wejammin-altdb.lock`.
2. Launch Worker phase 2 (`briefs/governed-worker-p2.md`) — ready now (governed-a promoted, fix pass CLEAR).
3f. Web relays for CMS-03C-03 term actions, terms read, CMS-03C-17 selector + taxonomies pages; Opus review of Web activation form (`lane-web-activation-report.md`, SHA `4e2bd94b…`).
3d. Next cascade pass (+ BE03c merge-convergence job disposition table from `lane-worker-taxonomy-terms-report.md`): BE03c 215 + CMS-03C-10 text — retire advances review `version` by one; IA03 272 over-budget wording; graph-only refresh command (find one; never compile.mjs).
3c. Hardening-4 (+ hardening-3 review minors: Worker 403 fallback admits CAPABILITY_REQUIRED, stale Web server README, pointer-hardcode test, adapter-through-route test): `CAPABILITY_REQUIRED` → `capability_missing` in `locale-routes.ts`, `related-content-routes.ts` and Web locale/related/mutation relays (hardening-3 report open item).
3e. Web polish: pattern/template designers — disable only the submit control while pending, blur validation, URL update after create (FE03 :1216 form contract; review-web-patterns m6); bundle budget check.
3b. (done) Web definition-reviews fix pass. NEXT Web: `CmsGovernedActivationForm` (activate / schedule with Time authority / retire per DEC-190) + proxy for CMS-03C-09 after the retire SQL promotes.
3a. Hardening-2: placement Worker adapter must map Slice 12 reason tokens (`revision_not_editable`, `pattern_version_not_active`, `pattern_incompatible`, …) to typed 409/422/403 (placement report R2); COMPOSITION-POSITION-DDL parity test (R3); `mapCmsCompositionRpcFailure` in `cms-composition-production-locale.ts` and `cms-composition-production-related-rpc.ts`; 502 retryable true in `locale-routes-support.ts:116`, `related-content-details.ts:95` (+oracle `related-content-errors.test.ts:233-247`); header-before-quota in locale/related routes; drop `STILL_NON_RETRYABLE_502` exemption in `phase-02-slice-12-dependency-unavailable.test.ts`; Web mirrors in `apps/web/src/server/cms-composition-platform-{mutation,pattern,locale,related}.ts` (+tests).
3. (done, under review) Hardening lane (also: CMS-03C-11 OPTIONS shadowed by 06 — merge; registry-pin over-claim; 40001 `VERSION_MISMATCH` fixture; three vacuous replay tests, per `review-governed-worker-p2.md`) (after locale releases `locale-routes*`/`production-locale*`): composition-scoped
   provider-fault guard for template, detail, locale, pattern-instance adapters (+ PGRST202 → 500, correct
   `cms-composition-production-pattern.test.ts:133-156` 503 pin), header-before-quota for template, locale,
   related, pattern-instance, taxonomy-term routes; 502 `retryable` vs BE00 172; 03b untouched.
4. Pattern-def fix pass done (310/341, 31 blocked on 09). Next: scoped delta review of the fix pass →
   combined run `governed-fix,governed-b,pattern-def` once governed-b exists → promote.
4a. Governed forward fix (new small lane, range 2026101408xxxx): governed digest recompute must admit
   deprecated blocks (refuse only missing/withdrawn/incompatible, BE03c 1361).
4c. (PROMOTED) Block-compat ruling B (`review-blockcompat.md`, SHA `0168aa22…`, root accepted 2026-10-14T15:45:11Z): the
   renderer-manifest `blocks` allowlist (`20260927200000:268-271`, `20260927240000:54-83`, pattern WIP
   `020300:110-152`) has no spec basis; the compiler correctly never writes it (BE03a :2246-2255, P2-S09-AC-007
   oracle). Correct check: block registered + lifecycle rule (templates `supported`; patterns non-withdrawn)
   + each compatible type's active artifact `compiler_version` within the block's
   `compatibility {minSchemaCompiler, maxSchemaCompiler}` (BE03a :1098-1101, :2761; BE03c :209, :1567),
   dotted-numeric, key-less range fails closed. Lane `block-compat` AFTER pattern-def promotion: one forward
   migration replacing `cms_template_block_digest` and `cms_pattern_blocks_compatible`; real-chain
   block-bearing RED tests first; oracle corrections (`template_authority.sql:618-620`, raw fixtures'
   `compatibility_range '{}'`, pattern-def `047`/`000` variants) with review.
4d. Governed recompute pattern-branch compiler-range parity (anchored patch calling `cms_pattern_blocks_compatible`, RED first; README for `phase_02_slice_12_block_compatibility/`), small lane.
4b. (done) Spec investigation: how BE03a/BE03c/IA03/FE03 define block
   "compatibility" for templates and patterns and whether the type compiler must emit renderer-manifest
   `blocks`; today it never does, so block-bearing templates/patterns are refused under real chains.
   Outcome: implementable spec → fix lane (possibly Slice 09 compiler code); absent → owner question.
5. Baseline-repair lane after promotions: S09 inventory pins (`r8_api_surface`, `sec2_*`, `schema` #448,
   `p240_authority` #76), S10 `ev_eb_publication_scope` #2, seven S11 suites aborting on the legacy
   `cms_pattern_versions` fixture (+ new lineage columns), dependency manifest/recheck joins using
   `pattern.id` as a version id; then `pnpm db:types` (root, under locks) and a lane-none full baseline.
6. Wave C: placement CMS-03C-02 SQL (needs pattern + 09), taxonomy terms CMS-03C-03/17/18 + terms read
   (needs taxonomy activation via 09), related 05/21 (`briefs/related.md`, ready), pattern selector/diff/
   update 13/14/15, Worker transports for 09/12-17 reads, CMS-03C-19 Worker sweep.
7. Wave D: Web pages/islands (FE03 1066–1072 routes), apispecs, E2E, a11y, perf; spec cascade AC189–285.
8. Owner question pending: CMS-03C-09 retire policy (asked 2026-10-14 ~05:47Z). Not yet asked: commit
   authorization (needed for Slice 11 AC045).
9. Budget: 5-hour window caps after ~1 h of 5–6 lanes; weekly all-models 25%, Fable 35% at ~11:00Z.

## Combined staged run 1 (root, 2026-10-14T10:44Z)

Lanes governed-a + pattern-def + taxonomy-def + governed-fix (22 WIP migrations): 8 files, 1,969 tests,
37 fail — all in `phase_02_slice_12_pattern_definition.sql` (50–52, 202–206, 208, 210–213, 218–221,
223–236). Governed submit/fix/assignment/decision/reads and taxonomy definition + witness all pass
(taxonomy 060 #1061–1065 now pass with `details.domain`). TAP
`.lane-logs/alt-staged-governed-a+pattern-def+taxonomy-def+governed-fix-064427-3158036.tap` SHA `93f8657b…`.
Diagnosis (corrected by `review-governed-fix.md`): #50–52 fail because the pattern suite's
`025-agreement.sqlinc:16-22` calls the digest recompute without `app.cms_rpc` against a forced-RLS
registry — a harness defect for the pattern lane, not a digest defect (#198 is the real end-to-end
agreement proof and passes); #202 real independent approval (CMS-03C-07) of a PATTERN subject refused P0001 (governed-a
drove template subjects only); #208/#225+ need CMS-03C-09 activation (not built); #223/#238 tokens
`nested_pattern_not_active`/`VALIDATION_FAILED` where `pattern_nodes_exceeded`/`pattern_cycle` expected —
downstream of missing activation (children never active).

## Decisions to record as DEC raw entries at slice close (do NOT run compile.mjs over manual edits)

- Token-less provider 4xx (incl. PGRST202) → scrubbed 500 in 03c (BE03c 1298–1302).
- Pattern lineage migration refuses unconvertible legacy state with 55000; no grandfathering (BE03c :217, :1425).
- Deprecated blocks admitted at pattern create and governed recompute; only missing/withdrawn/incompatible refused (BE03c 396, 1361).
- Pattern depth ≤8 is authored forest depth; only the 512-node bound is after expansion (BE03c 396, 1361).
- Block compatibility = compiler-range check, not a renderer-manifest allowlist (ruling B; fail-closed; registry ordering).
- Governed submit: inactive nested pattern → `subject_not_submittable`; hash mismatch 422 `/subjectHash`; `details.domain`.
- Reason-less 409 accepted where the catalog code identifies the conflict (version/idempotency CAS; governed re-revoke F-3).
- Related: hidden source 404; hidden/absent/ineligible target uniform 422 (BE03c 385/1381 over 163).
- Placement graph refusals (cycle/depth/nodes), if raised, map to typed 422 validation (BE03c :378), never a scrubbed 500; no reasonCode outside the closed list (revises an earlier 500 ruling).
- Placement: no template → slotPath `/` only; templated → a template slot, `/` refused (BE03c 1365/AC-218); archived entry → `revision_not_editable`; backfill guard pause in migration ratified.
- Governed claim takes subject row SKIP LOCKED on retries exhausted (ratified); expired-but-unrecovered lease honored under schedule row lock (03b parity); schedule takes the lineage advisory lock last.
- Governed 09 committed invalidation answers `dependency_changed` (BE03c 1262/1326); metric `cms_governed_activation_total{subject_kind,action,outcome}` label vocabulary (sweep action `activate`).
- Locale ratifications pending review (UUIDv5 namespace, `locale_variant_not_approved` phase, deadlock → CONFLICT).

## Slice 12 criterion map (from tracker text, 2026-10-14)

Per-operation rows: 01 AC004–009; 02 AC010–015; 03 AC016–021; 04 AC054–058; 05 AC059–063;
06 AC064–069; 07 AC070–075; 08 AC076–081; 09 AC082–087; 10 AC088–093; 11 AC094–099; 12 AC100–105;
13 AC106–111; 14 AC112–117; 15 AC118–123; 16 AC124–129; 17 AC130–135; 18 AC136–141; 19 AC142–147;
20 AC148–152; 21 AC153–158; cmsTemplateContextRead AC159–164; cmsTemplateLatestRead AC165–170;
cmsPatternLatestRead AC171–176; cmsTaxonomyVersionsRead AC177–182; cmsTaxonomyTermsRead AC183–188.
Cross-cutting: AC001–003, AC022–053 (IA/template/composition rules, receiving criteria AC051–053),
AC189–285 (spec-cascade obligations and CMS-15/16 IA rows). Gap analysis per criterion:
`docs/handoffs/2026-10-12-claude-s12/ledger-gap-*.md` (source reading as of 2026-10-12).
