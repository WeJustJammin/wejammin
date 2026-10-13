# Lane checker report (2026-10-10)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`, lane HEAD
`41a46135dc4f7440c812e40598aa271179214b83` (nothing committed by the lane). Logs are in
`docs/handoffs/2026-10-10-claude-s11/lane-checker-logs/` (pgTAP TAPs also under `.lane-logs/`).

## Files changed

Production:

- `supabase/migrations/20261005017910_cms_load_quality_gate_input.sql` (S11-only, edited in place; not pinned):
  new `platform_private.cms_revision_render_plan(uuid)` and `cms_accessibility_checker_input` rebuilt on it.
- `apps/worker/src/cms-editorial/a11y-structural/`: `render-plan.ts` (new), `registry.ts` (new),
  `input-schema.ts`, `locations.ts`, `rules-structure.ts`, `rules-heading.ts`, `rules-link.ts`, `index.ts`,
  `README.md`.

Tests:

- New: `supabase/tests/phase_02_slice_11_checker_render_plan.sql` (29 assertions),
  `render-plan.test.ts`, `registry.test.ts`, `purity.test.ts`, `gate-isolation.test.ts`,
  `sql-parity.test.ts` (all in `a11y-structural/`).
- Extended: `input-schema.test.ts`, `rules-structure.test.ts`, `rules-heading.test.ts`, `rules-link.test.ts`,
  `checker.test.ts`, `index.test.ts`, `a11y-structural.test-support.ts`.
- Reworded title only: `supabase/tests/phase_02_slice_11_rpc_reads_gate.sql` (see Finding 4, point 5).

## Finding 4 — checker input omits nested object rich text and canonical render order

### Root cause (confirmed)

`cms_accessibility_checker_input` selected only `definition.kind = 'rich_text'` values, so a rich_text property of
a DEC-133 `object` field never became a node: a revision whose only rich text sits in an object loaded with no
field node and the checker reported healthy. The order was a private `union all` of two hand-written groups, so
there was no single place that said what render order is, and a nested extraction bolted on as a third group would
have reversed headings. The Worker schema keyed field nodes by `fieldId` alone and refused duplicates, so a SQL-only
extraction was impossible.

### RED

- pgTAP: `lane-checker-logs/red-sql-render-plan.tap` (run `.lane-logs/alt-tap-193757-3176133.tap`), 12 of 28 failed,
  for the right reason. Test 12: have `a9200000-0000-4000-8000-000000000c34` (the body node alone), want
  `…c35#note,…c35#lead,…c34` (note, lead, body). Test 13: the nested node is NULL (never loaded). Tests 21, 22, 24: the
  render-plan hash is the old one (test 21 have `b96078d3…2d20`, want `f3d27279…8809`). Tests 23, 26, 27: only body and
  blocks load, so the template, declared-order and editor-position cases cannot hold. Tests 18, 19, 20, 25:
  `cms_revision_render_plan` does not exist. The other 16 (fixture, load ok, whole-value node shape,
  scalar/other-locale exclusion, determinism, empty object, no-write) pass before and after.
- vitest: `lane-checker-logs/red-vitest-1.log`, 21 failed of 421. The input schema refused `propertyKey`
  (`input-schema.test.ts` "accepts a rich_text property…" `expected false to be true`), the rules built pointers without the
  property key (`rules-heading.test.ts`, `rules-link.test.ts`, `rules-structure.test.ts`), `checker.test.ts` showed a nested
  `h3` first heading and a nested generic link unseen, `gate-isolation.test.ts` showed a nested-property input
  `failed` instead of `healthy`/`blocked`, and `render-plan.test.ts`/`registry.test.ts` could not import their modules.
  Two defects of my own `purity.test.ts` surfaced and were fixed before it was trusted: it flagged `field.document` (a data
  member) as the DOM global in the RED run (the detector now ignores member names, `isReference`, with positive and
  negative fixtures), and its "reaches the JCS module" check sliced a path outside the directory (first GREEN run,
  `1 failed | 475 passed`).

### The fix: one canonical render-plan derivation, one stable identity vocabulary

SQL, `platform_private.cms_revision_render_plan(p_revision_id uuid)`, private `SECURITY DEFINER`, owner
`wejammin_cms_definer`, `search_path = ''`, `STABLE`, revoked from every API role. It returns one row per judged
location in render order: `plan_position` (1..n), `plan_kind`, `identity` (jsonb), and the keys that load the payload
(`field_value_id`, `property_key`, `instance_id`). Identity, stable and content-free:

| Location | Identity |
| --- | --- |
| whole rich_text value | `{ kind: field, fieldId }` |
| rich_text property of an `object` field | `{ kind: field, fieldId, propertyKey }` |
| composition instance | `{ kind: block, pointer, blockKey, blockVersion }` |

Order: fields by editor position (`editorConfig.order`, then field key bytewise, then stable field id); an object field's
rich_text properties in the order its `objectStructure` DECLARES them (never the stored jsonb key order, which is
length-then-bytewise); then live composition instances by template slot index (unknown slot last), path (bytewise)
and id. `cms_accessibility_checker_input` now builds nodes as `identity || payload` and `renderPlanHash` from the
identities of the same rows, so the load cannot add an order or an identity of its own. A top-level node keeps its
four-member shape; a property node adds `propertyKey`.

Worker, `render-plan.ts`: `RenderIdentity`, `renderIdentityOf(node)` and `renderIdentityKey(identity)` name what the
database named. `input-schema.ts`: the field node takes an optional `propertyKey` (the contracts `CmsFieldKeySchema`,
the DEC-133 property-key grammar); duplicate detection is by identity key (`field:<id>#<prop>`); one field being both a
whole value and an object with properties is refused (`field_identity_mixed`). Finding pointers for a property are
`/fields/{fieldId}/{propertyKey}/blocks/{i}/spans/{j}` with `blockPath` `/{propertyKey}/blocks/{i}`; `structure.rich_text_invalid`
addresses the property, not the field.

Cross-boundary proof, so the two sides cannot drift: the independent `sha256sum` vector `f3d27279…8809` of
`{"nodes":[meta#note,meta#lead,body],"templateVersionId":null}` and the template/block vector `2cb8fc5d…7111` (SQL)
and `329dde74…9614` (TS, field/field/block) are asserted by pgTAP and by `render-plan.test.ts`. The document the live
database answers for an object-field revision is a `$j$` literal in the pgTAP file (asserted equal to the real output);
`sql-parity.test.ts` parses that literal, schema-validates it, recomputes the hash with the TS JCS module and runs the checker
over it: blocked with exactly `link.text_generic /fields/…c35/note/blocks/1/spans/0`, and the same nodes in another order
give `heading.first_level`.

### GREEN

- pgTAP, alt stack: `lane-checker-logs/green-sql-1.tap` (`.lane-logs/alt-tap-194551-3208789.tap`): 9 files, 340 tests,
  0 failed — the new file (28 at the time), `phase_02_slice_11_rpc_reads_gate.sql`, `phase_02_slice_09_r8_api_surface.sql`,
  `…_r3_grants_misc.sql`, `…_evidence_grants.sql`, `…_g1_consumer_boundary.sql`, `phase_02_slice_11_criteria_manifest_rls.sql`,
  `…_e7_settings_writer_tail.sql` (includes the checker input), `…_rpc_reads_workflow.sql`.
  Final run with the parity assertion added (`green-sql-2.tap`, `.lane-logs/alt-tap-200035-3265932.tap`): 2 files, 65 tests,
  0 failed (`phase_02_slice_11_checker_render_plan.sql` 29, `phase_02_slice_11_rpc_reads_gate.sql` 36).
- vitest: `lane-checker-logs/green-vitest-coverage-3.log`: `a11y-structural/` 21 files, 482 tests, 0 failed; coverage of the
  directory's production files 100% statements, branches, functions and lines (385/385, 207/207, 87/87, 353/353).
  Neighbour suites (`cms-editorial-production-quality-gate`, `-workflow`, `cms-publication-schedule-sweep`,
  `cms-editorial-principals`): 24 files, 522 tests, 0 failed (`green-vitest-2.log`).
- `tsc -p apps/worker/tsconfig.json --noEmit`: exit 0 (`tsc-worker-3.log`). `eslint --max-warnings=0` on the directory:
  exit 0. `prettier --check` on the directory's `.ts` and `.md`: clean.

### Tests changed or added (old to new)

- `phase_02_slice_11_rpc_reads_gate.sql`, title only, expectation unchanged:
  `block nodes are the live (draft | active) instances, fields first, ordered by path (a superseded and a pending_diff instance are not rendered) [P2-S11-AC-101]`
  became `block nodes are the live (draft | active) instances, after the revision's field nodes (the render plan: fields, then instances by slot and path), ordered by path here (a superseded and a pending_diff instance are not rendered) [P2-S11-AC-101]`.
  Nothing cited by the evidence ledgers changed (the ledger cites only "the load writes nothing…" from this file).
- `rules-structure.test.ts` "yields the parsed field and no finding for a valid value": the match object now also
  requires `propertyKey: null` (additive).
- `index.test.ts` "exports exactly the documented values": five names added (`ACCESSIBILITY_CHECKER_REGISTRY`,
  `CMS_ENTRY_REVISION_TARGET_TYPE`, `CheckerRegistryError`, `checkerTargetOf`, `defineCheckerRegistry`).
- `a11y-structural.test-support.ts`: `fieldNode(seed, value, propertyKey?)`, `parsedField` returns `propertyKey: null`,
  new `parsedPropertyField` (fixtures only).
- Added, pgTAP (`phase_02_slice_11_checker_render_plan.sql`): object-field nodes in declared order at editor position;
  exact property node shape; whole-value shape kept; scalar and other-locale values never nodes; determinism; empty
  object adds no node; plan function posture; plan rows equal identities; every node is plan identity plus payload;
  independent hash vector (two); template slot and path order; positions 1..n; declared-order move; editor-position
  move; parity fixture; no writes.
- Added, vitest: `input-schema.test.ts` "property nodes (DEC-133)" (15 cases), nested cases in `rules-structure`,
  `rules-heading`, `rules-link`, `checker`; `render-plan.test.ts` (9); `sql-parity.test.ts` (4); `purity.test.ts` (41, mostly one pair per judged module); `gate-isolation.test.ts` (6).

### Interpretation to ratify (and why the "fields-first" assertion kept its expectation)

BE05c orders "template slot order, then bound field position within each slot, then composition order". No Phase 2 registry
row binds an entry field to a template slot: `cms_field_definition_versions.editor_config` is `{label, helpText?, order}` and a
template `bindings` entry is `name -> { projection, required }` (a named domain projection, e.g. `profile.title`). So
"bound field position within a slot" has no data to read, and the only honest derivation is: every field is in a leading
root region ordered by editor position, then slot-ordered composition. The existing fields-first assertion therefore
pins the correct behaviour for the data that exists (fields precede instances; the observable bug was the missing nested
nodes and the absent single derivation, not the field/block interleave: only fields carry headings and links, so field
versus block order changes no rule outcome, only `renderPlanHash`). I did not invent a binding. When a binding exists, the
slot-bound position is added in `cms_revision_render_plan` only; the checker needs no change (README "Slot-bound fields").
If the owner wants a different placement of the root region (for example after the slots), it is one `region_no` in that
function and the two hash vectors.

## AC-098 — the checker module

(a) No network, DOM or Browser Rendering provider, proven two ways. `purity.test.ts` reads every production source of the
directory and every local module they reach (including `content-schema-registry/migration-transform-jcs.ts`) as a
TypeScript syntax tree and fails on any reference to a network, DOM, Browser Rendering or environment name
(`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `Request`/`Response`/`Headers`, `document`, `window`,
`puppeteer`, `playwright`, `BROWSER`, `Browser`, `axe`, `process`, `env`, `globalThis`, `self`, bindings types, `import.meta`)
and on any package other than `@wejammin/contracts` and `zod` (zod only in `zod-runtime.ts`); member names, comments and strings
are not references. `gate-isolation.test.ts` runs the gate (healthy, blocked, failed load, unreadable target, throwing load,
invalid input, never-settling load at its deadline) with `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `document`,
`window` and `Browser` replaced by throwing traps and asserts none was touched. `navigator` is deliberately not trapped (the zod
runtime reads it once for a harmless feature check). Mutation proof (restored afterwards, byte-identical): `void fetch(...)`
injected into `checker.ts` fails `purity.test.ts` ("expected [ 'fetch' ] to deeply equal []") and three `gate-isolation` cases
("fetch must not be used by cms.a11y.structural") — `mutation-fetch-in-checker.log`; `import … from 'node:https'` in `text.ts` fails
"text.ts imports only local files, the contracts package and zod" — `mutation-https-import-in-text.log`.

(b) The BE05c registry rules, implemented now: `registry.ts`. `defineCheckerRegistry(rows)` refuses an empty registry, a
checker key that is not a BE05c `Key`, a version that is not a positive decimal integer of at most 18 digits, a target
type outside `^[a-z][a-z0-9._-]{1,63}$`, a `timeoutMs` outside the integers 100 to 2,000, a (key, version) registered twice
(a checker version names one target type), a target type with no current version and a target type with two. Every
version stays readable (`find`, `versionsOf`, ascending by number whatever the input order); `currentFor(targetType)` is the
one current registration and `isCurrent(key, version)` is what Slice 16 needs for `stale`. The Phase 2 registry is
`cms.a11y.structural` version 1, `cms.entry_revision`, current, `timeoutMs` 2,000, built from the `@wejammin/contracts`
constants (so registry, evidence and audit record cannot disagree). `checkerTargetOf(input)` is the target: the revision uuid
and its `revision_number`. `registry.test.ts` (44 cases) covers every rule above including an older readable version beside
a current one. Interpretation: "exactly one current version per target type" is enforced literally (across checker keys),
the stricter reading.

## Spec lines satisfied

BE03b:1793 (category 11 over the rich_text.v1 values and the template render plan); BE05c:1000-1001 (registry row:
versions, older readable, one current per target type, `cms.entry_revision` target), :1002 (runtime, no network or DOM),
:1004-1006 (inputs by stable field id; document order is one pure function; the checker never re-derives order),
:1016-1019 (heading rules now see nested headings in plan order); DEC-133 (depth-1 object rich_text properties).
Tracker: P2-S11-AC-098, AC-100, AC-101.

## Open items for the orchestrator

1. `packages/data-access/src/database.types.ts` needs `pnpm db:types` (new private function `cms_revision_render_plan`);
   not in my ownership, so not regenerated (`db:types:check` will fail until it is).
2. Evidence ledger citations (not my files): add the new titles to the AC-098 (`purity.test.ts`, `gate-isolation.test.ts`,
   `registry.test.ts`), AC-100 (`render-plan.test.ts`, `sql-parity.test.ts`, pgTAP checker_render_plan) and AC-101 entries.
3. Slot-bound field position needs a registry source before it can be implemented (see Interpretation above); owner call if
   BE05c is to be read as requiring field-to-slot binding in Phase 2.
4. `ACCESSIBILITY_NODES_MAX` is still 256. With object properties a revision can now have more rich_text nodes (up to
   128 fields times 32 properties); beyond 256 the gate fails closed (`TARGET_UNREADABLE`, unavailable `checker_failed`). Raise it
   if the owner wants such revisions publishable (a one-constant change plus the existing boundary test).
5. `supabase/migrations/README.md` row for `017910` could mention the render-plan function (not my file).
6. Other lanes' working-tree changes (`20261005017570`, `20261005017870`, publication and recheck files) were in the alt
   stack reset; they did not affect these suites.
