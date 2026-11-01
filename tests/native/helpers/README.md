# Native test helpers

## Contents

Harnesses, case registrars and fixture builders shared by the `node:test` suites
in the parent directory, grouped by the primitive they exercise:

- `dec203-peer-*`: peer-credentials harness, client, sockets, metadata, process
  observer and the build and process case registrars.
- `dec203-lifetime-*`: peer-lifetime harness, peers, values, fixture compiler,
  build, capability and output-drift cases.
- `dec203-stream-ingress-*`: stream-ingress harness, fixture compiler, writers,
  writer build and the core, limit, pending and stream case registrars.
- `dec203-bootstrap-pre-ready-*`: bootstrap pre-ready artifacts, assertions,
  diagnostics, harness, inventory and pending-exec controls and fixtures,
  lease output, observation, process and value modules.

## Ownership

The DEC-203 native validation work owns these modules. Several are pinned by
SHA-256 in `.memory/pipeline/progress/verification/`; treat all of them as frozen
unless a receipt is being regenerated.

## Extension

Put a new shared harness or case group in a file named
`dec203-<primitive>-<role>.mjs` and register it from the suite with a
`register...Cases` or `...Cases(check)` function, as the existing modules do.
Keep each file under 300 lines by splitting by concern rather than growing a
neighbor. Native sources they compile live in `../fixtures/`.

## Conventions

Helpers receive a per-test fixture and never touch shared global state. They
assert exact outputs rather than approximate ones, bound every wait, and clean
up only the artifacts they created. Suites run with `concurrency: false`.

## Related links

- `tests/native/README.md`
- `tests/native/fixtures/README.md`
- `infra/database-upgrades/native-tracing/README.md`
