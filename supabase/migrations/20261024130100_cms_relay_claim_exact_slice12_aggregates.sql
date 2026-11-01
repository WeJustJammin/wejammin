-- Slice 12 gap lane claude_s12_gaps_db2 (P2-S12-AC-248, BE03c "Outbox identity of the activation and taxonomy events" line 1739, DEC-166,
-- DEC-180 G3, DEC-188): claim_outbox_batch still claims cms.template.activated.v1, cms.pattern.activated.v1 and cms.taxonomy.changed.v1
-- under ANY registry-key aggregate type (20261010164000 widened the closed allowlist with a regex alternative "until Slice 12 narrows it to
-- its own tuple", and 20261014050800 left the narrowing to a closing migration).  This migration is that narrowing, by a guarded anchored
-- amendment of the LIVE source: the regex alternative is replaced by the four exact tuples
--   (cms.template.activated.v1, cms_template_version), (cms.pattern.activated.v1, cms_pattern_version),
--   (cms.taxonomy.changed.v1, cms_taxonomy_version)  [activation side]  and  (cms.taxonomy.changed.v1, cms_term)  [CMS-03C-03 term action].
-- The anchor occurs exactly once, the inverse replacement restores the installed source byte for byte, every pg_proc attribute except the
-- source is unchanged.  The cms.pattern. and cms.taxonomy. producer prefixes stay registered insert-if-absent (20261010164000).
-- Debug-by-test: supabase/tests/phase_02_slice_12_gaps_relay_aggregates.sql is RED before and GREEN after.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.claim_outbox_batch(uuid,integer,integer)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  definition text;
  comment_text text;
  anchor_old constant text := E'(\'cms.localization.changed.v1\', \'cms_locale_variant\'))\n        or (e.event_type in (\n              \'cms.template.activated.v1\', \'cms.pattern.activated.v1\',\n              \'cms.taxonomy.changed.v1\')\n            and e.aggregate_type ~ \'^[a-z][a-z0-9_]{0,63}$\'))';
  anchor_new constant text := E'(\'cms.localization.changed.v1\', \'cms_locale_variant\'),\n          (\'cms.template.activated.v1\', \'cms_template_version\'),\n          (\'cms.pattern.activated.v1\', \'cms_pattern_version\'),\n          (\'cms.taxonomy.changed.v1\', \'cms_taxonomy_version\'),\n          (\'cms.taxonomy.changed.v1\', \'cms_term\'))\n      )';
begin
  select proc.* into original from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'outbox claim missing: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if pg_catalog.strpos(old_source, 'cms_template_version') > 0 then
    return;
  end if;
  if not original.prosecdef or original.prokind <> 'f'
     or original.proconfig is distinct from array['search_path=""']::text[] then
    raise exception 'outbox claim: unexpected attributes' using errcode = '55000';
  end if;
  if (pg_catalog.length(old_source) - pg_catalog.length(pg_catalog.replace(old_source, anchor_old, '')))
       / pg_catalog.length(anchor_old) <> 1 then
    raise exception 'outbox claim: unexpected anchor' using errcode = '55000';
  end if;
  new_source := pg_catalog.replace(old_source, anchor_old, anchor_new);
  if pg_catalog.replace(new_source, anchor_new, anchor_old) <> old_source then
    raise exception 'outbox claim: non-anchor change' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'outbox claim: ambiguous definition' using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc <> new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' <> pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'outbox claim: replacement changed more than the source' using errcode = '55000';
  end if;
end;
$migration$;

commit;
