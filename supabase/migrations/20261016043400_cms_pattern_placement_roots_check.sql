-- DEC-193 / BE03c380,520-551,1485: optional expanded block-root selectors.
-- Amend the installed private request guard, retaining every old predicate,
-- signature, owner, ACL, attribute and comment. No stored/override bound changes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_pattern_placement_check(jsonb)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  inverse_source text;
  definition text;
  comment_text text;
  i integer;
  anchors_old text[] := array[
    $old$      'idempotencyKey','context','blockRegistryDigest','correlationId']::text[]$old$,
    $old$  v_version numeric;$old$,
    $old$  if pg_catalog.jsonb_typeof(p_request->'patternVersion') is distinct from 'number' then$old$
  ];
  anchors_new text[] := array[
    $new$      'idempotencyKey','context','blockRegistryDigest','correlationId','roots']::text[]$new$,
    $new$  v_version numeric;
  v_root record;$new$,
    $new$  -- DEC-193: this carrier alone uses the fully expanded address bound.
  if p_request ? 'roots' then
    if pg_catalog.jsonb_typeof(p_request->'roots') is distinct from 'array' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/roots"]';
    end if;
    if pg_catalog.jsonb_array_length(p_request->'roots') not between 1 and 512 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/roots"]';
    end if;
    for v_root in
      select named.value, named.ordinality
        from pg_catalog.jsonb_array_elements(p_request->'roots') with ordinality named(value, ordinality)
       order by named.ordinality
    loop
      if pg_catalog.jsonb_typeof(v_root.value) is distinct from 'string'
         or pg_catalog.char_length(v_root.value #>> '{}') > 4680
         or (v_root.value #>> '{}') collate pg_catalog."C" !~ '^/[a-z][a-z0-9_-]{0,63}(/[a-z][a-z0-9_-]{0,63}){0,71}$' then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
          detail = pg_catalog.jsonb_build_array(pg_catalog.format('/roots/%s', v_root.ordinality - 1))::text;
      end if;
    end loop;
    if (select pg_catalog.count(*) <> pg_catalog.count(distinct named.value)
          from pg_catalog.jsonb_array_elements(p_request->'roots') named(value)) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/roots"]';
    end if;
  end if;

  if pg_catalog.jsonb_typeof(p_request->'patternVersion') is distinct from 'number' then$new$
  ];
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'selected-roots request guard missing: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 's'
     or original.proretset or original.prorettype <> 'pg_catalog.text'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'selected-roots request guard: unexpected attributes' using errcode = '55000';
  end if;
  new_source := old_source;
  for i in 1 .. pg_catalog.cardinality(anchors_old) loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, anchors_old[i], '')))
         / pg_catalog.length(anchors_old[i]) <> 1
       or pg_catalog.strpos(new_source, anchors_new[i]) <> 0 then
      raise exception 'selected-roots request guard: unexpected anchor %', i using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, anchors_old[i], anchors_new[i]);
  end loop;
  inverse_source := new_source;
  for i in reverse pg_catalog.cardinality(anchors_old) .. 1 loop
    if (pg_catalog.length(inverse_source) - pg_catalog.length(pg_catalog.replace(inverse_source, anchors_new[i], '')))
         / pg_catalog.length(anchors_new[i]) <> 1 then
      raise exception 'selected-roots request guard: ambiguous inverse %', i using errcode = '55000';
    end if;
    inverse_source := pg_catalog.replace(inverse_source, anchors_new[i], anchors_old[i]);
  end loop;
  if inverse_source is distinct from old_source then
    raise exception 'selected-roots request guard: non-anchor change' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if definition is null or pg_catalog.length(old_source) = 0
     or (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'selected-roots request guard: ambiguous definition' using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'selected-roots request guard: replacement changed more than the source' using errcode = '55000';
  end if;
end;
$migration$;

commit;
