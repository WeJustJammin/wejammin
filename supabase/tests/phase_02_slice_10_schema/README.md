# Slice 10 pgTAP fragments

The executable `../phase_02_slice_10_schema.sql` is the single Supabase
discovery entrypoint. It opens one transaction, establishes the pgTAP plan,
then includes these fragments in numeric order with psql `\ir` directives.
The final fragment returns control to the entrypoint for `finish()` and
`rollback()`, so helper and assertion state remain shared across the suite.

Keep fragments ordered and below the repository's 400-line test cap. The
fragments are includes, not independently discovered Supabase test files.

| Fragment                               | Coverage                                                                                                                                                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-helpers.sqlinc`                   | OID-resolving inspectors for columns, closed CHECK unions, FKs, triggers, indexes and enforcement probes                                                                                                       |
| `001-entries-and-revisions.sqlinc`     | ContentEntry and EntryRevision exact column sets, envelope nullability/defaults, closed unions, real identity FKs, CAS uniqueness, locked indexes, write/immutable guards                                      |
| `002-values-relations-and-seam.sqlinc` | EntryFieldValue and EntryRelation exact column sets, closed `state`/`provenance`/`on_unavailable` unions, immutable evidence guards, cross-domain target boundary, and the `template_version_id` registry seam |
| `003-security-and-indexes.sqlinc`      | Forced RLS, revoked browser/service grants, RPC-context policies, live direct-write rejection, and the assignment foundation                                                                                   |

## Scope and deliberate boundaries

This suite covers the Slice 10 database table foundation only. RPC
implementations (CMS-03B-01..-11), Zod contracts, middleware and RLS predicate
tests belong to later Slice 10 work and are intentionally absent here.

Three spec-to-reality corrections are asserted deliberately and must not be
silently "fixed":

1. BE03b names `identity_private.person(id)` and `identity_private.party(id)`
   for revision author and acting party. Those relations do not exist. The
   canonical BE01 references are `platform_private.person_party(party_id)` and
   `platform_private.party(id)`, which is what BE01c already uses and what these
   tables reference.
2. BE03b references `cms_template_versions(id)`, owned by 03c. That table does
   not exist yet, so `template_version_id` has no physical FK. It is protected
   instead by a column CHECK that calls the existing
   `platform_private.cms_template_registry_valid(uuid)` seam, which probes the
   candidate registry relations and returns false for an unregistered value.
   A forward migration must add the real FK once 03c owns TemplateVersion.
3. `cms_entry_assignments` has no canonical BE03b row. BE03b delegates
   assignment authority to BE01 and DEC-106 requires the initial entry create to
   persist an assignment atomically. This table is an additive foundation that
   still needs a canonical spec row authored before RPC work depends on it.

## Local run

```sh
node_modules/.bin/supabase test db --local supabase/tests/phase_02_slice_10_schema.sql
```
