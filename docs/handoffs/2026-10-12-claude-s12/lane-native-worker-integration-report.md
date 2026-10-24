# Native Worker integration receipt

## Status: PRE-CAS-correction component checkpoint

The focused run beginning `2026-10-13T22:19:21.501Z` passed all 345 tests in the
exact eleven declared files. This is a **PRE-CAS-correction checkpoint**, not
final acceptance. During the frozen run, root identified a taxonomy private
CAS encoding defect: the adapter sent quoted `p_request.ifMatch`, while the
existing template/pattern SQL convention expects the bare version. The old
taxonomy test incorrectly asserted the quoted payload. Root held that repair
until this checkpoint finished. Its correction, fresh review, and subsequent
joint rerun remain necessary. This receipt does not establish SQL producer,
hosted, browser, full-validation, or Slice 12 acceptance.

Agent: `native_s12_worker_integration`, `gpt-6-astra` / `ultra`.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
Primary checkout remained read-only. This validation turn changed only this
claimed report; all six integration sources stayed frozen.

## Integration delivered

- Optional `cmsPatternDefinition` and `cmsTaxonomyDefinition` Worker dependencies.
- Actual pattern definition/latest and taxonomy definition/versions registrars.
- Both production factories composed from the existing CMS production options.
- Existing seventeen runtime positional arguments preserved; both new optional
  arguments appended at the tail.
- Exact rate-operation additions: `CMS-03C-12`, `cmsPatternLatestRead`,
  `CMS-03C-16`, and `cmsTaxonomyVersionsRead`.
- Seven boundary aliases/comments moved mechanically to the new boundary-types
  module, with existing type exports preserved. The only moved-type change is
  the four operation IDs. Constants, RPC/deadline/rate maps, remaining types,
  and runtime behavior are unchanged by that extraction.

All six integration files satisfy the 300-physical-line limit: worker-types 122,
worker-route-composition 262, production-worker-runtime-cms 274,
production-worker-runtime 207, production-types 289, boundary-types 92.
Existing `cms-editorial-production-ports.ts` was not edited.

## Historical receipts preserved

The earlier six-file / 136-test pass comprised the initial four pattern suites
(122), runtime composition (4), and rate coverage (10). Its two original
production-composed route failures changed from 404 to the expected 401 after
wiring. That receipt predates subsequent pattern and taxonomy review fixes and
is historical only. Preliminary checks accidentally using Node 24.19.0 and
pnpm 11.25.0 were discarded; they are not validation receipts.

After the type extraction, scoped formatting, lint, diff checking, and Worker
type checking passed using Node 22.23.1 / pnpm 11.24.0. Independent native review
then statically cleared the six frozen integration hashes. That independent
review did not rerun the component suites.

## PRE-CAS checkpoint checks

The shell was `/bin/bash --noprofile --norc`, with
`/home/rob/.local/share/wejammin-toolchain/bin` prepended to inherited `PATH`.
Version probes confirmed Node `v22.23.1` and pnpm `11.24.0`. Every validation
command ran under `flock -s /tmp/wejammin-quiet.lock`. Gates ran serially and
would stop at the first failure. No test-name filter was supplied.

| Gate                                 | Scope                                              | Exit/result   |
| ------------------------------------ | -------------------------------------------------- | ------------- |
| Prettier `--check`                   | Six integration plus 24 component TypeScript files | 0             |
| ESLint `--max-warnings=0`            | Same thirty files                                  | 0             |
| Worker `type-check` / `tsc --noEmit` | Worker package                                     | 0             |
| `git diff --check`                   | Same thirty paths                                  | 0             |
| Single joint Vitest run              | Exact eleven files below                           | 0; 345 passed |

JSON independently parsed after the run: `success=true`, eleven result files,
345 assertion results, 345 passed, zero failed, zero pending, zero todo, and
exact filename-set equality with the declared command. No files were silently
filtered or omitted. Vitest version `4.1.11`; reported duration `12.58s`.

| Suite under `apps/worker/src/`                                 | Tests |
| -------------------------------------------------------------- | ----: |
| `cms-composition/pattern-definition-admission.test.ts`         |    28 |
| `cms-composition/pattern-definition-latest.test.ts`            |    41 |
| `cms-composition/pattern-definition-production.test.ts`        |    32 |
| `cms-composition/pattern-definition-provider-boundary.test.ts` |    52 |
| `cms-composition/pattern-definition-write.test.ts`             |    38 |
| `cms-composition/taxonomy-definition-admission.test.ts`        |    70 |
| `cms-composition/taxonomy-definition-production.test.ts`       |    16 |
| `cms-composition/taxonomy-definition-versions.test.ts`         |    23 |
| `cms-composition/taxonomy-definition-write.test.ts`            |    31 |
| `production-worker-runtime-cms-composition.test.ts`            |     4 |
| `cms-editorial-production-rate-coverage.test.ts`               |    10 |

Group totals: pattern 191; taxonomy 140; runtime 4; rate 10.
Machine receipt: `/tmp/wejammin-s12-worker-final-KOvCtX/vitest.json`.
SHA-256: `067ada0a527399532f487d094cd7a877f63cc34ed1a6751b0fa8cd75e7cb4216`.
The temporary receipt is local evidence, not a durable hosted artifact.

## Exact command arguments

These arrays reproduce the argument vectors executed by the non-login shell.
Working directory was the worktree above. Static gates ran before the single
Vitest invocation. The same pinned `PATH` applied to every command.

```bash
export PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH
node --version
pnpm --version
scope=(
  apps/worker/src/worker-types.ts
  apps/worker/src/worker-route-composition.ts
  apps/worker/src/production-worker-runtime-cms.ts
  apps/worker/src/production-worker-runtime.ts
  apps/worker/src/cms-editorial-production-types.ts
  apps/worker/src/cms-editorial-production-boundary-types.ts
  apps/worker/src/cms-composition-production-pattern-definition-latest.ts
  apps/worker/src/cms-composition-production-pattern-definition.ts
  apps/worker/src/cms-composition-production-taxonomy-definition-versions.ts
  apps/worker/src/cms-composition-production-taxonomy-definition.ts
  apps/worker/src/cms-composition/pattern-definition-admission.test.ts
  apps/worker/src/cms-composition/pattern-definition-latest-routes.ts
  apps/worker/src/cms-composition/pattern-definition-latest.test.ts
  apps/worker/src/cms-composition/pattern-definition-ports.ts
  apps/worker/src/cms-composition/pattern-definition-production.test.ts
  apps/worker/src/cms-composition/pattern-definition-provider-boundary.test.ts
  apps/worker/src/cms-composition/pattern-definition-response.ts
  apps/worker/src/cms-composition/pattern-definition-routes.ts
  apps/worker/src/cms-composition/pattern-definition-write.test.ts
  apps/worker/src/cms-composition/pattern-definition.test-support.ts
  apps/worker/src/cms-composition/taxonomy-definition-admission.test.ts
  apps/worker/src/cms-composition/taxonomy-definition-production.test.ts
  apps/worker/src/cms-composition/taxonomy-definition-response.ts
  apps/worker/src/cms-composition/taxonomy-definition-routes.ts
  apps/worker/src/cms-composition/taxonomy-definition-shared.ts
  apps/worker/src/cms-composition/taxonomy-definition-versions-route.ts
  apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts
  apps/worker/src/cms-composition/taxonomy-definition-write-route.ts
  apps/worker/src/cms-composition/taxonomy-definition-write.test.ts
  apps/worker/src/cms-composition/taxonomy-definition.test-support.ts
)
flock -s /tmp/wejammin-quiet.lock pnpm exec prettier --check "${scope[@]}"
flock -s /tmp/wejammin-quiet.lock pnpm exec eslint --max-warnings=0 "${scope[@]}"
flock -s /tmp/wejammin-quiet.lock pnpm --filter @wejammin/worker type-check
flock -s /tmp/wejammin-quiet.lock git diff --check -- "${scope[@]}"
flock -s /tmp/wejammin-quiet.lock pnpm exec vitest run --maxWorkers=1 \
  --reporter=default --reporter=json \
  --outputFile.json=/tmp/wejammin-s12-worker-final-KOvCtX/vitest.json \
  apps/worker/src/cms-composition/pattern-definition-admission.test.ts \
  apps/worker/src/cms-composition/pattern-definition-latest.test.ts \
  apps/worker/src/cms-composition/pattern-definition-production.test.ts \
  apps/worker/src/cms-composition/pattern-definition-provider-boundary.test.ts \
  apps/worker/src/cms-composition/pattern-definition-write.test.ts \
  apps/worker/src/cms-composition/taxonomy-definition-admission.test.ts \
  apps/worker/src/cms-composition/taxonomy-definition-production.test.ts \
  apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts \
  apps/worker/src/cms-composition/taxonomy-definition-write.test.ts \
  apps/worker/src/production-worker-runtime-cms-composition.test.ts \
  apps/worker/src/cms-editorial-production-rate-coverage.test.ts
```

## Frozen snapshot

Before and after all checks, the thirty-file manifest hash was unchanged:
`dd946d49b15d8797d930cb73c6d6015ad2ce75f10187c6ede5bd024cb1ea3d97`.
Manifest format: paths sorted lexicographically; each line is SHA-256, two
spaces, repository-relative path, newline. The exact manifest follows.

```text
40d82be8343d8ecff87ff5ff2684d25f31693c1277843cd2085a42a9d136a558  apps/worker/src/cms-composition-production-pattern-definition-latest.ts
b89a4c72796ef646298e388286af610bd13c1c9bcf719598946975ba4a1d107a  apps/worker/src/cms-composition-production-pattern-definition.ts
0f990a020ab1ef5a995ec2007af6de3397553c0ab5abbd24d345df15e6e09f71  apps/worker/src/cms-composition-production-taxonomy-definition-versions.ts
1b038896c9525cffd427fef5cbd791b9008a567c32992eb8f75e736a12935c3d  apps/worker/src/cms-composition-production-taxonomy-definition.ts
c11aa434f25252cea6a152051d096b8a6c67f8525b4c8904b88ea8d8bd222723  apps/worker/src/cms-composition/pattern-definition-admission.test.ts
b00f5d2d7535d1e938c7138bc4739139f5f8b6b87d5c447e6dd3bf3193e7ffc8  apps/worker/src/cms-composition/pattern-definition-latest-routes.ts
ad0814d14b84f6e5d6a0b6e5ac2f73c318f3d65f04687734ef954e6fdc889092  apps/worker/src/cms-composition/pattern-definition-latest.test.ts
33d559d93186bf222c5254e0cdd1a533c5a4cf0b09c38f54c88e6bbfc1792fd2  apps/worker/src/cms-composition/pattern-definition-ports.ts
bab04ce0a432f9e56e614c57782bf89ced389e974799f6e7e380920400f9e165  apps/worker/src/cms-composition/pattern-definition-production.test.ts
521f4f4b258807dccf049245c3b23cce01917707fbaeb7a265163b8607240bbf  apps/worker/src/cms-composition/pattern-definition-provider-boundary.test.ts
532c0d0944bef4414607a7c41067dc81935a2ee2e4d16706a12f9126b3091c77  apps/worker/src/cms-composition/pattern-definition-response.ts
170e600a2b17d5eaae0ad801d480e37cb47f224d7eff0c0679e011ac5d3f5612  apps/worker/src/cms-composition/pattern-definition-routes.ts
f462beea3f454a36e6012263f6113e8da98cd03e465c3ca9becdaca1f40256e9  apps/worker/src/cms-composition/pattern-definition-write.test.ts
eeafec09d5f3c38c0d577570a040c91f07286ff38881c80a791c150f1e151dfa  apps/worker/src/cms-composition/pattern-definition.test-support.ts
6fcb3d8adea8588eab0c939b2c6d019a8eb771e01d2a6840aeed0df8655d4c0c  apps/worker/src/cms-composition/taxonomy-definition-admission.test.ts
9659fef45160669e39abec998b96990192d9d43c6b667cbb0725e6bb2e7e9efe  apps/worker/src/cms-composition/taxonomy-definition-production.test.ts
0178baf086fcef12806f32c0d117d26443455ac7d8f8e770bac81f65ec3a47a3  apps/worker/src/cms-composition/taxonomy-definition-response.ts
9fae16c46b646ad646e920b0517c36dd50b651bc47fe1e088979010ef6616f89  apps/worker/src/cms-composition/taxonomy-definition-routes.ts
4b39a9b1879b97621925c33790457a618cc0219e94217c9a777c5812b0c267ee  apps/worker/src/cms-composition/taxonomy-definition-shared.ts
6931e3cb94ee1159d535df51f8b59a36f6ae3d08bd99fc7e904ab6b28aaa103d  apps/worker/src/cms-composition/taxonomy-definition-versions-route.ts
2c86725837e775494d7692e01367a603965a3f4ab2dda730e820a6754cb20fc7  apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts
0f8d62afd9d77c21c1b915d9cc836ae3f2c38f8c74a5ba48292631182da386f3  apps/worker/src/cms-composition/taxonomy-definition-write-route.ts
d4e093085f2f26efb36eca25717dbae1039f98a997ae36ce671bf941bd1965c0  apps/worker/src/cms-composition/taxonomy-definition-write.test.ts
5a0990a4f2c750a51224d700e9970523786e1467cf7768f98c398e06a04da725  apps/worker/src/cms-composition/taxonomy-definition.test-support.ts
401671016287c8e43735e2e69736e3f568482ceed38d19a9fef0fa9ef0f8e901  apps/worker/src/cms-editorial-production-boundary-types.ts
bc248fd9017abf6edb037424854f904551ae6f18889d636275869af6cde1aa33  apps/worker/src/cms-editorial-production-types.ts
6d76c23991d8a39dab8c7f4d871ccb8227b1e19d8fcecb1197443a9b4876b1fb  apps/worker/src/production-worker-runtime-cms.ts
e45c057b187ea75c1fb4766bd87e41f9c9f05e2f608c2ab3c7dd0031fc4ba9e9  apps/worker/src/production-worker-runtime.ts
333d23dd4988456b4d7b2c908dbf2f4d8b1c4f5fb0e18df9be55bd15af874e3a  apps/worker/src/worker-route-composition.ts
54c7447460f742d5fbf19d55295070c76e4acfe87ceafcd62bdacea5b9743ce6  apps/worker/src/worker-types.ts
```

HEAD remained `b16edb54a7a1b698ed8ca15b6085046d4270626e`.
Full Git-index SHA-256 remained
`278656d018b846e7664604718bbede1bd1d06e639499c7f80a644866085d9ddb`.
No staging, commit, reset, DB command, service operation, canonical validation,
staging access, acceptance tick, or completion signature was performed.

Next: root-directed taxonomy CAS repair, independent review, then a fresh joint
focused run. This report preserves the pre-correction evidence unchanged.

## POST-CAS-correction component receipt — 2026-10-13

Root released one new focused run after the three-file taxonomy CAS correction
froze. Its independent native CAS audit ran concurrently and its verdict was
pending at the start of these checks. This section records local component
validation only; it does not assert phase, SQL, hosted, atomicity, or acceptance
criterion completion. The 136-test history and PRE-CAS 345-test checkpoint above
remain historical records.

The corrected transport sends the bare version in private `p_request.ifMatch`,
quotes the HTTP `If-Match` header, and omits the first-version CAS operand. The
existing taxonomy production test oracle was corrected without removing tests.
Before execution, all three expected correction hashes and all six reviewed
integration hashes matched root's frozen release.

| Changed path under `apps/worker/src/`                        | Frozen SHA-256                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| `cms-composition-production-taxonomy-definition.ts`          | `54c0a86953889df902f6925a84e48b1638e769a1fb9431ce1f98603739476f5b` |
| `cms-composition-production-taxonomy-definition-versions.ts` | `069867132723762053bc373e40cc76e4e5cab48218dc94b88ce59fe7b20fab2b` |
| `cms-composition/taxonomy-definition-production.test.ts`     | `d85522b49b7440ef2ef59240fddea76c9b5274d3fe4add83039d79bc486ff50b` |

Node `v22.23.1` and pnpm `11.24.0` were verified again. Commands ran from the same
worktree using `/bin/bash --noprofile --norc`, the pinned toolchain `PATH`, and
the shared `/tmp/wejammin-quiet.lock`. The exact thirty-path `scope` array and
four static command argument vectors above were reused unchanged. Gates ran
serially, with first-failure stop behavior; all completed successfully:

| Gate                                                     | Exit/result   |
| -------------------------------------------------------- | ------------- |
| Prettier `--check`, all thirty involved TypeScript files | 0             |
| ESLint `--max-warnings=0`, same thirty files             | 0             |
| Worker `type-check` / `tsc --noEmit`                     | 0             |
| `git diff --check`, same thirty paths                    | 0             |
| One joint Vitest invocation, same exact eleven files     | 0; 345 passed |

The Vitest run started `2026-10-13T22:28:24.292Z`; reported duration `12.12s`.
JSON readback confirmed `success=true`, eleven files, 345 assertion results,
345 passed, zero failed, zero pending, zero todo, and exact filename-set
equality. No filters, skips, omitted files, or retry invocation were used.
Per-file counts remain exactly those in the PRE-CAS table: pattern 191,
taxonomy 140, runtime 4, rate 10.

The single new test command was:

```bash
flock -s /tmp/wejammin-quiet.lock pnpm exec vitest run --maxWorkers=1 \
  --reporter=default --reporter=json \
  --outputFile.json=/tmp/wejammin-s12-worker-post-cas-ucf6kA/vitest.json \
  apps/worker/src/cms-composition/pattern-definition-admission.test.ts \
  apps/worker/src/cms-composition/pattern-definition-latest.test.ts \
  apps/worker/src/cms-composition/pattern-definition-production.test.ts \
  apps/worker/src/cms-composition/pattern-definition-provider-boundary.test.ts \
  apps/worker/src/cms-composition/pattern-definition-write.test.ts \
  apps/worker/src/cms-composition/taxonomy-definition-admission.test.ts \
  apps/worker/src/cms-composition/taxonomy-definition-production.test.ts \
  apps/worker/src/cms-composition/taxonomy-definition-versions.test.ts \
  apps/worker/src/cms-composition/taxonomy-definition-write.test.ts \
  apps/worker/src/production-worker-runtime-cms-composition.test.ts \
  apps/worker/src/cms-editorial-production-rate-coverage.test.ts
```

Machine receipt: `/tmp/wejammin-s12-worker-post-cas-ucf6kA/vitest.json`.
SHA-256: `92c47e516857c7783ac3b83b3c3f2e79118c14b380b6777b77936bf50e996b35`.
It remains temporary local evidence.

The post-CAS thirty-file source manifest is the PRE-CAS manifest above with only
the three hashes in this section replaced. Its SHA-256, using the same sorted
line format, was identical before and after the checks:
`0833ddb47d393f476b19346023deefb6216b2c2f986524c58a03dc8bee026dc5`.
Every other source hash, including all six integration files, remained unchanged.
HEAD and full Git-index SHA-256 also remained identical to the values above.

No source edit, DB/reset operation, service change, canonical gate, staging
access, AC tick, or completion signature was performed. Only this report was
appended. Root retains independent-review synthesis and authority for any later
validation or implementation work.
