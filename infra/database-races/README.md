# Database race kits

## Contents

Shared kits for the independent-session race runners under `supabase/tests/phase_02_slice_*_races/` and `supabase/tests/phase_02_slice_11_recheck_race/`. Every call a kit makes is a fresh `psql` process inside the disposable local Supabase database container, so a lock or ordering guarantee is proven across real committed PostgreSQL sessions, which a single-transaction pgTAP file cannot do.

| Kit                   | Used by                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `race-kit.mjs`        | The Slice 10 runners: the gate trigger that pauses a writer between validation and its first revision insert, sessions and assertions |
| `chain-kit.mjs`       | The Slice 10 activation races driven through the real activation commands, so a lock-order cycle is a failing assertion               |
| `review-kit.mjs`      | The Slice 11 review-authority races: `cms_assign_editorial_reviewer`, `cms_record_review_decision`, `cms_submit_review`               |
| `publication-kit.mjs` | The Slice 11 schedule and publication races: schedule, publish, claim due schedules, execute a schedule                               |
| `preview-kit.mjs`     | The Slice 11 preview races: mint, verify and the preview-token revocation seams                                                       |
| `recheck-kit.mjs`     | The Slice 11 dependency-recheck race (`031-dependency-recheck-race.mjs`, P2-S11-AC-113): `cms_dependency_recheck_run`                 |
| `canonical-mode.mjs`  | The Slice 12 canonical-mode opt-in (`WEJAMMIN_CANONICAL_RACE=1`) and its target asserts; see the section below                        |

## Ownership

The Phase 2 CMS database lanes own these kits. `infra/run-database-race-runners.mjs` is the only gate that runs the runners: it resets the database before each runner and once more at the end.

## Extension

A new runner lives beside the pgTAP suite it complements and imports the kit of its slice. Add a kit here only when a second runner needs the same fixture; keep it to one world (fixture script that COMMITS, named RPC calls, deterministic pausing) and document it in the table above. Run a runner only right after `pnpm db:reset`, never against a shared or remote database.

## Canonical mode (Slice 12 modules)

The seven Slice 12 modules under `supabase/tests/phase_02_slice_12_*` run in every canonical `pnpm db:verify`, like the Slice 10 and 11 runners. Each also keeps a root-run ALT mode (an explicit `S12_*_ROOT_RELEASE`/`*_ALT_CONTAINER` release that forbids `supabase_db_wejammin`).

- `infra/run-database-race-runners.mjs` launches every module with `WEJAMMIN_CANONICAL_RACE=1` (`raceEnvironment`). Nothing else sets it, and only the exact value `1` selects canonical mode.
- Canonical mode targets the container the Slice 10 and 11 runners use (`S10_RACE_DB_CONTAINER`, then `AC217_DB_CONTAINER`, then `supabase_db_wejammin`) and fails when an ALT release variable is also set (the two modes are mutually exclusive).
- The protected primary checkout (`/home/rob/Projects/WeJammin`) is refused in ALT mode only (DEC-225): that rule is a lane-safety rule for root-run ALT races, while the owner runs `pnpm db:verify`, hence the canonical races, from that checkout. It lives in one place, `assertRaceCheckout` in `canonical-mode.mjs`, which the four modules that carry it (`dec193_writer`, `dec194_outer`, `dec194_sweep`, `dec199_publication`) call.
- To run one module by hand against the canonical stack: `pnpm db:reset`, then `WEJAMMIN_CANONICAL_RACE=1 node <module>`. Without the variable the module requires its ALT release.
- Every module relies on the gate's `pnpm db:reset` before and after it for its committed fixture rows, exactly as the Slice 10 and 11 runners do; the modules that create scratch tables also drop them in their own cleanup.

## Conventions

- Commands are driven only through the named `platform_api.*` RPCs, exactly as the Worker calls them; a fixture is the same pgTAP fragment the pgTAP suites include.
- Pausing is deterministic (an advisory-lock gate keyed by `application_name`), never a sleep.
- One kit per world: split a kit by world (fixture and commands), as the kits above do, rather than growing one file.

## Related links

- `../run-database-race-runners.mjs` (the gate that lists and runs the runners)
- `../README.md`
- `../../supabase/tests/README.md`
