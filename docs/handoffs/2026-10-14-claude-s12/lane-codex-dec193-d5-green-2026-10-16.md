# DEC-193 D5 comparison amendment — author handoff

Author: native `gpt-6.1-sol` / `ultra`, 2026-10-16.

## Status

Source-only authoring is complete and intentionally **UNRUN**. No parser, import,
test, database, Docker, network, or application-runtime command was used. Root
owns staging and the subsequent RED/GREEN execution gate.

| Path | LF lines | Bytes | SHA-256 |
|---|---:|---:|---|
| `supabase/migrations-wip/dec193/20261016041900_cms_revision_comparison_dec193.sql` | 157 | 7466 | `c540dd5a1f9ecd04c0ee436c91ae41f94aee4f1cb06fc0be1cf223210f4eaa53` |

## Defect addressed

The installed D5 block map in
`supabase/migrations/20261005018020_cms_list_revisions_derived_state.sql:524-577`
treated every `state = 'active'` immutable row as current. DEC-193 retains prior
rows while appending a newer version, so a detached non-NULL update could raise
`comparison_unavailable` at the duplicate-path check even though one newest row
was the effective head. A newer `retired` row could also leave an older active
row visible in the comparison.

## Forward amendment

The migration targets the live `platform_private.cms_list_revisions(jsonb)`
function by OID, reads its canonical `pg_get_functiondef`, and replaces only the
known block precheck/map anchor. The replacement:

1. selects one row per `(revision_id, path)` with PostgreSQL 17-valid
   `distinct on`, ordered by `version desc, id desc` for deterministic tie
   control;
2. applies `state = 'active'` only after that newest-row selection;
3. keeps the fail-closed 256-byte `/blocks/<path>` bound; and
4. hashes the selected base-table row through the existing private
   `platform_private.cms_composition_instance_content(instance)` helper.

The helper preserves the exact seven-field legacy image when
`detached_tree IS NULL` and adds only canonical `detachedTree` content for a
non-NULL tree (`supabase/migrations-wip/dec193/20261016041200_cms_composition_instance_content.sql:13-21`).
The relation map, field map, payload validation, authority checks, newest
readable-revision selection, keyed relation HMAC, and non-disclosure errors are
outside the replacement anchor and remain byte-for-byte untouched.

## Fail-closed source guard

The migration follows the approved source-preserving mechanism in
`supabase/migrations-wip/dec193/20261016041700_cms_preflight_effective_security.sql:16-95`:

- exact one-occurrence anchor and no prior DEC-193 marker;
- inverse replacement must reconstruct the entire original `prosrc`;
- `pg_get_functiondef(original.oid)` must contain exactly one old source;
- `CREATE OR REPLACE` executes the extracted live definition, not a copied
  779-line body;
- same function OID, owner, security-definer/search-path/language/return and
  volatility attributes, ACL, and comment are verified after replacement; and
- every failure raises inside one transaction, so the DDL rolls back.

The source anchor was statically compared with the installed block section and
matched exactly. This is a static authoring result, not runtime proof.

## Normative alignment

BE03b D5 requires canonical block content for non-NULL detached trees, defined
legacy pinned behavior for SQL-NULL trees, refusal on unresolvable dependencies,
and the newest readable right-side revision
(`.memory/wiki/specs/be/03b-editorial-workflow-publication.md:1707-1715`).
This amendment only changes block-head selection and the block-side image; it
does not broaden consumer manifest/render behavior or alter public contracts.
