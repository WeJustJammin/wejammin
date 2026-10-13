-- Slice 11 lane S11-3b: the settings advisory lock has ONE position in the BE03b global lock order (DEC-157;
-- tracker P2-S11-AC-092, finding 5 of the 2026-10-09 SQL2 reverification).
--
-- The owner settings advisory key ('cms.settings_snapshot:' || owner) is a LEAF: it is taken only at the tail of an
-- ordinary write (create entry / append / resolve / restore / locale variant), AFTER the reservation is completed and
-- therefore after every canonical position (0, 1, 2, 4) and before nothing but the snapshot insert.  No command that
-- takes the review row (position 5), the schedule row (6) or the lineage lock (7) - the decision, schedule, publish
-- and execute commands - and none of the helpers they call (manifest builder, frozen-currency check, settings
-- lookup, preflight evaluator) takes it, so no decision/publication/execution interleaving can invert it with the
-- review lock.  The three-session interleaving itself is race runner 017.
-- This file is the static half: a function that starts taking the key outside its position fails here.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(6);

-- 1: the key is named by exactly the five ordinary writers (nothing else may take it).
select is(
  (select string_agg(p.proname, ',' order by p.proname)
     from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('platform_private', 'platform_api')
      and p.prosrc like '%cms.settings_snapshot:%'),
  'cms_author_locale_variant,cms_create_entry,cms_create_revision,cms_resolve_conflict,cms_restore_revision',
  'only the five ordinary write tails name the owner settings advisory key [P2-S11-AC-092]');

-- 2: in each writer the key is taken after the reservation was completed (the leaf of the transaction).
select is(
  (select string_agg(p.proname, ',' order by p.proname)
     from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private'
      and p.proname in ('cms_author_locale_variant', 'cms_create_entry', 'cms_create_revision', 'cms_resolve_conflict', 'cms_restore_revision')
      and pg_catalog.strpos(p.prosrc, 'cms.settings_snapshot:') > pg_catalog.strpos(p.prosrc, 'cms_complete(')
      and pg_catalog.strpos(p.prosrc, 'cms_complete(') > 0),
  'cms_author_locale_variant,cms_create_entry,cms_create_revision,cms_resolve_conflict,cms_restore_revision',
  'every writer takes the settings key only after cms_complete (after every canonical lock position) [P2-S11-AC-092]');

-- 3: after the key a writer takes no further row lock.
select is(
  (select string_agg(p.proname, ',' order by p.proname)
     from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private'
      and p.proname in ('cms_author_locale_variant', 'cms_create_entry', 'cms_create_revision', 'cms_resolve_conflict', 'cms_restore_revision')
      and pg_catalog.substr(p.prosrc, pg_catalog.strpos(p.prosrc, 'cms.settings_snapshot:')) ~* '\sfor\s+(no\s+key\s+)?(update|share)\b'),
  null,
  'no writer takes a row lock after the settings key: the key is a leaf [P2-S11-AC-092]');

-- 4: the lookup the manifest builder and the frozen-currency check use neither locks nor writes.
select ok(
  (select p.prosrc !~* '(advisory|for\s+(no\s+key\s+)?(update|share)|insert\s+into|update\s+platform_private)'
     from pg_catalog.pg_proc p
    where p.oid = 'platform_private.cms_settings_snapshot(uuid)'::pg_catalog.regprocedure),
  'cms_settings_snapshot is the read-only lookup: no advisory lock, no row lock, no write [P2-S11-AC-092]');

-- 5: the commands that take the review row, the schedule row or the lineage lock, and the helpers they call, take no
-- advisory lock at all (the lineage lock itself is the one named leaf in cms_publication_lineage_lock).
select is(
  (select string_agg(p.proname, ',' order by p.proname)
     from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private'
      and p.proname in ('cms_record_review_decision', 'cms_assign_editorial_reviewer', 'cms_submit_review',
                        'cms_schedule_publication', 'cms_publish_revision', 'cms_execute_publication_schedule',
                        'cms_claim_due_publication_schedules', 'cms_publication_lock_authority', 'cms_publication_lock_review',
                        'cms_schedule_lock_review', 'cms_build_dependency_manifest', 'cms_frozen_dependencies_status',
                        'cms_evaluate_preflight', 'cms_publication_preflight_verdict', 'cms_publication_stale_refusal',
                        'cms_append_publication_lineage', 'cms_invalidate_editorial_review')
      and p.prosrc ~* 'advisory'),
  null,
  'no decision, schedule, publish, execute or invalidation command and no helper of theirs takes an advisory lock directly [P2-S11-AC-092]');
select is(
  (select string_agg(p.proname, ',' order by p.proname)
     from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private'
      and p.proname ~ '^cms_(publication|lineage|schedule|settings)'
      and p.prosrc ~* 'pg_advisory'),
  'cms_publication_lineage_lock',
  'across the publication, lineage, schedule and settings helpers the only advisory-lock taker is the lineage lock (position 7) [P2-S11-AC-092]');

select * from finish();
rollback;
