-- Slice 10 evidence lane EB (AC-038..AC-048, AC-045): the database serves no entry-level review submission,
-- decision, schedule, preview-token or publication command in Slice 10.  The CMS-03B-05..09 request rules are
-- contract-only until the Slice 11 operations exist; this file pins the database half of that statement, so it flips
-- the moment such an RPC is added without the contract and runtime evidence that goes with it.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(6);

select is(
  (select string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname, p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('platform_api', 'public_api', 'public')
      and p.proname ~ '(preview|schedul|publication|publish)'),
  null,
  'EB scope: no worker-facing function mints, opens, revokes, schedules or publishes (no preview, schedule or publication RPC exists)'
);

select is(
  (select string_agg(p.proname, ', ' order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_api'
      and p.proname ~ '(review|decision)'),
  'cms_assign_schema_review, cms_decide_schema_review, cms_get_schema_review, cms_submit_schema_review, cms_sweep_expired_review_authority',
  'EB scope: the only worker-facing review and decision functions are the 03A schema-review family, none submits or decides an entry review'
);

select is(
  (select string_agg(p.proname, ', ' order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private'
      and p.proname ~ '(entry_review|editorial_review|editorial_decision|publication|preview_token|schedule_publication)'),
  null,
  'EB scope: no private command exists for an entry review, an editorial decision, a publication or a preview token'
);

select is(
  (select count(*)::integer
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_api'
      and p.proname ~ '^cms_(create_entry|get_entry_draft|create_revision|resolve_conflict|restore_revision|list_revisions|get_conflict_detail|list_entries|get_entry_authoring_context)$'),
  9,
  'EB scope: the nine Slice 10 editorial operations are the nine worker-facing editorial RPCs'
);

select is(
  (select string_agg(table_name, ', ' order by table_name)
     from information_schema.tables
    where table_schema = 'platform_private'
      and table_name in ('cms_editorial_reviews', 'cms_editorial_decisions', 'cms_publication_schedules', 'cms_publication_versions', 'cms_preview_tokens')),
  'cms_editorial_decisions, cms_editorial_reviews, cms_preview_tokens, cms_publication_schedules, cms_publication_versions',
  'EB scope: the storage for reviews, decisions, schedules, publications and preview tokens exists while no command writes it'
);

select is(
  (select string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname, p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('platform_api', 'platform_private', 'public_api', 'public')
      and p.proname ~ '(dependency_manifest|version_set|frozen_hash|normalized_revision_hash)'),
  null,
  'EB scope: no function builds a dependency manifest, derives a version set or a frozen hash, or compares them (server derivation is Slice 11)'
);

select * from finish();
rollback;
