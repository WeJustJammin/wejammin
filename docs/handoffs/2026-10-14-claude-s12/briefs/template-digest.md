# Lane brief — `claude_s12_template_digest` (CMS-03C-01 `block_registry_digest_mismatch`, full stack)

Investigation: `lane-hardening-5-report.md` "## Investigation (item 6)". Spec REQUIRES CMS-03C-01 to refuse a
well-formed caller `blockRegistryDigest` that differs from the recomputed one with 409 and the closed
`details.reasonCode` `block_registry_digest_mismatch` (BE03c `.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`
:323-327, :373, the CMS-03C-01 error-matrix conflict cell, the typed-refusals paragraph; DEC-186 item 2). The
shipped producer raises the generic `CONFLICT` (`supabase/migrations/20261013100200_cms_define_template_per_owner.sql:138-141`,
same in `20260927200000:443-446`); the oracle `supabase/tests/phase_02_slice_12_template_authority.sql:426-427`
asserts `CONFLICT` and contradicts the spec. Precedent for the typed token: the pattern producers
(`20261014020400:251-252`, `20261014110300`, DETAIL `["/blockRegistryDigest"]`).

Do, RED first at each layer:
1. SQL: one forward anchored patch (exactly-once anchor; compare every non-body `pg_proc` attribute; idempotent) of
   the CURRENT template producer (find the latest definition among promoted migrations) so the digest check raises
   `block_registry_digest_mismatch` (P0001) with the same DETAIL convention as the pattern producers. WIP dir
   `supabase/migrations-wip/template-digest/`, timestamps `20261014180000`-`20261014180499`. pgTAP: correct the oracle
   at `:426-427` (spec-cited, strengthening; list it under Test corrections) and add an idempotency/attribute check;
   run the template suites plus every suite that includes the template producer (grep `\ir`) with your WIP staged.
2. Worker: `mapTemplateRpcFailure` maps the exact P0001 + `block_registry_digest_mismatch` pair to 409
   `VERSION_CONFLICT` (the CMS-03C-01 catalog code) with `details.reasonCode`; `template-respond.ts` relays it only on
   CMS-03C-01 (per the contract list); tests.
3. Web: the template relay / `safeDetails` 409 keeps `block_registry_digest_mismatch` for CMS-03C-01; the template
   designer shows fixed copy for it (FE03 template designer row; if FE03 names no copy, use the pattern designer's
   copy for the same token and cite it); tests.
Joint-landing rule: SQL and Worker/Web land together (root promotes only after all three are GREEN and reviewed).
Files: the WIP dir, the template pgTAP files, Worker `cms-composition/template-*.ts` + `cms-composition-production-template*.ts`
(+tests), Web template relay/designer files (+tests), report `docs/handoffs/2026-10-14-claude-s12/lane-template-digest-report.md`.
NOT `components/cms-governed-review/**`, `cms-taxonomy*`, `cms-related-content*`, pattern-update Worker files,
dispatcher files (other running lanes). Gates: staged DB runner (lane `template-digest`), focused + full Worker and Web
Vitest, worker `tsc`, `astro check`, eslint + prettier on touched files.
