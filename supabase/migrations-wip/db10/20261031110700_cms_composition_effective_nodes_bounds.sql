-- Slice 12 lane db10 sweep (DEC-247): the publication read models stay total.  cms_composition_effective_nodes is the one choke point under the dependency
-- manifest builder, the render plan, the accessibility checker input and the composition list.  Since 20261031110400 the update expander refuses a pinned forest
-- over the CMS-03C-12 bound; a read model that propagated that refusal would abort the manifest build and with it the whole 17-category preflight, so the
-- pattern provider's typed pattern_depth_exceeded / pattern_nodes_exceeded (20261031110100) could never be reported.  An over-bound pin therefore reads as its
-- root block alone (never expanded, never silently dropped: the row still has its node 0), and the provider is the gate that fails the revision before publish.
-- One anchored replacement per anchor (each occurs once; the inverse restores the installed source byte for byte; every pg_proc attribute and the comment are
-- unchanged).  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_composition_effective_nodes(platform_private.cms_composition_instances)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  inverse_source text;
  definition text;
  comment_text text;
  i integer;
  anchors_old text[] := array[
    $old$  tree jsonb;
begin$old$,
    $old$    tree := platform_private.cms_pattern_root_snapshot(p_row, pinned, false);$old$
  ];
  anchors_new text[] := array[
    $new$  tree jsonb;
  bound_message text;
begin$new$,
    $new$    -- DEC-247: a pinned forest over the CMS-03C-12 bound is not expanded here; it reads as its root block alone and the pattern provider
    -- (cms.pattern.active_digest) fails the revision before publish.
    begin
      tree := platform_private.cms_pattern_root_snapshot(p_row, pinned, false);
    exception when sqlstate 'P0001' then
      get stacked diagnostics bound_message = message_text;
      if bound_message in ('pattern_depth_exceeded', 'pattern_nodes_exceeded') then
        return query select 0, p_row.block_key::text, p_row.block_version::bigint, '{}'::jsonb;
        return;
      end if;
      raise;
    end;$new$
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
