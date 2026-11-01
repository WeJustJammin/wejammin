-- Slice 12 lane db10 sweep (DEC-247): the restore maps the update expander's refusals of an unresolvable stored pin to its own typed refusal
-- migration_chain_incomplete.  pattern_depth_exceeded is already in that list; pattern_nodes_exceeded (a pin that expands to more than 512 block roots,
-- 20261031110400) joins it, so a restore never leaks a stray token.  One anchored replacement in cms_restore_composition_refs (the anchor occurs once; the
-- inverse restores the installed source byte for byte; every pg_proc attribute and the comment are unchanged).  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_restore_composition_refs(platform_private.cms_composition_instances)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  inverse_source text;
  definition text;
  comment_text text;
  i integer;
  anchors_old text[] := array[
    $old$      if message_text in ('nested_pattern_not_active', 'pattern_cycle', 'pattern_depth_exceeded') then$old$
  ];
  anchors_new text[] := array[
    $new$      if message_text in ('nested_pattern_not_active', 'pattern_cycle', 'pattern_depth_exceeded', 'pattern_nodes_exceeded') then$new$
  ];
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'DEC-247 missing existing function: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or original.prosecdef or original.prokind <> 'f' or original.provolatile <> 's'
     or not original.proretset or original.prorettype <> 'record'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'DEC-247 unexpected baseline attributes: %', identity using errcode = '55000';
  end if;
  new_source := old_source;
  for i in 1 .. pg_catalog.cardinality(anchors_old) loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, anchors_old[i], '')))
         / pg_catalog.length(anchors_old[i]) <> 1
       or pg_catalog.strpos(old_source, anchors_new[i]) <> 0 then
      raise exception 'DEC-247 unexpected anchor % in %', i, identity using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, anchors_old[i], anchors_new[i]);
  end loop;
  inverse_source := new_source;
  for i in reverse pg_catalog.cardinality(anchors_old) .. 1 loop
    if (pg_catalog.length(inverse_source) - pg_catalog.length(pg_catalog.replace(inverse_source, anchors_new[i], '')))
         / pg_catalog.length(anchors_new[i]) <> 1 then
      raise exception 'DEC-247 ambiguous inverse % in %', i, identity using errcode = '55000';
    end if;
    inverse_source := pg_catalog.replace(inverse_source, anchors_new[i], anchors_old[i]);
  end loop;
  if inverse_source is distinct from old_source then
    raise exception 'DEC-247 non-anchored change in %', identity using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if definition is null or pg_catalog.length(old_source) = 0
     or (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
          / pg_catalog.length(old_source) <> 1 then
    raise exception 'DEC-247 ambiguous definition: %', identity using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'DEC-247 replacement changed more than the source: %', identity using errcode = '55000';
  end if;
end;
$migration$;

commit;
