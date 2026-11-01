# Lane claude_s12_web9a report

## Status

GREEN (round 2, 2026-10-31 ~23:20 UTC), from HEAD `85ab5ff0eb7e0a06c0f2fca1fdc72a5c71b5126e` plus the uncommitted wave-8 and wave-9 tree (web9b finished). Brief `briefs/gaps-wave9-web.md` section web9a plus the coordinator's round-2 order: DEC-246(1) on EVERY browser read of my islands, the two routes back under budget with no budget change. Cold `vitest run apps/web --maxWorkers=4` (all `results.json` deleted first): 835 files / 9,239 tests green. `vitest run tests/performance`: 13 files / 204 tests green. `tsc --noEmit -p apps/web/tsconfig.json`: 0 errors (web9b's earlier error is gone). Bundle gate exit 0 (table below). Nothing is marked done in any ledger. Playwright was not run. No sub-agent; every command in the foreground (two long commands were moved to the background by the harness's own timeout; I waited for them).

## Scope

V20 B1, M1, m1, m2, m4, m7, m8, n1, n3; refute8b locale 422 row, connected selector "page then 503", AC-271 closing words per family of my islands; AC-164 c3/c6 template pages. web9b's items (m3, m5, m6, m9, m10, n4, ruling 2, 3, 5, the related/composition/governed rows, AC-069) were not touched. Ruling (1) for the two local `READ_DEADLINE_MS` copies: `locale-source-refresh.ts` moved (mine); `related-conflict-read.ts` already imports `BROWSER_READ_DEADLINE_MS` (web9b's file).

## Per-item result

| Item | Outcome |
| ---- | ------- |
| V20 B1 | FIXED. RED: `CmsTaxonomyVersionDesigner.latest-states.test.tsx` 3 of 12 failed alone. `beforeAll(import('./taxonomy-versions-read'))`; 12 of 12 alone and in the cold full run. |
| V20 M1 | FIXED. RED test `pattern-designer-reasons.test.ts` (3 rows). Digest copy: "The block registry changed while you were editing. Block choices are read again; your values are kept. Nothing was saved." (was 125 chars, now shorter); `block_unavailable`: "This block is no longer registered. Choose another block." (was 72, now 58). No "Reload" anywhere. |
| V20 m1 | FIXED (round 1; round 2 below). `readTemplateContext` has the shared deadline (`startReadDeadline`) over fetch, safe retries and body; `withinDeadline` (new, `lib/read-within-deadline.ts`) races a fetcher that ignores its signal. RED: 4 of 5 rows in `cms-template-context-read.deadline.test.ts`. Also moved to it (ruling 1): `locale-source-refresh.ts` (RED 3 of 4), and the two holders of a retry: `cms-template-edit-reconcile.ts` (template key and latest read, RED 2 of 3) and `taxonomy-versions-read.ts` (RED 2 of 3). |
| V20 m2 | FIXED. The successor rows of `CmsTemplateDesigner.registry-context.test.tsx` now script the parent read as 200. Revert check R2 (`registry.holding` removed from `cannotSubmit`): the "no new send is possible" row of the successor surface FAILS (it passed before). |
| V20 m4 | FIXED. RED: `CmsLocaleVariantForm.moved-edit.test.tsx` "goes with the first edit". `useLocaleSaveReconcile` returns `dismissMoved`; `edited()` calls it. |
| V20 m7 / refute8b web8a idx 43 | FIXED. The it.each is split. The digest row now asserts the context GET once with `cache: 'no-store'`, no latest read, the fixed copy and the kept tree. Revert check MA (`useReconcileOnOutcome(false, ...)` in `use-registry-context.ts`): the new row FAILS. Retitle map in the proposals. |
| V20 m8 | FIXED. `CmsRegistryChangeNotice` mounts an empty polite `role=status` node in every state (the section is unnamed while the state is `none`) and writes the lines into it. RED: 3 of 3 rows of the new announcer test failed on the old `<ul>` inserted with its content. A first version wrote the text in an effect; it cost 140 B on the pattern edit route (over budget), so the final one renders the text into the always-mounted node (`state` starts at `none` on every mount; documented in the file). |
| V20 n1 | FIXED. READMEs of `cms-composition` (registry seam, on-demand rule, the 94 B and 64 B margins, deadline, page outcome, closing words), `cms-locale` (`locale-variant-submit-seam.ts`), `cms-pattern-designer`, `cms-taxonomy-designer`, `cms-taxonomy-terms`, `cms-editorial-fields`, `lib`, `pages/.../templates` name every new file. |
| V20 n3 | FIXED. The grammar row now also compares with `CMS_BLOCK_KEY_PATTERN` from the contracts; title unchanged because it is now true. |
| refute8b locale 422 row | In the proposals (AC-271 error), file `CmsLocaleVariantForm.states.test.tsx`. |
| refute8b selector "page then 503" | `CmsTaxonomyFieldEditor.connected-degraded.test.tsx`. Product already right; revert check (next-page failure clears the page) FAILS the row. |
| AC-271 closing words | One island-level test per family through the real transports (only `fetch` faked): template create and successor (4 rows), locale, pattern, vocabulary designer, term form, connected selector (2 rows). Each asserts every request is `cache: 'no-store'` same-origin and that nothing is claimed, navigated, cleared or rewritten before the save is answered. Revert checks: `cache` changed to `default` in each transport (template context read, key/latest read, template POST, locale POST and refresh, pattern POST, latest and nestable reads, taxonomy POST, versions and terms reads) fails its family row. |
| AC-164 c3/c6 | `cms-template-page-outcome.ts` (new, server-only) holds what the two Astro pages did inline; both pages use it. 37 rows: 401 redirect (both reads), 403, 404, 429 with a believed Retry-After (and 7 unbelieved values), 503/504 with Retry-After, 400/404/500/502 without, malformed or mismatched bodies (502), reserved or malformed key (400). The pattern pages were already behind `load-pattern-designer-page.ts` (11 rows cited). Playwright was not run. |

## Files

| path (under `apps/web/src/` unless shown) | lines | SHA-256 |
| ---- | ----- | ------- |
| `components/cms-composition/CmsRegistryChangeNotice.announcer.test.tsx` | 95 | `d483e28fb1c34355b3f29689d884883c724d2db302e24243a113367d18ec62fe` |
| `components/cms-composition/CmsRegistryChangeNotice.test.tsx` | 51 | `4f4c588ea0d70bb5a03c498ed51accb1022bc2de4f9be6253080c76b5e70f6c8` |
| `components/cms-composition/CmsRegistryChangeNotice.tsx` | 45 | `b0073d2da3528f74500cb10ac4497a4c1a276f63214015c113767e2522db10f6` |
| `components/cms-composition/cms-template-context-read.deadline.test.ts` | 97 | `bdf9275ad4482805ebf6f66e2d16fd79ef951a7e46981746648c42d9c1254f5f` |
| `components/cms-composition/cms-template-context-read.test.ts` | 187 | `02972e9a3d1dcf49aaa3781c9e0c1f6b419513d84e4559521c6dbe6154f25aba` |
| `components/cms-composition/cms-template-context-read.ts` | 141 | `5bbe92599868b199076f19d8d24be7bde1ff103918651b6520baa1d5c5d0eee1` |
| `components/cms-composition/CmsTemplateDesigner.closing-words.test.tsx` | 130 | `8c22a1d69e33ae0f1392aed180de2b869a25f0ff80e33321d95cdfa56bd3f287` |
| `components/cms-composition/CmsTemplateDesigner.registry-context.test.tsx` | 187 | `681d8e88d92c1d429e358c64e11d857f4a46fc4b6b812f350ea0e6cf6aac77e2` |
| `components/cms-composition/cms-template-edit-reconcile.deadline.test.ts` | 81 | `52b47906f14927757de28b12616573faa9d4a3d3e227469bb79b94b413a94c04` |
| `components/cms-composition/cms-template-edit-reconcile.ts` | 94 | `ce196234e9b400f39acb13a6bdc3336b32c7496140dc39a0895b112c90db1e27` |
| `components/cms-composition/cms-template-page-outcome.test.ts` | 302 | `4b5c01ffea9071b0554ec8f757202b56e8de5ee1a96f6ae9ee93fa5b34328d55` |
| `components/cms-composition/cms-template-page-outcome.ts` | 123 | `a06d789a40ea7bb4ea3e7ed1c8e953f15624740e122f58ec5e4b1e80516ed5d0` |
| `components/cms-composition/README.md` | 159 | `6afe9acdbc5e3f3bd281d8267d50b2c483139f7745e7aefa28389ccc06f1806b` |
| `components/cms-editorial-fields/CmsTaxonomyFieldEditor.connected-degraded.test.tsx` | 204 | `8253c63947c818da629715104892da0ccd3e964fdbf480f459f26c21a4982add` |
| `components/cms-editorial-fields/cms-taxonomy-selector-read.edges.test.ts` | 35 | `c12e27c6dd52dbfb263607a4287a195900ede4f664344e2aca73908582becbfb` |
| `components/cms-editorial-fields/cms-taxonomy-selector-read.retry.test.ts` | 197 | `f369de6989deb0f3054280f996fd0f45192319658908b9d879811a29f16fa54e` |
| `components/cms-editorial-fields/cms-taxonomy-selector-read.transport.test.ts` | 300 | `dea9b0a272ec0d7bb118bb38b1e6516e7d80d90c67e88063957862efbc551cfe` |
| `components/cms-editorial-fields/cms-taxonomy-selector-read.ts` | 146 | `3bfc5fe3eaa09d9f41ea8b8e2bbc4bb0ae4c733833d371772eb91a9efbbb5b94` |
| `components/cms-editorial-fields/README.md` | 137 | `2a400d7f2db7661e35700bd4c98ec51aac5093e4a586acfa6ed1abd698e0f8bb` |
| `components/cms-locale/CmsLocaleVariantForm.closing-words.test.tsx` | 117 | `60223eb0c87eb413aa606761aa9206f86429181ac49c016a0447b16c317eb4b1` |
| `components/cms-locale/CmsLocaleVariantForm.moved-edit.test.tsx` | 82 | `545944d4b8fe64dd8be8aa630e68a21ac2644862b1f2cd1788bd92b285fed1cd` |
| `components/cms-locale/locale-source-refresh.deadline.test.ts` | 81 | `453353d78eb8f7aad4e28c1cbc7a3e066b417cbc5b5c4d095ebd961936a4a5f9` |
| `components/cms-locale/locale-source-refresh.ts` | 137 | `897ed9bb95ec214f551e15c1c0a63fd25f9edd68e4c25594cafd59456ef3885b` |
| `components/cms-locale/README.md` | 102 | `1ed6c56429cdd496ba11c469a1ef83ce29dc1f34ba751cea27bf158f6bf7477c` |
| `components/cms-locale/use-locale-save-reconcile.ts` | 106 | `af90bda68ce3d388a82936cc323bcf0ca5a70eab9e37805d4b2481e9d80806fa` |
| `components/cms-locale/use-locale-variant-form.ts` | 296 | `99ef12fa073e6240c193ac0e19e539e9430a56a07c64a8caeeeb4e55d712d530` |
| `components/cms-on-demand-pattern-terms.proof.test.tsx` | 172 | `2cd2c735c9957ea6f05e4bf408e96e2a877cf40b295832e5952d1c5c98f4a1bb` |
| `components/cms-pattern-designer/CmsPatternVersionDesigner.closing-words.test.tsx` | 115 | `97dbe60f947fb19e88fcb1b33de48077b7762561fe676213f52847eb552773cf` |
| `components/cms-pattern-designer/CmsPatternVersionDesigner.hung-reads.test.tsx` | 120 | `6517ca1bd52c5983fa437c41a8807c065cf224c06518824015150868a8a55d2a` |
| `components/cms-pattern-designer/CmsPatternVersionDesigner.results.test.tsx` | 354 | `7d3baa3c3ca91e53edd45ec9c0c56bcbdb077c48a8c98f69223f73df2e775b49` |
| `components/cms-pattern-designer/CmsPatternVersionDesigner.states.test.tsx` | 364 | `0be9d309456db71e3011e7a6f51cdd089acb5bab6ae48a7429098608e2954e20` |
| `components/cms-pattern-designer/CmsPatternVersionDesigner.uncertain-boundaries.test.tsx` | 294 | `3398266b1818655fd516dcf7fec6033a46c3ac050ff9b8055e8e16b39329ffe7` |
| `components/cms-pattern-designer/pattern-designer-copy.ts` | 65 | `34dc390390c01098b0b78747a2db42ef31452a3e184e35856d56dac67c716f81` |
| `components/cms-pattern-designer/pattern-designer-reasons.test.ts` | 87 | `6bb48c4477c8a2a7e5e854f333f5485177aefa00e9c573d0349d49aba87965b5` |
| `components/cms-pattern-designer/pattern-designer-reasons.ts` | 84 | `0306c82911c5a05dafd76973a9f3bb058bcd78fd5b6499391c17a40a7520549f` |
| `components/cms-pattern-designer/pattern-latest-fetch.deadline.test.ts` | 62 | `492cf39c305c7c1dcc989d47ad235e427bd7c4507e7b1a76b7b1003e94463049` |
| `components/cms-pattern-designer/pattern-latest-fetch.edges.test.ts` | 95 | `e37ecd872b315bfd7907bbcdda5f987c43b8e4677c359110179a9929b85cbe2d` |
| `components/cms-pattern-designer/pattern-latest-fetch.ts` | 185 | `8218dc265224b65f1442650e4501edf477816c081563b4002b8b004ddd667936` |
| `components/cms-pattern-designer/pattern-latest-read.cancellation.test.ts` | 109 | `305e051a42e797e94c11240cb6ffe1aaa96e951444a57749962ae6f505f1805b` |
| `components/cms-pattern-designer/pattern-latest-read.retry.test.ts` | 147 | `763d5b59c48e7c1cee5f3816d7d890c967b2ba754550ccf17b8b11538d101377` |
| `components/cms-pattern-designer/pattern-latest-read.test.ts` | 129 | `c14757ad7b2ab8f5c76e176c0daa9d7279b4b7c1036054f70866fe111740298a` |
| `components/cms-pattern-designer/pattern-latest-read.ts` | 61 | `a4cecbf21a71f78456d34d16e409929b46fb57eb254dc40a90f8e2555a4cc1da` |
| `components/cms-pattern-designer/pattern-nestable-read.deadline.test.ts` | 63 | `fe0a55162209c4c67c12d14eac83a84c6ecf92b1bafd47644b6cdfbce943c0a5` |
| `components/cms-pattern-designer/pattern-nestable-read.edges.test.ts` | 62 | `34caa84887e9aa59f181b6b87595c9b87b30a9578f5293835c9ea20abdedf1ad` |
| `components/cms-pattern-designer/pattern-nestable-read.ts` | 249 | `c17c2b45079d0272df2b5ee99cdda67ca1f3e5c820f3dca0bf7ec746965af52c` |
| `components/cms-pattern-designer/README.md` | 117 | `a41c941d1170063c866ad762310a1bf0f4c3b28505bed8a4c23692fb98367e08` |
| `components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.closing-words.test.tsx` | 80 | `734ee9880e39a37f256ed30fa1f2f6af98eab492c1c1659bdd5454996e6b2d08` |
| `components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.latest-states.test.tsx` | 279 | `1a78f328588de2e75e3dec5c48f423fc3a41afa8c8ea6ad048aee412de5e762f` |
| `components/cms-taxonomy-designer/README.md` | 82 | `9aaeade6ae83f64d5ed017804926d4ddcc74172dda7fa241ce06ca1e9d1b1de7` |
| `components/cms-taxonomy-designer/taxonomy-versions-read.deadline.test.ts` | 67 | `84c2c2052a45cfb6dbf62582683e4e89f2a369b630b14f222f1c5cf4606ac26a` |
| `components/cms-taxonomy-designer/taxonomy-versions-read.ts` | 234 | `e40628fd56c2246b54949f5b702893dd448166c6134b382733d5ccc9b85f5e0c` |
| `components/cms-taxonomy-pages/load-taxonomy-page.ts` | 296 | `cee38295a265d4e4c5cdad830e94424e207543162f0490cff0e1024aa3a4929d` |
| `components/cms-taxonomy-pages/taxonomy-read-retry.test.ts` | 122 | `aa0da7f33bca460f8e312bf7883695733bff47b76207dcf1e254fe94944bb089` |
| `components/cms-taxonomy-terms/CmsTaxonomyTermForm.closing-words.test.tsx` | 89 | `ef32000025ef6c7ec48aa112ec976fe9503b7224e30c5e4bb4b2fc9c8bf2ac2b` |
| `components/cms-taxonomy-terms/CmsTaxonomyTermForm.hung-reads.test.tsx` | 86 | `c80148946258412f6217210e0e89152fcb8f3d6454c99c98d4df3e7ba69106d7` |
| `components/cms-taxonomy-terms/CmsTaxonomyTermForm.latest-states.test.tsx` | 364 | `a8c6ddd8794c0afc6618b7653e002787e397447737c5e5740bf2386aa8a93a02` |
| `components/cms-taxonomy-terms/README.md` | 94 | `3d2e02d1e3df96b3c61971b2e0bea3103e38320031e8888fa0742a7c6cd85d61` |
| `components/cms-taxonomy-terms/taxonomy-terms-fetch.deadline.test.ts` | 69 | `462c99726b1af82a96ed281ca1add714303b3e2fc1f4bf029915d87950af1326` |
| `components/cms-taxonomy-terms/taxonomy-terms-fetch.ts` | 196 | `857eab764e388f824ec2ac820f719147150d4d0a18c2523e24f8c74578738c57` |
| `components/cms-taxonomy-terms/taxonomy-terms-read.test.ts` | 245 | `09715c8f40917cda3966be95383ab4535d3656bd1dbab078fdd9dd884130b211` |
| `components/cms-taxonomy-terms/taxonomy-terms-read.ts` | 73 | `87a9f817a022793a1af3ca808c2e72734bc281bfd280fe9ed3251d6079628063` |
| `components/step-up-required.inventory.test.ts` | 230 | `53119f9d4f521446c3c3c04ca9d9b4cdbda0dce4a0c3884af1ba6ac3a981a80b` |
| `lib/README.md` | 91 | `784f0f190ecf3f3db94f437df36ddf1658fb0ae43e529783cdea958a42bb6ffe` |
| `lib/read-within-deadline.test.ts` | 60 | `33bd011db152f625b1f5379de067b582ffd0619c72c4e979add91fca31085c4c` |
| `lib/read-within-deadline.ts` | 20 | `fc3f7d6e922fa4030103a8c6b6176aa481e037ba04d2938a2592331caeb1baea` |
| `pages/app/cms-content-modeling/templates/new.astro` | 97 | `60da166a3d493ac5eb8b3fe7a4f20127c178c20b2f9e6b6850f955bdaa2cd73c` |
| `pages/app/cms-content-modeling/templates/README.md` | 38 | `e7ded85fbb7f0b3cd9b2249248c93e25bb172b18ba35e4aa7d2522bcc8ddd022` |
| `pages/app/cms-content-modeling/templates/template-designer-route.test.ts` | 61 | `3e5379cb370982cdedc32cd94751ade4de103e1758f883f644f42ac00122190f` |
| `pages/app/cms-content-modeling/templates/[templateKey].astro` | 161 | `e7ef3f609b42535ad90130b7b46a75fbf5a44f6296df4788ded527a8ca258eb8` |
| `docs/handoffs/2026-10-22-claude-s12/recite9/web9a-proposals.json` | 699 | `e452a5f2754a38668cb4ce674644aca18ca716cc1992088be39f0db87e2101bc` |
| `scripts/verify-bundle-budget.mjs` | 1941 | `2ad1f42eb59a21d35df2f14b7a9071069cede1069aaf2c6e8eb147659b49603c` |
| `tests/performance/cms-editorial-bundle-budget-mounted.test.ts` | 382 | `b4b9a65b412bcc4b46e2ab574434db6018c854325ec983e1ff4f3d981e2aa816` |

Shared files (one block each): `lib/read-within-deadline.ts` and its test (new) and one paragraph of `lib/README.md`; `components/step-up-required.inventory.test.ts` (the two template pages' entries replaced by `cms-template-page-outcome.ts`, because their 401 handling moved there). `scripts/verify-bundle-budget.mjs` and `tests/performance/...` were NOT edited (no new on-demand chunk).
Edited and restored byte for byte after revert checks (mtime only): the transports named above and `use-registry-context.ts`, `CmsTemplateEditDesigner.tsx`, `cms-taxonomy-field-connection.ts`. No untracked file was edited in place, so no tar backup was needed.

## Runs

| Run | Result |
| --- | ------ |
| `vitest run apps/web --maxWorkers=4` (cold: every `results.json` deleted first) | 835 files / 9,239 tests pass, exit 0 |
| `vitest run tests/performance` | 13 files / 204 tests pass |
| `tsc --noEmit -p apps/web/tsconfig.json` | 0 errors |
| `eslint --max-warnings=0` over my 70 code files, `scripts/verify-bundle-budget.mjs` and the budget test | 0 errors, 0 warnings |
| `prettier --check` over my code and README files | clean |
| v8 changed-line coverage (`cov-analyze.mjs`, scratch; the analyser lists every statement, branch and function with zero hits on a changed line, and was checked against known gaps, e.g. it reported 16 gaps in the first round-2 run) | round 1: 9 production files, 0 uncovered; round 2: `pattern-latest-fetch.ts`, `pattern-latest-read.ts`, `pattern-nestable-read.ts`, `taxonomy-terms-fetch.ts`, `taxonomy-terms-read.ts`, `load-taxonomy-page.ts`, `cms-taxonomy-selector-read.ts`, `cms-template-edit-reconcile.ts`, `taxonomy-versions-read.ts`: 0 uncovered (new files count every line). The first round-2 run found 16 gaps: six unreachable post-await abort checks (removed) and non-Response / mid-read-abort branches (the `*.edges.test.ts` rows). A single big coverage run returns an empty report, so each group of files ran with its own tests; zsh does not word-split `$inc`, use `${=inc}`. `.astro` pages are not coverable. |
| Import cycles (`claude_s12_v20/cycles.mjs`, 1,987 files) | 12 SCCs, the same 12 as V20; none in a file I touched |
| Sizes | 0 over in my files (largest `use-locale-variant-form.ts` 296/300, `CmsTemplateEditDesigner.tsx` 196/200, `CmsPatternVersionDesigner.states.test.tsx` 364/400) |
| Bundle, one lock, `scripts/verify-bundle-budget.mjs` on `<scratch>/dist` | exit 0, no budget change; per route below. Output `bundle.out` SHA `ff2200164b7d6e09417dfe9b4a968cfb480ab89b4b01e916eca8045fa7b60d56` |

Every CMS route, initial gzip (margin to 92,160): Infrastructure 79,116 (13,044); Platform configuration 78,242 (13,918); Content schema registry 91,668 (492); capability grants 83,991 (8,169); entry list 1,954 (90,206); entry create 90,532 (1,628); entry editor 91,239 (921); revision history 6,457 (85,703); entry workflow 89,163 (2,997); related content 78,705 (13,455); composition 83,875 (8,285); locale variant 90,967 (1,193); conflict resolve 91,660 (500); review queue 1,954 (90,206); review detail 89,880 (2,280); definition review queue 1,954 (90,206); definition review detail 75,619 (16,541); pattern create 87,124 (5,036); pattern edit 92,051 (109); taxonomy create 76,188 (15,972); taxonomy edit 90,860 (1,300); template create 79,378 (12,782); template edit 84,833 (7,327).

Revert checks (scratch edits restored byte for byte, `cmp`-verified): successor `registry.holding` removed (m2) fails; `useReconcileOnOutcome(false, ...)` (m7) fails the new digest row; `cache: 'default'` in each transport fails its closing-words row (template context, key/latest read, template POST, locale POST and refresh, pattern POST/latest/nestable, taxonomy POST/versions/terms); next-page failure clears the page (selector) fails; `startReadDeadline(.., 1e9)` in `pattern-latest-fetch`, `pattern-nestable-read`, `taxonomy-terms-fetch` and `cms-taxonomy-selector-read` fails the hung-read rows.

## Test corrections

(old to new, each justified by the spec line or the V20/refute8b finding; none weakens an assertion)

1. `CmsRegistryChangeNotice.test.tsx`: "renders nothing before any read" to "renders only the empty polite region, with no landmark name, before any read"; "lists the lines the read made, as a polite status" (`<ul>`/`<li>`, `role=status` only after the read) to "writes the lines of a read into the one polite region" (V20 m8: the live region exists before its content).
2. `CmsPatternVersionDesigner.states.test.tsx`: the it.each "a 409 %j renders fixed copy ... the registry-digest refusal reads nothing (D2, DEC-242)" is split into the conflict row (same assertions) and a digest row that asserts the context re-read instead of "reads nothing" (V20 m7, DEC-245(1)). Old titles are in `recite9/web9a-proposals.json` `retitled`.
3. `CmsTemplateDesigner.registry-context.test.tsx`: the stub answers the successor's parent read with 200 (was 503), so the registry hold is the only thing keeping the send off (V20 m2).
4. `template-designer-route.test.ts`: the five source-text assertions for `TemplateDesignerContextSchema.safeParse`, `TemplateVersionDetailSchema.safeParse`, `selector.status === 401` and the inline status line now assert the page uses `templateCreatePageOutcome` / `templateSuccessorPageOutcome` and `outcome.kind === 'redirect'`, `Astro.response.status = outcome.status`; the behaviour moved to `cms-template-page-outcome.test.ts`.
5. `step-up-required.inventory.test.ts`: the two `.astro` template pages replaced by `cms-template-page-outcome.ts` with the same `NO_STEP_UP_ROW` (the 401 mapper moved).
6. `cms-template-context-read.test.ts` (n3): added the comparison with `CMS_BLOCK_KEY_PATTERN`; nothing removed.
7. `CmsTaxonomyVersionDesigner.latest-states.test.tsx` (B1): `beforeAll` preload only.
8. `pattern-designer-reasons.test.ts`: a new `describe` appended; nothing removed.
9. Round 2, signal identity: `cms-taxonomy-selector-read.transport.test.ts` "reads the same-origin selector path..." `init.signal` `toBeUndefined()` to `toBeInstanceOf(AbortSignal)`, and "propagates the abort signal to the read" (identity `toBe(controller.signal)`) to "propagates the caller abort to the signal of the fetch" (the fetch gets the read's own deadline signal, which follows the caller; the test aborts mid-read and sees it aborted); `cms-taxonomy-selector-read.retry.test.ts` "propagates the abort signal to every retry": identity to one shared `AbortSignal` across the attempts.
10. Round 2, module split (no assertion changed): `pattern-latest-read.test.ts`, `pattern-latest-read.retry.test.ts`, `taxonomy-terms-read.test.ts` and `cms-taxonomy-pages/taxonomy-read-retry.test.ts` import the reader from `pattern-latest-fetch` / `taxonomy-terms-fetch`; `CmsPatternVersionDesigner.results`, `.uncertain-boundaries`, `.closing-words`, `pattern-latest-read.cancellation` and `CmsTaxonomyTermForm.latest-states` preload the on-demand module in `beforeAll` (a real module load cannot progress under fake timers).
11. `step-up-required.inventory.test.ts`: two more entries (`pattern-latest-fetch.ts`, `taxonomy-terms-fetch.ts`, `NO_STEP_UP_ROW`).

## Spec citations

FE03 1043-1049 and 1048 (409 reasons "refetch", unknown outcome "reconciles by refetching ... before any retry"), "Network and retry contract" (:1172-1173), 1620 (CMS-03C-17 degraded, "no optimistic state"); DEC-242, DEC-244 (3, 4), DEC-245 (1, 4), DEC-246 (1, 4); BE03c CMS-03C-12 digest token; P2-S12-AC-164 clauses 3 and 6; P2-S12-AC-271.

## Round 2: DEC-246(1) on every remaining browser read, and the budget

| Read | Change | Hung-fetch proof (fails with the deadline removed) |
| ---- | ------ | --------------------------------------------------- |
| latest version of a pattern (`pattern-latest-fetch.ts`) | Split: `pattern-latest-read.ts` keeps the types and a thin `readLatestPatternVersion` (same name, so the governed panel and the hooks need no edit) that imports `pattern-latest-fetch.ts` when asked; the reader has the shared deadline over fetch, safe retries and body. New on-demand stem `pattern-latest-fetch` (re-read after a command only). | `CmsPatternVersionDesigner.hung-reads.test.tsx` (409, then the read never answers: at 7,999 ms "Checking latest version…" is disabled, at 8,000 ms "The latest version is unavailable." and "Check latest version" enabled, a press reads again); `pattern-latest-fetch.deadline.test.ts`; mutant `startReadDeadline(.., 1e9)` fails the island row. |
| nestable patterns (`pattern-nestable-read.ts`) | Shared deadline over fetch, retries and body; stays on the initial route (the picker reads on mount). | Same file: the list ends at 8,000 ms in "…could not be loaded." and "Retry loading nestable patterns" asks again; `pattern-nestable-read.deadline.test.ts`; mutant fails the island row. |
| terms (`taxonomy-terms-fetch.ts`) | Split like the pattern read: `taxonomy-terms-read.ts` keeps the types, `TERM_LIFECYCLES` and a thin `readTaxonomyTerms`; the reader and its verification moved to `taxonomy-terms-fetch.ts` (new on-demand stem `taxonomy-terms-fetch`) with the shared deadline. The server page loader imports `verifiedTermsPage` from it. | `CmsTaxonomyTermForm.hung-reads.test.tsx` (a lost term action, the refresh never answers: at 8,000 ms "The list could not be refreshed" and "Refresh the list" enabled, a press reads again); `taxonomy-terms-fetch.deadline.test.ts`; mutant fails the island row. |
| connected selector (`cms-taxonomy-selector-read.ts`) | Shared deadline over fetch, retries and body, following the caller's abort; stays on the initial route of the entry routes (+362 B each, margins above 480 B). | `CmsTaxonomyFieldEditor.connected-degraded.test.tsx` (first page and next page that never answer: degraded cell at 8,000 ms, the last verified page kept, Try again asks again); mutant fails both rows. |

Dead code removed: after `withinDeadline` an abort rejects the race, so the readers' post-await `canceled(signal)` checks were unreachable; they are gone and the caller-abort rows (`*.edges.test.ts`) pin the race path instead.

Proof of the new chunks: `cms-on-demand-pattern-terms.proof.test.tsx` (not requested by the mount, a scroll or 120 s of idle time; requested when a 409 asks for the latest version, or when the list is read again after a lost term action; a chunk that cannot be fetched is the unavailable read with the control that repeats it). Gate entries added in `scripts/verify-bundle-budget.mjs` (`pattern-latest-fetch`, `taxonomy-terms-fetch`, each `importedBy` its thin module, `proof` that file) and their two stems in `tests/performance/cms-editorial-bundle-budget-mounted.test.ts`; both shared files carry other lanes' edits, mine are those two blocks.

Files of other lanes touched: `components/cms-taxonomy-pages/load-taxonomy-page.ts` (one import: `verifiedTermsPage` now comes from `taxonomy-terms-fetch`) and `taxonomy-read-retry.test.ts` (one import, the reader). I did NOT edit `lib/run-read-under-deadline.ts` or `lib/read-within-deadline.ts` (not needed: the budget was recovered by the on-demand splits); web9b's tests are green.

### Per-route initial gzip (budget 92,160), no budget change

| Route | V20 baseline | web9a round 1 | web9b tree before the splits (coordinator) | FINAL | Margin |
| ----- | -----------: | ------------: | -----------------------------------------: | ----: | -----: |
| CMS pattern edit | 92,066 | 92,093 | 93,212 | **92051** | 109 |
| CMS taxonomy edit | 92,096 | 92,121 | 92,902 | **90860** | 1300 |

Pattern edit: the reader of the latest version (2,158 B gzip as a chunk) left the initial route; the nestable deadline brings `read-within-deadline` (341 B) in. Taxonomy edit: the terms reader (1,185 B chunk) left it and nothing replaced it (`read-within-deadline` is not in its initial assets). Every other CMS route, final: Infrastructure 79,116 (13,044); Platform configuration 78,242 (13,918); Content schema registry 91,668 (492); capability grants 83,991 (8,169); entry list 1,954 (90,206); entry create 90,532 (1,628); entry editor 91,239 (921); revision history 6,457 (85,703); entry workflow 89,163 (2,997); related content 78,705 (13,455); composition 83,875 (8,285); locale variant 90,967 (1,193); conflict resolve 91,660 (500); review queue 1,954 (90,206); review detail 89,880 (2,280); definition review queue 1,954 (90,206); definition review detail 75,619 (16,541); pattern create 87,124 (5,036); pattern edit 92,051 (109); taxonomy create 76,188 (15,972); taxonomy edit 90,860 (1,300); template create 79,378 (12,782); template edit 84,833 (7,327).

## Open items / BOUNDARY

1. Commands (the POST of each island) have no deadline: an unknown outcome is reconciled by a read, not timed out (DEC-244 3); not a read, not changed.
2. The registry notice fixes its live region by being always mounted; if a future parent mounts it with a `read` state already set, the first paint carries the text (documented in the component).
3. Playwright was not run. The template real-route specs still do not script the digest 409's context GET and the page refactor is covered only by unit tests; root runs `...template-edit.spec.ts` and `...template-real-route.spec.ts`. The terms and latest-version chunks add one network request on first use; the real-route specs that press Refresh/Check latest version should still pass.
4. `recite9/web9a-proposals.json`: 21 AC-271 rows (error 3, degraded 8, closing 10) and the AC-164 c3/c6 rows (37 template + 11 pattern loader). Clauses 10 and 11 are uncited (DEC-245(5)). The governed submit-form 401 and the governed queue retitles are web9b's.

## Requests to root

1. Re-run the real-route specs listed in V20 (template, locale, pattern) and the new first-use chunks in a browser.
2. Apply the proposals only after the independent refutation.

## Evidence (scratch `/tmp/claude-1000/-home-rob-Projects-WeJammin/2663dcb2-f742-450b-97cd-0e849cede6cc/scratchpad/claude_s12_web9a/`)

`bundle.out`, `build.log`, `cov-run.log`, `cov-analyze.mjs`, `full-web.log`, `titles.json`, `make-proposals.mjs`, `files.txt`.
