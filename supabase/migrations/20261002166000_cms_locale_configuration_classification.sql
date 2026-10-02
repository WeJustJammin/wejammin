-- BE03a OD-4 compatibility: the server-derived classification (CMS-03A-10)
-- treats a successor whose locale configuration equals its source's as no
-- locale change and adding a supported locale (with its chain) as additive;
-- removing a supported locale or changing the members or order of a retained
-- locale's fallback chain is breaking, because a stored LocaleVariant or a
-- published locale could then resolve differently, and a breaking change needs
-- a migration plan whose dry run counts the affected rows.  The field rules are
-- unchanged and keep their own function.  Forward-only.
begin;

alter function platform_private.cms_derive_schema_classification(uuid, uuid)
  rename to cms_derive_schema_field_classification;

create or replace function platform_private.cms_derive_schema_classification(
  p_source_id uuid, p_target_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  source_row platform_private.cms_content_type_versions%rowtype;
  target_row platform_private.cms_content_type_versions%rowtype;
begin
  if p_source_id is null then
    return 'additive';
  end if;
  select * into source_row from platform_private.cms_content_type_versions where id = p_source_id;
  select * into target_row from platform_private.cms_content_type_versions where id = p_target_id;
  if source_row.id is not null and target_row.id is not null
     and source_row.locale_config_hash is distinct from target_row.locale_config_hash then
    if exists (
      select 1
        from pg_catalog.jsonb_array_elements_text(source_row.supported_locales) locale(value)
       where not (target_row.supported_locales ? locale.value)
    ) or exists (
      select 1
        from pg_catalog.jsonb_each(source_row.fallback_chains) chain(key, value)
       where target_row.fallback_chains -> chain.key is distinct from chain.value
    ) then
      return 'breaking';
    end if;
  end if;
  return platform_private.cms_derive_schema_field_classification(p_source_id, p_target_id);
end;
$body$;

revoke all on function platform_private.cms_derive_schema_field_classification(uuid, uuid),
  platform_private.cms_derive_schema_classification(uuid, uuid)
  from public, anon, authenticated, service_role;

commit;
