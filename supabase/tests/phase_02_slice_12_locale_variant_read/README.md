# cmsLocaleVariantRead pgTAP fragments (DEC-205)

Driver: `../phase_02_slice_12_locale_variant_read.sql`. World: the CMS-03C-20 resolver suite world
(`../phase_02_slice_12_locale_resolution/001-world.sqlinc`) on the Slice 10 RPC fixtures.

- `000-helpers.sqlinc` - the transport probe `l205_call`, principal switch, resolution/value pickers, the resolver
  oracle `l205_resolver` and the write-evidence counter.
- `001-shape-and-grants.sqlinc` - definer ownership, empty search_path, `service_role`-only transport, no write, no lock.
- `002-read.sqlinc` - untranslated, draft, explicit null, stale, revalidated answers; resolutions equal the CMS-03C-20 resolver.
- `003-authority.sqlinc` - FORBIDDEN / NOT_FOUND / INVALID_REQUEST / UNAUTHENTICATED split, parity with CMS-03C-04.

Add a case by appending to the fragment that owns its concern; keep each fragment under 400 lines. Run through the
staged ALT runner with lane `dec205` (see `docs/handoffs/2026-10-14-claude-s12/lane-rules.md`).
