-- Preserve the UUID identity semantics of 03c compatibleTypeIds. The template
-- definition contract accepts a single upper-case UUID representation, so
-- JSON string containment would reject an otherwise compatible type.

create or replace function platform_private.cms_template_binding_compatible(
  p_template_version_id uuid,
  p_owner_id uuid,
  p_content_type_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $body$
  select exists (
    select 1
    from platform_private.cms_template_versions template
    where template.id = p_template_version_id
      and template.owner_id = p_owner_id
      and exists (
        select 1
        from pg_catalog.jsonb_array_elements_text(
          template.compatible_type_ids
        ) as type_id(value)
        where type_id.value::uuid = p_content_type_id
      )
  )
$body$;

revoke all on function platform_private.cms_template_binding_compatible(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;
