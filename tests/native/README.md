# Native tracing primitive tests

## Contents

Pinned-Node `node:test` suites for the DEC-203 native tracing primitives in
`infra/database-upgrades/native-tracing/`. They compile and load real Node-API
addons and exercise real Unix sockets, so they are not Vitest files.

| File                                               | Subject                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `phase-02-slice-11-peer-credentials.mjs`           | Kernel `SO_PEERCRED` reader (`peer-credentials`).                      |
| `phase-02-slice-11-peer-lifetime.mjs`              | Connection-time peer lifetime handles (`peer-lifetime`).               |
| `phase-02-slice-11-native-stream-ingress.mjs`      | Native listener, accept and `recvmsg` stream ingress.                  |
| `phase-02-slice-11-stream-writer-fixture.mjs`      | Prerequisite fixture for the stream writer association, not authority. |
| `phase-02-slice-11-native-bootstrap-pre-ready.mjs` | Receiving-bootstrap pre-ready cohort (`PR01:` case prefix and later).  |

Subdirectories: `fixtures/` (C and Node sources compiled or spawned by the
suites) and `helpers/` (shared harnesses and case registrars).

## Ownership

The DEC-203 native validation work owns this tree. The files here are frozen
source for pinned receipts: `.memory/pipeline/progress/verification/` records
SHA-256 values for several of them, so any byte change invalidates a receipt.

## Extension

Do not edit existing `.mjs`, `.c` or `.h` files without regenerating the
matching receipt and getting independent review. A new suite is a new
`phase-02-slice-<n>-<subject>.mjs` file that registers cases through helpers;
shared setup goes in `helpers/`, test-only native sources in `fixtures/`. Run a
suite with the pinned Node 22.23.1 as
`node --test --test-concurrency=1 tests/native/<file>.mjs`, optionally with
`--test-name-pattern` to select a case cohort.

## Conventions

Suites run serially (`concurrency: false`): they share kernel resources such as
process tables and socket paths. Fixtures are test-only and never carry
production credentials. Passing here proves primitive behavior on this host only;
it does not clear native080, canonical database validation, hosted acceptance or
phase completion.

## Related links

- `infra/database-upgrades/native-tracing/README.md`
- `tests/contracts/helpers/README.md`
- `tests/native/helpers/README.md`
- `tests/native/fixtures/README.md`
