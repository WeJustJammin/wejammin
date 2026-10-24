# Browser narrow-validator boundaries — implementation freeze

Date: 2026-10-16. Author: native `gpt-6.1-sol` / `ultra`.
Worktree: `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`.
State: **ROOT RED RECORDED; IMPLEMENTATION AUTHORED, UNRUN**.
Root owns all execution and fresh artifact/budget acceptance.

## Exact claim

These four files were authored under the original root TEST-ONLY Dispatch claim:

- `packages/contracts/src/browser-validator-entry-boundaries.test.ts` — new.
- `apps/web/src/browser-validator-import-boundaries.test.ts` — new.
- `apps/web/src/components/platform-configuration/phase-02-slice-07-frontend.test.tsx` — additive cases/import only.
- This handoff.

After attributable root RED, a separate exact eight-path GREEN claim released
the seven production/doc/config files listed below and this report. Tests remain
frozen. All schema definitions, root barrels, chunk groups, budgets, companion
declarations and other files remain outside that GREEN claim. The primary
checkout was not edited.

## Test boundaries

`BROWSER-VALIDATOR-01/02` require the CMS curated validator entry to expose the
original `RelatedContentRuleReadSchema` and `relatedRuleReadAnswersEntry` objects.
`03` requires the exact package export mapping for
`@wejammin/contracts/platform-configuration/validators`.
`04` requires that future entry to export only the original
`Cfg05a02EffectiveValueResponseSchema` object.
`05/06` walk actual value imports/re-exports using the TypeScript syntax tree:
the complete static runtime closure must be acyclic, have only `zod` as an
external value dependency, and reach neither the root barrel nor `cms-delivery`.
The four DEC197 private storage schema exports are explicitly excluded.

The absent future platform file is asserted **inside** `04/06`; its dynamic
import is variable-based and guarded after the existence assertion. No static
import of that absent entry can abort test collection.

`BROWSER-IMPORT-01` walks each actual consumer's runtime graph, including
literal dynamic imports and package-export resolution. The graph must contain
its curated validator subpath, contain no whole-contract-barrel edge or
unresolved local contract edge, and reach no private receiving module. A
forbidden root-barrel edge is reported directly instead of recursively parsing
the entire server barrel.
`02` walks only eager edges and excludes validators, Zod and private receiving
modules from the eager closure. `03` controls the syntax-tree scanner against
type-only imports/exports, import-like comments/data, mixed imports, empty
side-effect imports, re-exports and an actual lazy import.

`BROWSER-EFFECTIVE-01/02/03` call the existing effective-response mapper directly:
exact projection/provenance mapping, both existing compatibility fallbacks,
and refusal of null, malformed UUID/version/compatibility or an unknown field.
No response schema, sanitizer or mapping implementation was changed.

## Historical oracle preservation

The frontend test received one import and the new `BROWSER-EFFECTIVE` block.
Removing exactly those additions reconstructs its original bytes and SHA256:

`1d370255242caf3bf5170499e2d7484bba04a81d4d4edaed8c66f3bbfd125794`.

Every prior assertion, fixture and case remains unchanged. None was deleted,
weakened, retitled or converted to a skip.

## Frozen test bytes — author UNRUN

| File | Physical lines | SHA256 |
| --- | ---: | --- |
| `packages/contracts/src/browser-validator-entry-boundaries.test.ts` | 134 | `4fa2b70402f155af72e55cb84a101482f2db9737b1a94de6dc25ba46c9881b88` |
| `apps/web/src/browser-validator-import-boundaries.test.ts` | 139 | `4f88f6c3aae7c32858e22e7f59fcd3231c0d9427e4af7c876bb4479e66035ee9` |
| `apps/web/src/components/platform-configuration/phase-02-slice-07-frontend.test.tsx` | 350 | `f23da79bd53a972bd668fbf70dd4e5bb6feabb44d73f186665bbbfdaf85f85db` |

These are pre-format author hashes, not execution receipts. Root must record
mechanical formatting changes and fresh hashes separately if formatting them.

## Root-owned baseline and next gate

Read-only inspection of root's actual build receipt
`/tmp/wejammin-native-registry-green-xevOHL/actual-bundle-final.log` confirmed:

- Shared `contracts.DwpZLHsz.js`: 171624 gzip bytes against 81920, over by 89704.
- Registry initial route: 92451 against 92160, over by 291.
- Taxonomy-edit initial route: 92316 against 92160, over by 156.
- Optional Vite manifest absent; the existing emitted-import fallback measured
  actual files. No missing-entry failure, and all declared companions remain charged.
- The actual emitted whole-barrel entry exports both DEC197 private storage
  schemas and both state schemas. Their constructors/refinements occur in the
  shared browser chunk. This is schema exposure, not proof of private-record disclosure.

Receipt SHA256:
`b0594c7205dbf1fd7408019aef1b3ea256daa1eeb19b6c522c79584940034a33`.

Root ran all three focused test files before releasing production:
`/tmp/wejammin-native-registry-green-xevOHL/browser-validator-red.json`.
Readback confirms **28 tests, 21 PASS, 7 meaningful FAIL, 0 skipped, no collection
abort**. Failures are exactly the two whole-barrel consumer graphs and
`BROWSER-VALIDATOR-01/02/03/04/06` (missing original exports, package mapping and
guarded future file). Behavioral and scanner/closure preservation controls pass.
Receipt SHA256:
`a005c8b57782711a68e811209931fecfe666086e46bad313745daee48fe1a9e1`.

## Exact GREEN implementation — author UNRUN

- `packages/contracts/src/cms-editorial/validators.ts`: add only the two named
  direct re-exports from `../cms-composition/related-content.ts`.
- `packages/contracts/src/platform-configuration/validators.ts`: new five-line
  curated entry; only the original effective-response schema is re-exported.
- `packages/contracts/package.json`: add only its exact package subpath mapping.
- `packages/contracts/src/platform-configuration/README.md`: document that entry.
- `apps/web/src/components/cms-related-content/related-conflict-read.ts`: use
  `loadedCmsValidators() ?? (await loadCmsValidators())` instead of the root
  dynamic import; remove its obsolete no-curated-export comment. The existing
  loader's lazy/shared/retry behavior is reused. The subsequent freshness
  `check()`, schema/predicate calls, ETag binding and all cancellation/deadline/
  request-stage behavior remain byte-identical.
- `apps/web/src/components/platform-configuration/settings-flags-runtime-controller-helpers.ts`:
  replace only the dynamic-import specifier with the narrow platform subpath;
  schema parsing, sanitizer and every mapping expression are unchanged.
- `vitest.config.ts`: add the explicit platform subpath alias before the generic
  contracts alias, matching the existing subpath-alias convention.
- This report.

No schema copy, new validation rule, eager validator import, root-export change,
chunk split, accounting change or companion removal was made. Reversing exactly
the approved edits reconstructs the pre-GREEN hashes of all six modified existing
files. All three frozen test hashes above remain unchanged.

### Frozen implementation bytes (pre-format; not an execution receipt)

| File | Physical lines | SHA256 |
| --- | ---: | --- |
| `packages/contracts/src/cms-editorial/validators.ts` | 157 | `3c0df48a858315f56d0dfd9c633720c2f359d6e2a1ad3266d214b51140615d09` |
| `packages/contracts/src/platform-configuration/validators.ts` | 5 | `303220e9029cf7a9eaf6ac5249391592bd1f70bec3f8496b4c105c798bf1045f` |
| `packages/contracts/package.json` | 22 | `29dd293f1ebb60d0ddec1f0482fe6e32775895af6ed1f472ea3b17a52467da80` |
| `packages/contracts/src/platform-configuration/README.md` | 59 | `91d4c100fdc836eb1967cfd2aeeed6a071b6a813e6e0ae2dd47ad691f36086c9` |
| `apps/web/src/components/cms-related-content/related-conflict-read.ts` | 226 | `e99ec7d1490fbe8591a2dbd3c700d459e076ee434c839811137f6e6f5af7f9bb` |
| `apps/web/src/components/platform-configuration/settings-flags-runtime-controller-helpers.ts` | 211 | `8a459df494591cda742a91e53c9a6f5f3c780a82a637841d7901dbe8d39c129f` |
| `vitest.config.ts` | 91 | `8237e35fdce506724b44f0261c0b3dcab0f31301688b82eecabcc525cca4e239` |

After focused GREEN and existing related conflict/lazy-loader/platform checks,
root must perform a fresh actual build/budget check and inspect **all** emitted
browser assets, deferred chunks included, for absence of DEC197 private storage
exports/constructors. Source-closure tests do not replace artifact proof.
Narrowing alone is not claimed to clear the lazy ceiling or either independent
initial-route overage. No chunk/accounting/ceiling/companion change is authorized.

## Execution limits

Author used read-only source/data analysis and absolute `apply_patch` edits to
the original four TEST-ONLY files, then only the eight released GREEN paths.
No tests, runtime, formatter, lint, type-check,
build, database, Docker, network or Git mutation was run. TDD and contract
evolution skills governed assertion-first authoring; execution remains with root.
