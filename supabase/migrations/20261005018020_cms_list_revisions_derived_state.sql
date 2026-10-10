-- Slice 11 lane S11-3d, BE03b "Derived revision workflow state (E2)" (tracker
-- P2-S11-AC-085, P2-S11-AC-086): the CMS-03B-03 revision history projects and
-- filters the DERIVED EntryRevisionState.
--
-- The summary `state` was copied from the physical cms_entry_revisions.state (the
-- constant `draft`, 20261005018090) and the `state` filter compared that column.
-- Both now come from platform_private.cms_revision_effective_states, the set form
-- of the one E2 helper:
--
--   * candidates are read in keyset order (revision_number DESC, id DESC) in
--     batches; the derived state of a batch is computed once, for exactly the
--     candidates of that batch;
--   * a request WITHOUT a state filter reads batches of limit + 1 candidates and
--     behaves as before (concealed rows advance the scan, has_more is decided by
--     the first visible row beyond the window);
--   * a request WITH a state filter reads batches of 200 candidates and returns up
--     to `limit` matching rows; it scans at most 1,000 candidates (concealed ones
--     count: a cursor must not become a probe).  Reaching that bound returns the rows
--     found with a cursor positioned after the last scanned candidate, so a filtered
--     page may be shorter than `limit` while nextCursor is non-null; when the probe
--     for the (limit + 1)th match succeeds first, the cursor stays after the last
--     RETURNED row and the probe is read again by the next page;
--   * the cursor payload ({queryHash, lastRevisionNumber, lastRevisionId, expiresAt}),
--     the sort and the signed envelope never depend on the derived state.  This reader
--     answers the payload UNSIGNED and in the clear; a filtered request's bound-ending
--     cursor can name a concealed candidate, so the caller-facing wrapper
--     cms_list_revisions_signed seals the cursor of every request that names a `state`
--     (authenticated encryption, 20261010161000 and 20261010161100);
--   * the concealment classifier is handed the derived state it needs (the
--     four-argument form of cms_revision_page_disposition, 20261005018000).
--
-- The rest of the body (authority, request validation, the cursor checks, the
-- comparison) is the 20261005010400 definition unchanged.  CREATE OR REPLACE keeps
-- the owner, the search_path, the grants and the SEC-2 table grants.  Forward-only.
begin;

create or replace function platform_private.cms_list_revisions(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  resolved_acting_party_id uuid;
  entry_row platform_private.cms_content_entries%rowtype;
  target_entry_id uuid;
  requested_state text;
  requested_locale text;
  compare_revision_id uuid;
  limit_value integer := 25;
  limit_input text;
  cursor_text text;
  cursor_value jsonb;
  cursor_expires bigint;
  cursor_last_number bigint;
  cursor_last_id uuid;
  query_hash text;
  capability_candidate text;
  authorized_capability text;
  revision_row platform_private.cms_entry_revisions;
  compared_revision_row platform_private.cms_entry_revisions%rowtype;
  newest_revision_row platform_private.cms_entry_revisions%rowtype;
  rows_seen integer := 0;
  has_more boolean := false;
  cursor_revision_number bigint;
  cursor_revision_id uuid;
  next_cursor text;
  page_items jsonb := '[]'::jsonb;
  left_id uuid;
  right_id uuid;
  left_payload jsonb;
  right_payload jsonb;
  left_blocks jsonb;
  right_blocks jsonb;
  left_relations jsonb;
  right_relations jsonb;
  left_map jsonb;
  right_map jsonb;
  relation_key_hex text;
  relation_key bytea;
  compare_changes jsonb := '[]'::jsonb;
  active_version_id uuid;
  active_version_count integer;
  chain_derived jsonb;
  chain_plan_ids jsonb;
  chain_edge_count integer := 0;
  chain_availability text;
  chain_hash text;
  restore_descriptor jsonb;
  -- E2 walk state.  A state filter is evaluated over keyset candidates read in
  -- batches of batch_size; a filtered request scans at most scan_bound candidates.
  scan_bound constant integer := 1000;
  batch_size constant integer := 200;
  fetch_size integer;
  walk_number bigint;
  walk_id uuid;
  batch_ids uuid[];
  batch_states jsonb;
  candidate_state text;
  scanned integer := 0;
  bound_reached boolean := false;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  resolved_acting_party_id := platform_private.cms_acting_party(p_request, actor_id);

  -- Request shape: entryId is required; cursor/limit/state/compareRevisionId/
  -- locale are the only accepted filters.  context and correlationId are
  -- control fields, never authority.
  if not platform_private.cms_exact_keys(
    p_request,
    array['entryId']::text[],
    array[
      'entryId', 'cursor', 'limit', 'state', 'compareRevisionId', 'locale',
      'context', 'correlationId'
    ]::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;

  if not platform_private.cms_valid_uuid(p_request->>'entryId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  target_entry_id := (p_request->>'entryId')::uuid;

  if p_request ? 'state'
     and p_request->'state' <> 'null'::jsonb
     and coalesce(p_request->>'state', '') not in (
       'draft', 'submitted', 'approved', 'rejected', 'scheduled', 'published'
     ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  requested_state := case
    when p_request->'state' = 'null'::jsonb then null
    else p_request->>'state'
  end;

  if p_request ? 'locale'
     and p_request->'locale' <> 'null'::jsonb
     and coalesce(p_request->>'locale', '') !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  requested_locale := case
    when p_request->'locale' = 'null'::jsonb then null
    else p_request->>'locale'
  end;

  if p_request ? 'compareRevisionId'
     and p_request->'compareRevisionId' <> 'null'::jsonb then
    if not platform_private.cms_valid_uuid(p_request->>'compareRevisionId') then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    compare_revision_id := (p_request->>'compareRevisionId')::uuid;
  end if;

  -- limit is a query bound, not a malformed selector: an out-of-range window is
  -- a 422 VALIDATION_FAILED, matching the registry's query-bounds column rather
  -- than the malformed-query 400.
  if p_request ? 'limit' and p_request->'limit' <> 'null'::jsonb then
    limit_input := p_request->>'limit';
    if limit_input is null
       or limit_input !~ '^[0-9]{1,2}$'
       or (limit_input::integer) not between 1 and 50 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    limit_value := limit_input::integer;
  end if;

  if p_request ? 'cursor' then
    cursor_text := nullif(p_request->>'cursor', '');
  end if;
  if cursor_text is not null
     and pg_catalog.octet_length(cursor_text) not between 1 and 512 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  select * into entry_row
  from platform_private.cms_content_entries candidate
  where candidate.id = target_entry_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Authority: a registered grant keyed to the acting party AND an active
  -- assignment on this entry.  A caller that presents a capability key without
  -- the grant/assignment is refused exactly like a caller that presents none.
  authorized_capability := null;
  foreach capability_candidate in array
    platform_private.cms_revision_reader_capabilities()
  loop
    if platform_private.cms_authority_origin(
         actor_id, resolved_acting_party_id, capability_candidate, target_entry_id
       ) is not null then
      authorized_capability := capability_candidate;
      exit;
    end if;
  end loop;
  if authorized_capability is null then
    if platform_private.cms_entry_tenant_visible(actor_id, entry_row.owner_id) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Cursor envelope: {queryHash, lastRevisionNumber, lastRevisionId, expiresAt}.
  -- queryHash binds the cursor to the exact actor, acting party, entry, filters,
  -- and window, so a cursor cannot be replayed against another context.
  query_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'actorId', actor_id::text,
    'actingPartyId', resolved_acting_party_id::text,
    'entryId', target_entry_id::text,
    'state', requested_state,
    'locale', requested_locale,
    'compareRevisionId', compare_revision_id::text,
    'limit', limit_value::text
  ));

  if cursor_text is not null then
    begin
      cursor_value := pg_catalog.convert_from(
        pg_catalog.decode(cursor_text, 'base64'), 'utf8'
      )::jsonb;
    exception
      when others then
        raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;

    if not platform_private.cms_exact_keys(
      cursor_value,
      array['queryHash', 'lastRevisionNumber', 'lastRevisionId', 'expiresAt']::text[],
      array['queryHash', 'lastRevisionNumber', 'lastRevisionId', 'expiresAt']::text[]
    ) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;

    -- A cursor whose shape is wrong is malformed (400).  A cursor that is
    -- well-formed but bound to another actor, party, entry, filter set, or
    -- window, or that has expired, is a cursor/context mismatch (409), exactly
    -- as the registry error matrix separates the two.
    if coalesce(cursor_value->>'queryHash', '') is distinct from query_hash
       or not platform_private.cms_valid_version(cursor_value->>'lastRevisionNumber')
       or not platform_private.cms_valid_uuid(cursor_value->>'lastRevisionId')
       or coalesce(cursor_value->>'expiresAt', '') !~ '^[0-9]{1,12}$' then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;

    cursor_expires := (cursor_value->>'expiresAt')::bigint;
    cursor_last_number := (cursor_value->>'lastRevisionNumber')::bigint;
    cursor_last_id := (cursor_value->>'lastRevisionId')::uuid;

    if cursor_expires <= pg_catalog.floor(
         pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
       )::bigint then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
  end if;

  -- The comparison target is resolved before pagination so an unreadable or
  -- off-entry target is a 404 regardless of which window was requested.
  if compare_revision_id is not null then
    select * into compared_revision_row
    from platform_private.cms_entry_revisions candidate
    where candidate.id = compare_revision_id;
    if not found then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    if compared_revision_row.entry_id <> target_entry_id then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    if platform_private.cms_revision_page_disposition(
         actor_id, resolved_acting_party_id, compared_revision_row
       ) = 'absent' then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
  end if;

  -- Keyset walk: descending (revision_number, id).  Candidates are read in
  -- batches (batch_size under a state filter, limit + 1 otherwise) and the
  -- EntryRevisionState of each batch is derived with the one E2 helper (set form), so
  -- the cursor and the sort never depend on the derived state.  Concealed rows still
  -- advance the scan (a cursor must not become a probe), so has_more is decided
  -- only by the first row the caller is allowed to see (and, under a state filter,
  -- that matches) beyond the window.  A request that names a state scans at most
  -- scan_bound candidates, concealed ones included; on reaching that bound it answers
  -- the rows found with a cursor positioned after the last scanned candidate, so a
  -- filtered page may be shorter than the limit while nextCursor is non-null.
  walk_number := cursor_last_number;
  walk_id := cursor_last_id;
  <<walk>>
  loop
    fetch_size := case
      when requested_state is null then limit_value + 1
      else least(batch_size, scan_bound - scanned)
    end;
    select pg_catalog.array_agg(
             window_row.id order by window_row.revision_number desc, window_row.id desc
           )
      into batch_ids
    from (
      select candidate.id, candidate.revision_number
      from platform_private.cms_entry_revisions candidate
      where candidate.entry_id = target_entry_id
        and (requested_locale is null or candidate.locale = requested_locale)
        and (
          walk_number is null
          or candidate.revision_number < walk_number
          or (
            candidate.revision_number = walk_number
            and candidate.id < walk_id
          )
        )
      order by candidate.revision_number desc, candidate.id desc
      limit fetch_size
    ) window_row;
    exit walk when batch_ids is null;

    select coalesce(
             pg_catalog.jsonb_object_agg(derived.revision_id::text, derived.state),
             '{}'::jsonb
           )
      into batch_states
    from platform_private.cms_revision_effective_states(batch_ids) derived;

    for revision_row in
      select candidate.*
      from pg_catalog.unnest(batch_ids) with ordinality as listed(id, ord)
      join platform_private.cms_entry_revisions candidate on candidate.id = listed.id
      order by listed.ord
    loop
      scanned := scanned + 1;
      walk_number := revision_row.revision_number;
      walk_id := revision_row.id;
      candidate_state := batch_states->>(revision_row.id::text);
      if candidate_state is null then
        raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
      end if;

      if platform_private.cms_revision_page_disposition(
           actor_id, resolved_acting_party_id, revision_row, candidate_state
         ) = 'absent' then
        continue;
      end if;
      if requested_state is not null and candidate_state <> requested_state then
        continue;
      end if;

      if rows_seen >= limit_value then
        has_more := true;
        exit walk;
      end if;
      rows_seen := rows_seen + 1;
      cursor_revision_number := revision_row.revision_number;
      cursor_revision_id := revision_row.id;

      page_items := page_items || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'id', revision_row.id,
          'revisionNumber', revision_row.revision_number::text,
          'locale', revision_row.locale,
          'state', candidate_state,
          'contentHash', platform_private.cms_revision_content_hash(
            revision_row.id,
            revision_row.payload_hash::text,
            revision_row.locale,
            revision_row.schema_version_id
          ),
          'createdAt', platform_private.auth_iso_time(revision_row.created_at),
          'authorClass', platform_private.cms_revision_author_class(
            revision_row.entry_id, revision_row.author_person_id
          )
        )
      );
    end loop;

    -- A short batch means the candidates are exhausted.
    exit walk when pg_catalog.cardinality(batch_ids) < fetch_size;

    -- The scan bound of a filtered request.
    if requested_state is not null and scanned >= scan_bound then
      if exists (
        select 1
        from platform_private.cms_entry_revisions beyond
        where beyond.entry_id = target_entry_id
          and (requested_locale is null or beyond.locale = requested_locale)
          and (
            beyond.revision_number < walk_number
            or (beyond.revision_number = walk_number and beyond.id < walk_id)
          )
      ) then
        has_more := true;
        bound_reached := true;
      end if;
      exit walk;
    end if;
  end loop;

  if has_more then
    if bound_reached then
      cursor_revision_number := walk_number;
      cursor_revision_id := walk_id;
    end if;
    next_cursor := pg_catalog.replace(
      pg_catalog.encode(
        pg_catalog.convert_to(
          platform_private.cms_jcs(pg_catalog.jsonb_build_object(
            'queryHash', query_hash,
          'lastRevisionNumber', cursor_revision_number::text,
          'lastRevisionId', cursor_revision_id::text,
            'expiresAt', (
              pg_catalog.floor(
                pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
              ) + 86400
            )::bigint::text
          )),
          'utf8'
        ),
        'base64'
      ),
      E'\n', ''
    );
    -- A cursor that cannot fit the 512-character contract is withheld rather
    -- than truncated; the client re-reads the first window instead.
    if pg_catalog.octet_length(next_cursor) > 512 then
      next_cursor := null;
      has_more := false;
    end if;
  end if;

  if compare_revision_id is null then
    return pg_catalog.jsonb_build_object(
      'items', page_items,
      'nextCursor', next_cursor,
      'pageVersion', entry_row.version::text,
      'compare', null
    );
  end if;

  -- The right side of the comparison is the newest readable revision on the
  -- entry that matches the requested locale.  The state filter is deliberately
  -- not applied: state is a window filter for the history list, and narrowing
  -- the comparison side to it would silently change what "latest" means.
  select * into newest_revision_row
  from platform_private.cms_entry_revisions candidate
  where candidate.entry_id = target_entry_id
    and (requested_locale is null or candidate.locale = requested_locale)
    and platform_private.cms_revision_page_disposition(
          actor_id, resolved_acting_party_id, candidate
        ) = 'visible'
  order by candidate.revision_number desc, candidate.id desc
  limit 1;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- An unresolvable recorded lineage on either side is a non-disclosing
  -- refusal: the comparison cannot be computed safely, so it is not fabricated.
  -- Each side must belong to this entry and owner, record a schema version of
  -- the entry's content type whose compiled artifact hash equals the recorded
  -- definition hash, and resolve every active block through the 03a registry.
  if not platform_private.cms_compare_revision_resolvable(
       target_entry_id, compared_revision_row.id
     )
     or not platform_private.cms_compare_revision_resolvable(
       target_entry_id, newest_revision_row.id
     ) then
    raise exception 'comparison_unavailable' using errcode = 'P0001';
  end if;

  left_id := compared_revision_row.id;
  right_id := newest_revision_row.id;

  left_payload := platform_private.cms_revision_field_payload(
    left_id, compared_revision_row.locale, compared_revision_row.schema_version_id
  );
  right_payload := platform_private.cms_revision_field_payload(
    right_id, newest_revision_row.locale, newest_revision_row.schema_version_id
  );

  -- The relation token reuses the Vault-held history-signing key with the
  -- cms.compare.relation.v1 domain separator (no new secret).  It is only
  -- required when the entry actually carries relations; a missing key with
  -- relations present is a non-disclosing refusal.
  select secret.decrypted_secret
    into relation_key_hex
  from vault.decrypted_secrets secret
  where secret.name = 'cms_editorial_history_cursor_active'
  limit 1;
  if relation_key_hex is not null and relation_key_hex ~ '^[0-9a-f]{64}$' then
    relation_key := pg_catalog.decode(relation_key_hex, 'hex');
  end if;
  if exists (
       select 1
       from platform_private.cms_entry_relations relation_row
       where relation_row.revision_id in (left_id, right_id)
     ) then
    if relation_key is null then
      raise exception 'comparison_unavailable' using errcode = 'P0001';
    end if;
    -- Relation lineage: the stored relation must resolve, through its field
    -- definition version, to the stable field it is keyed by on the schema
    -- version its revision recorded, and that definition must carry a
    -- relation definition.  The comparison key stays the stable field id; the
    -- version-specific definition id is never part of the path.
    if exists (
         select 1
         from platform_private.cms_entry_relations relation_row
         join platform_private.cms_entry_revisions relation_revision
           on relation_revision.id = relation_row.revision_id
         where relation_row.revision_id in (left_id, right_id)
           and not exists (
             select 1
             from platform_private.cms_field_definition_versions field_row
             join platform_private.cms_relation_definitions definition_row
               on definition_row.field_definition_id = field_row.id
             where field_row.id = relation_row.field_definition_id
               and field_row.stable_field_id = relation_row.field_id
               and field_row.content_type_version_id
                 = relation_revision.schema_version_id
           )
       ) then
      raise exception 'comparison_unavailable' using errcode = 'P0001';
    end if;
  end if;

  -- Block side map: JCS hash of the locked {blockKey, blockVersion,
  -- blockRegistryDigest, mode, patternRef, props, bindings} input, keyed by the
  -- composition instance path.  The registry digest and bindings are folded
  -- into the digest; no target identity is ever included.  Two active
  -- instances on one path would silently collapse into one map entry, and a
  -- path whose /blocks/<path> pointer cannot fit the 256-character JsonPointer
  -- contract could never be returned intact, so each is a non-disclosing
  -- refusal rather than a hidden or truncated change.
  if exists (
       select 1
       from platform_private.cms_composition_instances instance
       where instance.revision_id in (left_id, right_id)
         and instance.state = 'active'
       group by instance.revision_id, instance.path
       having pg_catalog.count(*) > 1
     )
     or exists (
       select 1
       from platform_private.cms_composition_instances instance
       where instance.revision_id in (left_id, right_id)
         and instance.state = 'active'
         and pg_catalog.octet_length('/blocks/' || instance.path) > 256
     ) then
    raise exception 'comparison_unavailable' using errcode = 'P0001';
  end if;
  select
    coalesce(pg_catalog.jsonb_object_agg(block_side.path, block_side.side_hash)
      filter (where block_side.revision_id = left_id), '{}'::jsonb),
    coalesce(pg_catalog.jsonb_object_agg(block_side.path, block_side.side_hash)
      filter (where block_side.revision_id = right_id), '{}'::jsonb)
  into left_blocks, right_blocks
  from (
    select instance.revision_id,
           '/blocks/' || instance.path as path,
           platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
             'blockKey', instance.block_key,
             'blockVersion', instance.block_version,
             'blockRegistryDigest',
               pg_catalog.btrim(instance.block_registry_digest::text),
             'mode', instance.link_mode,
             'patternRef', case
               when instance.pattern_id is null then null
               else pg_catalog.jsonb_build_object(
                 'patternId', instance.pattern_id,
                 'patternVersion', instance.pattern_version
               )
             end,
             'props', instance.props,
             'bindings', instance.bindings
           )) as side_hash
    from platform_private.cms_composition_instances instance
    where instance.revision_id in (left_id, right_id)
      and instance.state = 'active'
  ) block_side;

  -- Relation side map: keyed by the stable field id and the keyed targetToken
  -- (HMAC-SHA-256 over the JCS of {entryId, fieldId, targetKind, targetId} with
  -- the cms.compare.relation.v1 separator), never a raw target identity.  The
  -- same relation yields the same token on both sides of one read, so an
  -- unchanged relation compares as unchanged.  The side hash is the JCS hash
  -- of the locked {relationDefinitionVersion, position, expectedTargetVersion}
  -- input and never folds a target identity into the digest.
  select
    coalesce(pg_catalog.jsonb_object_agg(relation_side.path, relation_side.side_hash)
      filter (where relation_side.revision_id = left_id), '{}'::jsonb),
    coalesce(pg_catalog.jsonb_object_agg(relation_side.path, relation_side.side_hash)
      filter (where relation_side.revision_id = right_id), '{}'::jsonb)
  into left_relations, right_relations
  from (
    select relation_row.revision_id,
           '/relations/' || relation_row.field_id::text || '/'
             || platform_private.cms_compare_relation_token(
                  'cms.compare.relation.v1',
                  relation_key,
                  target_entry_id,
                  relation_row.field_id,
                  relation_row.target_kind,
                  relation_row.target_id
                ) as path,
           platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
             'relationDefinitionVersion', (
               select definition_row.version
               from platform_private.cms_relation_definitions definition_row
               where definition_row.field_definition_id
                 = relation_row.field_definition_id
               order by definition_row.version desc
               limit 1
             ),
             'position', relation_row.position,
             'expectedTargetVersion', relation_row.expected_target_version
           )) as side_hash
    from platform_private.cms_entry_relations relation_row
    where relation_row.revision_id in (left_id, right_id)
  ) relation_side;

  -- The field projection is keyed by the stable field id; the locked compare
  -- path namespaces it as /fields/<stableFieldId> so the domain classifier and
  -- the bytewise ordering see a field pointer rather than a bare id (which would
  -- otherwise be classified into the relation domain).  jsonb_each preserves an
  -- explicit-null value as JSON null, so a declared-null field keeps a null side
  -- hash instead of a fabricated digest.
  left_map := coalesce((
    select pg_catalog.jsonb_object_agg(
      '/fields/' || field_key.key, field_key.value
    )
    from pg_catalog.jsonb_each(left_payload) as field_key(key, value)
  ), '{}'::jsonb) || left_blocks || left_relations;
  right_map := coalesce((
    select pg_catalog.jsonb_object_agg(
      '/fields/' || field_key.key, field_key.value
    )
    from pg_catalog.jsonb_each(right_payload) as field_key(key, value)
  ), '{}'::jsonb) || right_blocks || right_relations;

  -- A semantic linear change list keyed by the stable pointer path across all
  -- three domains.  Only the pointer and the two safe hashes are exposed: no
  -- value and no target identity.  left is the explicitly requested
  -- compareRevisionId and right is the newest readable revision, so kind=added
  -- means the item exists only on the newer side.  Ordering is by domain
  -- (field, block, relation) then path, bytewise.
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'domain', change_key.domain,
      'path', change_key.path,
      'kind', case
        when left_map ? change_key.path
         and right_map ? change_key.path
         and left_map->change_key.path
             is distinct from right_map->change_key.path then 'changed'
        when left_map ? change_key.path
         and right_map ? change_key.path then 'unchanged'
        when right_map ? change_key.path then 'added'
        else 'removed'
      end,
      'leftHash', case
        when left_map ? change_key.path
          then left_map->change_key.path #>> '{}'
        else null
      end,
      'rightHash', case
        when right_map ? change_key.path
          then right_map->change_key.path #>> '{}'
        else null
      end
    ) order by change_key.domain_rank, change_key.path collate "C"
  ), '[]'::jsonb) into compare_changes
  from (
    select path_key.path,
           case
             when path_key.path like '/fields/%' then 'field'
             when path_key.path like '/blocks/%' then 'block'
             else 'relation'
           end as domain,
           case
             when path_key.path like '/fields/%' then 1
             when path_key.path like '/blocks/%' then 2
             else 3
           end as domain_rank
    from (
      select pg_catalog.jsonb_object_keys(left_map) as path
      union
      select pg_catalog.jsonb_object_keys(right_map) as path
    ) path_key
  ) change_key;

  if pg_catalog.jsonb_array_length(compare_changes) > 512 then
    raise exception 'comparison_too_large' using errcode = 'P0001';
  end if;

  -- D6 restore descriptor for leftRevisionId, derived through the SAME
  -- canonical chain helpers the restore command (20261005010500) re-derives
  -- from, so a compare-issued migrationChainId always equals the identity
  -- restore requires.  Zero edges is a genuine same-schema restore.  The
  -- descriptor is fail-closed: more or fewer than one active version, an
  -- active version whose compiled artifact does not verify, or an ambiguous,
  -- unreachable or over-64-edge path is chain_unavailable, and a plan without a
  -- registered transform is transform_missing; nothing is fabricated.
  select pg_catalog.count(*)::integer,
         (pg_catalog.array_agg(version_row.id))[1]
    into active_version_count, active_version_id
  from platform_private.cms_content_type_versions version_row
  where version_row.content_type_id = entry_row.content_type_id
    and version_row.state::text = 'active';
  if active_version_count <> 1 then
    active_version_id := null;
  end if;

  chain_derived := null;
  if active_version_id is not null
     and platform_private.cms_compare_version_resolvable(
       target_entry_id, active_version_id
     ) then
    chain_derived := platform_private.cms_restore_chain_derive(
      entry_row.content_type_id,
      compared_revision_row.schema_version_id,
      active_version_id
    );
  end if;

  if chain_derived is null then
    chain_availability := 'chain_unavailable';
    chain_plan_ids := '[]'::jsonb;
    chain_edge_count := 0;
    chain_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
      'contentTypeId', entry_row.content_type_id,
      'sourceSchemaVersionId', compared_revision_row.schema_version_id,
      'targetSchemaVersionId', active_version_id,
      'planIds', chain_plan_ids
    ));
  else
    chain_availability := 'available';
    chain_plan_ids := chain_derived->'planIds';
    chain_edge_count := (chain_derived->>'edgeCount')::integer;
    chain_hash := chain_derived->>'hash';
    if exists (
      select 1
      from pg_catalog.jsonb_array_elements_text(chain_plan_ids) as member(plan_id)
      join platform_private.cms_schema_migration_plans plan_row
        on plan_row.id = member.plan_id::uuid
      where plan_row.transform_key is not null
        and not exists (
          select 1
          from platform_private.cms_schema_transform_registry registry_row
          where registry_row.transform_key = plan_row.transform_key
            and registry_row.transform_version = plan_row.transform_version
        )
    ) then
      chain_availability := 'transform_missing';
    end if;
  end if;

  restore_descriptor := pg_catalog.jsonb_build_object(
    'migrationChainId', platform_private.cms_restore_chain_manifest_id(chain_hash),
    'edgeCount', chain_edge_count,
    'chainHash', chain_hash,
    'availability', chain_availability
  );

  return pg_catalog.jsonb_build_object(
    'items', page_items,
    'nextCursor', next_cursor,
    'pageVersion', entry_row.version::text,
    'compare', pg_catalog.jsonb_build_object(
      'leftRevisionId', compared_revision_row.id,
      'rightRevisionId', newest_revision_row.id,
      'restore', restore_descriptor,
      'changes', compare_changes
    )
  );
end;
$body$;

comment on function platform_private.cms_list_revisions(jsonb) is
  'CMS-03B-03 safe revision history and schema-aware comparison.  Authority is server-derived (registered grant keyed to the resolved acting party plus an active entry assignment); a hidden entry is NOT_FOUND and a visible one the caller cannot read is FORBIDDEN.  Each summary carries the DERIVED EntryRevisionState (cms_revision_effective_states, BE03b E2); a state filter is evaluated over keyset candidates read in batches of 200 and scans at most 1,000 candidates per request, answering the rows found with a cursor after the last scanned candidate when the bound is reached.  The comparison covers the field, block and relation domains with domain/path/kind/leftHash/rightHash changes ordered by domain then path; relation paths use the keyed cms.compare.relation.v1 targetToken and never expose a target identity.  More than 512 combined changes is comparison_too_large and an unresolvable recorded version is comparison_unavailable, never a truncated 200.  compare.restore carries the derived migrationChainId/edgeCount/chainHash/availability descriptor.  No row is written and no audit or outbox event is emitted.';

commit;
