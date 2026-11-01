-- Slice 12 lane taxonomy-integrity: the write commands persist the 03b `taxonomy` encoding (BE03b Value encodings by field kind,
-- taxonomy; BE03c Receiving obligations from Slice 10 (DEC-141) item 5, DEC-233; BE03c Slice 12 lock order position 6; P2-S12-AC-246, AC-276).
--
-- cms_create_entry, cms_create_revision and cms_resolve_conflict each, after the revision insert and the composition carry, take the
-- assigned terms FOR SHARE in ascending id order and re-check the authored terms under the lock (cms_lock_term_plan: position 6, so a
-- term merge, which locks the terms FOR UPDATE, serializes with the assignment), then append the revision's TermAssignment rows
-- (cms_record_term_assignments) and record the vocabularies' active version ids as the revision's taxonomy_version_ids
-- (cms_taxonomy_plan_version_ids).  Guarded anchored amendments of the LIVE sources (each anchor occurs exactly once, the inverse replay
-- restores the installed source byte for byte, every pg_proc attribute except the source is unchanged):
--   create_entry     changed fields = every authored field; response unchanged (it carries no taxonomyVersionIds);
--   create_revision  changed fields = the patched fields, the rest carried from the current draft; response reports the stored ids; the
--                    value check receives the current draft so a deprecated term it already assigns stays accepted (DEC-233);
--   resolve_conflict changed fields = fields whose resolved value differs from the current draft's (theirs), the rest carried from
--                    theirs; a taxonomy value EQUAL to theirs' is an existing assignment and is not re-checked, a changed value is checked
--                    against theirs (DEC-233).
-- Forward-only.
begin;
set local lock_timeout = '5s';

do $amend$
declare
  identity constant text := 'platform_private.cms_create_entry(jsonb)';
  pairs constant text[][] := array[
    array[$o0$    default_template_id, '[]'::jsonb, '[]'::jsonb, p_request->>'locale',$o0$,
     $n0$    default_template_id,
    platform_private.cms_taxonomy_plan_version_ids(
      acting_party_id, version_row.id, null::uuid, field_values,
      array(select taxonomy_key.key from pg_catalog.jsonb_object_keys(field_values) taxonomy_key(key))),
    '[]'::jsonb, p_request->>'locale',$n0$],
    array[$o1$  -- The resolved relation rows of the first revision: targetKind and$o1$,
     $n1$  -- DEC-141 item 5 (BE03b taxonomy encoding): BE03c Slice 12 lock order position 6 (the assigned terms FOR SHARE, ascending id, re-checked
  -- under the lock), then the term assignments of the first revision.
  perform platform_private.cms_lock_term_plan(
    acting_party_id, version_row.id, null::uuid, field_values,
    array(select taxonomy_key.key from pg_catalog.jsonb_object_keys(field_values) taxonomy_key(key)));
  perform platform_private.cms_record_term_assignments(
    revision_id, acting_party_id, actor_id, version_row.id, null::uuid, field_values,
    array(select taxonomy_key.key from pg_catalog.jsonb_object_keys(field_values) taxonomy_key(key)));

  -- The resolved relation rows of the first revision: targetKind and$n1$]
  ];
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  replayed text;
  definition text;
  comment_text text;
  item integer;
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'v'
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql') then
    raise exception 'cms_create_entry: unexpected attributes' using errcode = '55000';
  end if;
  old_source := original.prosrc;
  new_source := old_source;
  for item in 1 .. pg_catalog.array_length(pairs, 1) loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, pairs[item][1], '')))
         / pg_catalog.length(pairs[item][1]) <> 1 then
      raise exception 'cms_create_entry: anchor % is not unique', item using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, pairs[item][1], pairs[item][2]);
  end loop;
  -- the inverse replay (last pair first) restores the installed source byte for byte
  replayed := new_source;
  for item in reverse pg_catalog.array_length(pairs, 1) .. 1 loop
    replayed := pg_catalog.replace(replayed, pairs[item][2], pairs[item][1]);
  end loop;
  if replayed is distinct from old_source then
    raise exception 'cms_create_entry: amendment is not reversible' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'cms_create_entry: definition is ambiguous' using errcode = '55000';
  end if;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = original.oid;
  if not found or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'cms_create_entry: amendment changed more than the anchors' using errcode = '55000';
  end if;
end;
$amend$;

do $amend$
declare
  identity constant text := 'platform_private.cms_create_revision(jsonb)';
  pairs constant text[][] := array[
    array[$o0$    current_row.template_version_id, current_row.taxonomy_version_ids,
    parent_ids, p_request->>'locale', payload_hash::char(64),$o0$,
     $n0$    current_row.template_version_id,
    platform_private.cms_taxonomy_plan_version_ids(
      entry_row.owner_id, version_row.id, current_row.id, next_values,
      array(select patched.key from pg_catalog.jsonb_object_keys(values_patch) patched(key))),
    parent_ids, p_request->>'locale', payload_hash::char(64),$n0$],
    array[$o1$  perform platform_private.cms_revision_composition_carry(
    base_row.id, new_revision_id, snapshot_time
  );$o1$,
     $n1$  perform platform_private.cms_revision_composition_carry(
    base_row.id, new_revision_id, snapshot_time
  );
  -- DEC-141 item 5: BE03c Slice 12 lock order position 6 (the assigned terms FOR SHARE, ascending id, re-checked under the lock), then the
  -- term assignments of the new revision (changed fields from the patch, the rest carried from the current draft).
  perform platform_private.cms_lock_term_plan(
    entry_row.owner_id, version_row.id, current_row.id, next_values,
    array(select patched.key from pg_catalog.jsonb_object_keys(values_patch) patched(key)));
  perform platform_private.cms_record_term_assignments(
    new_revision_id, entry_row.owner_id, actor_id, version_row.id, current_row.id, next_values,
    array(select patched.key from pg_catalog.jsonb_object_keys(values_patch) patched(key)));$n1$],
    array[$o2$    'taxonomyVersionIds', current_row.taxonomy_version_ids,$o2$,
     $n2$    'taxonomyVersionIds', (select stored.taxonomy_version_ids
      from platform_private.cms_entry_revisions stored where stored.id = new_revision_id),$n2$],
    array[$o3$      perform platform_private.cms_require_value_source_available(
        version_row.id, value_field_id_text::uuid, value_input
      );$o3$,
     $n3$      -- DEC-233: a deprecated term the current draft already assigns in this field stays accepted on a re-sent value.
      perform platform_private.cms_require_value_source_available(
        version_row.id, value_field_id_text::uuid, value_input, current_row.id
      );$n3$]
  ];
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  replayed text;
  definition text;
  comment_text text;
  item integer;
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'v'
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql') then
    raise exception 'cms_create_revision: unexpected attributes' using errcode = '55000';
  end if;
  old_source := original.prosrc;
  new_source := old_source;
  for item in 1 .. pg_catalog.array_length(pairs, 1) loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, pairs[item][1], '')))
         / pg_catalog.length(pairs[item][1]) <> 1 then
      raise exception 'cms_create_revision: anchor % is not unique', item using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, pairs[item][1], pairs[item][2]);
  end loop;
  -- the inverse replay (last pair first) restores the installed source byte for byte
  replayed := new_source;
  for item in reverse pg_catalog.array_length(pairs, 1) .. 1 loop
    replayed := pg_catalog.replace(replayed, pairs[item][2], pairs[item][1]);
  end loop;
  if replayed is distinct from old_source then
    raise exception 'cms_create_revision: amendment is not reversible' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'cms_create_revision: definition is ambiguous' using errcode = '55000';
  end if;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = original.oid;
  if not found or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'cms_create_revision: amendment changed more than the anchors' using errcode = '55000';
  end if;
end;
$amend$;

do $amend$
declare
  identity constant text := 'platform_private.cms_resolve_conflict(jsonb)';
  pairs constant text[][] := array[
    array[$o0$    theirs_row.template_version_id, theirs_row.taxonomy_version_ids,
    parent_ids, theirs_row.locale,$o0$,
     $n0$    theirs_row.template_version_id,
    platform_private.cms_taxonomy_plan_version_ids(
      entry_row.owner_id, version_row.id, theirs_row.id, next_values,
      array(select resolved.key from pg_catalog.jsonb_object_keys(next_values) resolved(key)
        where next_values -> resolved.key is distinct from theirs_values -> resolved.key)),
    parent_ids, theirs_row.locale,$n0$],
    array[$o1$  perform platform_private.cms_revision_composition_carry(
    theirs_row.id, new_revision_id, snapshot_time
  );$o1$,
     $n1$  perform platform_private.cms_revision_composition_carry(
    theirs_row.id, new_revision_id, snapshot_time
  );
  -- DEC-141 item 5: BE03c Slice 12 lock order position 6 (the assigned terms FOR SHARE, ascending id, re-checked under the lock), then the
  -- term assignments of the resolved revision (changed fields from the resolution, the rest carried from theirs).
  perform platform_private.cms_lock_term_plan(
    entry_row.owner_id, version_row.id, theirs_row.id, next_values,
    array(select resolved.key from pg_catalog.jsonb_object_keys(next_values) resolved(key)
        where next_values -> resolved.key is distinct from theirs_values -> resolved.key));
  perform platform_private.cms_record_term_assignments(
    new_revision_id, entry_row.owner_id, actor_id, version_row.id, theirs_row.id, next_values,
    array(select resolved.key from pg_catalog.jsonb_object_keys(next_values) resolved(key)
        where next_values -> resolved.key is distinct from theirs_values -> resolved.key));$n1$],
    array[$o2$    'taxonomyVersionIds', theirs_row.taxonomy_version_ids,$o2$,
     $n2$    'taxonomyVersionIds', (select stored.taxonomy_version_ids
      from platform_private.cms_entry_revisions stored where stored.id = new_revision_id),$n2$],
    array[$o3$    perform platform_private.cms_require_value_source_available(
      version_row.id, field_id_text::uuid, next_values->field_id_text
    );$o3$,
     $n3$    -- DEC-141 item 5 / DEC-233: a taxonomy value equal to the current draft's is an existing assignment, and a deprecated term the
    -- current draft already assigns in the field stays accepted in a changed value.
    if field_row.kind <> 'taxonomy'
       or next_values->field_id_text is distinct from theirs_values->field_id_text then
      perform platform_private.cms_require_value_source_available(
        version_row.id, field_id_text::uuid, next_values->field_id_text, theirs_row.id
      );
    end if;$n3$]
  ];
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  replayed text;
  definition text;
  comment_text text;
  item integer;
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'v'
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql') then
    raise exception 'cms_resolve_conflict: unexpected attributes' using errcode = '55000';
  end if;
  old_source := original.prosrc;
  new_source := old_source;
  for item in 1 .. pg_catalog.array_length(pairs, 1) loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, pairs[item][1], '')))
         / pg_catalog.length(pairs[item][1]) <> 1 then
      raise exception 'cms_resolve_conflict: anchor % is not unique', item using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, pairs[item][1], pairs[item][2]);
  end loop;
  -- the inverse replay (last pair first) restores the installed source byte for byte
  replayed := new_source;
  for item in reverse pg_catalog.array_length(pairs, 1) .. 1 loop
    replayed := pg_catalog.replace(replayed, pairs[item][2], pairs[item][1]);
  end loop;
  if replayed is distinct from old_source then
    raise exception 'cms_resolve_conflict: amendment is not reversible' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'cms_resolve_conflict: definition is ambiguous' using errcode = '55000';
  end if;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = original.oid;
  if not found or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'cms_resolve_conflict: amendment changed more than the anchors' using errcode = '55000';
  end if;
end;
$amend$;

commit;
