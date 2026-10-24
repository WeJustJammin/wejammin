# Contract test helpers (DEC-203 native tracing)

## Contents

Shared fixtures and type modules for the Slice 11 and Slice 12 DEC-203 native
tracing unit tests in the parent `tests/contracts/` directory. None of them is a
test file; each is imported by the `*.test.ts` files named below.

| Helper                                        | Used by                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `dec203-coordinator-startup-fixture.ts`       | `phase-02-slice-11-dec203-coordinator-startup.test.ts`: expected observer contract from fixed literals. |
| `dec203-coordinator-startup-fixture-types.ts` | Type-only module re-exported by the startup fixture.                                                    |
| `dec203-fd-snapshot-fixture.ts`               | `phase-02-slice-11-dec203-fd-snapshot.test.ts`: stat and process-fact records and mock expectations.    |
| `dec203-finality-metadata-fixture.ts`         | `phase-02-slice-12-native-finality-metadata.test.ts`: literal target, cgroup and container values.      |
| `dec203-finality-metadata-vm.ts`              | Same test: runs the audited script inside a `node:vm` context with injected IO.                         |
| `dec203-proc-locks-metadata-types.ts`         | `phase-02-slice-11-dec203-proc-locks-metadata.test.ts`: `Metadata` type.                                |
| `dec203-proc-locks-observation-fixture.ts`    | FD-snapshot and test-observer-inventory tests: lossless `/proc/locks` identity and lstat records.       |
| `dec203-test-observer-fixture.ts`             | Both test-observer tests: repository paths, `RealFs` type and BigInt stat builders.                     |
| `dec203-test-observer-proc.ts`                | Both test-observer tests: `/proc`-shaped process, executable and lock fixtures.                         |

## Ownership

The Slice 11 and Slice 12 native-tracing validation work owns these helpers.
They describe the pinned native machinery under `infra/database-upgrades/native-tracing/`
and must change only together with the test that consumes them.

## Extension

Add a helper only when two or more test files in `tests/contracts/` need the
same fixture; a fixture used by one file stays in that file. Name it
`dec203-<subject>-fixture.ts` (or `-types.ts` for type-only modules), keep it
under 300 lines, and record the consuming test in the table above. Put shared
types in a type-only module so no import cycle forms (the startup fixture
re-exports its types module, never the reverse).

## Conventions

Helpers are pure data and builders: they open no real file, read no real `/proc`,
start no process and run no subject of their own. Each call returns fresh
mutable records so one test cannot affect another. No `any`; type mocks
explicitly. Where a helper embeds the worktree path, it does so as a named
constant so the pinned expectation is greppable.

## Related links

- `tests/contracts/README.md`
- `infra/database-upgrades/native-tracing/README.md`
- `tests/native/README.md`
