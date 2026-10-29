-- Slice 12 lane taxonomy-integrity: BE03c "Receiving obligations from Slice 10 (DEC-141)" item 3, restore translation of term
-- assignments (P2-S12-AC-244; BE03b Recorded taxonomy and composition references in comparison and restore (3)).
--
-- cms_restore_revision carries each `active` TermAssignment of the source revision (the highest version of each (field, term) pair,
-- read when `active`) to the new draft revision: an assignment to an `active` or `deprecated` term carries unchanged (same term,
-- position, provenance); a `merged` term is re-pointed to its surviving successor (the chain is followed to the terminal
-- survivor; two sources that merged into one survivor collapse to one assignment at the smaller position); an unknown term (absent
-- or of another owner), a term of a vocabulary whose active version does not list the entry content type key and the field key
-- (other-vocabulary: the same vocabulary rule the write encoder applies, with `deprecated` tolerated), a term of a vocabulary
-- with no active version, a source assignment whose field is no longer an active taxonomy field of
-- the target schema, or a non-empty taxonomy value with no source assignment fails the whole restore with
-- 409 `migration_chain_incomplete` (nothing is fabricated).  The new revision's taxonomy_version_ids are the carried vocabularies'
-- CURRENT active version ids (the assignment rows themselves name each term's write-version, which the stored foreign key pins); a source-recorded version of a vocabulary that has no carried assignment keeps its recorded id
-- (BOUNDARY: 03c states the rule for assignments only).  The restored field value is the carried terms in position order.
-- cms_restore_source_side_valid no longer blanket-refuses a taxonomy value (media still fails closed).
-- The pin check resolves each recorded version through cms_taxonomy_version_resolves.  Forward-only.
begin;
set local lock_timeout = '5s';

do $guard$
begin
  if (select pg_catalog.md5(proc.prosrc) from pg_catalog.pg_proc proc
       where proc.oid = pg_catalog.to_regprocedure('platform_private.cms_restore_source_side_valid(uuid,uuid,jsonb,text)'))
     is distinct from '4d478a7763949f94dcb1e3c4bbbedbb3' then
    raise exception 'cms_restore_source_side_valid is not the expected predecessor body' using errcode = '55000';
  end if;
end;
$guard$;

create or replace function platform_private.cms_restore_source_side_valid(
  p_schema_version_id uuid,
  p_field_id uuid,
  p_value jsonb,
  p_provenance text
)
returns boolean
language plpgsql
stable
set search_path = ''
as $body$
declare
  field_row platform_private.cms_field_definition_versions%rowtype;
begin
  if p_schema_version_id is null or p_field_id is null or p_provenance is null then
    return false;
  end if;
  select * into field_row
  from platform_private.cms_field_definition_versions field
  where field.content_type_version_id = p_schema_version_id
    and field.stable_field_id = p_field_id
    and field.state = 'active';
  if not found then
    return false;
  end if;
  if field_row.validator_key is not null
     and not platform_private.cms_validator_registry_valid(
       field_row.validator_key, field_row.validator_version
     ) then
    return false;
  end if;
  -- DEC-141 item 3: a taxonomy value is shape-checked here and its terms are translated by
  -- cms_restore_term_plan; only media still fails closed until its provider exists.
  if p_value is not null
     and pg_catalog.jsonb_typeof(p_value) <> 'null'
     and field_row.kind = 'media' then
    return false;
  end if;
  return coalesce(
    platform_private.cms_draft_field_value_valid(
      p_schema_version_id, p_field_id, p_value, p_provenance
    ),
    false
  );
end;
$body$;

comment on function platform_private.cms_restore_source_side_valid(uuid, uuid, jsonb, text) is
  'Restore per-value revalidation seam: one source value typed against the TARGET schema version field definition (rich_text.v1, DEC-133 object, relation, list, scalar and taxonomy encodings) through the shared draft value gate; a media value fails closed until its provider exists (a taxonomy value''s terms are translated by cms_restore_term_plan, DEC-141). Read-only.';

create function platform_private.cms_restore_term_plan(
  p_owner_id uuid, p_source_revision_id uuid, p_target_version_id uuid, p_values jsonb
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $body$
declare
  source_row record;
  target_field record;
  current_term platform_private.cms_terms%rowtype;
  recorded_version platform_private.cms_taxonomy_versions%rowtype;
  active_version platform_private.cms_taxonomy_versions%rowtype;
  v_type_key text;
  hops integer;
  rows_json jsonb := '[]'::jsonb;
  values_json jsonb := coalesce(p_values, '{}'::jsonb);
  field_terms jsonb;
  version_ids jsonb := '[]'::jsonb;
  lineages uuid[] := array[]::uuid[];
  pin record;
begin
  select content_type.type_key into v_type_key
    from platform_private.cms_content_type_versions type_version
    join platform_private.cms_content_types content_type on content_type.id = type_version.content_type_id
   where type_version.id = p_target_version_id and type_version.owner_id = p_owner_id;
  -- Every source assignment must belong to an active taxonomy field of the target schema.
  if exists (
    select 1
      from platform_private.cms_term_assignments stored
      join platform_private.cms_field_definition_versions old_field on old_field.id = stored.field_definition_id
     where stored.revision_id = p_source_revision_id
       and not exists (
         select 1 from platform_private.cms_field_definition_versions target
          where target.content_type_version_id = p_target_version_id
            and target.stable_field_id = old_field.stable_field_id
            and target.state = 'active' and target.kind = 'taxonomy')
  ) then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;

  for target_field in
    select field.id, field.stable_field_id, field.field_key
      from platform_private.cms_field_definition_versions field
     where field.content_type_version_id = p_target_version_id
       and field.state = 'active' and field.kind = 'taxonomy'
     order by field.stable_field_id
  loop
    field_terms := '[]'::jsonb;
    for source_row in
      select current_row.term_id, current_row.taxonomy_version_id, current_row.position, current_row.provenance
        from (
          select distinct on (stored.field_definition_id, stored.term_id) stored.*
            from platform_private.cms_term_assignments stored
            join platform_private.cms_field_definition_versions old_field on old_field.id = stored.field_definition_id
           where stored.revision_id = p_source_revision_id
             and old_field.stable_field_id = target_field.stable_field_id
           order by stored.field_definition_id, stored.term_id, stored.version desc
        ) current_row
       where current_row.state = 'active'
       order by current_row.position, current_row.term_id
    loop
      select term.* into current_term from platform_private.cms_terms term
       where term.id = source_row.term_id and term.owner_id = p_owner_id;
      select tv.* into recorded_version from platform_private.cms_taxonomy_versions tv
       where tv.id = source_row.taxonomy_version_id and tv.owner_id = p_owner_id;
      if current_term.id is null or recorded_version.id is null
         or recorded_version.taxonomy_id is distinct from current_term.taxonomy_id then
        raise exception 'migration_chain_incomplete' using errcode = 'P0001';
      end if;
      hops := 0;
      while current_term.lifecycle = 'merged' loop
        hops := hops + 1;
        if hops > 64 or current_term.successor_id is null then
          raise exception 'migration_chain_incomplete' using errcode = 'P0001';
        end if;
        select term.* into current_term from platform_private.cms_terms term
         where term.id = current_term.successor_id and term.owner_id = p_owner_id;
        if current_term.id is null then
          raise exception 'migration_chain_incomplete' using errcode = 'P0001';
        end if;
      end loop;
      select tv.* into active_version from platform_private.cms_taxonomy_versions tv
       where tv.taxonomy_id = current_term.taxonomy_id and tv.owner_id = p_owner_id and tv.state = 'active';
      if active_version.id is null or v_type_key is null
         or not (active_version.allowlisted_type_keys ? v_type_key
                 and active_version.allowlisted_field_keys ? target_field.field_key) then
        raise exception 'migration_chain_incomplete' using errcode = 'P0001';
      end if;
      if exists (select 1 from pg_catalog.jsonb_array_elements(rows_json) existing(item)
                  where existing.item->>'fieldDefinitionId' = target_field.id::text
                    and existing.item->>'termId' = current_term.id::text) then
        continue;
      end if;
      rows_json := rows_json || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'fieldDefinitionId', target_field.id, 'termId', current_term.id,
        'taxonomyVersionId', current_term.taxonomy_version_id, 'position', source_row.position,
        'provenance', source_row.provenance));
      field_terms := field_terms || pg_catalog.jsonb_build_array(current_term.id);
      if not (active_version.id::text = any(array(select pg_catalog.jsonb_array_elements_text(version_ids)))) then
        version_ids := version_ids || pg_catalog.jsonb_build_array(active_version.id);
      end if;
      lineages := lineages || current_term.taxonomy_id;
    end loop;
    if pg_catalog.jsonb_array_length(field_terms) > 0 then
      values_json := values_json || pg_catalog.jsonb_build_object(
        target_field.stable_field_id::text, pg_catalog.jsonb_build_object('termIds', field_terms));
    elsif pg_catalog.jsonb_typeof(values_json -> target_field.stable_field_id::text -> 'termIds') = 'array'
          and pg_catalog.jsonb_array_length(values_json -> target_field.stable_field_id::text -> 'termIds') > 0 then
      -- a non-empty taxonomy value with no source assignment names terms nothing can vouch for
      raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end if;
  end loop;

  -- Recorded versions of vocabularies without a carried assignment keep their recorded id.
  for pin in
    select recorded.id as version_id, tv.taxonomy_id
      from platform_private.cms_entry_revisions source_revision
      cross join lateral pg_catalog.jsonb_array_elements_text(source_revision.taxonomy_version_ids) recorded(id)
      join platform_private.cms_taxonomy_versions tv on tv.id::text = recorded.id and tv.owner_id = p_owner_id
     where source_revision.id = p_source_revision_id
  loop
    if not (pin.taxonomy_id = any(lineages))
       and not (pin.version_id = any(array(select pg_catalog.jsonb_array_elements_text(version_ids)))) then
      version_ids := version_ids || pg_catalog.jsonb_build_array(pin.version_id::uuid);
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'values', values_json,
    'rows', rows_json,
    'versionIds', (select coalesce(pg_catalog.jsonb_agg(item.value order by item.value collate "C"), '[]'::jsonb)
                     from pg_catalog.jsonb_array_elements_text(version_ids) item(value)));
end;
$body$;

comment on function platform_private.cms_restore_term_plan(uuid, uuid, uuid, jsonb) is
  'BE03c DEC-141 item 3: the term assignments a restore carries. Active/deprecated terms carry unchanged, a merged term is re-pointed to its terminal survivor, an unknown, other-vocabulary or unbindable term fails migration_chain_incomplete; returns { values (taxonomy fields rewritten to the carried terms), rows, versionIds }. Private; STABLE.';

create function platform_private.cms_restore_record_term_assignments(
  p_revision_id uuid, p_owner_id uuid, p_actor_id uuid, p_plan jsonb
)
returns integer
language plpgsql
set search_path = ''
as $body$
declare written integer;
begin
  insert into platform_private.cms_term_assignments(
    owner_id, state, version, revision_id, field_definition_id, term_id,
    taxonomy_version_id, position, provenance, created_by)
  select p_owner_id, 'active', 1, p_revision_id,
         (item.value->>'fieldDefinitionId')::uuid, (item.value->>'termId')::uuid,
         (item.value->>'taxonomyVersionId')::uuid, (item.value->>'position')::integer,
         item.value->>'provenance', p_actor_id
    from pg_catalog.jsonb_array_elements(p_plan->'rows') item(value);
  get diagnostics written = row_count;
  return written;
end;
$body$;

comment on function platform_private.cms_restore_record_term_assignments(uuid, uuid, uuid, jsonb) is
  'BE03c DEC-141 item 3: appends the restore plan rows as version-1 active TermAssignment rows of the restored revision. Private; callers run under the CMS RPC context.';

create function platform_private.cms_restore_lock_term_plan(
  p_owner_id uuid, p_source_revision_id uuid, p_target_version_id uuid, p_values jsonb, p_plan jsonb
)
returns void
language plpgsql
set search_path = ''
as $body$
begin
  -- BE03c "Slice 12 lock order", position 6: the carried terms FOR SHARE, ascending id (a merge locks them FOR UPDATE).  A lock
  -- timeout or a deadlock victim is the typed retryable 409 CONFLICT, as for the relation targets of the same command.
  begin
    perform 1
      from platform_private.cms_terms term
     where term.id in (select (item.value->>'termId')::uuid from pg_catalog.jsonb_array_elements(p_plan->'rows') item(value))
     order by term.id
       for share;
  exception when lock_not_available or deadlock_detected then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  -- The plan re-run under the lock: a merge or deprecation that committed since the first plan changes it, and the restore is retried.
  if platform_private.cms_restore_term_plan(p_owner_id, p_source_revision_id, p_target_version_id, p_values)
     is distinct from p_plan then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
end;
$body$;

comment on function platform_private.cms_restore_lock_term_plan(uuid, uuid, uuid, jsonb, jsonb) is
  'BE03c Slice 12 lock order position 6 for cms_restore_revision: locks the carried terms FOR SHARE in ascending id order, then re-runs cms_restore_term_plan and raises CONFLICT when a concurrent term action changed it. Private; callers run under the CMS RPC context.';

grant select on table platform_private.cms_terms, platform_private.cms_taxonomy_versions,
  platform_private.cms_term_assignments, platform_private.cms_entry_revisions to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_restore_term_plan(uuid, uuid, uuid, jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_restore_record_term_assignments(uuid, uuid, uuid, jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_restore_lock_term_plan(uuid, uuid, uuid, jsonb, jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_restore_term_plan(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_restore_record_term_assignments(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_restore_lock_term_plan(uuid, uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated, service_role;

commit;
