# Native test fixtures

## Contents

Test-only sources used by the suites in the parent directory. C files are
compiled at test time against the Node headers; `.mjs` files are spawned as
child processes.

| File                            | Role                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `dec203-peer-sockets.c`         | Node-API-8 test addon that owns a connected socket pair (peer-credentials suite).                                                    |
| `dec203-lifetime-values.c`      | Node-API-8 test addon with the same owned socket-pair role (peer-lifetime suite and its fixture compiler).                           |
| `dec203-lifetime-peer.mjs`      | Spawned peer that connects to a Unix socket, sends a nonce and declared PID, and stops on a `stop` IPC message or parent disconnect. |
| `dec203-lifetime-probe.mjs`     | Spawned probe that loads the subject addon and inspects its own descriptors under `/proc/self/fd`.                                   |
| `dec203-stream-writers.c`       | Native writer processes for the stream-ingress suite.                                                                                |
| `dec203-stream-writers-state.h` | State header included by `dec203-stream-writers.c`.                                                                                  |

## Ownership

The DEC-203 native validation work owns these fixtures. They are pinned inputs to
recorded receipts.

## Extension

Add a fixture only when a suite needs a native or child-process counterpart that
cannot be written inline; name it `dec203-<subject>-<role>.<ext>` and load it
from `helpers/` by `new URL('../fixtures/<name>', import.meta.url)`. Do not
change an existing fixture without regenerating the receipts that hash it.

## Conventions

Fixtures hold no production credentials. The C addons require Node-API 8
(`NAPI_VERSION` is checked at compile time) and close the descriptors they own
exactly once. Spawned `.mjs` fixtures take their socket path and nonce as
command-line arguments from the harness and exit when told to stop.

## Related links

- `tests/native/README.md`
- `tests/native/helpers/README.md`
- `infra/database-upgrades/native-tracing/README.md`
