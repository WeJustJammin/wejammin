# Lane claude_s12_docs_readmes report

## Status

GREEN. `tests/documentation-boundaries.test.ts`: 5 of 5 tests pass. A script that mirrors the test's
directory walk reports no remaining directory without a conforming README.

## Scope

Create conforming `README.md` files (sections Contents, Ownership, Extension, Conventions, Related links)
for every directory with more than two direct files that lacked one, and append the missing sections to three
existing READMEs. Documentation only; no code, test, SQL or pinned file was touched.

## Files (path, lines, SHA-256)

Created (12): the first twelve rows. Appended sections only (3): the last three rows. Prettier was run with
`--write` on the three appended files and reformatted some existing text in the two `infra/` files (they are
untracked, so no baseline diff exists; the change is formatting only). `prettier --check` passes on all 15.

| Path                                                         | Lines | SHA-256                                                            |
| ------------------------------------------------------------ | ----- | ------------------------------------------------------------------ |
| `tests/contracts/helpers/README.md`                          | 48    | `e35fdef5573752a0e1c5077f6843760c734b50f6d27c2f39331e47cea20ca3dc` |
| `tests/native/README.md`                                     | 49    | `90d69728e8ef051757d40726af4f6b91d0eb7217c1832878baa5cd8180ca6e33` |
| `tests/native/fixtures/README.md`                            | 41    | `38c23d412037c7ee9373fe57a96999cc74442314364b6022b43736f87f15c6cc` |
| `tests/native/helpers/README.md`                             | 42    | `2ccc097e99262d5b08ef7d86319ab7428738ba4a14637964cea787539ab9bd77` |
| `tests/observability/README.md`                              | 35    | `895cabc62b78bc7aedf0b71684eb2686fe870b0353fc5f1153c2b7b8caebe40f` |
| `docs/handoffs/2026-10-12-claude-s12/README.md`              | 49    | `77e609a28b6bb0e283f05cdd1424bf51a7734e6c63cbd691493da1a008de1b9f` |
| `docs/handoffs/2026-10-12-claude-s12/lane-logs/README.md`    | 31    | `276858963b7d1db63fd8e925de1b2ae14c6641ba7bf01a4b668ff688d8b9c866` |
| `docs/handoffs/2026-10-12-claude-s12/lane-l0-logs/README.md` | 32    | `f8fef427d669d3a0e6526aa67b94df38c9cfe3e6351a596b49e00f9555244de6` |
| `docs/handoffs/2026-10-14-claude-s12/README.md`              | 54    | `317e1e29a00435f8da5258d1404d999f80af0cb7667d5b3daec15aeb774c38e7` |
| `docs/handoffs/2026-10-14-claude-s12/briefs/README.md`       | 37    | `a48198155c1350dadef9d04eca8c1f7bbdfab4d87fffc705a3c443c12fe3da31` |
| `docs/handoffs/2026-10-22-claude-s12/README.md`              | 42    | `f48444e89064740e9427fd924fa59f8f8cb54384ad7eec1c7cc10730eeca3e65` |
| `docs/handoffs/2026-10-22-claude-s12/briefs/README.md`       | 34    | `82080ab59400fab09b61d81915500fb3c4db6d18bc5020dc7a932019c95c3d68` |
| `packages/contracts/src/cms-delivery/README.md`              | 83    | `78acd647fa52f9d37ab1b75cf379fa4ae55f14b31a26db0dbcb9edb3c0166287` |
| `infra/database-upgrades/README.md`                          | 209   | `84c4aba0ca9a187245da8fd5cac3ef6563e7d1699584e6cce8f77ecab9921b86` |
| `infra/database-upgrades/native-tracing/README.md`           | 132   | `6007f0f2a10324ec7dcaebc95e981a1d7e27e77db51be566cc96fc6f568a9257` |

## Runs

- `pnpm exec vitest run tests/documentation-boundaries.test.ts` before: 1 failed (first reported
  `packages/contracts/src/cms-delivery/README.md: Contents`; the test stops at the first miss, so a scan script
  enumerated all 15 offending directories); after: 5 passed.
- `pnpm exec prettier --check` on all 15 files: pass.

## Safety review (tests/native and infra/database-upgrades)

Before writing, I grepped `tests/native`, `infra/database-upgrades`, `tests/contracts/*native*|*dec203*|*bootstrap*`,
`tests/contracts/helpers` and `tests/observability` for directory enumeration:

- `readdir` hits in `tests/native/helpers/*` act on per-test temporary run directories (`f.run`, `runDirectory`)
  or on `/proc` and `/proc/self/fd`, never on `tests/native` or its subdirectories.
- `infra/database-upgrades/delivery-receiving-upgrade-local-target.mjs:47` only lists required injected `fs` port methods.
- The bootstrap profile names its sources explicitly (`SOURCE_NAMES`); nothing globs `native-tracing/`.
- The source-pin file `2026-10-21-bootstrap-observation-green-source-pins-v3.json` pins explicit paths and no README.

So adding `README.md` to `tests/native`, `tests/native/fixtures`, `tests/native/helpers` and appending sections to
the two existing `infra/` READMEs cannot be noticed by any enumeration. Nothing was declined. No `.mjs`, `.cjs`,
`.c`, `.h` or `.ts` file was edited. Not run (out of scope): the native suites themselves.

## Test corrections

None.

## Spec citations

Requirement source is `tests/documentation-boundaries.test.ts` and `.claude/rules/extensibility.md`
(directory documentation). Content was drawn from reading each directory's files and existing READMEs.

## Open items / BOUNDARY

- `tests/observability/` README was created while another lane's `phase-02-slice-12-alert-policy.test.ts` is
  untracked there; the README names it. If that lane renames or drops it, update the Contents bullet.
- `docs/handoffs/2026-10-22-claude-s12/` now lists `lane-docs-readmes-report.md` only through the `docs-readmes`
  mention in its README; add nothing else unless more lanes are added.
- `infra/database-upgrades/native-tracing/README.md` states stream-ingress status text pre-existing in the file
  ("current24-case native cohort"); not edited.

## Requests to root

None. New files are untracked; root decides staging.
