# Lane claude_s12_wip_paths report

## Status
GREEN for the assignment. Every live reference to a deleted `supabase/migrations-wip/<dir>/` path is repointed or removed; the 92 failing Slice 11 upgrade tests pass. Residual non-lane failures are the five evidence/receipt guards (see Open items).

Backup (pre-edit, 32 files): scratchpad `claude_s12_wip_paths/orig-20261023T110358Z.tar` (`/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_wip_paths/`). The catalog `.mjs` and `local-prefix.test.ts` were edited after the tar and are not in it; their before-hashes are reconstructed by reversing the edit.

## Scope
Find and fix every live `migrations-wip` reference outside `supabase/migrations/`, `supabase/migrations-wip/README.md` and historical `docs/`/`.memory/`. No DB/docker/supabase command run; no staging of git; race modules untouched.

## Findings by class
1. Promoted THIS session (manifest `promotion-manifest-20261023.json`): dec197 -> `supabase/migrations/20261016030000_delivery_receiving_contracts.sql`; pattern-updates (`20261014140000`-`140610`); dec195 (`20261014200000/200010`); dec206 (`20261022050000/050010`); linked-scan (`20261022110000`-`110300`).
2. Promoted EARLIER (not in the manifest, all present in `supabase/migrations/`): taxonomy-terms `20261014120000`, placement `20261014110000`, pattern-def `20261014020100`, taxonomy-def `20261014030000`, locale `20261014050000`-`050900`, related `20261014060000`-`060500`, governed-a `20261014010100`, governed-fix `20261014040000/040100`, governed-fix2 `20261014080000`, governed-fix3 `20261014100000`, template-digest `20261014180000`.
3. Logic that distinguished WIP from promoted (fixed as logic, not string):
   - `infra/database-upgrades/delivery-receiving-upgrade-plan.mjs`: `sourcePaths()` returned [promoted, WIP]; `resolveMigrationSource` read both, refused divergence, fell back to WIP when promoted was absent, and `buildUpgradePlan` accepted either `source.path`. Now `sourcePath()` is the single promoted path; absence refuses (`migration missing`); `buildUpgradePlan` requires `source.path === promoted path` (`foreign source path` otherwise). Reason: the migration is promoted and immutable, a WIP twin can no longer legitimately exist, and a plan must not bind a source from an unreviewed untracked location.
   - `delivery-receiving-upgrade-host-source.mjs`: dropped the WIP read and the promoted/WIP divergence check; the promoted bytes are compared with the 080 witness as before.
   - `delivery-receiving-upgrade-local-inventory.mjs`: dropped the two-path list; `plan.source.path` must equal the promoted path and the bytes must equal `plan.source.bytes`.
   - `tests/contracts/phase-02-slice-11-delivery-receiving-witness-parity.test.ts`: test-local `selectMigration(promoted, wip, read)` reduced to promoted-only.
   - Five Slice 12 `*-parity.test.ts`: `existsSync(promoted) ? promoted : WIP` transition fallback replaced with the promoted path; unused `existsSync` import removed; header comment updated.
   - Slice 11 fixtures: the baseline listing (`readdirSync(supabase/migrations)`) now already contains the target migration, which the old fixtures modelled as "WIP target + baseline without it". The fixtures now bind `source.path` to the promoted file; `promoteTarget()` (which spliced the target into an inventory that already holds it) is removed together with its two calls in `local-prefix.test.ts` (P08, P17).
4. String/doc only: `pattern-update.test-support.ts` comment, `linked-scan/README.md`, `phase-02-slice-11-closeout.test-support.ts` comment, `infra/database-upgrades/README.md` (API paragraph), 11 `supabase/tests/phase_02_slice_12_*/README.md`, catalog-contract header comment ("WIP SQL" -> "promoted SQL").
5. The three `*-replay.sqlinc` (`governed_fix/030`, `governed_fix3/040`, `template_digest/030`): the path occurs only on line 1, an SQL comment ("Replay witnesses for ..."). It is not read or executed at runtime; the files replay byte copies of the migrations' DO blocks inlined in the include. NOT edited (editing would change pgTAP include bytes for a comment). Root may repoint the comment later if wanted.

## Test corrections (for independent review)
No spec contradiction; these follow the removed WIP fallback and are listed so a reviewer can confirm nothing was weakened.
- `phase-02-slice-11-delivery-receiving-upgrade-plan.test.ts`: `reader(a,b)` -> `reader(bytes)`; DR-UR-S01 now covers the promoted source only (the `WIP` and `identical dual` rows removed); DR-UR-S02 (divergent promoted vs WIP refuses) is replaced by DR-UR-S02 "a source path outside the promoted directory is refused", which builds a plan whose `source.path` is the retired `supabase/migrations-wip/dec197/...` path and expects `foreign source path`. DR-UR-S03 (missing source / read error refuses) unchanged.
- `phase-02-slice-11-delivery-receiving-witness-parity.test.ts`: DR-UP-P03 (WIP only when promoted absent), P04 (identical dual), P05/P06 (WIP/promoted divergence) removed because the behaviour they test is removed; P01 asserts `path === PROMOTED`; P02, P07 (absent source refuses), P08 (read failure propagates) and the P09-P17 byte mutations unchanged in meaning.
- `phase-02-slice-11-delivery-receiving-upgrade-local-prefix.test.ts`: `promoteTarget(mock)` removed from DR-UL-P08 and DR-UL-P17 (see above); all assertions unchanged. Neither removed test id is cited by any evidence ledger (grep of the repo found only the handoff note and the test files).

## Files (before / after SHA-256)
| path | before | after | state |
|---|---|---|---|
| `apps/worker/src/cms-composition/linked-scan/README.md` | 4010ad8f8e374b0be273d9480a5e13ee0396406550077294aa0a659ff4cbaecf | 49fdf8be9d22841c25673cc8320ced7e3d77623a4e4e0d096b78982d1ee217cb | edited |
| `apps/worker/src/cms-composition/pattern-update.test-support.ts` | 75290229cba8bdbe2ef8f2addc246254a5e74787929d47aa4b393c5eb8b62750 | f4e83e5348d73391a8ed7f101d201e96a45c390b31c173425d9b7219511efcfc | edited |
| `infra/database-upgrades/README.md` | 84c4aba0ca9a187245da8fd5cac3ef6563e7d1699584e6cce8f77ecab9921b86 | 1a414f7cde8732ff2df543ff0760f288b6ff003b61d6ed00f781f5845d842e12 | edited |
| `infra/database-upgrades/delivery-receiving-upgrade-catalog-relations-contract.mjs` | e5d34eb9c797dbfff79faa2a60ee7d6d8a47e8b38f26c6ebd5858459a8a02391 (reconstructed by reversing the 1-line edit) | 58a0cf0b943f1d7290595904b125fea8d13860b58db8969c0514d167e14dfce1 | edited |
| `infra/database-upgrades/delivery-receiving-upgrade-host-source.mjs` | 0f36d4ba072b52698efed4013067882f320b295e34852633b4ffccb61d858b14 | f317b6449cef89913ef9c9fefe309e035e20378df93816c069894140395d86ef | edited |
| `infra/database-upgrades/delivery-receiving-upgrade-local-inventory.mjs` | 2b03e60f2a0f71a43b641c66401983ba7ebd724bedf40dbf6226659d3c6452c8 | 99583728737026fa1491c4c22b5546ed7545eec51da712039b30ae3002ad90c0 | edited |
| `infra/database-upgrades/delivery-receiving-upgrade-plan.mjs` | 5688cd765ddb8a2bc397ad2c5c9755e33365ce5f0135ac8b39f5d5106aaaa1de | 9316ca5122c74b5ca479f859ef6fc03ea65cece940e1ab8af7d99cf494341d83 | edited |
| `supabase/tests/phase_02_slice_12_composition_instances_read/README.md` | 561e792e49b933e6093090268c2a2844ef897e581d53a499a38579a1ecb42f44 | c1dcabe1cbc0be49a86e226797780d479f54ee6ee942041dd5ac10c351bea608 | edited |
| `supabase/tests/phase_02_slice_12_dec193_resolution/README.md` | f5ae3cc9dc2a4565a44a50965d642e03943ed60e8bc5c74f352c2dc1a3313c5d | 61d3479828ca8ebd7f35dca57aff2328040d1741aec46ddc8b3fffe3fe3eb9bf | edited |
| `supabase/tests/phase_02_slice_12_governed_assignment/README.md` | c767ed202be814314265d1991064c94ebbd542253c79ad72289ee8efce445576 | b34bfe3d6b8b70c7b9de86db6708cde5ada6751473a5ff32131fa86c36b8b088 | edited |
| `supabase/tests/phase_02_slice_12_governed_fix/030-replay.sqlinc` | 41f98e6d6aad0f8c4b8378a60f302f9fd5fc57ae9d8fa4b036ad7493ce3d2f7a | 41f98e6d6aad0f8c4b8378a60f302f9fd5fc57ae9d8fa4b036ad7493ce3d2f7a | UNCHANGED (intentional) |
| `supabase/tests/phase_02_slice_12_governed_fix/README.md` | 9d3585c9f7592feaf2e6718a976f70b50ba613ae4f94df89781b6f2612be81c7 | 9983320ee58ad66a2a1b39d239c5d9ebcbbff4b6c092aa5175e36e1fe186bd39 | edited |
| `supabase/tests/phase_02_slice_12_governed_fix3/040-replay.sqlinc` | 2b4226891c1b92f3321736ecd190c275a033ac3845260b42debf67743ae1dd2e | 2b4226891c1b92f3321736ecd190c275a033ac3845260b42debf67743ae1dd2e | UNCHANGED (intentional) |
| `supabase/tests/phase_02_slice_12_governed_fix3/README.md` | fab07004093b5cdee6d7a7d0f0cfa189fd51257f0d4f23637028dc9a82bc962d | 96b5e7caeffd018ce137bf2213b7f407e283eebe85e375fbc7db089fe29d7ffa | edited |
| `supabase/tests/phase_02_slice_12_locale_resolution/README.md` | 77467e03199abaa701ec1443a2d9937c9b1e58c2a7db36ca9374e15f22be88c1 | feea9da5e6277dbb68ca0a482bb5c8c1138fd6f3f702983cdd9d10ce3c478086 | edited |
| `supabase/tests/phase_02_slice_12_locale_variant/README.md` | 93d42e727abf8c360142cca99b4e683bc0a9dcf3c9ffb7ca6a05fb32b0396e3c | 574d283bd941acfbbf1ddf2a17fa67aedfa80279315715253206ffd80a799e96 | edited |
| `supabase/tests/phase_02_slice_12_related_content/README.md` | 609a49335352b18550cf6fcf913a87cbda24d5a0860383f13d1e7aa2a9fd452e | fd16ec1abf83899399df228ee0c9a8ca1f9fd6ef14732dbac18a1148b308473f | edited |
| `supabase/tests/phase_02_slice_12_related_content_read/README.md` | b8eea74902f8c848c9333bd3045312f677bb1cfbdbf4dfb66f5917485b8428a0 | 44a5eb8bc145d9083bfc1ba73a3090305e24699bf2f3e077a6364989ce666add | edited |
| `supabase/tests/phase_02_slice_12_related_public_targets/README.md` | 5ed4733adc6efd62e1bbaa9c2576de279986f39f9910b45327a35fa6acfe3dc3 | 357833de74c50b7b1dd12ae7113a5d16a30f4eba8c58d835320f90635eb0533c | edited |
| `supabase/tests/phase_02_slice_12_template_digest/030-replay.sqlinc` | 889db390899ce99ddaf84228b99833079048ad131d9ac282eeafdc38d8cdd1fa | 889db390899ce99ddaf84228b99833079048ad131d9ac282eeafdc38d8cdd1fa | UNCHANGED (intentional) |
| `supabase/tests/phase_02_slice_12_template_digest/README.md` | 2de56399aade1da340b9e4f9d6cb5555a32d1ce16961fbcd8a096f1cbf9e4426 | 5564eb93c1c531c594a95dbd61287f5c289daf2bc9aec717f0a8010785001734 | edited |
| `tests/contracts/phase-02-slice-11-closeout.test-support.ts` | 72fdbc70019ca67eeace1ab2f276a3d032cefb5af7cf95aa0f5fa2b09ed982ad | f3966093849cd30aba01e36dc5d71aa0c173e71f337993aa52e916ffe089f2a4 | edited |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-fixtures.ts` | f3e145f7fdc6706fb4f4ba6943d4a32cc001506e00a6bdcf9f452e34714f8ede | cabd88adb0670c6bb9bf39a68a3bab6fac6dca15b022b4a1f803ace62ad5210f | edited |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-fixtures.ts` | 02ece38f18fc0a39f96c2efd311d257d5e8be62bcbd3e0747125e721213268a8 | 14620f8242b2ad3a979d58e9bf18bf4fe90aea111431d9a5ffb8707325353421 | edited |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-local-prefix.test.ts` | b5870e3772defeed77f23ff52d61d47fe35a15a8273d65a916925ef1dfc12eea (reconstructed by reversing the edit) | e318e19f6f926f7ebfc672435d62f360afc7ec4c6346012891e4969c1c088252 | edited |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-plan.test.ts` | df86831d4b3259cc3b40ba73fab1d26575c5bed2159fcb802b701b3d52003845 | c1e0b6f8d7d127c2a90bb53e49aa262563185cde16a6c90ed21830b4ba88fb11 | edited |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-renewal-fixtures.ts` | 53128cd4a6eb19cfb8d8fb10c515cb1dc3f43837662b0819902dc074dc756cfc | 7edfd4354fc1befecdf7b641be02d9fab8818cdda6b14890ad851deb5a52cb74 | edited |
| `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-source-fixtures.ts` | aad1523b2047cd4a778b545b3a100c724a63ffe30482d7f3460273c695ed6495 | 2f3b17dd666b341a3068236f686872912d9256054b374b1883fd642952b88962 | edited |
| `tests/contracts/phase-02-slice-11-delivery-receiving-witness-parity.test.ts` | 847b748f82e01b73f887130b6c89d063d6d8ee94b6f515bd770dc2bc7f2e4362 | 14401082b392416e67b17bc4a0c2884fdfa2c7f2215d24e6b7b22986b4e36cd8 | edited |
| `tests/contracts/phase-02-slice-12-pattern-lineage-witness-parity.test.ts` | 2c9ea0d2d1c4b854de985b3cbef736457563c27e1f59a9a3336565453bfaf892 | 9c98154cef79899ac331211740397685401f515038cd0eaf9601c2168433a037 | edited |
| `tests/contracts/phase-02-slice-12-pattern-placement-witness-parity.test.ts` | 810f1db6e08e5adad186873a39e68e17c598ccf598921e25a1c2c370ea9183db | 312dc5fe7df75036d74cf5bda073b3538581d42f4f90b1ce88e551b936505b65 | edited |
| `tests/contracts/phase-02-slice-12-pattern-updates-pending-parity.test.ts` | dadeabd01812b75f821581e53ae046cc8aab7b48e70e651e2d4bb6963303edb8 | d3d45bed2dbf5b5a06d4adfbf327f563e8d222df24d92aafba98382cbcf0e4d9 | edited |
| `tests/contracts/phase-02-slice-12-taxonomy-lineage-witness-parity.test.ts` | a1051ddf612ad8af156232929778353ef1f06b7c74970e4f70c8118fb898b186 | c4f9fcc505579dedeede35cd1add4b0c5092b6fe169692f884ba0968f4d89372 | edited |
| `tests/contracts/phase-02-slice-12-taxonomy-terms-witness-parity.test.ts` | 6670f9a46b3129d9e74407fa8cee3beab6589e5c86102be3766184d26bf92a6f | 70990d5c4eba195acf45f07f9d946dd8508a08846d480475fec1c63eee937319 | edited |

## Runs (non-DB)
- Baseline before edits: `vitest run tests/contracts/phase-02-slice-11-delivery-receiving tests/contracts/phase-02-slice-11-closeout tests/contracts/phase-02-slice-12 apps/worker/src/cms-composition` -> 5 files failed, 94 tests failed (92 in four `...upgrade-local-{prefix,prefix-lifetime,safety,session}.test.ts`, 2 in `phase-02-slice-12-evidence-guard.test.ts`); 189 files / 4596 tests passed.
- After edits, same command: 1 file failed / 193 passed (194); 2 failed / 4682 passed (4684) (the 2 are the slice-12 evidence guard).
- `tests/contracts/phase-02-slice-11-delivery-receiving-upgrade-`: 16 files, 545 tests passed.
- `witness-parity`: 6 files, 26 tests passed. `phase-02-slice-11-closeout`: 1 file, 16 passed. `apps/worker/src/cms-composition`: 150 files, 3492 passed.
- Whole repo `pnpm exec vitest run` (no coverage): 4 files failed, 2097 passed (2101); 5 tests failed, 29678 passed, 1 skipped. All 5 failures are evidence/receipt guards: slice-09 receipts-guard (50 stale or missing receipts), slice-10 (152 evidence problems), slice-11 (1060), slice-12 (759 + `phase-02-slice-12-receipts.generated.jsonl` missing). None mention a WIP path or a test I changed.
- `prettier --check` on every edited file: clean (prettier reflowed `plan.mjs`, `plan.test.ts`, `source-fixtures.ts`). `eslint` on the edited .ts/.mjs: 0 problems. `pnpm type-check` (`tsc --build`): exit 0.

## Open items
- Evidence guards (above) are ledger/receipt regeneration, root-owned (`node scripts/evidence/run-slice-evidence.mjs --slice N`, `collect-receipts.mjs`). They are the remaining `test:coverage` failures after this lane; they predate it.
- Out of my claim, new since the brief: `supabase/tests/phase_02_slice_12_race_fixes_pattern_locks.sql:2` comment names `supabase/migrations-wip/race-fixes/20261023100000, 20261023100100`; both are now `supabase/migrations/20261023100000_cms_lock_revision_pattern_dependencies.sql` and `20261023100100_cms_publication_pattern_dependency_locks.sql`. Comment only, owned by the races-canonical lane.
- Remaining grep hits by design: `supabase/migrations/README.md:736`, `supabase/migrations/20261016040800_...sql:4` (immutable), `supabase/migrations-wip/README.md`, the three replay `.sqlinc` comments, the race-fixes comment above, and `plan.test.ts` DR-UR-S02 (deliberately names the retired path to prove it is refused).
- `supabase/tests/phase_02_slice_12_dec193_resolution/README.md` still says the resolution helper is "intentionally absent at RED"; I did not verify that claim and left it.

## Requests to root
None blocking. Optional: repoint the three replay `.sqlinc` line-1 comments and the race-fixes comment in a pgTAP-touching pass.
