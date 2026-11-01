# Lane L0 (contracts) report, Slice 12

Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`. Nothing was committed,
staged or stashed; no migration, no `apps/**` or `supabase/**` file was touched. RED and GREEN logs are in
`docs/handoffs/2026-10-12-claude-s12/lane-l0-logs/` (`red-<module>.log` fails because the module or behaviour did not
exist; `green-*` and `vitest-related.log` are the later runs).

## Verification (all under `flock -s /tmp/wejammin-quiet.lock`)

| Check | Result |
| --- | --- |
| `vitest run packages/contracts` plus the seven `tests/contracts/phase-02-slice-12-*-openapi.test.ts` | 181 files, 2169 tests passed (`green-final-contracts.log`) |
| `node infra/generate-openapi.mjs --check` (`pnpm contracts:check`) | passes; committed `docs/openapi/openapi.json` equals the generated one |
| `tsc --build packages/contracts/tsconfig.json` | clean (no `export *` name collision with `cms-editorial`) |
| eslint `--max-warnings=0` on all 73 touched `.ts`/`.mjs` files | clean |
| prettier `--check` on the same 73 files | clean |
| type-check of my test files (scratch tsconfig, outside the repo) | clean, except the existing `TS7016` for `infra/openapi-document.mjs` that every Slice 12 OpenAPI test already has |
| `vitest related --run` on the changed contract sources (`vitest-related.log`) | 1047 files, 7 failed / 10 tests failed; 9 are CMS-03C-02 consumers (below), 1 is unrelated |

## Files changed

New modules under `packages/contracts/src/cms-composition/` (each with an adjacent `*.test.ts`):
`key-grammar`, `definition-state`, `refusals`, `error-catalog` (zod-free), `conditional-if-match`,
`governed-review`, `governed-decision`, `governed-assignment`, `governed-activation`, `governed-review-read`,
`governed-activation-job`, `pattern-node`, `pattern-version`, `pattern-selector`, `pattern-update`,
`taxonomy-version`, `taxonomy-selector`, `taxonomy-term-list`, `canonical-taxonomy-match`, `locale-resolution`,
`related-public-target` (also the code-owned `CMS_RELATED_RULES`), `preflight-providers`,
`composition-fixtures.test-support`. Extra test files created by splitting oversize suites:
`refusals-operations`, `governed-review-queue`, `pattern-update-diff`, `template-keys`, `locale-variant-stale`.

Edited: `template.ts` (E13 reserved keys via `key-grammar`, E4 audience grammar `^[a-z0-9_-]{1,48}$`, `templateId`,
conditional If-Match), `template-detail.ts` (inherits both), `pattern-instance.ts` (DEC-175 node-path override keys,
`position`, `PatternPlacementResource`, int32 `patternVersion`, If-Match equality), `taxonomy-term.ts` (exports the label
schema, If-Match equality), `locale-variant.ts` (`staleFieldIds`, If-Match equality), `related-content.ts` (If-Match
equality), `index.ts`, `README.md`.

Outside the directory, all within "registry / OpenAPI": `packages/contracts/src/platform-registries.ts` (15 new rows,
CMS-03C-02 now answers `PatternPlacementResourceSchema`), `packages/contracts/src/openapi.ts` (31 schemas),
`infra/openapi-definitions-cms-composition.mjs` (new; the response definitions of the 15 operations) plus one import and
one spread in `infra/openapi-definitions.mjs` and the new CMS-03C-02 success wording, `docs/openapi/openapi.json`
(regenerated), `packages/contracts/src/registries.test.ts` (+15 operation ids) and
`packages/contracts/src/core-contracts.test.ts` (+30 component names). New agreement tests:
`tests/contracts/phase-02-slice-12-{governed-review,pattern,taxonomy-version}-openapi.test.ts` and
`phase-02-slice-12-openapi.test-support.ts`.

## Criteria proven (RED, change, GREEN)

RED = the log of the same test file before the change. Registry/OpenAPI RED reproduced by running the three
`tests/contracts/phase-02-slice-12-*-openapi.test.ts` files against the HEAD `platform-registries.ts`
(`red-registry-openapi.log`: 47 failed, first failing line `Error: CMS-03C-06 is not registered.`).

| Area | Criteria (markers) | RED log | Change |
| --- | --- | --- | --- |
| Key grammar, E13/E14, lineage ids, node keys and paths | AC-189, AC-191, AC-101, AC-125, AC-028 | `red-key-grammar.log` (import fails) | `key-grammar.ts` |
| Template keys, audience, templateId, If-Match | AC-189, AC-025, AC-191, AC-165, AC-166, AC-007 | `red-template.log` (7 failed incl. `[P2-S12-AC-189] refuses a reserved templateKey...`: expected true to be false) | `template.ts` |
| Typed refusals, error catalog | AC-274, AC-008..AC-187 per operation, AC-222, AC-223, AC-233, AC-083 | `red-refusals.log`, `red-error-catalog.log` | `refusals.ts`, `error-catalog.ts` |
| Governed review set CMS-03C-06..11 | AC-064/065/067, 070/071/073, 076/077/079, 082/083/085, 088/089, 094/095 | `red-governed-*.log` | `governed-*.ts` |
| Activation job CMS-03C-19 | AC-142, AC-143, AC-147 | `red-governed-activation-job.log` | `governed-activation-job.ts` |
| Pattern CMS-03C-02/12/13/14/15 + latest read | AC-010, AC-013, AC-027, AC-028, AC-100, AC-101, AC-103, AC-106/107, AC-112/113/114, AC-118/119/121, AC-171/172, AC-218 | `red-pattern-instance.log` (9 failed: new key grammar, `position`, `PatternPlacementResource`), `red-pattern-node.log`, `red-pattern-version.log`, `red-pattern-selector.log`, `red-pattern-update.log` | `pattern-*.ts` |
| Taxonomy CMS-03C-03/16/17 + versions/terms reads | AC-019, AC-124/125/127, AC-130/131, AC-177/178, AC-183/184 | `red-taxonomy-version.log`, `red-taxonomy-selector-terms.log`, `red-ifmatch-operand.log` | `taxonomy-*.ts` |
| Canonical match CMS-03C-18 | AC-136, AC-137, AC-140 | `red-canonical-taxonomy-match.log` | `canonical-taxonomy-match.ts` |
| Locale CMS-03C-04/20 | AC-056, AC-235, AC-148, AC-149, AC-051, AC-052, AC-240 | `red-locale-variant.log` (6 failed: `staleFieldIds`), `red-locale-resolution.log` | `locale-variant.ts`, `locale-resolution.ts` |
| Related CMS-03C-05/21 | AC-061, AC-153, AC-154, AC-229 | `red-ifmatch-operand.log`, `red-related-public-target.log` | `related-public-target.ts`, `related-content.ts` |
| Preflight providers | AC-238, AC-239, AC-240, AC-241 | `red-preflight-providers.log` | `preflight-providers.ts` |
| Registry parity and OpenAPI | AC-275 and the registration clause of AC-064/070/076/082/088/094/100/106/112/118/124/130/171/177/183, AC-010 (placement), AC-136/153 (internal ops absent) | `red-registry-openapi.log` | registry rows, `openapi.ts`, `infra/openapi-definitions-cms-composition.mjs`, regenerated `openapi.json` |

A marker is not proof: the Hono-route half of "OpenAPI and the discovered Hono route match the registry row" (AC-064 etc.)
and the SQL/Worker halves are other lanes'. This lane proves the registry row and the generated OpenAPI operation agree
with the spec table.

## Test titles changed in existing files (old -> new)

- `pattern-instance.test.ts`: fixtures `overrides: { title: ... }` -> `{ '/title': ... }` and the resource fixture gains
  `position: 0`. Bodies changed, titles kept: `accepts a bounded linked request and optional digest omission` (override keys
  `/optional`, `/items`), `bounds override key count, names, JSON depth, and non-JSON values` (65 node-path keys refused,
  64 accepted, a 513-character node path replaces the 129-character key, depth/NaN cases keyed `/nested`, `/bad`),
  `counts the override root when enforcing the locked depth-eight limit` (key `/nested`).
- `locale-variant.test.ts`: resource fixture gains `staleFieldIds: []`; this is the only edit (S09 AC-1166 tests keep their
  titles).
- `template.test.ts` and `template-detail.test.ts`: resource/detail fixtures gain `templateId`. Their new tests live in
  `template-keys.test.ts`, `template-detail.test.ts` and `locale-variant-stale.test.ts`.
- `registries.test.ts`: `registers the foundation routes, retention class, and SLO as closed inputs` expects the 15 new ids
  after `CMS-03C-05` in registry order. `core-contracts.test.ts`: `derives OpenAPI component schemas from the runtime
  contracts` expects the 30 new component names.

## Behavioural changes other lanes must follow

1. `TemplateVersionResource` and `TemplateVersionDetail` now require `templateId` (spec line 860). The RPC and Worker of
   CMS-03C-01 and the latest read must return it, and every worker/web fixture of those resources must carry it.
2. `CompositionInstanceResource` requires `position` (int, 0..2147483647); CMS-03C-02 answers `{ items: [...] }`
   (`PatternPlacementResource`, 1..512 rows, one revision/pattern/version/link mode, distinct paths and ids, consecutive
   positions); CMS-03C-15 rows carry `position` too.
3. `LocaleVariantResource` requires `staleFieldIds` (empty unless `state` is `stale`).
4. The template audience is `^[a-z0-9_-]{1,48}$`. Existing rows or fixtures with a longer or mixed-case audience now fail
   the latest read; the FIX lane's CHECK needs a populated-data backfill (PAT-025).
5. Override keys must be normalized node paths; a bad key is one Zod issue at `/overrides` with the message
   `override_key_not_node_path`. Similar message-as-token issues: `key_reserved` (at `/templateKey` or `/patternKey`),
   `pattern_depth_exceeded` (at the ninth-level node), `pattern_nodes_exceeded` (at `/blockTree`),
   `node_key_duplicate`, `diff_too_large`, `choices_single_instance_only`. The Worker maps these to `details.reasonCode`.
6. The shipped 403 token is `CAPABILITY_REQUIRED`; the Slice 12 closed set (and `CMS_SLICE_12_OPERATION_REASONS`, which
   allows `capability_missing` on CMS-03C-01..05) uses lowercase `capability_missing`. Switching is the Worker lanes' call.
7. The 502/503/504 mapping is one code, `DEPENDENCY_UNAVAILABLE`, in `error-catalog.ts` (DEC-172/186 item 7); the shipped
   `DEPENDENCY_INVALID_RESPONSE` and `DEPENDENCY_DEADLINE_EXCEEDED` are not in any catalog.

## Judgement calls (change if the orchestrator disagrees)

- Request schemas are not `.readonly()` (it publishes `readOnly: true` on a request body, as Slice 11's do); the assignment
  request is the 03b schema itself, so it keeps that quirk.
- `CMS_RELATED_RULES` is exported, but `derivedRule.key/version/reasonCode` stay grammar-only in the request schema so the
  server can answer `derived_rule_unknown` (a Zod failure would lose the token). The existing test key `similar-genre` still
  parses.
- Ordering of selector and term pages is not asserted (text collation is not defined by the spec); only keyset-order of the
  governed queue (timestamp, uuid) and newest-first taxonomy versions are.
- Invariants added beyond a bare shape, each from explicit spec text: review `invalidatedReason`/`decidedAt` coupling,
  protected review needs two decisions, `cms.reviewer` first capability slot, activation `eventType` per subject kind,
  diff `collisionCount`/`bulkEligible`, `LocaleFieldResolution` blocking rules, `Taxonomy*` merged/successor coupling,
  placement rows' consecutive positions (AC-218), the 256 KiB bounds.
- The shared registry rows use `owner: ContentSchema` for definition operations and governed reviews, `Editorial` for
  author-facing ones, `docs/runbooks/platform/operational-endpoints.md` as runbook (a test forbids `cms-editorial.md`
  for non-Slice-10 editorial rows). Rate classes are new per operation family.

## Open items and things I could not do

- Not in this lane and not done: the browser-lazy re-exports in `cms-editorial/validators.ts` and the zod-free ones in
  `client.ts` (the web lane needs `error-catalog`, the reserved-key lists and the new schemas there); the 03b
  `CMS_PREFLIGHT_REGISTRY` mirror in `cms-editorial/preflight.ts` still lists `pattern`, `taxonomy` and `locale` as reference
  gates (`CMS_SLICE_12_PREFLIGHT_PROVIDERS` is the contract for the replacement rows); the platform-queue message schemas for
  `cms.governed_review.recheck` and `cms.pattern.linked_update_scan` (DEC-166); a stale-CAS `details` schema for the 03c
  409 (the spec says only "safe version/conflict metadata"); the token for a failed CMS-03C-09 preflight (BE03c lists none,
  Slice 11 uses `preflight_failed`).
- `docs/openapi/openapi.json` must be regenerated (`node infra/generate-openapi.mjs`) after any other lane changes a
  registry row or contract schema; a merge conflict there is mechanical.
- Receipts: editing `locale-variant.test.ts` makes six S09 `P2-S09-AC-1166` receipts stale (the
  `phase-02-slice-09-receipts-guard` test lists them); regenerate with `scripts/evidence/collect-receipts.mjs`. The other
  failures in `vitest run tests/contracts` at the time of my run (S09 AC347 citations, S11 BOUNDARY marker in
  `production-job-effect-dispatcher.ts`, stale pgTAP receipts, S11 evidence guard) come from other lanes' in-progress files.

## Consumer breakage (`vitest related`, `vitest-related.log`)

Caused by this lane (the CMS-03C-02 response is now `{ items: [...] }` of rows that carry `position`; I did not edit
any of these, as instructed). Each needs the PatternPlacementResource fixture and the plural-items assertion, owned by the
CMS-03C-02 worker/web lanes:

- `apps/worker/src/cms-composition-production-pattern.test.ts`: `calls only the named private RPC with server-bound
  context`, `isolates the cached server context from a later caller session and permits editor role`
- `apps/worker/src/cms-composition/pattern-instance-routes.test.ts`: `mounts the protected route in the composed Worker
  when injected`, `returns the authoritative instance and forwards the exact precondition to the port`,
  `cms-pattern-instance: a request with no defect is accepted`
- `apps/worker/src/cms-composition/pattern-instance-boundary.test.ts`: `isolates asynchronous and synchronous telemetry
  failures from the result`
- `apps/worker/src/cms-composition/pattern-instance-contracts.test.ts`: `rejects malformed or unrelated private instance
  resources` (the guard in `pattern-instance-contracts.ts` still validates a single `CompositionInstanceResource`)
- `apps/web/src/server/cms-composition-platform-pattern.test.ts`: `forwards a valid response without disclosing local
  cookies or caller authority`
- `apps/web/src/pages/api/v1/cms/compositions/pattern-instances.test.ts`: `stays dynamic and forwards a validated
  mutation through the private Worker binding`

Not caused by this lane: `tests/contracts/phase-02-slice-11-closeout.test.ts` (`boundaries: the only BOUNDARY: markers
...`; another lane's `BOUNDARY:` marker in `supabase/migrations/20261010165000_cms_projection_consumer_state.sql`
against the tracked list).

No worker or web test broke on `templateId`, `staleFieldIds` or the audience grammar: those suites either already carry
the member (the FIX lane edited them) or do not parse the strict resource.
