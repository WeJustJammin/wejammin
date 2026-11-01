-- Slice 12 lane taxonomy-integrity: BE03c "Receiving obligations from Slice 10 (DEC-141)" item 5 (P2-S12-AC-246, AC-221 assignment
-- clause, AC-224 not newly assignable): the 03b `taxonomy` value encoder with the taxonomy authority registered.
--
-- BE03b "Value encodings by field kind": each termId must be an `active` term of a vocabulary whose active version lists the entry
-- content type's key in allowedTypeKeys and the field's key in allowedFieldKeys; a merged, deprecated-for-assignment, unknown or
-- other-vocabulary term is the uniform 422 VALIDATION_FAILED reason `term_unavailable` (raised as the whole P0001 message, with the
-- refused field's normative pointer as DETAIL like the other typed producers).  Owner scope: a term and the vocabulary versions
-- listing it must belong to the owner of the pinned schema version, so another owner's term is the same refusal.
--
--   cms_term_assignable(owner, typeKey, fieldKey, term)  the predicate (SQL, STABLE, invoker; owner CMS definer)
--   cms_require_value_source_available                    replaced: taxonomy -> term_unavailable; media -> unchanged refusal
--   cms_value_source_refusal                              the taxonomy_source_unavailable fail-closed branch is retired (the
--                                                         predicate is context-free; media keeps media_source_unavailable)
-- DEC-233 (BE03c DEC-141 item 5): a `deprecated` term that the SOURCE revision of the write already assigns in the same field is an
-- existing assignment and stays accepted when the value is re-sent (cms_term_existing_deprecated; both cms_create_revision and
-- cms_resolve_conflict pass their source revision to the four-argument form); a value naming the same termId twice is refused 422
-- VALIDATION_FAILED at the field pointer, so the stored value stays canonical.
-- A malformed encoding is still decided before this runs (bare VALIDATION_FAILED).  The three wholesale replacements below are guarded
-- by an md5 pin of the installed predecessor body, so a later lane's change to them cannot be dropped silently.  Forward-only.
begin;
set local lock_timeout = '5s';

create function platform_private.cms_term_assignable(
  p_owner_id uuid, p_type_key text, p_field_key text, p_term_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $body$
  select exists (
    select 1
      from platform_private.cms_terms term
      join platform_private.cms_taxonomy_versions active_version
        on active_version.taxonomy_id = term.taxonomy_id
       and active_version.owner_id = term.owner_id
       and active_version.state = 'active'
     where term.id = p_term_id
       and term.owner_id = p_owner_id
       and term.lifecycle = 'active'
       and active_version.allowlisted_type_keys ? p_type_key
       and active_version.allowlisted_field_keys ? p_field_key
  )
$body$;

comment on function platform_private.cms_term_assignable(uuid, text, text, uuid) is
  'BE03b taxonomy encoder: true when the term is an active term of the owner whose vocabulary''s active version lists the content type key and the field key. Private; STABLE.';

do $guard$
declare
  pins constant text[][] := array[
    array['platform_private.cms_value_source_refusal(text,jsonb)', '6f4c07e4cafd0eab3dba234f970bdaea'],
    array['platform_private.cms_require_value_source_available(uuid,uuid,jsonb)', '9ae6d84378d15314fe31b4a303d85caf']
  ];
  item integer;
begin
  for item in 1 .. pg_catalog.array_length(pins, 1) loop
    if (select pg_catalog.md5(proc.prosrc) from pg_catalog.pg_proc proc
         where proc.oid = pg_catalog.to_regprocedure(pins[item][1])) is distinct from pins[item][2] then
      raise exception '% is not the expected predecessor body', pins[item][1] using errcode = '55000';
    end if;
  end loop;
end;
$guard$;

create function platform_private.cms_term_existing_deprecated(
  p_owner_id uuid, p_source_revision_id uuid, p_field_id uuid, p_term_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $body$
  select exists (
    select 1
      from platform_private.cms_terms term
     where term.id = p_term_id
       and term.owner_id = p_owner_id
       and term.lifecycle = 'deprecated'
       and exists (
         select 1
           from (
             select distinct on (stored.field_definition_id, stored.term_id) stored.state
               from platform_private.cms_term_assignments stored
               join platform_private.cms_field_definition_versions old_field on old_field.id = stored.field_definition_id
              where stored.revision_id = p_source_revision_id
                and stored.term_id = p_term_id
                and old_field.stable_field_id = p_field_id
              order by stored.field_definition_id, stored.term_id, stored.version desc
           ) current_row
          where current_row.state = 'active')
  )
$body$;

comment on function platform_private.cms_term_existing_deprecated(uuid, uuid, uuid, uuid) is
  'DEC-233: true when the term is a deprecated term of the owner that the source revision currently assigns (active, highest version) in the field named by its stable id. Private; STABLE.';

create or replace function platform_private.cms_value_source_refusal(p_kind text, p_value jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $body$
begin
  if p_kind is null or p_value is null then
    return null;
  end if;
  -- DEC-141 item 5: a taxonomy value is no longer refused by kind; whether its terms are assignable
  -- depends on the owner, the content type and the field (cms_require_value_source_available).
  if p_kind = 'media' then
    if pg_catalog.jsonb_typeof(p_value) = 'object' then
      return 'media_source_unavailable';
    end if;
    if pg_catalog.jsonb_typeof(p_value) = 'array' then
      if pg_catalog.jsonb_array_length(p_value) > 0 then
        return 'media_source_unavailable';
      end if;
    end if;
    return null;
  end if;
  return null;
end;
$body$;

comment on function platform_private.cms_value_source_refusal(text, jsonb) is
  'BE03b producer refusal: a non-empty media value is media_source_unavailable until the media provider exists; every other kind (taxonomy included, DEC-141) and a JSON null are never refused here. Returns the typed reason token or NULL. Pure predicate.';

create function platform_private.cms_require_value_source_available(
  p_schema_version_id uuid,
  p_field_id uuid,
  p_value jsonb,
  p_source_revision_id uuid
)
returns void
language plpgsql
stable
set search_path = ''
as $body$
declare
  v_kind text;
  v_field_key text;
  v_refusal text;
  v_owner_id uuid;
  v_type_key text;
begin
  select field.kind, field.field_key into v_kind, v_field_key
  from platform_private.cms_field_definition_versions field
  where field.stable_field_id = p_field_id
    and field.content_type_version_id = p_schema_version_id;
  if v_kind = 'taxonomy' then
    if pg_catalog.jsonb_typeof(p_value) = 'object'
       and pg_catalog.jsonb_typeof(p_value->'termIds') = 'array'
       and pg_catalog.jsonb_array_length(p_value->'termIds') > 0 then
      -- DEC-233: the same termId twice is a non-canonical value.
      if (select pg_catalog.count(distinct pg_catalog.lower(requested.id)) <> pg_catalog.count(*)
            from pg_catalog.jsonb_array_elements_text(p_value->'termIds') requested(id)) then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
          detail = pg_catalog.jsonb_build_array('/fields/' || p_field_id::text)::text;
      end if;
      select type_version.owner_id, content_type.type_key into v_owner_id, v_type_key
        from platform_private.cms_content_type_versions type_version
        join platform_private.cms_content_types content_type on content_type.id = type_version.content_type_id
       where type_version.id = p_schema_version_id;
      if v_owner_id is null or v_type_key is null or exists (
        select 1
          from pg_catalog.jsonb_array_elements_text(p_value->'termIds') requested(id)
         where not coalesce(
                 platform_private.cms_term_assignable(v_owner_id, v_type_key, v_field_key,
                   case when platform_private.cms_valid_uuid(requested.id) then requested.id::uuid end)
                 or platform_private.cms_term_existing_deprecated(v_owner_id, p_source_revision_id, p_field_id,
                   case when platform_private.cms_valid_uuid(requested.id) then requested.id::uuid end),
                 false)
      ) then
        raise exception 'term_unavailable' using errcode = 'P0001',
          detail = pg_catalog.jsonb_build_array('/fields/' || p_field_id::text)::text;
      end if;
    end if;
    return;
  end if;
  v_refusal := platform_private.cms_value_source_refusal(v_kind, p_value);
  if v_refusal is not null then
    -- Item 6e: the refused field is named by its normative pointer.
    raise exception '%', v_refusal using errcode = 'P0001',
      detail = pg_catalog.jsonb_build_array('/fields/' || p_field_id::text)::text;
  end if;
end;
$body$;

comment on function platform_private.cms_require_value_source_available(uuid, uuid, jsonb, uuid) is
  'Write-time producer refusal with the source revision of the write (DEC-233): a non-empty taxonomy value naming the same termId twice is VALIDATION_FAILED, naming any term that is neither assignable (an active term of the owner whose vocabulary''s active version lists the content type key and the field key) nor a deprecated term the source revision already assigns in the field is the uniform term_unavailable (P0001, DETAIL the field pointer); a non-empty media value raises media_source_unavailable. Call after cms_draft_field_value_valid.';

create or replace function platform_private.cms_require_value_source_available(
  p_schema_version_id uuid,
  p_field_id uuid,
  p_value jsonb
)
returns void
language plpgsql
stable
set search_path = ''
as $body$
begin
  perform platform_private.cms_require_value_source_available(p_schema_version_id, p_field_id, p_value, null::uuid);
end;
$body$;

comment on function platform_private.cms_require_value_source_available(uuid, uuid, jsonb) is
  'Write-time producer refusal for a write with no source revision (cms_create_entry): see the four-argument form. Call after cms_draft_field_value_valid.';

grant select on table
  platform_private.cms_terms,
  platform_private.cms_taxonomy_versions,
  platform_private.cms_content_type_versions,
  platform_private.cms_content_types,
  platform_private.cms_term_assignments,
  platform_private.cms_field_definition_versions
  to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_term_assignable(uuid, text, text, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_term_existing_deprecated(uuid, uuid, uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_require_value_source_available(uuid, uuid, jsonb, uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_term_assignable(uuid, text, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_term_existing_deprecated(uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_require_value_source_available(uuid, uuid, jsonb, uuid)
  from public, anon, authenticated, service_role;

commit;
