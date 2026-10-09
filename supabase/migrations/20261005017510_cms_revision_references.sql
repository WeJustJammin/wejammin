-- Slice 11 shared helper (lane S11-3s, BE03b "Publication preflight registry
-- (D19, DEC-134, D25)"; tracker P2-S11-AC-094): the canonical reference counter.
--
-- The generic preflight.reference_gate provider serves every category whose
-- owning domain has no provider yet (pattern, taxonomy, privacy, media, route,
-- locale).  It passes only when platform_private.cms_revision_references
-- (revision, kind) is 0 and otherwise fails closed `provider_unbuilt_reference`.
-- This is that counter, the single place a "reference of kind K" is defined:
--
--   pattern   composition instances of the revision that name a PatternVersion
--             and are still live (draft, active, pending_diff; a retired or
--             superseded instance is history).
--   taxonomy  `active` TermAssignment rows of the revision plus the entries of
--             its recorded taxonomy_version_ids.
--   privacy   distinct entries among {the revision's entry, the content targets
--             of its relation rows} whose lifecycle is `held` or
--             `deletion_pending` (the only representation of a legal hold or an
--             erasure fence before Slice 16 registers the hold provider).  An
--             `archived` entry is unavailable, not held.
--   media     non-empty (not null, not [], not {}) values of `media` fields plus
--             composition instances of a block that declares a `cms.media*` data
--             source.  A non-empty media value already fails closed at write
--             (media_source_unavailable); this is the publish-time backstop.
--   route     `internal` rich-text links at any depth of any stored value
--             (rich_text fields and rich_text object properties alike): a node
--             that is the `link` member of its parent with kind `internal`.
--   locale    LocaleVariant rows of the revision (its manifest localeSources
--             entry) plus the active `no_fallback` fields its schema declares.
--
-- An absent revision holds no reference of any kind (0); an unknown or null
-- kind is a malformed helper call (INVALID_REQUEST).  Private, SECURITY
-- DEFINER, STABLE, a pure read; callers run under the CMS RPC context.
-- Forward-only.
begin;

create or replace function platform_private.cms_revision_references(
  p_revision_id uuid,
  p_kind text
)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  revision_row platform_private.cms_entry_revisions%rowtype;
  total bigint := 0;
begin
  if p_kind is null
     or p_kind not in ('pattern', 'taxonomy', 'privacy', 'media', 'route', 'locale') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select revision.* into revision_row
    from platform_private.cms_entry_revisions revision
   where revision.id = p_revision_id;
  if not found then
    return 0;
  end if;

  if p_kind = 'pattern' then
    select pg_catalog.count(*) into total
      from platform_private.cms_composition_instances instance
     where instance.revision_id = revision_row.id
       and instance.pattern_id is not null
       and instance.state in ('draft', 'active', 'pending_diff');

  elsif p_kind = 'taxonomy' then
    select pg_catalog.count(*) into total
      from platform_private.cms_term_assignments assignment
     where assignment.revision_id = revision_row.id
       and assignment.state = 'active';
    total := total + pg_catalog.jsonb_array_length(revision_row.taxonomy_version_ids);

  elsif p_kind = 'privacy' then
    select pg_catalog.count(*) into total
      from (
        select revision_row.entry_id as entry_id
        union
        select relation.target_id
          from platform_private.cms_entry_relations relation
         where relation.revision_id = revision_row.id
           and relation.target_kind = 'content'
      ) candidate
      join platform_private.cms_content_entries entry
        on entry.id = candidate.entry_id
     where entry.lifecycle in ('held', 'deletion_pending');

  elsif p_kind = 'media' then
    select pg_catalog.count(*) into total
      from platform_private.cms_entry_field_values field_value
      join platform_private.cms_field_definition_versions field
        on field.id = field_value.field_definition_id
     where field_value.revision_id = revision_row.id
       and field.kind = 'media'
       and field_value.value is not null
       and field_value.value not in ('null'::jsonb, '[]'::jsonb, '{}'::jsonb);
    total := total + (
      select pg_catalog.count(*)
        from platform_private.cms_composition_instances instance
        join platform_private.cms_block_definition_versions block
          on block.block_key = instance.block_key
         and block.block_version = instance.block_version
       where instance.revision_id = revision_row.id
         and instance.state in ('draft', 'active', 'pending_diff')
         and exists (
           select 1
             from pg_catalog.jsonb_array_elements_text(block.data_source_permissions) source(permission)
            where pg_catalog.starts_with(source.permission, 'cms.media')
         )
    );

  elsif p_kind = 'route' then
    with recursive nodes(parent_key, node) as (
      select null::text, field_value.value
        from platform_private.cms_entry_field_values field_value
       where field_value.revision_id = revision_row.id
         and field_value.value is not null
      union all
      select child.key, child.value
        from nodes
        cross join lateral (
          select member.key, member.value
            from pg_catalog.jsonb_each(
              case when pg_catalog.jsonb_typeof(nodes.node) = 'object'
                then nodes.node else '{}'::jsonb end
            ) member
          union all
          select null::text, element.value
            from pg_catalog.jsonb_array_elements(
              case when pg_catalog.jsonb_typeof(nodes.node) = 'array'
                then nodes.node else '[]'::jsonb end
            ) element
        ) child
    )
    select pg_catalog.count(*) into total
      from nodes
     where nodes.parent_key = 'link'
       and pg_catalog.jsonb_typeof(nodes.node) = 'object'
       and nodes.node->>'kind' = 'internal';

  else
    select pg_catalog.count(*) into total
      from platform_private.cms_locale_variants variant
     where variant.revision_id = revision_row.id;
    total := total + (
      select pg_catalog.count(*)
        from platform_private.cms_field_definition_versions field
       where field.content_type_version_id = revision_row.schema_version_id
         and field.state = 'active'
         and field.localization_mode = 'no_fallback'
    );
  end if;

  return total;
end;
$body$;

comment on function platform_private.cms_revision_references(uuid, text) is
  'BE03b D19: how many references of kind pattern|taxonomy|privacy|media|route|locale a revision holds (0 for an absent revision). The generic preflight.reference_gate passes only at 0. Private; STABLE; callers run under the CMS RPC context.';

-- The definer reads these relations; table privileges are derived from the
-- function bodies (SEC-2), RLS admits the definer inside a CMS RPC context.
grant select on table
  platform_private.cms_block_definition_versions,
  platform_private.cms_composition_instances,
  platform_private.cms_content_entries,
  platform_private.cms_entry_field_values,
  platform_private.cms_entry_relations,
  platform_private.cms_entry_revisions,
  platform_private.cms_field_definition_versions,
  platform_private.cms_locale_variants,
  platform_private.cms_term_assignments
  to wejammin_cms_definer;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_revision_references(uuid, text)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_revision_references(uuid, text)
  from public, anon, authenticated, service_role;

commit;
