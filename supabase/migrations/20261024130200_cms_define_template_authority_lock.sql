-- Slice 12 gap lane claude_s12_gaps_db2 (P2-S12-AC-276, BE03c "Slice 12 lock order" table row CMS-03C-01 and rule 1): CMS-03C-01 must take
-- position 1 - the caller's designer grant rows FOR SHARE - and re-prove its capability under that lock, so that a revocation committed
-- first wins (403) and a later revocation waits for the writer.  The installed body checks cms_template_designer_authorized with no lock
-- (CMS-03C-12 and CMS-03C-16 already call cms_lock_governed_authority first).  This migration inserts that one call before the existing
-- authority check - which then IS the re-proof under the lock - by a guarded anchored amendment of the LIVE source: the anchor occurs
-- exactly once, the inverse replacement restores the installed source byte for byte, every pg_proc attribute except the source is
-- unchanged.  cms_lock_governed_authority returns silently for an unresolvable actor, so the refusals of an unauthenticated or
-- non-member caller are unchanged.  Debug-by-test: supabase/tests/phase_02_slice_12_gaps_lock_sources.sql is RED before, GREEN after.
-- Forward-only; idempotent (marker).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_define_template(jsonb)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  definition text;
  comment_text text;
  anchor_old constant text := 'if not platform_private.cms_template_designer_authorized(actor_id, acting_party_id) then';
  anchor_new constant text := E'-- BE03c lock order position 1: the designer grant rows FOR SHARE; the check below is the re-proof under the lock.\n  perform platform_private.cms_lock_governed_authority(actor_id, acting_party_id, \'cms.template_designer\');\n  if not platform_private.cms_template_designer_authorized(actor_id, acting_party_id) then';
begin
  select proc.* into original from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'define template missing: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  if pg_catalog.strpos(old_source, 'cms_lock_governed_authority') > 0 then
    return;
  end if;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if not original.prosecdef or original.prokind <> 'f' or original.proconfig is distinct from array['search_path=""']::text[] then
    raise exception 'define template: unexpected attributes' using errcode = '55000';
  end if;
  if (pg_catalog.length(old_source) - pg_catalog.length(pg_catalog.replace(old_source, anchor_old, ''))) / pg_catalog.length(anchor_old) <> 1 then
    raise exception 'define template: unexpected anchor' using errcode = '55000';
  end if;
  new_source := pg_catalog.replace(old_source, anchor_old, anchor_new);
  if pg_catalog.replace(new_source, anchor_new, anchor_old) <> old_source then
    raise exception 'define template: non-anchor change' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, ''))) / pg_catalog.length(old_source) <> 1 then
    raise exception 'define template: ambiguous definition' using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc <> new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' <> pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'define template: replacement changed more than the source' using errcode = '55000';
  end if;
end;
$migration$;

commit;
