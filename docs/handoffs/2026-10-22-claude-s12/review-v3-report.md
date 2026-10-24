# Promotion review V3: lane `claude_s12_dec208_obs` (DEC-208 / DEC-213 database-side locale observability)

Reviewer: independent promotion reviewer V3 (did not author any file below). Read-only: no SQL, docker, supabase, pgTAP, race
module or staged runner was run. Read-only Vitest and ESLint were run (results below). Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD
`b16edb54a7a1b698ed8ca15b6085046d4270626e`. Review time 2026-10-23T01:29Z (clock read from `date -u`).

## Verdict

| Lane | Verdict |
| --- | --- |
| `claude_s12_dec208_obs` SQL (`supabase/migrations-wip/dec208/*`) and its pgTAP suite | **FIX FIRST** |
| `claude_s12_dec208_obs` Worker probe and the shared Worker edits | no blocking finding (ratify after the SQL is fixed; the probe is only as good as the RPC it reads) |

Counts by severity: **BLOCKER 1, MAJOR 2, MINOR 4, NIT 4** (11 findings).

The one thing that must change before promotion: the reader and its wrapper never hold the CMS RPC context
(`app.cms_rpc = 'true'`), so over the real PostgREST call they read zero rows from forced-RLS tables and answer
`{"fanoutRows":0,"staleFieldsAppended":0,"staleLegalFields":0}` forever. The alert input (AC-264) and both counters (AC-052, AC-263)
would be permanently dead while every test is green. The repo has hit and fixed this exact defect class twice already (F-1 evidence).
Everything else the seven requested checks cover is correct.

## Scope (files and SHA-256, all verified equal to the lane report's 16-hex prefixes)

| File | Lines | SHA-256 |
| --- | --- | --- |
| `supabase/migrations-wip/dec208/20261022100000_cms_locale_variants_observability_indexes.sql` | 20 | 1442f1b4ba183dd77910d382040cd8a7cfff7e92438a9b32c8b2ace4747f8914 |
| `supabase/migrations-wip/dec208/20261022100010_cms_locale_observability_read.sql` | 110 | 57ebe9aad18811f628c938b9ea076d7c8c611f24786ca40a4f74caf4f89fb791 |
| `supabase/migrations-wip/dec208/20261022100020_cms_locale_observability_read_public.sql` | 43 | df0b6b7181930268546887aaecfacd61508eb82a21f01c67e9ac7e74dee3e360 |
| `supabase/migrations-wip/dec208/README.md` | 14 | 97c613de32afa7c11827ce491b9093eecfced40b731c82620d4afd52ecc40807 |
| `supabase/tests/phase_02_slice_12_locale_observability.sql` | 33 | b3d73c0bb31a1b2599e5eb284edaef13c3e55d85f12a3325ef51b577dfbb2156 |
| `supabase/tests/phase_02_slice_12_locale_observability/000-helpers.sqlinc` | 84 | a6cd8d7b77fcedfecb8e0f54ef280ebb9f6f4f59b67efc1cb0bcc38990aedd12 |
| `.../001-shape-and-grants.sqlinc` | 77 | 1267f900ededd587203961dc432bd472df6598def0a78a2d9236a98620bcf9a9 |
| `.../002-refusals.sqlinc` | 44 | 57e3c73a3751b11d94a316199c7c80c30905c7d5180f0406a35bc390420a88a4 |
| `.../003-window.sqlinc` | 111 | 3dff07d33e4ab1cc88338c729e97e4c07e7c9677dc21702b013fa2b2672bf0e0 |
| `.../004-gauge.sqlinc` | 78 | fad2ffa51680eb531621722c6370ef07e779920d58bd52d904e75d79f809733b |
| `.../README.md` | 14 | dbeb7fa98e09c4575165cb6897d0a347d777bc59dd7733ada6caa1c990e87721 |
| `apps/worker/src/cms-composition/locale-observability.ts` | 183 | a0b5eb0d417e8fc898c8299b11daeee5649cdb0f40b17ad68f88e0f03b5f6fb5 |
| `apps/worker/src/cms-composition/locale-observability.test.ts` | 163 | efca66baa325c4ab21ceaf40547d462d435a0fd8effd266e5317aacd53b4543c |
| `apps/worker/src/cms-composition/locale-observability-probe.test.ts` | 331 | 5b59202888e88835318ca6acbab18e1cdc102e70ac2dcdcb58469f413feb3f92 |
| `apps/worker/src/async-entrypoint-locale-observability.test.ts` | 121 | c275530f60994a9be6317beafbc442b2c793db0f40f20081606b75637720e0a3 |
| `apps/worker/src/production-async-entrypoint-locale-observability.test.ts` | 153 | 00b81b5729503fa9245ca40ee89af9adc77eb4cc872de3e744fdc6ce31a98ed9 |
| `apps/worker/src/async-entrypoint.ts` (locale lines only: 134-140, 304-310, 316) | 322 | e1b223b31eadf77f086d736cf1f640c8c5075ec81237910b537d4ba92dc56080 |
| `apps/worker/src/production-async-entrypoint.ts` (locale lines only: 136-137) | 199 | 1333421461ad9541c69cf3d54eb0f2d6d528fcca7595947be15fa387795cf23d |
| `apps/worker/src/event-consumers/production.ts` | 126 | 068bcfe57f255122878236f0c8d5b2241189bfa3eeaba6cc4faa78c0f5bc0c78 |
| `apps/worker/src/event-consumers/rpc-names.ts` | 26 | 8cbd9cb7f21f50aca57e803197d0ba5be42b8191e155fc57fefae0e922039f27 |
| `apps/worker/src/cms-composition/observability-registry.ts` | 220 | 36f3f28f94a085e8df75b7f4cd45cfdf1655f57726abeb10f66aeafe08b82fb8 |
| `apps/worker/src/cms-composition/observability-registry.test.ts` | 184 | 86b0c72a464a0992e162cca833203e87539cc5cf0fedb2611db2dbf33acc1783 |
| `apps/worker/src/cms-composition/README.md` | 217 | 34602b361fca4eba2a03d879f9dcdc0c5dfbf053688ffba1c58ba86106952cd1 |
| `apps/worker/src/event-consumers/README.md` | 75 | 37c34372cf2e41dd7de6a94dc4358a819f0e94434f66366be8bf838d259cac7c |

Also read for the corrections: `apps/worker/src/production-async-entrypoint-event-consumers.test.ts`, `apps/worker/src/index-scheduled.test.ts`
(diffs against HEAD). `observability-registry.ts`, its test and `locale-observability.ts` are untracked in this worktree (no HEAD diff
exists), so I reviewed their full current text.

Evidence I generated (read-only):
- Focused Vitest, 7 files (both locale-observability suites, both entrypoint locale suites, registry, event-consumers production,
  index-scheduled): **82/82 passed** (matches the lane's 82/82). Adjacent scheduled-tick suites that count RPCs (19 files):
  **149/149 passed**, so no other count oracle is stale. ESLint `--max-warnings=0` on every touched Worker TS file: clean.
  Logs: scratchpad `review-v3/vitest-focused.log`, `vitest-adjacent.log`, `eslint.log`.
- TAP, read only: run 4 `.lane-logs/alt-staged-...dec208-210446-3769325.tap` = 78 ok, 0 not ok, `Result: PASS`; its `.manifest` lists the three
  dec208 migrations with the same SHA-256 as the files on disk (so run 4 exercised exactly these bytes). Run 3 (`...205634-3726889.tap`):
  Files=14, Tests=528, 0 not ok, PASS. These prove the suite is green; they cannot prove F-1 absent (see F-2).
- Not independently re-run: the lane's 18/18 mutation run and its 717-file regression.

## Findings

| ID | Severity | file:line | Evidence (short) | Spec / rule | Proposed fix (short) |
| --- | --- | --- | --- | --- | --- |
| F-1 | BLOCKER | `supabase/migrations-wip/dec208/20261022100010_cms_locale_observability_read.sql:25-91`; `20261022100020_cms_locale_observability_read_public.sql:5,9-21` | Reader and wrapper never set `app.cms_rpc`; all four tables it selects are FORCE RLS with the single policy `USING (cms_rpc_context_valid())`; the owner `wejammin_cms_definer` is NOBYPASSRLS; PostgREST starts without the flag. Result: 0 rows, answer all zeros, no error. Wrapper header states the omission as a decision. | SEC-2 (`20261003120000:3-10`, `20261003120360:1-11`, `20261013100500:1-10`, `20261003120410:1-15`); BE03c DEC-208 paragraph (the RPC must report the fan-out and the stale gauge) | Private reader sets the flag after validation; wrapper becomes the flag-restoring plpgsql wrapper (dec205 shape). Exact SQL in F-1 details. |
| F-2 | MAJOR | `supabase/tests/phase_02_slice_12_locale_observability/003-window.sqlinc:6,12,18,22,41,74`; `004-gauge.sqlinc:21,25,55`; `001-shape-and-grants.sqlinc:76-77` | Every read in the suite runs with the flag left `'true'` by the fixtures; the one `service_role` transport assertion only checks `? 'fanoutRows'`, which zeros satisfy. The suite cannot fail on F-1. | `.claude/rules/tdd-contract-first.md` (tests ARE the spec); lane-rules "Never ... weaken a test"; repo precedent `supabase/tests/phase_02_slice_12_fix_template_reads_rpc_context.sql:8-14` | Add a RED-first fragment: flag cleared, real caller path, real counts, flag restored, plus an RLS negative control. Sketch in F-2 details. |
| F-3 | MAJOR (root-owned precondition) | `supabase/tests/phase_02_slice_09_r8_api_surface.sql:74-167,183,187,235` | The pin requires every `cms_` function of `platform_api` to be classified and counts the supported set (`8 + 10 + 74`). The new wrapper is `cms_locale_observability_read`, executable by `service_role`, in no list. The lane flagged it (report Requests #3) but nobody has edited the file. | `.memory/pipeline/progress/slices/phase-02-slice-12.md` AC-261 (RPC and grant inventory); DEC-213 Downstream "AC-261 RPC inventory cascade" | In the same promotion add `('cms_locale_observability_read')` to `r8a_supporting` and make the count 75 (line 235 title). |
| F-4 | MINOR | `supabase/migrations-wip/dec208/20261022100010_cms_locale_observability_read.sql:7`; BE03c line 1772 | Comment (and the spec sentence it copies) says "`created_at` is the writer's transaction start". The fan-out writer stamps `snapshot_time := clock_timestamp()` at function entry (`supabase/migrations/20261014050300_cms_stale_locale_dependents_slice12.sql:46`, inserted at `:98-103`). The claim "a writer transaction shorter than two minutes is never missed" still holds (later stamp, shorter remaining time), but a migration comment is frozen at promotion. | BE03c 1772; `.claude/rules/specificity-standards.md` | Reword the comment now ("`created_at` is `clock_timestamp()` taken when the fan-out writer starts, never earlier than the writer's transaction start"); ask root to correct the BE03c sentence. |
| F-5 | MINOR | `20261022100010...sql:64-84`; index `20261022100000...sql:13-18` | The gauge enumerates every `state = 'stale'` row ever written (append-only, never pruned) through index A, then probes index B once per row; cost grows with total stale history, not with current heads. The only bound is the Worker's 5 s abort, which becomes a warn log (`locale-observability.ts:136-150`); nothing alerts on persistent probe failure, so at scale the alert input disappears silently. | BE03c 1772 ("so neither read scans the table"); the spec fixes this shape | No code change required to promote. Record the limit in `dec208/README.md`; ask root for a follow-up (alert on N consecutive `LOCALE_OBSERVABILITY_UNAVAILABLE`, and a seeded-volume timing test like `phase_02_slice_12_locale_perf`). |
| F-6 | MINOR | `003-window.sqlinc:60-73`; `004-gauge.sqlinc:41-54` | `set local session_replication_role = replica` (disables the write guard, the immutability guard and the FK triggers) is used to pin instants and to forge a `de-de` draft row. Lane rule "Never disable triggers" and the brief's fixture rule forbid it; precedent exists (`phase_02_slice_12_locale_variant/002-limit-and-fanout.sqlinc:235`). The forged row references a `de-DE` revision, which `cms_locale_variants_revision_locale_fkey` (`20260927370000:11-17`) would refuse; no real writer can store a second case. No defect is hidden by it (check 7 below). | `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` "Never"; review brief fixture rule | Accept with the note that the `de-de` branch is defensive and unreachable today; ideally also insert a matching `de-de` revision so the forged state is FK-consistent. |
| F-7 | MINOR | `003-window.sqlinc`, `004-gauge.sqlinc` (fixture world) | Surviving mutations: (a) count rows instead of members (`count(distinct variant.id)` for `count(*)`, `100010:64`): no variant has two stale `no_fallback` fields, so both give 2 then 1; (b) drop `definition.state = 'active'` (`:76`); (c) drop `version_row.state::text = 'active'` (`:71`): no deprecated/retired definition and no second version exists; (d) no second entry, so cross-entry aggregation is unproved; (e) no real, unpinned fan-out row is ever read through its own minute window. | BE03c 1772 ("`stale_field_ids` members", "in the entry's current schema") | Add a variant with both `legal` and `terms` stale, a retired definition and a superseded type version, a second entry, and one unpinned real row read via `date_trunc('minute', created_at)`. |
| F-8 | NIT | `20261022100010...sql:34`; `20261022100020...sql:18`; `001-shape-and-grants.sqlinc:7,21` | Function-level `SET statement_timeout = '5s'` cannot bound the calling statement (PostgreSQL arms the timer at statement start) and the spec now says the bound is the Worker's 5,000 ms abort. Root accepted it as harmless; it is permanent after promotion and pinned by pgTAP, a trap for a future reader who believes the database enforces 5 s. | BE03c 1772 and changelog row 1885 | Optional: drop it from both functions and the two pins while the files are still WIP. If kept, the comments already say it is inert. |
| F-9 | NIT | `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md:1617` | BE03c "Permission, RLS and grants" names the internal RPCs; `cms_locale_observability_read` is not listed (nor in AC-261's text). DEC-213 Downstream says root owns this cascade. | DEC-213 Downstream | Root: add the RPC to the internal-RPC list and AC-261. |
| F-10 | NIT | `20261022100010...sql:64-84` | Entries in any lifecycle (`active`, `archived`, `deletion_pending`, `held`; `20260926090000:33-34`) are counted. If a lifecycle other than `active` cannot be edited (I did not trace each lifecycle's edit rules), a stale `no_fallback` field on such an entry could never be revalidated and the alert for it could not clear. Spec-literal ("every entry's current locale variant"); recorded so the owner can decide before promotion makes it immutable. | BE03c 1772 | Owner/root question; no change unless the spec is amended. |
| F-11 | NIT | `apps/worker/src/cms-composition/observability-registry.ts:10` | Header still says "the twelve Slice 12 metrics ... plus `cms_no_fallback_block_total{reason}`"; the registry now has fifteen entries (adds `cms_locale_stale_total`, `cms_locale_stale_legal_fields`). | `.claude/rules/extensibility.md` | One-line comment fix. |

## Finding details

### F-1 BLOCKER: the reader never holds the CMS RPC context, so it reads nothing in production

What the code does. `platform_private.cms_locale_observability_read` (`100010:25-91`) validates the window, then runs two `select`s over
`platform_private.cms_locale_variants`, `cms_content_entries`, `cms_content_type_versions` and `cms_field_definition_versions`. It never
calls `set_config('app.cms_rpc', ...)`. The wrapper (`100020:9-21`) is a one-line `language sql` delegate, and its header says so on purpose:
"A read: it sets no RPC-context flag and writes nothing." (`100020:5`).

Why that returns nothing.
1. All four tables are `ENABLE` + `FORCE ROW LEVEL SECURITY` with exactly one policy, `<table>_rpc_policy FOR ALL TO public USING
   (platform_private.cms_rpc_context_valid())`: `cms_locale_variants` at `20260927310000_cms_locale_related_authority.sql:102-120`
   (policy at `:114-117`); `cms_content_entries` at `20260926090000_cms_entry_revision_authority.sql:258-282`
   (policy at `:276-279`); `cms_content_type_versions` and `cms_field_definition_versions` at
   `20260902080000_content_schema_registry_authority.sql:2199-2213`. No later migration adds a permissive or definer-specific policy for
   these four (grep of every literal `create policy` in `supabase/migrations`; the definer-specific policies of
   `20261003120200_cms_definer_non_slice09_policies.sql` cover identity and non-CMS tables only), and the SEC-2 gate itself asserts that
   no `cms_*` forced table carries a blanket `USING (true)` policy except the three code-owned registries
   (`supabase/tests/phase_02_slice_09_sec2_definer_rls.sql:131-137`).
2. `cms_rpc_context_valid()` is `select pg_catalog.current_setting('app.cms_rpc', true) = 'true'`
   (`20260902080000_content_schema_registry_authority.sql:1600-1606`).
3. The reader is owned by `wejammin_cms_definer`, created `NOBYPASSRLS` (`20261003120000_cms_definer_roles.sql:31`); the migration's own
   header explains that the policies are therefore evaluated for every statement a function it owns runs (`:3-10`).
4. The caller is the Worker: `POST /rest/v1/rpc/cms_locale_observability_read` with `Content-Profile: platform_api` as the service role
   (`apps/worker/src/async-runtime-rpc-transport.ts:62,100-102`). A PostgREST request starts with `app.cms_rpc` unset (no
   `db-pre-request`, no role-level setting: grep of `supabase/config.toml` and all migrations finds none).
5. So both queries see zero rows and the function returns `{"fanoutRows":0,"staleFieldsAppended":0,"staleLegalFields":0}` with no error.
   The Worker parses that as a healthy sample; the gauge is 0 forever; `evaluateCmsCompositionAlerts` never fires.

This is the third occurrence of the same class in this repo, each time found late because "their fixtures leave the flag set":
- `20261003120360_cms_read_only_consumer_reads_hold_rpc_context.sql:1-11`: the two service-role consumer reads
  (`cms_capability_grant_read_current`, `cms_get_operational_state_snapshot`) were repaired to "hold the RPC context for their read ...
  and restore the previous value before returning" (`:14-40`).
- `20261013100500_cms_template_context_rpc_flag.sql:1-10`: "The read never set it, so over the real API ... it listed no content type ...;
  the pgTAP suites missed it because their fixtures leave the flag set." Its regression suite is
  `supabase/tests/phase_02_slice_12_fix_template_reads_rpc_context.sql` (header `:8-14`; pattern `:36-47`).
- Every sibling read lane in this wave does hold it: dec205 reader `supabase/migrations-wip/dec205/20261022020000_cms_get_locale_variant.sql:55`
  and wrapper `...20261022020010...sql:1-3,14-21`; dec206 and dec195 each contain one `set_config('app.cms_rpc'` in reader and wrapper.
  The dec208 lane is the only one that omits it.

Convention it violates: "like every CMS wrapper (20261003120410), remembers the RPC-context flag and restores it before it returns"
(`20261003120410_content_rpc_flag_restore.sql:1-15`; quoted in the dec205 wrapper header).

Confidence and how to confirm cheaply. I did not run SQL. The policy chain above is static and complete, and the two repaired
precedents describe the same symptom. Confirmation is the F-2 test: run it RED against the current bytes (the real-caller assertion
returns zeros; the control shows the definer sees `0` rows with the flag cleared).

Proposed fix (exact shape; keep it in the WIP files, nothing is promoted yet):
- `20261022100010`: declare `v_previous_rpc text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');`, keep the three
  `VALIDATION_FAILED` checks first, then `perform pg_catalog.set_config('app.cms_rpc', 'true', true);` before the first `select`.
  Either keep `stable` (as `cms_capability_grant_read_current` does) or declare it volatile; if volatile, update the pin at
  `001-shape-and-grants.sqlinc:17-18`. Rewrite the header (`:16-20`) and the `comment on function` (`:94`), which currently describe a flagless read.
- `20261022100020`: replace the `language sql` body with the dec205 shape: `language plpgsql security definer set search_path = ''`,
  `rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '')`, call the private reader, then
  `perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);` and return. The variable name must be `rpc_previous` or
  `previous_rpc`: the SEC-2 catalog guard D (`supabase/tests/phase_02_slice_09_sec2_definer_rls.sql:461-477`) fails any `platform_api`
  function that reaches a flag-setting function by name without a restore matching that exact spelling. Fix the header (`:5`) and README
  (`dec208/README.md:10-11`).
- A different arrangement (wrapper sets and restores, private reader unchanged) also satisfies the guard, but then the private reader is only
  correct under a caller that already holds the context; the dec205 shape keeps the private reader self-sufficient.
- Bytes change, so run the new suite plus the 13 sibling `phase_02_slice_12_locale*.sql` files once through the staged runner again.

Wrapper, in the shape of `dec205/20261022020010_cms_get_locale_variant_public.sql:7-22` (the ACL, owner and `do $closure$` tail of
`20261022100020` stay as they are):

```sql
create function platform_api.cms_locale_observability_read(
  p_window_start timestamptz,
  p_window_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_locale_observability_read(p_window_start, p_window_end);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;
```

and in the private reader, between the last `VALIDATION_FAILED` check (`100010:54`) and the first query (`:56`):
`perform pg_catalog.set_config('app.cms_rpc', 'true', true);`. When the reader raises `VALIDATION_FAILED` the flag was never set, so
there is nothing to restore; if it raises later, the aborted statement's transaction-local setting is rolled back with it.

### F-2 MAJOR: the pgTAP suite is structurally unable to see F-1

- The Slice 10 fixtures set the flag for the whole rolled-back transaction (`phase_02_slice_10_rpc/001-fixtures.sqlinc:358,399`), the locale
  resolution world sets it again (`phase_02_slice_12_locale_resolution/001-world.sqlinc:58`), and this suite re-sets it after every
  producer call (`003-window.sqlinc:6,12,18,22,41,74`; `004-gauge.sqlinc:21,25,55`). No line of the suite ever clears it
  (grep: no `set_config('app.cms_rpc', '', ...)` in `phase_02_slice_12_locale_observability*`).
- The only assertion that runs the transport as the real caller is `001-shape-and-grants.sqlinc:76-77`, and it checks
  `(... ? 'fanoutRows')::text = 'true'`, which an all-zero answer satisfies.
- There is no assertion that the call leaves the flag as it found it (SEC-2: "an RPC does not leave the RPC-context flag set").

Required new fragment (RED first on the current bytes, e.g. `005-rpc-context.sqlinc`, plus the `\ir` line in the driver; the repo's own
template is `phase_02_slice_12_fix_template_reads_rpc_context.sql:36-47`). Place the real-caller assertion where the world still has the
gauge at 2 (between `004-gauge.sqlinc:10` and `:12`, window 12:00-12:01 expected `{"fanoutRows":2,"staleFieldsAppended":4,"staleLegalFields":2}`):

```sql
select set_config('app.cms_rpc', '', true);
select is(pg_temp.l208_as_role('wejammin_cms_definer', 'select count(*)::text from platform_private.cms_locale_variants'), '0',
  'control: without the RPC flag the forced policy hides every variant row from the definer role');
select is(pg_temp.l208_as_role('service_role', $q$select platform_api.cms_locale_observability_read(
    '2026-10-22 12:00:00+00'::timestamptz, '2026-10-22 12:01:00+00'::timestamptz)::text$q$),
  '{"fanoutRows": 2, "staleLegalFields": 2, "staleFieldsAppended": 4}',
  'the real caller path (service_role, no flag) returns the real counts');
select is(current_setting('app.cms_rpc', true), '', 'and leaves the flag as it found it (empty)');
select set_config('app.cms_rpc', 'true', true);
select pg_temp.l208_read('2026-10-22 12:00:00+00', '2026-10-22 12:01:00+00');
select is(current_setting('app.cms_rpc', true), 'true', 'and a caller that already held the flag still holds it');
```

Also assert, after a `VALIDATION_FAILED` call caught by `l208_try`, that the flag is unchanged. Re-set the flag to `'true'` after the fragment
because later fixtures expect it.

### F-3 MAJOR (integration precondition, root-owned)

`supabase/tests/phase_02_slice_09_r8_api_surface.sql` classifies every `cms_` function of `platform_api` (`:183`) and pins the exact
supported count (`:235`, "8 + 10 + 74"). Its supporting set was extended for dec205/dec206 (`:165-167`). The new wrapper is in none of the
lists, so `pnpm db:verify` goes red on promotion. The lane cannot edit another suite's file, so this is a promotion precondition, not a lane
defect. Add `('cms_locale_observability_read')` after `:167` and change `74` to `75` in the title at `:235`. The all-schema SEC-2 pin
(`phase_02_slice_09_sec2_all_schema_definer_rls.sql:111-113`) needs no edit: the reader names only tables already in that pinned set, and the
platform_api call matrix at `phase_02_slice_09_sec2_definer_rls.sql:387-458` derives its function list from the catalog.

### F-4 MINOR: "created_at is the writer's transaction start" is not what the code does

`cms_stale_locale_dependents` declares `snapshot_time timestamptz := pg_catalog.clock_timestamp();` (`20261014050300:46`) and uses it for
`created_at` and `updated_at` (`:98-103`, constrained equal by `cms_locale_variants_snapshot_time_check`, `20260927310000:39-40`). That is
function-entry wall time, inside the transaction and after its start. The safety argument is unaffected (a later stamp shortens the time to
commit), so the lane's behaviour is right; only the sentence is wrong, in an immutable migration comment and in BE03c line 1772.

### F-5 MINOR: gauge cost scales with total stale history

Query 2 (`100010:64-84`) filters `variant.state = 'stale'` with no `created_at` bound, so index A `(state, created_at)` is scanned across the whole
stale partition. Each row then costs one probe of index B and, for surviving heads, the entry, active-version and definition joins. Stale rows
are append-only and never deleted (`cms_locale_variants_immutable_guard`, `20260927310000:95-97`), and one source edit appends one per
dependent locale (up to 32 per entry). I did not measure it (no SQL was run; this is a cost-shape argument, not a timing): once the stale
history is large enough that one pass exceeds the 5 s Worker abort, every minute logs a warn and the alert input is silently gone. This
is the shape the spec fixed, so it is a risk to hand to root, not a lane defect.

### F-6 and F-7

Their evidence is in the findings table and in checks 3 and 7 below. The jsonb text form used in the F-2 sketch
(`{"fanoutRows": 2, "staleLegalFields": 2, "staleFieldsAppended": 4}`) is the one the run-4 TAP prints for this world (jsonb orders keys by
length, then bytes); comparing text avoids a harness abort if `l208_as_role` returns its `__error` marker.

## Specific checks requested

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Window is closed-open on `created_at`; Worker derives [T-3 min, T-2 min) from `scheduledTime` floored to the minute; boundary tests | **PASS** | SQL `100010:60-62` (`>= p_window_start and < p_window_end`). Worker `locale-observability.ts:59-73`: `tick = floor(scheduledTime/60000)*60000`, start `tick-3 min`, end `tick-2 min`, ISO strings with `:00.000Z`. pgTAP pins rows at 12:00:00 (counted), 12:00:59.999999 (counted), 12:01:00 (not counted in the first window, counted in the next) and checks the window ending at 12:00:00 excludes the 12:00:00 row (`003-window.sqlinc:60-100`, TAP 78/78). Vitest: exact ISO output for T, T+1, T+999, T+30 000, T+59 999 all equal; T-1 maps to the previous window; T+60 000 starts exactly at the previous end; 180-tick tiling has no gap or overlap; every window spans exactly 60 s between whole minutes; NaN, +-Infinity and +-1e30 refused (`locale-observability.test.ts:28-79`). The database also refuses non-whole-minute or non-60 s windows (`100010:41-54`, `002-refusals.sqlinc`). |
| 2 | `fanoutRows` counts only `state = 'stale'` and no other writer inserts `stale` rows | **PASS** (invariant of the code base, not of the schema) | I scanned every `insert into / update / delete from / merge into / copy` that targets `cms_locale_variants` in every `.sql`/`.sqlinc` file of `supabase/migrations` and every `migrations-wip/*` dir (comments stripped; script: scratchpad `review-v3/writers.mjs`). Eight inserts, no update, no delete. Six write `'draft'`: the author command family (`20260927440000:264`, `20260927510000:278`, `20260927580000:274`, `20261002167000:291`; `20261014050200:54,86` are anchor strings patching that command, not extra writers). The two `'stale'` inserts are `cms_stale_locale_dependents` (`20260927450000:78`, replaced by `20261014050300:98`). Every caller funnels into it: `cms_author_locale_variant` (`20261014050200:85`), the draft head-move trigger (`20261014050310:62`), `cms_localization_fanout` (`20261005010900:77`). The physical state is `check (state in ('draft','stale'))` (`20261014050000:93-94`), `stale_field_ids` is `[]` unless stale (`:74-75`), and the table is append-only (`20260927310000:95-97`). No WIP lane writes the table (dec205 reads only). Caveat: nothing in the schema forbids a future second stale writer. |
| 3 | `staleLegalFields` uses the resolver's `no_fallback` predicate and the dec205 current-row rule; the two indexes serve both queries | **PASS** | Predicate: `definition.localization_mode = 'no_fallback'` on an `active` definition of the content type's `active` version (`100010:67-77`) is the resolver's own: `cms_resolve_locale_field` selects the entry type's `state::text = 'active'` version (`20261014050500:171-175`) and `cms_locale_resolutions` takes `definition.state = 'active'` and `mode = definition.localization_mode`, blocking when `mode = 'no_fallback'` (`:76-83,139`). One active version per type (`cms_content_type_versions_one_active_unique`, `20260902080000:1540`) and one definition per (version, field) (`cms_field_definition_versions_stable_id_unique`, `:1177`) rule out multiplication. `stale_field_ids` members are unique lowercase UUIDs (`20261014050000:37-51`), so the `::uuid` cast is safe and no member is double-counted. Current row: dec205 orders `version desc, created_at desc, id desc limit 1` per `(entry_id, lower(locale))` (`dec205/20261022020000:92-95`); the reader's `not exists (newer ... lower(newer.locale) = lower(variant.locale) and (newer.version, newer.created_at, newer.id) > (variant.version, variant.created_at, variant.id))` (`100010:79-84`) selects the same row (all three columns NOT NULL, `id` is the primary key, so the order is total). Indexes: (A) `(state, created_at)` is the exact shape of query 1, equality on `state` plus a range on `created_at` (`:60-62`), so it is a bounded range scan; it is also the access path for query 2's `state = 'stale'` leading column (cost caveat F-5). (B) `(entry_id, pg_catalog.lower(locale), version desc, created_at desc, id desc)` carries the two equality columns of the anti-join probe in the same expression form (`pg_catalog.lower(locale)`), and the row comparison on the three trailing DESC columns is a single same-direction RowCompare, which btree can use as an index condition; it is also the exact `ORDER BY ... LIMIT 1` of dec205. Both exist, are valid and non-unique (`001-shape-and-grants.sqlinc:52-67`). The 004 fragment cross-checks the gauge against the real resolver (`no_fallback_stale` blocking for fr-FR and de-DE legal, `004-gauge.sqlinc:13-17`). Residual: the gauge counts stored `stale_field_ids` members as the spec says, not the resolver's live `own_has`/`own_stale` (lane observation c); correct per spec. |
| 4 | Answer is exactly three non-negative integers, no identifiers; `service_role`-only execute | **PASS** | `jsonb_build_object` of three `bigint` values (`100010:86-89`); `count(*)` and `coalesce(sum(...), 0)` cannot be negative. pgTAP asserts exactly the three keys, each a non-negative integer, no uuid or locale text (`004-gauge.sqlinc:60-69`). Worker parser rejects any other key set, negative, non-integer, string, boolean, null, NaN, Infinity and unsafe integers (`locale-observability.ts:78-96`; tests `:93-113`). ACL: both functions `revoke all ... from public, anon, authenticated, service_role`; only the wrapper regrants `execute` to `service_role` (`100010:99-100`, `100020:29-32`); pgTAP checks ACL entries including PUBLIC and the role matrix (`001-shape-and-grants.sqlinc:5-28,70-77`). Owner `wejammin_cms_definer`, `search_path=""`, no dynamic SQL, no write, no lock clause. |
| 5 | 5,000 ms deadline, failure containment, no `locale` label, alert at >0 | **PASS** (Worker); the data source is broken per F-1 | Deadline: `LOCALE_OBSERVABILITY_READ_DEADLINE_MS = 5_000` passed to `runWithDeadline` (`locale-observability.ts:32,132-135`), which aborts the signal at the deadline; the production transport honours the external signal (`async-runtime-rpc-transport.ts:83-84`, forwarded at `event-consumers/production.ts:77-79`). Tests with fake timers: a read resolving at 4 999 ms is used, one that would resolve at 5 001 ms is a swallowed failed read with allowlisted fields and no counter, gauge or alert (`locale-observability-probe.test.ts:254-318`). Containment: the probe catches everything it awaits; the entrypoint runs it in its own try/catch IIFE awaited in `finally` (`async-entrypoint.ts:304-310,316`), so a throwing, rejecting or retry-requesting sweep still samples and a failing sample never fails the sweep (`async-entrypoint-locale-observability.test.ts:52-90`). Failure log members are all in the allowlist and schema-valid (`:107-131,194-217`). Labels: the three metrics are label-free; `cms_locale_stale_total{locale="fr-FR"}` is rejected by `metricKeyConforms` (`observability-registry.test.ts:165-168`); a repo-wide grep finds no locale-labelled use outside historical reports and that negative test. Alert: `evaluateCmsCompositionAlerts` fires strictly above the threshold 0 (`cms-composition-alert-evaluator.ts:55-62`, `...-thresholds.ts:14`); tests: not at 0, at 1 once with `STALE_LOCALE_LEGAL_FIELDS`, any positive, never from the counters alone, none on a failed read (`locale-observability-probe.test.ts:134-188,320-330`; production-level `production-async-entrypoint-locale-observability.test.ts:113-127`). |
| 6 | The three listed test corrections are justified and not weakening | **ACCEPT all three** | See "Test-correction verdicts". |
| 7 | The forged `de-de` draft fixture does not bypass a producer in a way that hides a real defect | **No defect hidden by that fixture; but see F-1/F-2 for the fixture-wide blind spot** | The fixture (`004-gauge.sqlinc:41-58`) inserts one `draft` row with `version = previous + 1` and `stale_field_ids = []` under `session_replication_role = replica`. It is not an authority or approval bypass and creates no active row. Real supersession is separately proved with a real producer call (`004-gauge.sqlinc:20-35`: the fr-FR revalidation appends a real draft v3 and the gauge falls from 2 to 1). The forged row only exercises the `lower()` branch, and it mutates meaningfully (removing `lower()` flips the assertion at `:57-58`). It does build a state the schema forbids (revision-locale FK, F-6) that no real writer can reach, so it is defensive coverage only. The real hidden defect in this suite is not this row; it is that every read runs under a flag the fixtures left set (F-2). The instant pinning (`003-window.sqlinc:60-73`) rewrites `created_at` of rows that real producers made; acceptable, with the F-6 rule note. |

## Brief checklist walk-through

1. Security.
   - SECURITY DEFINER, `set search_path = ''`, owner `wejammin_cms_definer`, `revoke all ... from public, anon, authenticated, service_role`, execute to
     `service_role` on the wrapper only, no direct table grant to a browser role, RLS untouched (still forced), no dynamic SQL, no
     identifier or content in the answer: all OK (`100010:25-35,96-108`, `100020:9-32`).
   - **FAIL**: the definer does not satisfy the forced-RLS gate (F-1).
   - Authority: the only authority statement is the DEC-208 paragraph (service role, internal, no browser operation id); it is honoured.
     BE03c "Permission, RLS and grants" and AC-261 do not list the RPC yet (F-9).
2. Spec correctness (BE03c 1772, 1770, 1565, changelog 1884-1885; DEC-208, DEC-213 in `.memory/raw/events/2026-10-22.jsonl:6,11`).
   Behaviour matches on every sentence: closed-open window, whole-minute and exactly-60 s refusal as `VALIDATION_FAILED` (P0001 +
   `{"violations":[{"pointer","message"}]}`, the `20261002164000` convention), no lock, no write, exactly three integers, the two named
   indexes with the exact column lists. Nothing invented beyond the inert `statement_timeout` (F-8). Missing behaviour: only what F-1 implies
   (the reader must be able to see the rows).
3. Promotability. Timestamps `20261022100000/100010/100020` are unique across `supabase/migrations` and every WIP dir (the only
   duplicates in the WIP tree are `governed-recheck` vs `governed-recheck-red`) and ordered after the newest promoted file
   (`20261020203606`) and the newest WIP file (`20261022090100`). No promoted migration is modified. All three functions are new; no
   `create or replace` of a live body. No backfill, no data rewrite, no NOT NULL addition. Sizes 20, 110 and 43 lines. Index
   build takes a SHARE lock under `lock_timeout = '5s'` on a small append-only table: fail-fast and retryable. The WIP files are
   safe to edit for F-1 because nothing is promoted yet; after promotion the comments in F-4 and F-8 are frozen.
4. Locks. The reader takes no lock and writes nothing, so the BE03c/BE03b lock orders do not apply. (After the F-1 fix it sets and restores one
   transaction-local GUC; still no lock and no write.)

## Test-correction verdicts (lane report `## Test corrections`)

| # | File | Verdict | Reason |
| --- | --- | --- | --- |
| 1 | `apps/worker/src/cms-composition/observability-registry.test.ts` | **ACCEPT** | Additive and stricter: `cms_locale_stale_total: []` joins the spec oracle (DEC-208 drops its `locale` label); the exact-registry oracle gains the gauge `cms_locale_stale_legal_fields` (named by the DEC-208 paragraph); `metricKeyConforms` now accepts the three label-free keys and explicitly rejects `cms_locale_stale_total{locale="fr-FR"}`; the no-event list shrinks to `cms_pattern_linked_update_pending_total` because the two locale counters now have a source (BE03c 1565, 1772). One condition: that last shrink is only true once F-1 is fixed, otherwise the "emitted" counters read a permanently empty source. |
| 2 | `apps/worker/src/production-async-entrypoint-event-consumers.test.ts` (`:243-262`) | **ACCEPT** | Adds a handler for `cms_locale_observability_read` and the name to the sorted expected list of RPCs of one scheduled tick; the list stays exact (3 names), so a missing or extra call still fails. Required by BE03c 1772 ("on every firing"). |
| 3 | `apps/worker/src/index-scheduled.test.ts` | **ACCEPT** | The counts 9 and 10 equal the lengths of the exact sorted RPC lists (9 names listed in the first test; 6 earlier jobs + 4 later ones in the second), so they are not loosened; the new name is placed in sort order. The same diff also carries other lanes' lines (governed activation claim, merge convergence sweep); I checked that the counts and lists are consistent as a whole with one extra RPC for this lane. |

## Notes for root

1. Everything in F-1 to F-3 is cheap and local; do the RED-first test (F-2) before touching the SQL so the fix is proved, as the repo did for
   `20261013100500`.
2. After the SQL change the TAP counts change (78 plus the new assertions); one staged run of the new suite and the 13 sibling locale files covers it.
3. Outside this lane's scope, for awareness only (not counted above): the sibling read suites (`phase_02_slice_12_locale_variant_read`,
   `..._composition_instances_read`, `..._related_content_read`) also contain no flag-cleared assertion. Their functions do hold the flag
   (dec205 reader `:55`, dec206 and dec195 readers each have one `set_config('app.cms_rpc'`), so they are correct today, but they carry the same
   blind spot if someone later removes that line.
4. The Worker probe and the shared Worker edits (`async-entrypoint.ts` locale lines, `production-async-entrypoint.ts:136-137`,
   `event-consumers/production.ts`, `rpc-names.ts`, `observability-registry.ts`) can be ratified as they are; I found nothing to change in
   them beyond the NIT F-11. `async-entrypoint.ts` and `production-async-entrypoint.ts` also contain other lanes' governed-recheck and
   taxonomy-merge wiring, which I did not review.

## Promotion verdict per lane

- `claude_s12_dec208_obs`, SQL + pgTAP: **FIX FIRST** (F-1 BLOCKER, F-2 MAJOR, F-3 MAJOR precondition).
- `claude_s12_dec208_obs`, Worker + shared Worker edits + READMEs: no blocking finding.
