# Lane report: claude_s12_web_composition

## Status

GREEN for the web slice of CMS-12 (composition page, instance list, selector, update diff, three new first-party
proxies), with ONE BOUNDARY: the instance list read does not exist in BE03c (see Open items). Vitest only; no DB, no git
writes. HEAD `b16edb54a7a1b698ed8ca15b6085046d4270626e`, finished 2026-10-22T06:42Z. No acceptance criterion is ticked
(root owns tracking). Criteria implemented and tested: P2-S12-AC-045, AC-111, AC-117, AC-123, AC-269.

## Scope

`/app/cms-content-modeling/entries/:entryId/composition` with `CmsPatternSelector` (real, CMS-03C-13), the
instance-insert form (CMS-03C-02), `CmsCompositionInstanceList`, `CmsPatternUpdateDiff` (CMS-03C-14) with accept, detach,
bulk (<= 32 per request) and the DEC-193 _Place_ command (CMS-03C-15 / CMS-03C-02 `roots`). New first-party proxies for
CMS-03C-13, -14, -15 (the placement proxy already existed). Not touched: any existing file.

## Findings before code (verified on disk)

- Worker routes and contracts for CMS-03C-02, -13, -14, -15 exist (`apps/worker/src/cms-composition/pattern-*-routes.ts`,
  `packages/contracts/src/cms-composition/pattern-{instance,selector,update,update-diff}.ts`); the web had a proxy only
  for -02. This lane added the other three.
- BE03c's route registry (lines 161-179) has no operation that lists an entry revision's composition instances: rows are
  returned only by CMS-03C-02 (201) and CMS-03C-15 (200). Hence the BOUNDARY below.
- The selector's `contentTypeId` is not on the draft detail: it is `selectedType.contentTypeId` of the CMS-03B-14
  authoring context for the draft's `schemaVersionId`. `revision.id` of CMS-03B-11 is the placement `revisionId`,
  `entry.version` the strong `If-Match`.
- The pattern designer's nested picker is a disabled placeholder (`CmsPatternNestedPicker.tsx`); not in this lane's claim.
  `CmsPatternSelector` is exported for it (`CmsPatternSelector.tsx`, props `{ page, state, selectedId, onSelect, onLoadMore }`).

## Files

Path, lines, SHA-256 (all NEW; nothing existing was edited). Lines outside the literal claim, flagged for root: the
three thin endpoint files under `pages/api/v1/cms/` and their test (no other lane claims them; the reserved
`selector` key in `patterns/README.md` anticipated `patterns/selector.ts`).

| Path | Lines | SHA-256 |
| --- | --- | --- |
| `apps/web/src/components/cms-composition-instances/cms-composition-instances.css` | 185 | cb8b892a5f6a007ceac4d86179bf7bee82852f8e1c715bf4ad2be7f0e3bbe663 |
| `apps/web/src/components/cms-composition-instances/CmsBulkUpdatePanel.tsx` | 74 | 5a599d72c13b23d729a9b33192907bc1f55cbc57b3f047d623b039bd1a2390ed |
| `apps/web/src/components/cms-composition-instances/CmsCompositionInstanceList.test.tsx` | 210 | b76401d68a818bac06f4a00609e26e1e843c0efa7a5b57404b97ed71bc84e8ea |
| `apps/web/src/components/cms-composition-instances/CmsCompositionInstanceList.tsx` | 119 | 9ba1370fc1cac6e5994c6027f44a80b4337b10d473d47d9b7871a3ead655005f |
| `apps/web/src/components/cms-composition-instances/CmsCompositionInstanceRow.tsx` | 91 | 33d2bf5d2d9150b3869a1705a09c71729c8d319c0617f491f19e413968eac6b8 |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.accessibility.test.tsx` | 195 | 0a8ed4cbac4e8e8dfdcc992fcd6225f8db3e9ccd9607ba345665c92d9c6a9e3e |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.bulk.test.tsx` | 237 | c375386f3e7c200c4dd722a360db581b50e96850d963cf9f8f9d7edc936584ac |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx` | 355 | 6725888e2d3bd5f9e87b3b0edd498271f93de6fa2a055cbae23e09a7d5f68fae |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.privacy.test.tsx` | 115 | 661e27f8587656e2abce0329b5dd53ce93464848d5ab262160b7c94f7c2542eb |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.tsx` | 88 | 3d12c3020fa4c9f6cb061f79d427b6d2b61226a49adbd0a5e455d389cb0d1670 |
| `apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx` | 383 | 1163865ca2dd000e4cfa61f7307963be70502285b7123591f6329f9b81d55fe7 |
| `apps/web/src/components/cms-composition-instances/CmsCompositionStatus.test.tsx` | 75 | b67c9f4a500abe0b96df5a24100d6c35a376274fd45fc6c7c686f0fa8f33cfca |
| `apps/web/src/components/cms-composition-instances/CmsCompositionStatus.tsx` | 44 | 3b0ad307292e504beea3eaa7dc96eebb32c3288e38e697a316ddf66f866c77b2 |
| `apps/web/src/components/cms-composition-instances/CmsDiffNewRoots.tsx` | 67 | 176d794e368981ca851eadc2a0ffea43bce4dbf8b2b4f0eb37ae36d05f72c99e |
| `apps/web/src/components/cms-composition-instances/CmsDiffPath.tsx` | 123 | e9513144b855a3ec4b44cd8009e52f3b44dbaecc846567a50fed0411a04b77af |
| `apps/web/src/components/cms-composition-instances/CmsPatternInsertForm.test.tsx` | 171 | d8c09b777b416da85c4ebc1bfa56321ba983c8509b80aa9cf9dd58a817fbb42e |
| `apps/web/src/components/cms-composition-instances/CmsPatternInsertForm.tsx` | 188 | fc0abb7b3b791d7bcdc59a1fd82b83dea52a5c2d95fbc80bc7c11cd6ba3cd347 |
| `apps/web/src/components/cms-composition-instances/CmsPatternSelector.test.tsx` | 149 | d06201e38a06fce92666c782fd94986c2d2c6fb62cca316f8b29ed52d033f73f |
| `apps/web/src/components/cms-composition-instances/CmsPatternSelector.tsx` | 108 | 1ec72aa9df748e1e4a2b8cf71a2ecdd58b2d0117fde57091eaed74ac9dc7e6cc |
| `apps/web/src/components/cms-composition-instances/CmsPatternUpdateDiff.test.tsx` | 265 | be92a295e20b3b5ec48e4c9503e4fc04d340213fcf3b96d2a738dfa86147564a |
| `apps/web/src/components/cms-composition-instances/CmsPatternUpdateDiff.tsx` | 131 | 7e7f8a9dfe4f61ab0c31808d0a79d43983b1751b064366725c5e896cbc5b984b |
| `apps/web/src/components/cms-composition-instances/composition-choices.test.ts` | 154 | 86dd7fcd821a89647ddeb3aff866958fdaa73934a240bbb52682b7ad15ab0dd1 |
| `apps/web/src/components/cms-composition-instances/composition-choices.ts` | 88 | 4bccb28959ebc16f6f65548d99e677d457d17b9ab3e63fe2da6b1aaef6b362cc |
| `apps/web/src/components/cms-composition-instances/composition-commands.test.ts` | 312 | 61431eb5a56be28025260508648e5835e8c46f7cfe0420ffab0e1cd63dba1a71 |
| `apps/web/src/components/cms-composition-instances/composition-commands.ts` | 221 | 1afa945238bfca7403ddc40ae402938735752d9e51f1aedacc93fbdf323e7976 |
| `apps/web/src/components/cms-composition-instances/composition-commands.update.test.ts` | 137 | f3fd776485d38da43c95edffb5a6872e082c2acf716863f20ea0f2911bddcffd |
| `apps/web/src/components/cms-composition-instances/composition-copy.test.ts` | 70 | 3fbda1e58826dbaef412ee0de7534ccf217fcc995578871b19bb8e8d6746c927 |
| `apps/web/src/components/cms-composition-instances/composition-copy.ts` | 90 | c19d03abe5fed3b09e009dad7bad7c50643a2025c07eb28614064d52d8dbaca7 |
| `apps/web/src/components/cms-composition-instances/composition-guards.ts` | 102 | 4f46c803b7b273c84e1c7927f0b96261ba98eef0fc15e7f62d2305d98226d7f4 |
| `apps/web/src/components/cms-composition-instances/composition-insert-fields.ts` | 97 | d90be33adbf72c4cef1090d9f74b2a8109b29c30e57ad81f623308b08601617e |
| `apps/web/src/components/cms-composition-instances/composition-instances-source.ts` | 21 | 5033c995f62dd8683ac33e6b9b272beec7778550949bbc3a6dfe94f05a8cc477 |
| `apps/web/src/components/cms-composition-instances/composition-page-reads.ts` | 70 | f88c509592a16a1b6c05aa7e03ebbc3caf8ea43b9785d4143ef670c15873bc04 |
| `apps/web/src/components/cms-composition-instances/composition-page.test-support.tsx` | 135 | 0dc21fafa942b63287bf8e20758eacffc711518f4f66e0e1f18bd9d2143b9003 |
| `apps/web/src/components/cms-composition-instances/composition-panel.ts` | 15 | 7a278d16ee32cdc4cdc63712616b5b3a789a86c4accc6a76539a18582360589b |
| `apps/web/src/components/cms-composition-instances/composition-path.ts` | 7 | fdd76170b6da731522de4b324ee6f9a605fa615168e0e1827a27531a6e3d1940 |
| `apps/web/src/components/cms-composition-instances/composition-reads.test.ts` | 203 | 3b268e0331a581c2cde2eb337025d7a7ae2319ceb01fb8e0926707e954968a4c |
| `apps/web/src/components/cms-composition-instances/composition-reads.ts` | 66 | 793e5a327abb5747959e49b2382c0801c66e9dde252195418612a787a1160b44 |
| `apps/web/src/components/cms-composition-instances/composition-rows.test.ts` | 108 | f9f2af03b9c75e2a30488909c455d4e056960e296e0f95efb67fc3f97c18d720 |
| `apps/web/src/components/cms-composition-instances/composition-rows.ts` | 69 | 1adef67c510f0601325091f4dfd53723ca1c11b7abdcfc64e347097859b31c9e |
| `apps/web/src/components/cms-composition-instances/composition-static-closure.test.ts` | 57 | ec6e97983a922d178ff84fbafe8a71ce20a3b56272f1c58d2b53f3d29aa197b7 |
| `apps/web/src/components/cms-composition-instances/composition-status.ts` | 53 | 05a94d33774d4b303d90e4de21e87ce19ea364f1682fbcff11a7b379d0cf2bfb |
| `apps/web/src/components/cms-composition-instances/composition-transport.test.ts` | 230 | aef95ae57acf15744e8b3205d182aa499707d3f0032e1282ee25a3d85822a55c |
| `apps/web/src/components/cms-composition-instances/composition-transport.ts` | 231 | d5bbe6ef4d8ae2224ed544f6d663f36fc71dae2b02dfd6cbd55e71c00c48a676 |
| `apps/web/src/components/cms-composition-instances/composition-types.ts` | 49 | 90df686dac039834af6c357d978279c1bbd4b48adda7c3697c7cbd0b2975d414 |
| `apps/web/src/components/cms-composition-instances/composition-update-request.test.ts` | 156 | 552f1cb4e79886e1b61ff177a2aa60cb9263d15c03dd19376e7b455b1026703f |
| `apps/web/src/components/cms-composition-instances/composition-update-request.ts` | 119 | a9b5d2d4d20596478daeafd177e1d4800827779b675a3b3395e700ae60ed50f3 |
| `apps/web/src/components/cms-composition-instances/composition-windowing.test.ts` | 55 | 9648ff03111b50605e67914d4d2123b3f54ad288ed97e8956c273885f848ef83 |
| `apps/web/src/components/cms-composition-instances/composition-windowing.ts` | 32 | f10d860a3a5f7eda3e85c0a7fd9b256ead7230306030e40872a8146322b78078 |
| `apps/web/src/components/cms-composition-instances/composition.test-support.ts` | 153 | 04ced3873b3bd174bbf0c4554bbbf6f8e0426c70a521284a54daae866c0b8a09 |
| `apps/web/src/components/cms-composition-instances/load-composition-page.test.ts` | 217 | c05a665b8fcc69209083aa1500633ed78a4b1ffe594693db821a266f5ab56f7e |
| `apps/web/src/components/cms-composition-instances/load-composition-page.ts` | 157 | dc6955f4a220006a6bc4061bc1cb63a9b02dd98211bcf7c4b83b4ca61293d52b |
| `apps/web/src/components/cms-composition-instances/README.md` | 77 | 3bf5def9d870287144368bbcdcbb587130b9904be5908db1f1c195ffda208e47 |
| `apps/web/src/components/cms-composition-instances/use-composition-bulk.ts` | 189 | c3cec97dd4c7976a92cd41744936127039b616dcbffdf7f506cfe002a68e9834 |
| `apps/web/src/components/cms-composition-instances/use-composition-insert.ts` | 166 | de2f5580ad6ceab89b0d33c4571ea65fbf70fa1e46b51c7bebe08562b3d30209 |
| `apps/web/src/components/cms-composition-instances/use-composition-page.ts` | 57 | 8aa9c6ca8909e0521d4437bd4927cd496284c631e67aaa858a976d27e6982256 |
| `apps/web/src/components/cms-composition-instances/use-composition-session.ts` | 149 | f05a7fd8397567a338754817f8407bbca1cc51ed76fa0130bc3981c136edf957 |
| `apps/web/src/components/cms-composition-instances/use-composition-updates.ts` | 290 | 4ed3605b8d4550e67b9022b54dd55ff0957d50bcc48f892d13c79727554839a5 |
| `apps/web/src/server/cms-composition-instances-diff.test.ts` | 249 | 702ad57cb82b040e8e014a84969ecce9fdf045eb744e536dad855bd2359b986b |
| `apps/web/src/server/cms-composition-instances-diff.ts` | 92 | 63139ccdc86d4279fc619a04da2b7d8cec8c0b59b8a21299e4fd5ccdf2b7a2b2 |
| `apps/web/src/server/cms-composition-instances-errors.ts` | 169 | bc352109f983fba8f7c0a9a3d0b8a54474aa6df63cea6668186dacad01dfdc82 |
| `apps/web/src/server/cms-composition-instances-selector.test.ts` | 282 | e6029639c651437ac37cc034d60c7613fa6a850fd69efa6313e1568ab9efa45e |
| `apps/web/src/server/cms-composition-instances-selector.ts` | 168 | 5724ebf6b2a163568817692bb67c3d0ab0a8585fccbb8704363249f5fac867a6 |
| `apps/web/src/server/cms-composition-instances-update-answer.ts` | 69 | 8ce3ac4b40189449cb4d0fc1d4db63812bbf450c3704ab2ebf0759c8cad0a0f8 |
| `apps/web/src/server/cms-composition-instances-update.test.ts` | 371 | 3fca63000c85fcf51b1832a49664fd6c974c837e33176ac3c4b9b417e1d2366b |
| `apps/web/src/server/cms-composition-instances-update.ts` | 118 | 95cab66e8caeb3fffe108ac8669df33ee9a501bc6416790a29cf09f5941b38b1 |
| `apps/web/src/server/cms-composition-instances.test-support.ts` | 181 | c0c755a52ca4a0c788622c05515c31acf23bca945c02027fdb862913b4664d82 |
| `apps/web/src/pages/api/v1/cms/compositions/composition-instances-endpoints.test.ts` | 89 | 9bb67b2be73601cb19ac13f082fb609c14d219f75463ea793f6ca346d2dda76b |
| `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/composition-route.test.tsx` | 215 | b0c025509efbedf018a2a97b2c50b8a35dbcc2299358bc8fb57d59cbac227888 |
| `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/composition.astro` | 69 | 93b53a0c80f07673fbb6ebc9ceb7edc6e931225d8eeb656c31312487c1d14596 |
| `apps/web/src/pages/api/v1/cms/compositions/pattern-updates.ts` | 10 | 3dd70bb3a5151f58ec6a6a07a8f40e044a07d18eb68e9f7238626019fde23e52 |
| `apps/web/src/pages/api/v1/cms/patterns/selector.ts` | 10 | 8f743e2b679b197110a03bdd1747ca780630dcb78739840d0026e7a8cb40c6de |
| `apps/web/src/pages/api/v1/cms/compositions/instances/[instanceId]/update-diff.ts` | 10 | e7409b6209acad9c1177d7dba9046d9d5987cd725affcd73d5fc3f43fb91d8cb |

## Runs

All from the repo root with `PATH=/home/rob/.local/share/wejammin-toolchain/bin:$PATH pnpm exec vitest run <files>`.

- Final lane run (2026-10-22T06:4xZ): 26 files, 315 tests, all pass (components 21 files, server proxies 3, endpoints 1,
  route 1). Neighbour regression: `proxy-body-untouched`, `step-up-mfa-proxies`, `cms-island-static-closure`,
  `step-up-required.inventory`, all of `apps/web/src/pages/api/v1/cms` (21 files, 359 tests pass);
  `tests/contracts/phase-02-slice-12-local-module-boundaries`, `...-pattern-openapi`,
  `tests/integration/phase-02-slice-10-ev-eb-closeout` (3 files, 29 tests pass).
- `tsc --noEmit -p apps/web`: 0 errors. `astro check`: 0 errors (includes `composition.astro`). `eslint --max-warnings=0`
  on every lane file: exit 0. `prettier --check`: clean. Component files <= 200 lines (max 188), test files <= 400 (max 371).
- RED first (module missing, observed): selector proxy, update proxy, choices, update-request, transport, reads, commands,
  copy, windowing, loader, and the selector/diff/list/insert components. Written together with their code (no separate
  RED run; covered by mutation checks): diff proxy, rows, status, page integration suites, route test.
- Mutation spot checks (code mutated, focused suite must fail, original restored): 25 distinct mutants over proxies,
  rules, hooks and components; 22 killed on the first run. The 3 survivors were TEST weaknesses, fixed and re-killed:
  the update proxy lacked a bulk case with fewer rows than instances; a selector fixture gave several rows one version id,
  so the "more items than the limit" case failed for the wrong reason; and "one version id on two rows" was shadowed by the
  order rule (new case added). Script under `<scratchpad>/claude_s12_web_composition/`.
- axe (WCAG 2.1 AA structural rules + best-practice) over the mounted island: clean, invalid form, diff with all three
  collision kinds and new roots, after a refusal, and a virtualized 300-row list: no finding; a negative control proves the
  runner detects an unlabelled button. Colour contrast and target size are not computed in jsdom (e2e/manual).

## Test corrections

None. No existing test was changed.

## Spec citations (behaviour -> test)

- FE03 886/1508, AC-111 (native select, nothing preselected, polite count, empty state "No compatible pattern is active",
  cursor in state only, keyset order and cursor shape verified): `CmsPatternSelector.test.tsx`,
  `cms-composition-instances-selector.test.ts`, `CmsCompositionPage.insert.test.tsx` (Load more).
- FE03 887/1509/2708/2892/2893, AC-117 (three-way list, collision kinds with fixed copy, radios never preselected, consequence of
  keeping mine, new-in-this-version list and _Place_ request, no-update, "No changes to this block", `diff_too_large`,
  128-path/256 KiB bounds, bulkEligible, focus on first unanswered, diff never cached): `CmsPatternUpdateDiff.test.tsx`,
  `composition-choices.test.ts`, `composition-commands.test.ts`, `CmsCompositionPage.update.test.tsx`,
  `cms-composition-instances-diff.test.ts`.
- FE03 887/1115/1616/1745, AC-123 (Accept single, bulk only without collision, <= 32 per request with entry version
  re-read, entry + instance versions, Detach, `diff_has_collisions`/`revision_not_editable` keep choices, 422 keeps choices,
  named outcomes new pin / "Removed from the entry" / "Local copy", pending_diff shown as "Update available"):
  `composition-update-request.test.ts`, `CmsCompositionPage.update.test.tsx`, `CmsCompositionPage.bulk.test.tsx`,
  `CmsCompositionInstanceList.test.tsx`, `cms-composition-instances-update.test.ts`.
- FE03 887/DEC-175/181/185 instance list (position order, stable ids, polite count, virtualization > 100):
  `composition-rows.test.ts`, `composition-windowing.test.ts`, `CmsCompositionInstanceList.test.tsx`.
- FE03 1072/1640, AC-269 (303 sign-in, 400 malformed id/any query, disclosure-safe 404, 403, `:entryId` only, no URL/diff
  state, title/description): `load-composition-page.test.ts`, `composition-route.test.tsx`,
  `CmsCompositionPage.privacy.test.tsx`.
- FE03 1114/1115, AC-045 (native forms, key policy, input retained, focus, announce, exact ApiError mapping, ETag/
  idempotency): `CmsPatternInsertForm.test.tsx`, `CmsCompositionPage.insert.test.tsx`, `composition-transport.test.ts`,
  `composition-copy.test.ts`, `CmsCompositionStatus.test.tsx`.
- FE03 AC261 zod-free island: `composition-static-closure.test.ts`. FE03 testing floor (axe):
  `CmsCompositionPage.accessibility.test.tsx`. FE03 2723 "no diff value ... in URL, storage, logs": privacy test.
- BE03c 175-179, 1304 (typed reasons per operation, catalog codes/messages, details allowlist): the three proxy suites.

## Decisions made (implementation tier, one line each)

- Link mode is an explicit choice (no default), like a collision answer; the spec lists both modes and no default.
- After an UNKNOWN outcome the identical request is replayed under the SAME `Idempotency-Key` (BE03c 1502, the
  related-content precedent). FE03 1048's "reconcile by refetching ... before any retry" is not done by a refetch for these
  commands: no read exists that could prove a placement committed (see BOUNDARY), and a refetched `If-Match` would change
  the fingerprint and mint a new key, risking a duplicate placement.
- The entry version after a placement is the committed ETag (must exceed the one sent); after an update it is the sent
  version + 1; between bulk requests it is read again from CMS-03B-11 (DEC-181).
- Bulk accept groups instances by target version (one `targetPatternVersion` per request), preserves selection order and
  splits at 32; a failed request stops the sequence, reports "k of n requests applied" and leaves the rest selected.
- A virtualized row (> 100) is a single fixed-height line; rows keep stable ids and `aria-posinset`/`aria-setsize`.
- 429 blocks commands until the stated wait ends; an unstated wait shows the generic message and does not block.

## Open items / BOUNDARY

1. BOUNDARY (needs a spec): no operation lists the composition instances of an entry's draft revision. FE03 887 shows every
   instance with its state, including `pending_diff`; without that read, a reloaded page lists only the instances placed or
   updated in the session, and an update that arrived on an earlier instance cannot be found from this page.
   Implemented per `boundary-not-placeholder`: typed port `composition-instances-source.ts` (answers `rows: []`, source
   `session_only`), the page says so (`COMPOSITION_COPY.sessionRows`), sentinel test in `load-composition-page.test.ts`.
   TRACKING: root must file the issue (no network here): "BE03c: add `cmsCompositionInstancesRead` (list a revision's newest
   composition row per path, bounded <= 512, `no-store`, strong ETag), its contract, Worker route and first-party proxy; then
   replace `composition-instances-source.ts` and the sentinel".
2. Playwright coverage of the journeys in FE03 2723 (linked update accepted/detached, removed block kept/removed, new block
   placed; keyboard-only; 200% zoom) is outside this lane (Vitest only). Responsive layout is CSS-only here
   (`cms-composition-instances.css`), unverified by a browser.
3. The CMS-03C-14/15 SQL is still unpromoted WIP; everything here is proven against mocked proxies/fetch only, never a
   running Worker.

## Requests to root

1. Reachability (vertical-slices rule): `apps/web/src/pages/app/cms-content-modeling/entries/[entryId].astro`. Add the import
   `import { compositionPagePath } from '../../../../components/cms-composition-instances/composition-path';`, the line
   `const compositionPath = compositionPagePath(Astro.params.entryId ?? '');` after `relatedPath`, and in the markup, after the
   related-content paragraph:
   `{compositionPath !== null && (<p><a href={compositionPath}>Composition</a></p>)}`. Then append to my
   `composition-route.test.tsx` (it fails until the link exists):
   `describe('the entry page reaches the composition page', () => { const source = readFileSync(fromHere('../[entryId].astro'), 'utf8'); it('links to it from the draft editor, only for a valid entry id', () => { expect(source).toContain('compositionPagePath(Astro.params.entryId'); expect(source).toContain('<a href={compositionPath}>Composition</a>'); expect(source).toContain('compositionPath !== null'); }); });`
2. Directory docs (shared README files; not edited by me):
   - `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/README.md`: add bullets `composition.astro` (CMS-03C-02/-13/-14/-15
     composition page; any query is a 400; instance ids row-local) and `composition-route.test.tsx` (composes the real loader,
     the real read proxies and the real island with only the platform binding replaced).
   - `apps/web/src/pages/api/v1/cms/patterns/README.md`: Contents add `selector.ts` (CMS-03C-13); replace the Extension-rules
     paragraph about `selector` having no route yet with: `selector.ts` forwards CMS-03C-13 through
     `server/cms-composition-instances-selector.ts`; `selector` stays a reserved key and `[patternKey]` still answers it 400.
   - NEW `apps/web/src/pages/api/v1/cms/compositions/README.md` (the dir has > 2 files and no README): contents `pattern-instances.ts`
     (CMS-03C-02), `pattern-updates.ts` (CMS-03C-15), `instances/[instanceId]/update-diff.ts` (CMS-03C-14),
     `composition-instances-endpoints.test.ts`; ownership: thin wrappers over `server/cms-composition-*.ts`; extension: a new
     operation needs its own proxy and endpoint test; related: BE03c 175-179.
   - `apps/web/src/server/README.md`: add bullets for `cms-composition-instances-selector.ts` (CMS-03C-13 read: query
     allowlist, keyset/cursor verification), `-diff.ts` (CMS-03C-14: path-only, strict 128-path/256 KiB resource, ETag =
     instance version), `-update.ts` + `-update-answer.ts` (CMS-03C-15: request binding of the 200, unknown-outcome marker),
     `-errors.ts` (catalog relay, per-operation typed reasons).
3. File the BOUNDARY issue (Open items 1) and decide who authors the BE03c operation; then replace the port and the sentinel.
4. Tracking only (no ticks from me): the ledger citations for AC-045/111/117/123/269 are the test files listed under Spec
   citations; AC-045 also needs Playwright evidence before it is ticked.
5. Ratify or relocate the three endpoint files and their test, which sit outside the literal claim (see Files).
