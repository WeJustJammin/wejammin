# Slice 12 locale resolver fragments (lane locale)

Fragments (`*.sqlinc`) of `../phase_02_slice_12_locale_resolution.sql`, the CMS-03C-20 suite
(`platform_private.cms_resolve_locale_field`, BE03c Locale field resolution (DEC-121, DEC-138)).

| Fragment              | Content                                                                                                                                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `001-world.sqlinc`    | the active `loc12doc` type (localized, no_fallback and none fields; fr-FR/de-DE chain to en-US, fr-CA to fr-FR then en-US) created by the real `cms_create_type_draft`, its entry saved by the real `cms_create_entry`, and the `pg_temp.l12r_*` builders |
| `002-resolver.sqlinc` | the resolution of every `localizationMode`, the chain walk, `no_fallback` never borrowing, stale handling, revalidation, argument errors, read-only and determinism, grants, no leakage                                                                   |

Result strings read `mode/outcome/provenance/resolvedFromLocale/stale/blocking/reasonCode`
(`pg_temp.l12r_res(locale, fieldKey)`). Include order: Slice 10 RPC fixtures, then
`../phase_02_slice_12_locale_variant/000-helpers.sqlinc`, then these fragments. Keep every file under 400 lines.

The 128-field wall-clock bench lives in its own suite, `../phase_02_slice_12_locale_perf.sql` (run it on a quiet host), so a loaded machine cannot fail this functional suite.

## Related paths

- `../phase_02_slice_12_locale_variant/README.md`
- `../../migrations/20261014050500_cms_resolve_locale_field.sql`
