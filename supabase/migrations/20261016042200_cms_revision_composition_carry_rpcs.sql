-- BE03c1545 / DEC-198 / DEC-200 / DEC-209: ordinary append and conflict resolution only.
-- cms_create_revision carries from its base revision. cms_resolve_conflict carries from the
-- entry's current draft (theirs), never the conflict base: composition commands write only to
-- the current draft, so the base would silently drop every placement made since (DEC-209).
-- Guarded live-source amendment preserves the later E7 settings tail and every
-- authority, replay, CAS, field/relation, effect and public transport branch.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity text;
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  definition text;
  comment_text text;
  anchor_old text;
  anchor_new text;
begin
  if not pg_catalog.has_function_privilege('wejammin_cms_definer',
      'platform_private.cms_revision_composition_carry(uuid,uuid,timestamp with time zone)',
      'EXECUTE') then
    raise exception 'ordinary revision carry helper unavailable' using errcode = '55000';
  end if;
  foreach identity in array array[
    'platform_private.cms_create_revision(jsonb)',
    'platform_private.cms_resolve_conflict(jsonb)'
  ] loop
    if identity = 'platform_private.cms_create_revision(jsonb)' then
      anchor_old := $anchor$    author_person_id, acting_party_id, 'draft', 1, 'valid', '{}'::jsonb,
    snapshot_time, snapshot_time
  );
  insert into platform_private.cms_entry_field_values($anchor$;
    else
      anchor_old := $anchor$    author_person_id, acting_party_id, 'draft', 1,
    'valid', '{}'::jsonb, snapshot_time, snapshot_time
  );
  insert into platform_private.cms_entry_field_values($anchor$;
    end if;
    anchor_new := pg_catalog.replace(anchor_old,
      E'\n  insert into platform_private.cms_entry_field_values(',
      E'\n  perform platform_private.cms_revision_composition_carry(\n    '
        || case when identity = 'platform_private.cms_resolve_conflict(jsonb)'
             then 'theirs_row.id' else 'base_row.id' end
        || E', new_revision_id, snapshot_time\n  );\n  insert into platform_private.cms_entry_field_values(');
    select proc.* into original from pg_catalog.pg_proc proc
     where proc.oid = pg_catalog.to_regprocedure(identity);
    if not found then
      raise exception 'ordinary revision writer missing: %', identity using errcode = '55000';
    end if;
    old_source := original.prosrc;
    comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
    if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
       or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'v'
       or original.proconfig is distinct from array['search_path=""']::text[]
       or original.pronargs <> 1 or original.pronargdefaults <> 0
       or original.proargnames is distinct from array['p_request']::text[]
       or pg_catalog.oidvectortypes(original.proargtypes) <> 'jsonb'
       or original.prorettype <> 'jsonb'::pg_catalog.regtype or original.proretset
       or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
      raise exception 'ordinary revision writer attributes changed: %', identity using errcode = '55000';
    end if;
    if (pg_catalog.length(old_source) - pg_catalog.length(
          pg_catalog.replace(old_source, anchor_old, ''))) / pg_catalog.length(anchor_old) <> 1
       or pg_catalog.strpos(old_source, 'cms_revision_composition_carry') <> 0 then
      raise exception 'ordinary revision writer unexpected INSERT anchor: %', identity using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(old_source, anchor_old, anchor_new);
    if pg_catalog.replace(new_source, anchor_new, anchor_old) <> old_source then
      raise exception 'ordinary revision writer non-anchor change: %', identity using errcode = '55000';
    end if;
    definition := pg_catalog.pg_get_functiondef(original.oid);
    if (pg_catalog.length(definition) - pg_catalog.length(
          pg_catalog.replace(definition, old_source, ''))) / pg_catalog.length(old_source) <> 1 then
      raise exception 'ordinary revision writer ambiguous definition: %', identity using errcode = '55000';
    end if;
    execute pg_catalog.replace(definition, old_source, new_source);
    select proc.* into actual from pg_catalog.pg_proc proc
     where proc.oid = pg_catalog.to_regprocedure(identity);
    if not found or actual.oid <> original.oid or actual.prosrc <> new_source
       or pg_catalog.to_jsonb(actual) - 'prosrc' <> pg_catalog.to_jsonb(original) - 'prosrc'
       or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
      raise exception 'ordinary revision writer replacement changed metadata: %', identity
        using errcode = '55000';
    end if;
  end loop;
end;
$migration$;

commit;
