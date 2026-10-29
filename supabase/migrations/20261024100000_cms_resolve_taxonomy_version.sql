-- Slice 12 lane taxonomy-integrity: BE03c "Receiving obligations from Slice 10 (DEC-141)" item 1 (P2-S12-AC-242).
--
-- platform_private.cms_resolve_taxonomy_version(p_taxonomy_version_id uuid) resolves any taxonomy version id of the caller's
-- owner scope, in any state (draft through retired and blocked), to { taxonomyId, taxonomyKey, taxonomyVersion (decimal
-- string), state, contentHash }.  The caller's owner scope is the acting party the CMS command published (cms_acting_party
-- publishes app.cms_session_party in every CMS RPC); an absent id, an id of another owner, a null id and a call with no
-- published party are the identical non-disclosing P0001 `comparison_unavailable`.
--
-- cms_taxonomy_version_resolves(text) is the boolean form the comparison lineage guard and the restore pin check use (an
-- unparseable id does not resolve).  Both functions read forced-RLS tables through the CMS definer, so they set the
-- transaction-local RPC flag for the read and restore the caller's value (SEC-2, PAT-031).  Forward-only.
begin;
set local lock_timeout = '5s';

create function platform_private.cms_resolve_taxonomy_version(p_taxonomy_version_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  prior_flag text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  party_text text := nullif(pg_catalog.current_setting('app.cms_session_party', true), '');
  party_id uuid;
  version_row platform_private.cms_taxonomy_versions%rowtype;
begin
  if party_text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    party_id := party_text::uuid;
  end if;
  if p_taxonomy_version_id is not null and party_id is not null then
    perform pg_catalog.set_config('app.cms_rpc', 'true', true);
    select tv.* into version_row
      from platform_private.cms_taxonomy_versions tv
     where tv.id = p_taxonomy_version_id
       and tv.owner_id = party_id;
    perform pg_catalog.set_config('app.cms_rpc', prior_flag, true);
  end if;
  if version_row.id is null then
    raise exception 'comparison_unavailable' using errcode = 'P0001';
  end if;
  return pg_catalog.jsonb_build_object(
    'taxonomyId', version_row.taxonomy_id,
    'taxonomyKey', version_row.taxonomy_key,
    'taxonomyVersion', version_row.version::text,
    'state', version_row.state,
    'contentHash', pg_catalog.btrim(version_row.content_hash::text)
  );
end;
$body$;

comment on function platform_private.cms_resolve_taxonomy_version(uuid) is
  'BE03c DEC-141 item 1: resolves any taxonomy version id of the published acting party''s owner scope, in any state, to { taxonomyId, taxonomyKey, taxonomyVersion, state, contentHash }; an absent, out-of-scope or null id, or no published party, is the non-disclosing P0001 comparison_unavailable. Private; STABLE; sets and restores app.cms_rpc.';

create function platform_private.cms_taxonomy_version_resolves(p_taxonomy_version_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $body$
begin
  if p_taxonomy_version_id is null
     or p_taxonomy_version_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  perform platform_private.cms_resolve_taxonomy_version(p_taxonomy_version_id::uuid);
  return true;
exception when sqlstate 'P0001' then
  if sqlerrm = 'comparison_unavailable' then return false; end if;
  raise;
end;
$body$;

comment on function platform_private.cms_taxonomy_version_resolves(text) is
  'BE03c DEC-141 item 1: true when cms_resolve_taxonomy_version resolves the recorded id (any state, caller owner scope); false for an unparseable, absent or out-of-scope id. Private; STABLE.';

grant select on table platform_private.cms_taxonomy_versions to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_resolve_taxonomy_version(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_taxonomy_version_resolves(text) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_resolve_taxonomy_version(uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_taxonomy_version_resolves(text)
  from public, anon, authenticated, service_role;

commit;
