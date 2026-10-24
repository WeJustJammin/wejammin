-- DEC-193: the canonical security provider counts only effective stored content.
-- Amend the installed source, retaining later providers and every routine attribute.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_evaluate_preflight(jsonb)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  definition text;
  comment_text text;
  anchor_old constant text :=
    $old$      select (
        select coalesce(pg_catalog.sum(platform_private.cms_json_executable_leaves(field_value.value)), 0)
          from platform_private.cms_entry_field_values field_value
         where field_value.revision_id = revision_row.id and field_value.value is not null
      ) + (
        select coalesce(pg_catalog.sum(
                 platform_private.cms_json_executable_leaves(instance.props)
                 + platform_private.cms_json_executable_leaves(instance.bindings)), 0)
          from platform_private.cms_composition_instances instance
         where instance.revision_id = revision_row.id
           and instance.state in ('draft', 'active', 'pending_diff')
      ) into offenders;$old$;
  anchor_new constant text :=
    $new$      -- DEC-193 effective-security heads precede live-state eligibility.
      with latest as materialized (
        select distinct on (instance.revision_id, instance.path)
               instance.revision_id, instance.path, instance.state,
               instance.props, instance.bindings, instance.detached_tree
          from platform_private.cms_composition_instances instance
         where instance.revision_id = revision_row.id
         order by instance.revision_id, instance.path, instance.version desc
      ), effective as (
        select latest.* from latest
         where latest.state in ('draft', 'active', 'pending_diff')
      ), leaf_counts as (
        select platform_private.cms_json_executable_leaves(field_value.value)::bigint as leaf_count
          from platform_private.cms_entry_field_values field_value
         where field_value.revision_id = revision_row.id and field_value.value is not null
        union all
        select platform_private.cms_json_executable_leaves(instance.props)::bigint
               + platform_private.cms_json_executable_leaves(instance.bindings)::bigint
          from effective instance
        union all
        select platform_private.cms_json_executable_leaves(node.value->'props')::bigint
          from effective instance
          cross join lateral pg_catalog.jsonb_array_elements(
            case when instance.detached_tree is null then '[]'::jsonb
                 else instance.detached_tree->'nodes' end) node(value)
      )
      select least(coalesce(pg_catalog.sum(counted.leaf_count), 0), 1000)::integer
        into offenders from leaf_counts counted;$new$;
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'preflight evaluator missing: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'v'
     or original.proretset or original.prorettype <> 'pg_catalog.jsonb'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'preflight evaluator: unexpected attributes' using errcode = '55000';
  end if;
  if (pg_catalog.length(old_source) - pg_catalog.length(pg_catalog.replace(old_source, anchor_old, '')))
       / pg_catalog.length(anchor_old) <> 1
     or pg_catalog.strpos(old_source, 'DEC-193 effective-security heads') <> 0 then
    raise exception 'preflight evaluator: unexpected security anchor' using errcode = '55000';
  end if;
  new_source := pg_catalog.replace(old_source, anchor_old, anchor_new);
  if pg_catalog.replace(new_source, anchor_new, anchor_old) is distinct from old_source then
    raise exception 'preflight evaluator: non-anchor change' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if definition is null
     or (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'preflight evaluator: ambiguous definition' using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'preflight evaluator: replacement changed more than the source' using errcode = '55000';
  end if;
end;
$migration$;

commit;
