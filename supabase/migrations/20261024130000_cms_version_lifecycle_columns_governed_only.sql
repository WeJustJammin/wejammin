-- Slice 12 gap lane claude_s12_gaps_db2 (P2-S12-AC-195, BE03c Registry invariants and "Persisted model envelope" line 1715):
-- "only the lifecycle columns (state, lifecycle_version, activated_at, retired_at, updated_at) advance, only through the governed
-- RPCs".  The three definition guards return early for a governed lifecycle update (cms_governed_lifecycle_update, which needs the
-- app.cms_governed_lifecycle flag the governed RPCs set) but then fall through for every other UPDATE of a draft, review, approved,
-- scheduled row: the template guard compares only the definition columns, and the taxonomy and pattern guards exclude `state` from
-- their whole-row comparison, so a direct UPDATE inside the CMS RPC context (without the governed flag) could still change `state`
-- (and for a template also lifecycle_version, activated_at and retired_at).  updated_at is the fifth column: a direct write of it
-- (V13-01) would also be able to move it into the future, after which cms_governed_lifecycle_update (new.updated_at >= old.updated_at)
-- refuses every governed transition of that row.  Debug-by-test: phase_02_slice_12_gaps_governed_basis.sql
-- (040-lifecycle) is RED against the promoted migrations and GREEN with this one.
--
-- The amendment is ONE anchored insertion per guard, immediately after the governed early return and before the first terminal-state
-- test: a non-governed UPDATE that changes state, lifecycle_version, activated_at, retired_at or updated_at is CONFLICT.  Each anchor must occur
-- exactly once in the installed source, the inverse replacement restores the installed source byte for byte, and every pg_proc
-- attribute except the source is unchanged.  Forward-only; idempotent (the marker below).
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
  anchor constant text := 'if tg_op = ''DELETE'' or old.state in (';
  marker constant text := 'BE03c lifecycle columns: governed RPCs only';
  insertion constant text := E'-- BE03c lifecycle columns: governed RPCs only; a non-governed UPDATE inside the RPC context never moves them (outside the RPC context the write guard of the table refuses the write).\n  if tg_op = ''UPDATE'' and pg_catalog.current_setting(''app.cms_rpc'', true) is not distinct from ''true''\n     and (new.state is distinct from old.state\n     or new.lifecycle_version is distinct from old.lifecycle_version\n     or new.activated_at is distinct from old.activated_at\n     or new.retired_at is distinct from old.retired_at\n     or new.updated_at is distinct from old.updated_at) then\n    raise exception ''CONFLICT'' using errcode = ''P0001'';\n  end if;\n  ';
begin
  foreach identity in array array[
    'platform_private.cms_template_versions_guard()',
    'platform_private.cms_pattern_versions_lifecycle_guard()',
    'platform_private.cms_taxonomy_versions_lifecycle_guard()'
  ] loop
    select proc.* into original from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
    if not found then
      raise exception 'lifecycle columns: % is missing', identity using errcode = '55000';
    end if;
    old_source := original.prosrc;
    if pg_catalog.strpos(old_source, marker) > 0 then
      continue;
    end if;
    comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
    if (pg_catalog.length(old_source) - pg_catalog.length(pg_catalog.replace(old_source, anchor, ''))) / pg_catalog.length(anchor) <> 1
       or pg_catalog.strpos(old_source, 'cms_governed_lifecycle_update') = 0
       or original.prorettype <> 'trigger'::pg_catalog.regtype or original.prosecdef
       or original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
       or original.proconfig is distinct from array['search_path=""']::text[] then
      raise exception 'lifecycle columns: % does not have the expected shape', identity using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(old_source, anchor, insertion || anchor);
    if pg_catalog.replace(new_source, insertion || anchor, anchor) is distinct from old_source then
      raise exception 'lifecycle columns: non-anchored change in %', identity using errcode = '55000';
    end if;
    definition := pg_catalog.pg_get_functiondef(original.oid);
    if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
         / pg_catalog.length(old_source) <> 1 then
      raise exception 'lifecycle columns: ambiguous definition of %', identity using errcode = '55000';
    end if;
    execute pg_catalog.replace(definition, old_source, new_source);
    select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
    if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
       or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
       or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
      raise exception 'lifecycle columns: replacement changed more than the source of %', identity using errcode = '55000';
    end if;
  end loop;
end;
$migration$;

commit;
