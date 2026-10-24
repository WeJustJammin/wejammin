# Lane `claude_s12_dec205_read` — protected locale-variant read, full stack (DEC-205)

Read `docs/handoffs/2026-10-14-claude-s12/lane-rules.md` fully first; it binds you. Worktree
`/home/rob/.codex/worktrees/phase2-slice12/WeJammin`. Report:
`docs/handoffs/2026-10-22-claude-s12/lane-dec205-read-report.md` (checkpoint early, after every run).

## Decision and spec (root already wrote BE03c)

Owner decision DEC-205 (2026-10-22, raw record in `.memory/raw/events/2026-10-22.jsonl`; mirrors DEC-195).
Root wrote the BE03c rows — search `cmsLocaleVariantRead` in
`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md` (epic index, interaction map, route
registry, CMS-03C-20 consumers, validation, `LocaleVariantRead` schema right after `LocaleFieldResolution`,
error kinds, error matrix, authority, changelog). Those rows are the contract. If you find them
internally inconsistent or contradicting another BE03c/BE03b rule, STOP that part and report it to root;
do not edit BE03c yourself.

Precedent to follow layer by layer: the DEC-195 related-content read
(`docs/handoffs/2026-10-14-claude-s12/briefs/dec195-read.md` and its report `lane-dec195-read-report.md`),
whose SQL is `supabase/migrations-wip/dec195/`, contract `RelatedContentRuleReadSchema`, Worker GET route,
web proxy and page loader.

## Layers (RED first at each)

1. **Contracts** (`packages/contracts/src/cms-composition/`): `LocaleVariantReadSchema` exactly as BE03c;
   operation id `cmsLocaleVariantRead` in the platform registries (300/600 per minute, 8,000 ms, no-store,
   Tier 1), refusal list, OpenAPI path. Run `pnpm contracts:generate` then
   `node infra/generate-openapi.mjs --check` (record diff). This is an additive evolution approved by the owner.
2. **SQL** WIP `supabase/migrations-wip/dec205/`, timestamps `20261022020000`–`20261022029999`: private
   SECURITY DEFINER read + `platform_api` wrapper reusing the CMS-03C-04 authority helper exactly (403
   `capability_missing`-style refusal per existing locale tokens for a visible entry without edit; 404 hidden/
   absent or locale outside `supportedLocales`), returning `{locale, activeFallbackChain, variant|null,
   fields, resolutions}`; resolutions come from `platform_private.cms_resolve_locale_field` for every
   localizable field (one statement). Note: the locale gate/provider WIP lives in
   `supabase/migrations-wip/locale-gate/` and the resolver may be there or promoted — find it; stage the
   lanes you need with a comma list (e.g. `locale-gate,dec205`). New pgTAP
   `supabase/tests/phase_02_slice_12_locale_variant_read.sql` (+ dir): editor gets variant/null; stale ids;
   no_fallback missing/stale resolutions; fallback order equals the active version chain; reader without edit
   403; hidden 404; unsupported locale 404; malformed 400; grants (`revoke … from public, anon,
   authenticated`; execute to service_role only per the existing pattern). Staged lane name `dec205` (plus
   any lane you depend on).
3. **Worker**: GET route + production adapter + strict parsing (precedent: the DEC-195 related read route).
4. **Web**: same-origin proxy GET; replace the BOUNDARY seams SG-S12-05/06/07 left by the web-locale lane
   (report `docs/handoffs/2026-10-22-claude-s12/lane-web-locale-report.md`) in the locale page loader and
   `CmsLocaleVariantForm`: real resolutions, current values, derived state, author-safe fallback order,
   page-level 403. Replace the boundary sentinel tests with behavioural tests. Lift `saveAllowed` holds.
5. **FE03/IA03 cascade** (owner-approved by DEC-205): FE03 `.memory/wiki/specs/fe/03-cms-content-modeling.md`
   `CmsLocaleVariantForm` rows (~891, ~1513), locale page rows (~1073, ~1641), route row (~1549), endpoint
   table (~1885: add the read row) and changelog name the read; IA03 CMS-15 only if it names the reads.
   Criteria: do NOT change acceptance criteria text; list in your report any Slice 12 criterion whose text
   should name the read, for root.

## Claim

- NEW `supabase/migrations-wip/dec205/`; NEW `supabase/tests/phase_02_slice_12_locale_variant_read*`.
- Contracts: new files under `packages/contracts/src/cms-composition/` for the read + the minimal registry
  edits (list each shared registry file in your report before editing; no other lane is editing contracts now).
- Worker: new route/adapter files + the minimal router wiring line (name it in your report before editing).
- Web: `apps/web/src/components/cms-locale/`, `apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/locales/`,
  `apps/web/src/server/cms-composition-platform-locale*.ts` (the web-locale lane is finished; you own these now).
- FE03 and IA03 rows listed above (not BE03c).
Never touch `apps/web/src/components/cms-composition-instances/`, `entries/[entryId]/composition.astro`
or `apps/web/src/server/cms-composition-instances-*` (another lane owns them).

Final message: GREEN / PARTIAL / BLOCKED, report path + SHA-256, pgTAP/Vitest counts, files, Requests to root.
