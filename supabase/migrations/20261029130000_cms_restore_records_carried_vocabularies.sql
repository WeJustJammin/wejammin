-- Slice 12 lane gaps-db5, DEC-240 (root 2026-10-29; BE03c "Receiving obligations from Slice 10 (DEC-141)" item 3, AC-244, AC-246):
-- cms_restore_term_plan (20261024100700) no longer carries a source-recorded taxonomy version whose vocabulary has no carried
-- assignment.  The restored revision's `versionIds` are exactly one current `active` version id per vocabulary with a carried
-- assignment, ascending bytewise, the rule every revision writer applies.  The amendment supersedes the "keep the recorded id" tail
-- of the installed function; cms_restore_revision (20261024100800) is unchanged, it records the plan's versionIds and reports the
-- stored ids.  The pin check that a recorded version resolves in the owner scope (any state) still runs first, so an unresolvable
-- recorded version still fails the restore 409 migration_chain_incomplete.
-- Mechanism: ONE guarded, anchored replacement of three fragments in the installed source (the DEC-232 precedent 20261027100020):
-- each anchor occurs exactly once, the inverse replacement restores the installed source byte for byte, and every pg_proc attribute
-- except the source (owner, SECURITY DEFINER, volatility, search_path, ACL, comment) is unchanged.  The function holds no data, so the
-- migration is safe on a populated database; it runs under lock_timeout / statement_timeout and refuses with SQLSTATE 55000 and a
-- message naming the cause, changing nothing.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_restore_term_plan(uuid,uuid,uuid,jsonb)';
  anchors_old constant text[] := array[
    $o1$  lineages uuid[] := array[]::uuid[];
  pin record;
begin
  select content_type.type_key into v_type_key
$o1$,
    $o2$      lineages := lineages || current_term.taxonomy_id;
    end loop;
    if pg_catalog.jsonb_array_length(field_terms) > 0 then
$o2$,
    $o3$  -- Recorded versions of vocabularies without a carried assignment keep their recorded id.
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
$o3$];
  anchors_new constant text[] := array[
    $n1$begin
  select content_type.type_key into v_type_key
$n1$,
    $n2$    end loop;
    if pg_catalog.jsonb_array_length(field_terms) > 0 then
$n2$,
    $n3$  -- DEC-240: version_ids holds only the current active version of each vocabulary with a carried assignment; a source-recorded
  -- version of a vocabulary without one is not carried.
$n3$];
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  inverse_source text;
  definition text;
  comment_text text;
  i integer;
begin
  select proc.* into original from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'DEC-240 missing existing function: %', identity using errcode = '55000';
  end if;
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole or original.prosecdef or original.prokind <> 'f'
     or original.provolatile <> 's' or original.proconfig is distinct from array['search_path=""']::text[] then
    raise exception 'DEC-240 unexpected attributes of %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  new_source := old_source;
  for i in 1 .. pg_catalog.cardinality(anchors_old) loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, anchors_old[i], '')))
         / pg_catalog.length(anchors_old[i]) <> 1 then
      raise exception 'DEC-240 anchor % is not unique in %', i, identity using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, anchors_old[i], anchors_new[i]);
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, anchors_new[i], '')))
         / pg_catalog.length(anchors_new[i]) <> 1 then
      raise exception 'DEC-240 replacement anchor % is not unique in %', i, identity using errcode = '55000';
    end if;
  end loop;
  inverse_source := new_source;
  for i in reverse pg_catalog.cardinality(anchors_old) .. 1 loop
    inverse_source := pg_catalog.replace(inverse_source, anchors_new[i], anchors_old[i]);
  end loop;
  if inverse_source is distinct from old_source or pg_catalog.strpos(new_source, 'pin.version_id') <> 0
     or pg_catalog.strpos(new_source, 'lineages') <> 0 then
    raise exception 'DEC-240 non-anchored change in %', identity using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if definition is null or pg_catalog.length(old_source) = 0
     or (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
          / pg_catalog.length(old_source) <> 1 then
    raise exception 'DEC-240 ambiguous definition: %', identity using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'DEC-240 replacement changed more than the source: %', identity using errcode = '55000';
  end if;
end;
$migration$;

commit;
