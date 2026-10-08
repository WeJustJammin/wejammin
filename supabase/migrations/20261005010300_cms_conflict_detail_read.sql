-- Slice 10 WP-S10-3 (CMS-03B-12, decision D2): protected three-way conflict
-- detail read.
--
-- The read is a bounded, write-free projection of exactly one conflict that
-- belongs to the resolved readable entry.  Authority is server-derived: the
-- caller must present a proven cms.author/cms.editor grant plus an active
-- assignment on the entry, and the acting party must own the entry.  A hidden
-- or absent entry/conflict, or a caller outside the owner tenant, is concealed
-- as NOT_FOUND, while a visible entry the caller cannot read is FORBIDDEN.  The
-- envelope carries no ownership, acting-party, retriever, or resolver identity
-- at any level.
--
-- Preimages are open-only: an `open` conflict carries a bounded per-path
-- three-way projection whose sides carry the stored value, provenance and
-- value hash; a `resolved` or `superseded` record is metadata-only with
-- `paths: []`.  Nothing is mutated, no audit or outbox row is emitted, and the
-- named worker wrapper restores the transaction-local RPC-context flag.
-- Forward-only.

begin;

create or replace function platform_private.cms_get_conflict_detail(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  entry_id uuid;
  conflict_id uuid;
  entry_row platform_private.cms_content_entries%rowtype;
  conflict_row platform_private.cms_conflict_records%rowtype;
  base_row platform_private.cms_entry_revisions%rowtype;
  theirs_row platform_private.cms_entry_revisions%rowtype;
  yours_row platform_private.cms_entry_revisions%rowtype;
  base_ref jsonb;
  theirs_ref jsonb;
  yours_ref jsonb;
  paths jsonb := '[]'::jsonb;
  path_item jsonb;
  path_text text;
  path_field_id uuid;
  side_value jsonb;
  side_provenance text;
  side_hash text;
  base_side jsonb;
  theirs_side jsonb;
  yours_side jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);

  -- The resource is addressed entirely by path: exactly the entry and the
  -- conflict, with only the transport context.  Any other key (an ownership or
  -- authority claim) has no slot and is refused before any lookup.
  if not platform_private.cms_exact_keys(
    p_request,
    array['entryId', 'conflictId']::text[],
    array['entryId', 'conflictId', 'context', 'correlationId']::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;
  if platform_private.cms_valid_uuid(p_request->>'entryId') is not true
     or platform_private.cms_valid_uuid(p_request->>'conflictId') is not true then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  entry_id := (p_request->>'entryId')::uuid;
  conflict_id := (p_request->>'conflictId')::uuid;

  select * into entry_row
  from platform_private.cms_content_entries candidate
  where candidate.id = entry_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Authority: a registered grant keyed to the acting party AND an active
  -- assignment on this entry.  A visible entry the caller cannot read is
  -- refused; a caller outside the owner tenant stays concealed.
  if platform_private.cms_authority_origin(
       actor_id, acting_party_id, 'cms.editor', entry_row.id
     ) is null
     and platform_private.cms_authority_origin(
       actor_id, acting_party_id, 'cms.author', entry_row.id
     ) is null then
    if platform_private.cms_entry_tenant_visible(actor_id, entry_row.owner_id) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- The conflict is loaded by its opaque id only after the entry is readable
  -- and the caller is authorized, so a foreign or absent conflict is concealed
  -- as NOT_FOUND rather than distinguished from a hidden one.
  select * into conflict_row
  from platform_private.cms_conflict_records candidate
  where candidate.id = conflict_id
    and candidate.entry_id = entry_row.id
    and candidate.owner_id = entry_row.owner_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into base_row
  from platform_private.cms_entry_revisions candidate
  where candidate.id = conflict_row.base_revision_id
    and candidate.entry_id = entry_row.id;
  if not found then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  select * into theirs_row
  from platform_private.cms_entry_revisions candidate
  where candidate.id = conflict_row.theirs_revision_id
    and candidate.entry_id = entry_row.id;
  if not found then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if conflict_row.yours_source = 'revision' then
    select * into yours_row
    from platform_private.cms_entry_revisions candidate
    where candidate.id = conflict_row.yours_revision_id
      and candidate.entry_id = entry_row.id;
    if not found then
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;
  elsif conflict_row.yours_source = 'proposed' then
    if conflict_row.proposed_values is null
       or not platform_private.cms_json_bounded(
         conflict_row.proposed_values, 262144, 8, 128, 128
       ) then
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;
  else
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  base_ref := pg_catalog.jsonb_build_object(
    'revisionId', base_row.id,
    'revisionNumber', base_row.revision_number::text,
    'schemaVersionId', base_row.schema_version_id,
    'contentHash', pg_catalog.btrim(base_row.payload_hash::text)
  );
  theirs_ref := pg_catalog.jsonb_build_object(
    'revisionId', theirs_row.id,
    'revisionNumber', theirs_row.revision_number::text,
    'schemaVersionId', theirs_row.schema_version_id,
    'contentHash', pg_catalog.btrim(theirs_row.payload_hash::text)
  );
  yours_ref := pg_catalog.jsonb_build_object(
    'source', conflict_row.yours_source,
    'revisionId', case when conflict_row.yours_source = 'revision'
      then yours_row.id else null end,
    'contentHash', pg_catalog.btrim(conflict_row.yours_hash::text)
  );

  -- Open-only preimages.  A closed record has no divergent paths left, so the
  -- read returns metadata only and never fabricates a side.
  if conflict_row.state = 'open' then
    if pg_catalog.jsonb_typeof(conflict_row.changed_paths) is distinct from 'array'
       or pg_catalog.jsonb_array_length(conflict_row.changed_paths) not between 1 and 128 then
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;
    for path_item in
      select element.value
      from pg_catalog.jsonb_array_elements(conflict_row.changed_paths) element
    loop
      if pg_catalog.jsonb_typeof(path_item) is distinct from 'string' then
        raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
      end if;
      path_text := path_item #>> '{}';
      if pg_catalog.length(path_text) > 256
         or path_text !~ '^/fields/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
      end if;
      path_field_id := pg_catalog.substr(path_text, 9)::uuid;

      side_value := null;
      side_provenance := 'missing';
      side_hash := null;
      select field.value, coalesce(field.provenance::text, 'missing'),
             nullif(pg_catalog.btrim(field.value_hash::text), '')
        into side_value, side_provenance, side_hash
      from platform_private.cms_entry_field_values field
      where field.revision_id = base_row.id
        and field.field_id = path_field_id
        and field.locale = base_row.locale;
      if side_value is not null
         and not platform_private.cms_json_bounded(side_value, 262144, 8, 128, 128) then
        raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
      end if;
      base_side := pg_catalog.jsonb_build_object(
        'value', side_value, 'provenance', side_provenance, 'valueHash', side_hash
      );

      side_value := null;
      side_provenance := 'missing';
      side_hash := null;
      select field.value, coalesce(field.provenance::text, 'missing'),
             nullif(pg_catalog.btrim(field.value_hash::text), '')
        into side_value, side_provenance, side_hash
      from platform_private.cms_entry_field_values field
      where field.revision_id = theirs_row.id
        and field.field_id = path_field_id
        and field.locale = theirs_row.locale;
      if side_value is not null
         and not platform_private.cms_json_bounded(side_value, 262144, 8, 128, 128) then
        raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
      end if;
      theirs_side := pg_catalog.jsonb_build_object(
        'value', side_value, 'provenance', side_provenance, 'valueHash', side_hash
      );

      if conflict_row.yours_source = 'proposed' then
        side_value := conflict_row.proposed_values -> path_field_id::text;
        if side_value is null then
          side_provenance := 'missing';
          side_hash := null;
        elsif side_value = 'null'::jsonb then
          side_provenance := 'explicit_null';
          side_hash := null;
        else
          side_provenance := 'authored';
          side_hash := platform_private.cms_jcs_sha256(side_value)::text;
        end if;
        if side_value is not null
           and not platform_private.cms_json_bounded(side_value, 262144, 8, 128, 128) then
          raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
        end if;
      else
        side_value := null;
        side_provenance := 'missing';
        side_hash := null;
        select field.value, coalesce(field.provenance::text, 'missing'),
               nullif(pg_catalog.btrim(field.value_hash::text), '')
          into side_value, side_provenance, side_hash
        from platform_private.cms_entry_field_values field
        where field.revision_id = yours_row.id
          and field.field_id = path_field_id
          and field.locale = yours_row.locale;
        if side_value is not null
           and not platform_private.cms_json_bounded(side_value, 262144, 8, 128, 128) then
          raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
        end if;
      end if;
      yours_side := pg_catalog.jsonb_build_object(
        'value', side_value, 'provenance', side_provenance, 'valueHash', side_hash
      );

      paths := paths || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'path', path_text,
        'base', base_side,
        'theirs', theirs_side,
        'yours', yours_side
      ));
      if pg_catalog.jsonb_array_length(paths) > 128 then
        raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
      end if;
    end loop;
  end if;

  return pg_catalog.jsonb_build_object(
    'conflict', pg_catalog.jsonb_build_object(
      'id', conflict_row.id,
      'version', conflict_row.version::text,
      'createdAt', platform_private.auth_iso_time(conflict_row.created_at),
      'updatedAt', platform_private.auth_iso_time(conflict_row.updated_at),
      'state', conflict_row.state::text,
      'changedPaths', conflict_row.changed_paths,
      'conflictHash', pg_catalog.btrim(conflict_row.conflict_hash::text)
    ),
    'entry', pg_catalog.jsonb_build_object(
      'id', entry_row.id,
      'version', entry_row.version::text,
      'createdAt', platform_private.auth_iso_time(entry_row.created_at),
      'updatedAt', platform_private.auth_iso_time(entry_row.updated_at)
    ),
    'base', base_ref,
    'theirs', theirs_ref,
    'yours', yours_ref,
    'paths', paths,
    'resolvedRevisionId', conflict_row.resolved_revision_id
  );
end;
$body$;

comment on function platform_private.cms_get_conflict_detail(jsonb) is
  'CMS-03B-12 protected three-way conflict-detail read. Requires a server-derived cms.editor/cms.author grant plus an active entry assignment and entry-owning acting party; returns the bounded base/theirs/yours preimages only while the conflict is open, conceals a hidden or absent entry/conflict as NOT_FOUND, never serializes an ownership or resolver identifier, and writes nothing.';

-- SEC-2: the private conflict-detail reader names forced-RLS tables
-- (cms_content_entries, cms_conflict_records, cms_entry_revisions and
-- cms_entry_field_values), so it is owned by the non-BYPASSRLS definer role and
-- the forced policies apply to every statement it runs.  The definer already
-- holds every table verb and every callee the body needs
-- (20261003120100_cms_definer_privileges.sql), so no new grant is required;
-- ALTER FUNCTION ... OWNER TO only needs CREATE on the schema for the length of
-- this transaction.
grant create on schema platform_private to wejammin_cms_definer;

alter function platform_private.cms_get_conflict_detail(jsonb)
  owner to wejammin_cms_definer;

revoke create on schema platform_private from wejammin_cms_definer;

-- The browser-facing named RPC stays service-role only; the wrapper restores
-- the transaction-local RPC-context flag to its prior value so the read cannot
-- leak the write gate into the rest of the transaction.
create or replace function platform_api.cms_get_conflict_detail(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_get_conflict_detail(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

revoke all on function platform_api.cms_get_conflict_detail(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_get_conflict_detail(jsonb) to service_role;

revoke all on function platform_private.cms_get_conflict_detail(jsonb)
  from public, anon, authenticated, service_role;

commit;
