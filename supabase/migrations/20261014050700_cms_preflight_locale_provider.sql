-- Slice 12 lane locale, registration of the preflight provider cms.locale.no_fallback_gate version 1
-- (BE03c Preflight providers registered by Slice 12 1397; BE03b Publication preflight registry 1811-1818;
-- tracker P2-S12-AC-240, AC-241):
--
--   1. the deployed evaluator cms_evaluate_preflight dispatches the `locale` category to
--      cms_locale_no_fallback_gate BEFORE the registry row names the provider, so no category ever evaluates
--      `unavailable` with provider_unavailable because its provider is not implemented (AC-241).  The branch
--      is inserted before the generic `preflight.<category>` key check, which stays the last test of a
--      database row, by a guarded anchored amendment of the LIVE source (one anchor occurring exactly once,
--      the inverse replacement restores the installed source byte for byte, every pg_proc attribute except
--      the source is unchanged).  The pattern and taxonomy providers register their own branches in front of
--      the same anchor;
--   2. then the registry row: a strictly newer row (registry version 2) for the category `locale`, provider
--      cms.locale.no_fallback_gate version 1, kind `database`, replacing the reference-gate row (version 1).
--      The `route`, `media` and `privacy` rows stay on the reference gate.  The seeding release record is
--      the fixed namespaced id 0d6a0d6a-0000-4000-8000-000000000138 (DEC-138), as 0d6a0d6a-...0134 seeds
--      DEC-134's rows.
-- Forward-only.
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
    $a$    elsif registry_row.provider_key <> 'preflight.' || registry_row.category then$a$;
  anchor_new constant text :=
    $a$    elsif registry_row.category = 'locale' and registry_row.provider_key = 'cms.locale.no_fallback_gate' then
      -- Slice 12 (DEC-138): the locale gate, evaluated for the phase of this evaluation.
      select gate.outcome, gate.reason_code, gate.blocking_count
        into outcome, reason, offenders
        from platform_private.cms_locale_no_fallback_gate(revision_row.id, phase) gate;

$a$ || anchor_old;
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
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'preflight evaluator: unexpected attributes' using errcode = '55000';
  end if;
  if (pg_catalog.length(old_source) - pg_catalog.length(pg_catalog.replace(old_source, anchor_old, '')))
       / pg_catalog.length(anchor_old) <> 1
     or pg_catalog.strpos(old_source, 'cms.locale.no_fallback_gate') <> 0 then
    raise exception 'preflight evaluator: unexpected anchor' using errcode = '55000';
  end if;
  new_source := pg_catalog.replace(old_source, anchor_old, anchor_new);
  if pg_catalog.replace(new_source, anchor_new, anchor_old) <> old_source then
    raise exception 'preflight evaluator: non-anchor change' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'preflight evaluator: ambiguous definition' using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc <> new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' <> pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'preflight evaluator: replacement changed more than the source' using errcode = '55000';
  end if;
end;
$migration$;

-- The registry row, inside a CMS migration context exactly like the DEC-134 seed.
select pg_catalog.set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_preflight_registry(
  owner_id, state, version, category, owner_slice, provider_key,
  provider_version, provider_kind, reference_kind
) values (
  '0d6a0d6a-0000-4000-8000-000000000138'::uuid, 'seeded', 2, 'locale', 'slice-12',
  'cms.locale.no_fallback_gate', 1, 'database', null
);

commit;
