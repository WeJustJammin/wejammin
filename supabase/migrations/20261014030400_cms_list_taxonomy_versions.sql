-- Slice 12 lane taxonomy-def (BE03c route registry cmsTaxonomyVersionsRead at 166, validation at 406, the
-- TaxonomyVersionsPage contract at 1166-1169, authorization at 1480, DEC-188; P2-S12-AC-177..182): the versions
-- read of a vocabulary lineage.
--
--   platform_private.cms_list_taxonomy_versions(p_request jsonb) returns jsonb;
--   platform_api.cms_list_taxonomy_versions(p_request jsonb) - the Worker transport.
--
-- Private request: { taxonomyId, context, correlationId? }, nothing else.  Answer: the strict witness
-- { taxonomyId, page: { items, pageVersion } }: the Worker unwraps the unchanged public page only after the
-- witness names the lineage it asked for, so an empty page can never be mistaken for an absent vocabulary.
-- Order: a non-object body is INVALID_REQUEST; actor and acting party (UNAUTHENTICATED); a caller who cannot
-- read the owner party is NOT_FOUND; a reader without cms.taxonomy_curator is `capability_missing` (BE03c:1304);
-- the strict members and a lowercase UUID (INVALID_REQUEST); the lineage must exist in the caller's owner scope (NOT_FOUND, the
-- same refusal for an absent, another owner's or a non-lineage id).  The page is the lineage's versions newest
-- first, at most 50, each exactly the resource its create answered (state and updatedAt are current).
-- pageVersion is the high-water update instant of the page in UTC microseconds (the page ETag).  Reads lock
-- nothing and write nothing.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_list_taxonomy_versions(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  person_id uuid;
  lineage_id uuid;
  page_items jsonb;
  high_water timestamptz;
begin
  -- SEC-2: the forced policies admit a row only inside an RPC context; the platform_api wrapper restores the flag.
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if pg_catalog.jsonb_typeof(p_request) is distinct from 'object' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  begin
    person_id := platform_private.identity_actor_person(actor_id);
  exception when others then
    person_id := null;
  end;
  if person_id is null or not platform_private.cms_entry_tenant_visible(actor_id, acting_party_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not platform_private.cms_person_holds_capability(acting_party_id, person_id, 'cms.taxonomy_curator') then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;
  if not platform_private.cms_exact_keys(
    p_request, array['taxonomyId','context']::text[], array['taxonomyId','context','correlationId']::text[]
  ) or pg_catalog.jsonb_typeof(p_request->'taxonomyId') is distinct from 'string' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if platform_private.cms_valid_uuid(p_request->>'taxonomyId') is not true then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  lineage_id := (p_request->>'taxonomyId')::uuid;

  select pg_catalog.jsonb_agg(page.resource order by page.version desc), pg_catalog.max(page.updated_at)
    into page_items, high_water
    from (
      select pg_catalog.jsonb_build_object(
               'id', version_row.id,
               'version', version_row.version::text,
               'contentHash', version_row.content_hash,
               'createdAt', platform_private.auth_iso_time(version_row.created_at),
               'updatedAt', platform_private.auth_iso_time(version_row.updated_at),
               'state', version_row.state,
               'taxonomyId', version_row.taxonomy_id,
               'taxonomyKey', version_row.taxonomy_key,
               'taxonomyVersion', version_row.version,
               'shape', version_row.shape,
               'allowedTypeKeys', version_row.allowlisted_type_keys,
               'allowedFieldKeys', version_row.allowlisted_field_keys,
               'canonicalOverlapDomains', version_row.canonical_overlap_domains) as resource,
             version_row.version,
             version_row.updated_at
        from platform_private.cms_taxonomy_versions version_row
       where version_row.owner_id = acting_party_id
         and version_row.taxonomy_id = lineage_id
       order by version_row.version desc
       limit 50
    ) page;
  if page_items is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return pg_catalog.jsonb_build_object(
    'taxonomyId', lineage_id,
    'page', pg_catalog.jsonb_build_object(
      'items', page_items,
      'pageVersion', pg_catalog.floor(extract(epoch from high_water) * 1000000)::bigint::text));
end;
$body$;

comment on function platform_private.cms_list_taxonomy_versions(jsonb) is
  'cmsTaxonomyVersionsRead: a verified taxonomy curator reads the versions of one vocabulary lineage of their owner scope, newest first, at most 50, with the page version (high-water update instant in microseconds). Answers { taxonomyId, page } so the Worker can prove the lineage; an absent, foreign or non-lineage id is NOT_FOUND. Writes and locks nothing. Private; the Worker calls the platform_api wrapper.';

create or replace function platform_api.cms_list_taxonomy_versions(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_list_taxonomy_versions(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_list_taxonomy_versions(jsonb) is
  'cmsTaxonomyVersionsRead Worker transport: delegates to platform_private.cms_list_taxonomy_versions; service_role only.';

grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_private.cms_list_taxonomy_versions(jsonb) owner to wejammin_cms_definer;
alter function platform_api.cms_list_taxonomy_versions(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;
revoke all on function platform_private.cms_list_taxonomy_versions(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_list_taxonomy_versions(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_list_taxonomy_versions(jsonb) to service_role;

commit;
