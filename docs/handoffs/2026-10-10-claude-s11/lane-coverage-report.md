# Lane report: Slice 11 coverage closure

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`, HEAD `5b7eee200a4b5f94b6275690e315d54e692f73c6` (nothing committed, staged or reset by this lane).

Result: all 18 files below 100% now report 100% lines, statements, functions and branches. No `v8 ignore` / `istanbul ignore` comment, no threshold change, no coverage exclusion, no existing `*.test.ts(x)` / `*.apispec.ts` edited.

How the per-file numbers were produced: vitest with `--coverage.include=<file>` over every test file that imports the module, plus a final union run over all 18 files (below). The subset runs reproduced the counts of the failed full run exactly (for example `posix-footer.ts` 4 statements / 7 branches), so the subsets were representative.

## Per-file results

Order of the original counts: lines / statements / functions / branches uncovered.

### packages/contracts (production)

| File | Uncovered before | Action | After |
| --- | --- | --- | --- |
| `cms-editorial/time-authority/local-datetime.ts` (0/0/0/1) | branch L159: the `: 0` arm of `digits.length > 2 ? … : 0` (hours-only offset such as `+01`) | 3 tests in `local-datetime.coverage.test.ts` (hours-only east/west offsets, compact `+0530`, `+24` / `-99` refused) | 100/100/100/100 |
| `…/posix-footer.ts` (0/4/0/7) | stmts L41, L64, L86, L167; branches L41, L63 (`rule ?? ''`), L64, L85 (`match[1] ?? ''`), L86, L104 (`month === 12 ? 31`), L167 | Six were provably unreachable and were removed by refactor (see below). The December arm got 3 tests in `posix-footer.coverage.test.ts`. | 100/100/100/100 |
| `…/time-authority.ts` (1/2/0/3) | L54-56 (release mismatch `TzdbIntegrityError`); L62 `return undefined` plus branches L61/L62 | Release mismatch: 2 tests in `time-authority.coverage.test.ts`. L61/L62 unreachable, removed (see below). | 100/100/100/100 |
| `…/tzdb-snapshot.ts` (2/2/0/2) | L34-37 ("transitions ascend strictly"), L39-42 ("transition offset index is out of range") | 5 tests in `tzdb-snapshot.coverage.test.ts` asserting the exact issue message and path | 100/100/100/100 |
| `…/tzdb-zone.ts` (1/1/0/9) | L142-144 (no instant and no gap throw); branches L37, L39 (`distinct[…] ?? 0`), L40 (empty footer), L51 (`times[middle] ?? 0`), L67, L84, L85 (`offsets[…] ?? initialOffset`), L87 (zone without footer) | 8 tests in `tzdb-zone.coverage.test.ts`; parallel-array fallbacks removed by restructuring (see below) | 100/100/100/100 |
| `cms-editorial/internal-rpc.ts` (0/0/0/1) | branch L151: `?? null` in `cmsScheduleRetryDelaySeconds` | unreachable behind the explicit bounds guard; simplified (see below); 10 tests in `internal-rpc.coverage.test.ts` | 100/100/100/100 |
| `cms-editorial/preflight.ts` (0/0/0/1) | branch L158: `?? []` in `registeredReasons` | unreachable (one registry row per category, already asserted by `preflight.test.ts`); `find()?.x ?? []` became `filter().flatMap()`; 1 test pins one row per category | 100/100/100/100 |
| `cms-editorial/route-policy-errors.ts` (0/1/0/1) | stmt + branch L53: `if (declared === undefined) return false` after `Object.hasOwn` | the two guards were one condition; merged into `const declared = hasOwn ? errors[code] : undefined`; 2 tests incl. an own code mapped to `undefined` | 100/100/100/100 |

Refactors of provably unreachable code (all behaviour-preserving for every input the callers can produce):

- `posix-footer.ts`: `FOOTER_PATTERN` already proves every captured offset, rule and time has the clock grammar, so `clockSeconds` no longer re-matches and cannot return `null` (it now splits on `:` and weights by `60 ** (2 - place)`; sign and the `-0` handling are unchanged). `parseRule` reads month/week/weekday from the already-validated `Mm.w.d` capture instead of re-running a second regex, so the `rule ?? ''` and `match === null` paths are gone. `yearChanges` takes the non-null daylight rule, so the `changes === null` guards in `footerOffsetAt` and `footerTransitions` are gone (both callers had already returned for a null daylight). Two `!` assertions on mandatory capture groups follow the precedent in `entry-draft-detail.ts`.
- `time-authority.ts`: `TzdbSnapshotSchema` rejects any name pointing past the zone table (existing test "Bad/Zone": 99999), so `snapshot.names[name]!` and `snapshot.zones[index]!` after `Object.hasOwn` cannot be undefined.
- `tzdb-zone.ts`: `CompiledZone` changed from parallel `times[]` / `offsets[]` arrays to `transitions: {at, offset}[]` (nothing outside the file constructed or read `times` / `offsets`; `tzdb-pin.test.ts` uses its own `parseTzif` fields). The binary search became a single `reduce` ("last transition at or before the instant, else the initial offset"), and `zoneTransitions` carries the previous offset forward instead of indexing. No fallback lookups remain. `compileZone` now validates its input instead of silently using offset 0: an offset index outside the table, or a different number of indexes than deltas, throws (previously unreachable because the schema rejects both; 4 tests assert the exact messages). The 40-zone Intl differential test and the golden tests still pass.
- `internal-rpc.ts`: `CMS_SCHEDULE_RETRY_DELAYS_SECONDS[failureNumber - 1] ?? null` already returns `null` for 0, 4, 1.5, NaN and infinities because only indexes 0-2 exist, so the `isInteger` / range guard was redundant. A new test pins `delays.length === CMS_SCHEDULE_MAX_RETRY_ATTEMPTS`.

### apps/worker

| File | Uncovered before | Action | After |
| --- | --- | --- | --- |
| `async-runtime-outbox-poison.ts` (0/1/0/1) | L66 `return null` when `eventId` differs from the outbox id | production code, real condition: 3 tests in `async-runtime-outbox-poison.coverage.test.ts` | 100/100/100/100 |
| `async-entrypoint-cms-origin-admission-test-support.ts` (3/6/1/6) | `equal` mismatch return (L60); `resource instanceof Request` arm (L133); body-not-string throw (L146); "Unexpected canonical read" (L160); "Unexpected lease claim" (L170); final `else throw` for unknown RPC (L178); the never-called `send` implementation (L222-224) | `Request` arm deleted (only string URLs are ever fetched); the four tripwire throws became `expect(...)` assertions with the same messages; the `send` mock lost its unused implementation (`check` still asserts it is never called); the `equal` mismatch path is exercised by the exported `same` tests | 100/100/100/100 |
| `async-entrypoint-queued-continuation-test-support.ts` (2/3/1/2) | `equalStructure` mismatch return (L67); "Unexpected queued-continuation RPC" throw (L133); never-called `send` implementation (L180-182) | same treatment | 100/100/100/100 |
| `content-schema-registry/claimed-schema-migration-preparation-test-support.ts` (1/3/1/2) | `deferred` placeholder initializer (L118-120, never invoked because the Promise executor runs synchronously); "Missing own descriptor" (L144); "Missing object snapshot" (L170) | `let complete!: (value: T) => void`; descriptor of a `Reflect.ownKeys` key typed as present; `before[index]!` directly after `toHaveLength(before.length)` | 100/100/100/100 |
| `content-schema-registry/migration-worker-dry-run-purpose-test-support.ts` (0/1/0/1) | L91 `if (rpc === RPC.claimEvent) return {status:'new'}` | deleted; no existing caller reaches it | 100/100/100/100 |
| `content-schema-registry/migration-worker-pre-review-purpose-test-support.ts` (1/1/0/1) | `default: throw new Error('Unexpected preparation RPC')` (L183) | file unchanged; 8 tests assert the fixture refuses the 7 RPCs a preparation never issues and still answers `readPlan` | 100/100/100/100 |
| `content-schema-registry/migration-worker-sealed-lease-test-support.ts` (1/1/0/1) | `default: throw new Error('Unexpected RPC')` (L169) | file unchanged; 8 tests (7 refusals, 1 positive control) | 100/100/100/100 |
| `content-schema-registry/schema-dry-run-claim-response-test-support.ts` (1/1/0/1) | "Missing fixture descriptor" throw (L201) | descriptor typed as present (every `Reflect.ownKeys` key has one) | 100/100/100/100 |
| `production-schema-migration-preparation-test-support.ts` (3/3/0/3) | `claimEvent` and `acknowledgeEvent` replies (L163, L165) and the unknown-RPC `default` throw (L167) | the two event replies deleted (a preparation job never claims events, so an attempt now fails the fixture); 7 tests assert six RPCs are refused with the exact message and that `readPlan` is still served | 100/100/100/100 |

### packages/application

| File | Uncovered before | Action | After |
| --- | --- | --- | --- |
| `infrastructure/jobs/consumer-cms-lease-control-test-support.ts` (1/3/0/3) | `equal` mismatch return (L45); `need(undefined)` throw (L91); "Expected effect invocation" throw (L296) | 16 tests in `consumer-cms-lease-control-test-support.coverage.test.ts` for `same` (13 refusals) and `need`; `assertEffect` now asserts `toHaveLength(1)` then reads `calls[0]!` | 100/100/100/100 |

Judgement calls to review: (1) I converted four fixture tripwires of the form `if (x === undefined) throw` into `expect(x, message).toBeDefined()`; they fail with the same message and strictness, but the failing path is still not driven by a test. Say so if you would rather have a test per tripwire. (2) The `equal` / `equalStructure` helper is copy-pasted in three support files; it is not deduplicated here (out of scope), but now has refusal tests in each.

## Verification runs (all under `flock -s /tmp/wejammin-quiet.lock`, PATH set to the pinned toolchain)

| Run | Result |
| --- | --- |
| Union coverage run: `packages/contracts`, `packages/application/src/infrastructure/jobs`, `apps/worker/src/{async-runtime*,async-entrypoint*,content-schema-registry,production-schema-migration-preparation*,production-job-effect-dispatcher-cms-lease-control.test.ts}`, `tests/contracts/phase-02-slice-11-tzdb-pin.test.ts`, coverage restricted to the 18 files | 345 files, 5666 tests passed; 18 files at 100 / 100 / 100 / 100 (1034 statements, 605 branches, 225 functions, 963 lines) |
| `vitest related --run` over all 13 changed production and support files (every test that transitively imports one) | 1060 files, 14723 tests passed |
| Closure, purity and evidence guards: `client-chunk-time-authority`, `cms-island-static-closure`, `cms-editorial/a11y-structural`, `tests/contracts/phase-02-slice-11*`, `tests/contracts/phase-02-evidence*` | 47 files, 975 tests passed (no module was added or re-wired, so the lazy time-authority chunk is unchanged) |
| `eslint --max-warnings=0` on all 26 touched files | exit 0 |
| `prettier --check` on all 26 touched files | clean (4 new test files were formatted with `--write`) |
| `tsc --build apps/worker/tsconfig.json` | exit 0 |
| `tsc --build tsconfig.json` (repo-wide, same as `pnpm type-check`) | exit 0 |
| ad-hoc `tsc --noEmit` over the 9 new contracts / application test files, which their package tsconfigs exclude | exit 0 |

## New test files (13, 108 tests)

`packages/contracts/src/cms-editorial/`
- `internal-rpc.coverage.test.ts`: the schedule retry ladder: has one delay per permitted retry attempt; reads each rung by its failure number; has no delay for zero / a negative number / the exhausting fourth failure / a fraction below the first rung / a fraction between rungs / not a number / positive infinity / negative infinity
- `preflight.coverage.test.ts`: the failed reasons of a preflight category: come from the one registry row of the category
- `route-policy-errors.coverage.test.ts`: cmsEditorialDeclaresError with a code mapped to nothing: treats an own code with no declared status as undeclared; still answers for the other codes of the same map

`packages/contracts/src/cms-editorial/time-authority/`
- `local-datetime.coverage.test.ts`: parseInstant with an hours-only numeric offset: reads +hh and -hh as whole hours with no minutes; reads a compact +hhmm offset as hours and minutes; refuses an hours-only offset past 23 hours
- `posix-footer.coverage.test.ts`: footer rules that start in December: parses a December rule next to a January rule; places the last-Sunday rule on 27 December 2026 and 24 January 2026 (UTC); is in daylight time from the December change through the January change
- `time-authority.coverage.test.ts`: the time authority release pin: refuses a correctly hashed snapshot of a release other than the pinned one; serves the same snapshot when the pinned release matches its own
- `tzdb-snapshot.coverage.test.ts`: snapshot zone transition validation: accepts ascending transitions whose first delta precedes 1970; refuses a delta of zero after the first transition; refuses a negative delta after the first transition; refuses a transition that points past the offset table; reports a malformed zone as a malformed snapshot
- `tzdb-zone.coverage.test.ts`: a zone without a footer: compiles its transitions to absolute seconds and leaves the footer null; keeps the last explicit offset for every later instant; lists only the explicit transitions inside the half-open window. compiling a zone whose offset indexes do not line up: refuses an initial offset index outside the offset table; refuses a transition offset index outside the offset table; refuses fewer offset indexes than transition deltas; refuses more offset indexes than transition deltas. resolving a local time in a self-contradicting zone: refuses to invent an instant when the last explicit offset contradicts the footer

`apps/worker/src/`
- `async-runtime-outbox-poison.coverage.test.ts`: parsePoisonedOutboxRow event id binding: refuses a row whose eventId names a different event than its outbox id; refuses a row whose eventId differs from its snake_case event_id; accepts a row whose eventId repeats its outbox id
- `async-entrypoint-structural-equality.coverage.test.ts`: run once for "cms origin admission" and once for "queued continuation" structural equality: accepts identical primitives and deeply equal plain structures; refuses different primitives / a number against a string / null against an object / an object against null / an object against a primitive / a primitive against an object / an array against an object / an object against an array / objects with different prototypes / an extra key / a missing key / a renamed key / a nested difference / arrays of different lengths / arrays with different elements
- `production-schema-migration-preparation-fixture.coverage.test.ts`: the production preparation fixture: refuses each of the claim-event, release-event, acknowledge-event, dead-letter, reconcile-activation and rollback RPCs ("refuses <rpc>, which a preparation job never issues"); still answers the plan read it scripts
- `content-schema-registry/migration-worker-fixture-refusals.coverage.test.ts`: the pre-review preparation fixture: refuses each of process-dry-run-batch, finalize-dry-run, reconcile-activation, claim-event, release-event, acknowledge-event, dead-letter ("refuses <rpc>, which a preparation never issues"); still answers the plan read it scripts. the sealed-lease handoff fixture: refuses each of begin-verification, verify, complete, activate, rollback, claim-event, acknowledge-event ("refuses <rpc>, which the handoff scenario never issues"); still answers the dry-run finalize it scripts

`packages/application/src/infrastructure/jobs/`
- `consumer-cms-lease-control-test-support.coverage.test.ts`: the CMS lease-control harness structural equality: accepts identical primitives and deeply equal plain structures; refuses different primitives / a number against a string / null against an object / an object against null / an object against a primitive / an array against an object / an object against an array / objects with different prototypes / an extra key / a missing key / a renamed key / a nested difference / arrays of different lengths. need: returns the CMS lease control it is given; refuses a missing CMS lease control

## Production and support files edited (13)

`packages/contracts/src/cms-editorial/{internal-rpc,preflight,route-policy-errors}.ts`, `…/time-authority/{posix-footer,time-authority,tzdb-zone}.ts`; `apps/worker/src/{async-entrypoint-cms-origin-admission,async-entrypoint-queued-continuation,production-schema-migration-preparation}-test-support.ts`; `apps/worker/src/content-schema-registry/{claimed-schema-migration-preparation,migration-worker-dry-run-purpose,schema-dry-run-claim-response}-test-support.ts`; `packages/application/src/infrastructure/jobs/consumer-cms-lease-control-test-support.ts`.

Evidence receipts that bind the hashes of these production or support files will need a refresh by whoever owns the receipt pass; no `*.test.ts` hash changed.
