# Lane order report (Slice 11, 2026-10-11)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`. The lane started at HEAD `813fcafd`; HEAD was
`6af4f106` for every run below (the orchestrator committed meanwhile). Nothing was staged, committed, stashed or reset. The tree also held
another lane's uncommitted migration `20261010167000_cms_valid_field_input_fast_accept.sql`, which every reset in this lane applied. All
logs are under `.lane-logs/order/` (local, ignored by git). Input: `.lane-logs/claude-diag2-20261011-040555/`.

## Summary

| Finding | Root cause | Fix | Result |
| ------- | ---------- | --- | ------ |
| 1a. 5 files (11 failed tests plus 16 skipped behind two file-level failures): composition x9, composition-flows, review-chain, diagnostics, read-workflow | Every Slice 11 suite committed its own active content type for the one shared bootstrap owner. The CMS-03B-14 authoring-context read serves at most 32 creatable types and refuses the 33rd as `INTERNAL_ERROR` (BE03b `creatableTypes.max(32)`, pgTAP EC-103). The schedule file's own authoring-context read was 22,628 bytes (about 707 bytes per type, consistent with exactly 32); every world prepared after it got the 70-byte `{"code":"P0001",...,"message":"INTERNAL_ERROR"}`. Which files failed depends on vitest's result-cache file order. | Slice 11 worlds share ONE active type (`s11shared_*`), found again by read-only SQL; a suite that supersedes or compares types asks for `{ fresh: true }`. | fixed |
| 1b. schedule `[CMS-03B-07] readable nonpublisher ...` | `phase-02-slice-11-publish.apispec.ts` inserted a standing `cms.publisher` grant (`valid_through null`) for the shared owner in its separation-of-duties test and never removed it. The schedule test claims the owner as publisher expecting `capability_missing`; the owner now held the capability. | The test uses a dedicated author member (`addMember`) who holds publisher; nothing is granted to the shared owner any more. | fixed |
| 2. `db:races` | The 4th `pnpm db:reset` died in `supabase db reset`'s schema-initialisation container (`LegacyDbSetupError`, "error running container: exit 1"). The CLI prints that error as JSON on stdout, and the gate discards stdout, so the log showed only "Initialising schema...". It is an intermittent CLI/stack flake: 5 of the 263 reset logs in `.lane-logs` (3 `LegacyDbSetupError`, 2 `LegacyHealthCheckTimeoutError`), and the gate resets 22 times per run. It happened again in this lane's own run (before runner 015) and was recovered. | `pnpm db:reset` is now `node infra/reset-local-database.mjs`: `supabase db reset --local`, repeated up to 3 times only for those two CLI failures, echoing both streams and reporting every failed attempt with the CLI's error line. A migration error is never retried. | fixed |
| 3. `db:types:check` stale | Consequence of 2: the failed reset left a recreated, EMPTY database, so the generated types differed. The types are NOT stale against the migrations: `pnpm db:types:check` exits 0 on a clean reset and after a complete race run. The race runners do leave schema objects behind by design (race 030's `cms_publication_settings_effective_values` stand-in and the `public.s10race_gate`, `s11race_*gate` functions and triggers, which `gen types` WOULD emit from `public`); the gate's reset before each runner and at the end is what removes them, so the only exposure is a gate that ends without its last reset. | No type regeneration, no runner change. The reset retry removes the cause that ended the gate early. | verified, nothing to regenerate |

Final runs on a fresh main-stack reset, lane discipline (quiet lock shared, CI lock exclusive, reset under `/tmp/wejammin-reset.lock`):

- `pnpm db:api-test`, one invocation, 06:16-07:07: **71 files, 843 tests, all passed** (was 6 failed / 64 passed files, 12 failed / 811 passed / 16 skipped tests;
  the 4 added tests are the new world-isolation spec). `.lane-logs/order/api-full-1/db-api-test.log`.
- `pnpm db:races`, one invocation, 07:23-08:22: **All 21 race runners passed**, 592 assertions, 38 receipt lines. Runner 014 -> 015 reset failed once with
  `LegacyDbSetupError` and the wrapper recovered ("attempt 1 of 3 failed ... resetting again"). `.lane-logs/order/races-full-1/db-races.log`.
- `pnpm db:types:check` right after the races: exit 0 ("Generated database types match the migrated local schema."). `.lane-logs/order/races-full-1/db-types-check.log`.

## Finding 1a: the 32-type bound

RED (`.lane-logs/order/red-ab/vt-red-a-isolation.log`, new spec against the HEAD world helper, fresh reset): `[CMS-03B-14] preparing a world again reuses the
shared content type, so the creatable types of the shared owner do not grow with the number of suites` fails at `phase-02-slice-11-world-isolation.apispec.ts:62`,
`expected { owner, contentTypeId: '107a19ba-...', ...} to deeply equal {... contentTypeId: 'b874ecb3-...'}` (a second `prepareS11World()` committed a second type).
The production failure it stands for is the diagnostic itself: `db-api-test.log` lines 802-848 (`cms_get_entry_authoring_context 400 bytes=70`, then `GET 500`).

Fix: `tests/postgrest/support/phase-02-slice-11-type.ts` (`findSharedS11Type`: read-only SQL for the owner's active, compiled type whose key starts `s11shared_`;
`ensureS11ContentType(owner, { fresh })`), `phase-02-slice-11-world.ts` (`prepareS11World(typeOptions)`), `phase-02-slice-11-schema-lifecycle.ts`
(`prepareS11SchemaCandidate(owner, source, typeKeyPrefix = 's11')`), `phase-02-slice-11-recheck.apispec.ts` (both worlds `fresh: true`: the activation supersedes
`world`'s version and `control` must stay another type). Still produced by the genuine CMS03A chain; no raw activation rows.

GREEN: `.lane-logs/order/green-ab/vt-green-a-isolation.log` 4/4; full run above.

The product was not changed. The bound is a ratified decision (EC-103: overflow fails closed, never truncates). See open item 1.

## Finding 1b: standing publisher grant

RED, the canonical order on one database (`.lane-logs/order/red-ab/`): old publish file passes (`vt-red-b-1-publish.log`, 10/10), then
`vt-red-b-2-schedule.log` fails `[CMS-03B-07] readable nonpublisher is exactly 403 ...` at `phase-02-slice-11-schedule.apispec.ts:182` with
`details (expectedSha=fa10bb51ffdbc4e7 actualSha=90083bbce0013109)`, the same two digests as the diagnostic (`db-api-test.log:848`); then
`vt-red-b-3-canary.log` fails `[CMS-03B-18] no suite leaves a standing reviewer or publisher grant on the shared owner` at `:100` with `expected 'cms.publisher' to be ''`.

Fix: `phase-02-slice-11-publish.apispec.ts` (the separation-of-duties test: a dedicated `addMember(..., ['cms.author','cms.editor','cms.publisher'])` authors the draft and
publishes it; the E11 rule is "the author of the revision", `20261005017720_cms_publish_revision.sql`), `support/phase-02-slice-11-flow.ts`
(`approvedDraft(stack, world, title, reviewer, author = world.owner)`; the owner still assigns, CMS-03B-18 derives from the owner receipt).

GREEN, same order (`.lane-logs/order/green-ab/`): publish 10/10, schedule 7/7, world-isolation 4/4.

## Finding 2: reset flake

RED (`.lane-logs/order/red-reset-unit.log`): `phase-02-slice-11-reset-resilience.test.ts` fails with `Cannot find module '.../infra/reset-local-database.mjs'`.
Then one GREEN failure fixed on the way (`green-reset-unit.log`: the report line carried the CLI's last stderr line instead of its JSON error line), final GREEN
`.lane-logs/order/green-reset-unit-2.log`: 2 files, 19 tests (8 new + the 11 of `phase-02-slice-09-race-runner-gate.test.ts`, unchanged).
Production reproduction of the fix: the race run above (`races-full-1/db-races.log:6373-6380`).

`infra/run-database-race-runners.mjs` is unchanged: it still calls `pnpm db:reset`, and the wrapper now reports every failed attempt on stderr, which that gate inherits.

## Files changed

- `tests/postgrest/support/phase-02-slice-11-type.ts` (rewritten), `phase-02-slice-11-world.ts`, `phase-02-slice-11-schema-lifecycle.ts`, `phase-02-slice-11-flow.ts`
- `tests/postgrest/phase-02-slice-11-publish.apispec.ts`, `tests/postgrest/phase-02-slice-11-recheck.apispec.ts`
- NEW `tests/postgrest/phase-02-slice-11-world-isolation.apispec.ts`
- `tests/postgrest/README.md`
- NEW `infra/reset-local-database.mjs`, `infra/README.md`, `package.json` (`db:reset` only)
- NEW `tests/contracts/phase-02-slice-11-reset-resilience.test.ts`

No migration, production source, generated type or race runner changed. No `TODO`; no assertion weakened or skipped.

## Test titles

No existing title changed. Bodies changed: `[CMS-03B-09] the author of the revision may not publish it even with a standing publisher grant: 403 separation_of_duties and no effects`
(same assertions; the author is a dedicated member instead of the shared owner) and the `phase-02-slice-11-recheck.apispec.ts` setup (`fresh: true`, titles unchanged).
Both files are cited by the evidence ledgers, so their content digests changed: regenerate their receipts.

Added (`phase-02-slice-11-world-isolation.apispec.ts`):
`[CMS-03B-14] preparing a world again reuses the shared content type, so the creatable types of the shared owner do not grow with the number of suites`;
`[CMS-03B-14] a world that asks for its own content type commits exactly one more creatable type and leaves the shared type creatable`;
`[CMS-03B-14] the shared owner is served its creatable types with at least 8 to spare under the bound of 32`;
`[CMS-03B-18] no suite leaves a standing reviewer or publisher grant on the shared owner`.

Added (`phase-02-slice-11-reset-resilience.test.ts`, describe `a transient supabase db reset failure does not fail a database gate`): resets again after `LegacyDbSetupError`;
resets again after `LegacyHealthCheckTimeoutError`; does not retry a migration error; gives up after the attempt limit; never reports success for a signalled CLI;
reports each failed attempt; classifies only CLI infrastructure failures as transient; `pnpm db:reset` runs the wrapper.

Spec lines satisfied: BE03b `AuthoringContextResource.creatableTypes.max(32)` and CMS-03B-14 (unchanged, now respected by the fixtures); BE03b CMS-03B-09 E11 (author of the revision) and
CMS-03B-07 `capability_missing` (the negative control is valid again).

## Open items

1. Product/spec gap for the owner: BE03a has no cap on active types per owner, but CMS-03B-14 refuses the 33rd creatable type with `INTERNAL_ERROR` and no truncation (EC-103), so an
   organization with 33 active compiled types cannot open the create form at all. I did not change this ratified behaviour; it needs a decision (cap at activation, or paginate/select).
2. `pnpm lint` / `format:check` pass for my files (eslint `--max-warnings=0` and prettier clean). `tests/documentation-boundaries.test.ts` fails today on another lane's directory
   (`docs/handoffs/2026-10-10-claude-s11/lane-bench-logs/probes/README.md` missing; `lane-bench2-logs` will need one too). Not mine.
3. `lane-db.sh`, `lane-api.sh`, `lane-db-alt.sh` call `supabase db reset` directly and so still meet the same ~2% flake; they can call `pnpm db:reset` or loop the same way.
4. Vitest orders files by its result cache (failed first, then slowest). That is why a different set of files failed in each diagnostic and why the six failed files ran first
   in the next run. Any remaining order coupling shows up only in another order; the world-isolation spec's last two tests are canaries for the two couplings found here.
5. The race runners still leave `public.s1[01]race*_gate` functions and a replaced `cms_publication_settings_effective_values` behind by design; the gate's resets are the cleanup.
   Running one runner by hand and then `db:types:check` without a reset would report stale types.
