-- AC169: enforce template/content-type family compatibility at the draft
-- write and activation switch. The 03a existence resolver alone cannot prove
-- compatibility with 03c's immutable compatible_type_ids snapshot.

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
      and template.compatible_type_ids @>
        pg_catalog.jsonb_build_array(p_content_type_id::text)
  )
$body$;

revoke all on function platform_private.cms_template_binding_compatible(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;

create or replace function platform_private.cms_draft_template_binding_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
declare
  parent_row platform_private.cms_content_type_versions%rowtype;
begin
  select * into parent_row
  from platform_private.cms_content_type_versions
  where id = new.content_type_version_id;

  -- A missing parent is still rejected by the existing FK. Existing review
  -- fixtures remain available to exercise activation preflight separately.
  if found and parent_row.state = 'draft'
     and (
       new.owner_id is distinct from parent_row.owner_id
       or not platform_private.cms_template_binding_compatible(
         new.template_version_id,
         parent_row.owner_id,
         parent_row.content_type_id
       )
     ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

create trigger cms_draft_template_binding_compat_guard
before insert or update of owner_id, content_type_version_id, template_version_id
on platform_private.cms_content_type_template_bindings
for each row execute function platform_private.cms_draft_template_binding_guard();

revoke all on function platform_private.cms_draft_template_binding_guard()
from public, anon, authenticated, service_role;

create or replace function platform_private.cms_type_version_template_compat_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
begin
  -- New drafts must not capture an incompatible default. Recheck both the
  -- default and every persisted binding at the actual activation state switch
  -- so deleted or drifted references fail in the same transaction.
  if (tg_op = 'INSERT' and new.state = 'draft')
     or (tg_op = 'UPDATE' and new.state = 'active'
         and old.state is distinct from 'active') then
    if new.default_template_version_id is not null
       and not platform_private.cms_template_binding_compatible(
         new.default_template_version_id, new.owner_id, new.content_type_id
       ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.state = 'active'
     and old.state is distinct from 'active'
     and exists (
       select 1
       from platform_private.cms_content_type_template_bindings binding
       where binding.content_type_version_id = new.id
         and (
           binding.owner_id is distinct from new.owner_id
           or not platform_private.cms_template_binding_compatible(
             binding.template_version_id, new.owner_id, new.content_type_id
           )
         )
     ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  return new;
end;
$body$;

create trigger cms_type_version_template_compat_guard
before insert or update of state, default_template_version_id
on platform_private.cms_content_type_versions
for each row execute function platform_private.cms_type_version_template_compat_guard();

revoke all on function platform_private.cms_type_version_template_compat_guard()
from public, anon, authenticated, service_role;
