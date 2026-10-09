-- Slice 11 lane S11-3d, BE03b "Derived revision workflow state (E2)" (tracker
-- P2-S11-AC-085, P2-S11-AC-086): "No other code computes or stores a revision
-- state."  Every browser-visible EntryRevisionState comes from the one helper
-- platform_private.cms_revision_effective_state (set form
-- cms_revision_effective_states):
--
--   * the Slice 10 reads (cms_list_entries, cms_list_revisions, cms_get_entry_draft)
--     and the concealment classifier project / filter / classify by the derived state;
--   * the revision write responses (cms_create_entry, cms_create_revision,
--     cms_resolve_conflict, cms_restore_revision) take their `state` from the helper
--     instead of a literal;
--   * the composition admission guard reads the derived state.
--
-- Behaviour is proven row by row in phase_02_slice_11_e2_reads_*.sql,
-- _scan_*.sql and _composition_guard.sql; this file pins the structure that makes
-- the adoption un-forgettable: no function body reads the physical column or
-- hard-codes a state in a response.  The write responses cannot be told apart by
-- behaviour (a revision created in the same transaction has no evidence, so its
-- derived state is `draft`), which is why they are pinned here.
-- RED before the Slice 11 forward migrations 20261005018000..018060.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(19);

-- Body of platform_private.<name>(<args>), or '' when the function is absent.
create or replace function pg_temp.e2_body(p_signature text)
returns text
language sql
stable
as $body$
  select coalesce((
    select p.prosrc from pg_catalog.pg_proc p
     where p.oid = pg_catalog.to_regprocedure('platform_private.' || p_signature)
  ), '')
$body$;

-- ---------------------------------------------------------------- the reads ----
select ok(
  pg_temp.e2_body('cms_list_entries(jsonb)') ~ 'cms_revision_effective_states\('
    and pg_temp.e2_body('cms_list_entries(jsonb)') !~ 'revision\.state',
  'cms_list_entries derives the state in batches and never reads the physical column [P2-S11-AC-085]');
select ok(
  pg_temp.e2_body('cms_list_revisions(jsonb)') ~ 'cms_revision_effective_states\('
    and pg_temp.e2_body('cms_list_revisions(jsonb)') !~ 'candidate\.state'
    and pg_temp.e2_body('cms_list_revisions(jsonb)') !~ 'revision_row\.state',
  'cms_list_revisions derives the state in batches and never reads the physical column [P2-S11-AC-085]');
select ok(
  pg_temp.e2_body('cms_get_entry_draft(jsonb)') ~ 'cms_revision_effective_state\(revision_row\.id\)'
    and pg_temp.e2_body('cms_get_entry_draft(jsonb)') !~ 'revision_row\.state',
  'cms_get_entry_draft projects the derived state of the current draft revision [P2-S11-AC-085]');
select ok(
  pg_temp.e2_body('cms_revision_page_disposition(uuid,uuid,platform_private.cms_entry_revisions)')
      ~ 'cms_revision_effective_state\(p_revision\.id\)'
    and pg_temp.e2_body('cms_revision_page_disposition(uuid,uuid,platform_private.cms_entry_revisions)')
      !~ 'p_revision\.state',
  'the concealment classifier derives the state of a revision it is handed [P2-S11-AC-085]');
select ok(
  pg_temp.e2_body('cms_revision_page_disposition(uuid,uuid,platform_private.cms_entry_revisions,text)')
      ~ 'p_effective_state'
    and pg_temp.e2_body('cms_revision_page_disposition(uuid,uuid,platform_private.cms_entry_revisions,text)')
      !~ 'p_revision\.state',
  'its four-argument form classifies by a derived state the caller already holds (batch reads) [P2-S11-AC-085]');
select is(
  (select pg_catalog.count(*)::integer from pg_catalog.pg_proc p
    where p.pronamespace = 'platform_private'::regnamespace
      and p.proname = 'cms_revision_page_disposition'),
  2, 'exactly the three- and four-argument forms of the classifier exist [P2-S11-AC-085]');

-- -------------------------------------------------------- the write responses ----
select ok(
  pg_temp.e2_body('cms_create_entry(jsonb)') ~ 'cms_revision_effective_state\(revision_id\)'
    and pg_temp.e2_body('cms_create_entry(jsonb)') !~ '''state'',\s*''draft''',
  'cms_create_entry answers the derived state of the revision it created [P2-S11-AC-085]');
select ok(
  pg_temp.e2_body('cms_create_revision(jsonb)') ~ 'cms_revision_effective_state\(new_revision_id\)'
    and pg_temp.e2_body('cms_create_revision(jsonb)') !~ '''state'',\s*''draft''',
  'cms_create_revision answers the derived state of the revision it appended [P2-S11-AC-085]');
select ok(
  pg_temp.e2_body('cms_resolve_conflict(jsonb)') ~ 'cms_revision_effective_state\(new_revision_id\)'
    and pg_temp.e2_body('cms_resolve_conflict(jsonb)') !~ '''state'',\s*''draft''',
  'cms_resolve_conflict answers the derived state of the revision it appended [P2-S11-AC-085]');
select ok(
  pg_temp.e2_body('cms_restore_revision(jsonb)') ~ 'cms_revision_effective_state\(new_revision_id\)'
    and pg_temp.e2_body('cms_restore_revision(jsonb)') !~ '''state'',\s*''draft''',
  'cms_restore_revision answers the derived state of the revision it appended [P2-S11-AC-085]');

-- ----------------------------------------------------------- the data rule ----
select ok(
  pg_temp.e2_body('cms_composition_instance_guards()') ~ 'cms_revision_effective_state\(new\.revision_id\)'
    and pg_temp.e2_body('cms_composition_instance_guards()') !~ 'revision\.state',
  'the composition admission guard judges the derived state [P2-S11-AC-085]');

-- ------------------------------------- hardening carried by the rewritten bodies ----
select ok(
  (select bool_and(p.prosecdef and p.proowner = 'wejammin_cms_definer'::regrole
                   and coalesce(p.proconfig, array[]::text[]) @> array['search_path=""'])
     from pg_catalog.pg_proc p
    where p.pronamespace = 'platform_private'::regnamespace
      and p.proname in ('cms_list_entries', 'cms_list_revisions', 'cms_get_entry_draft',
                        'cms_create_entry', 'cms_create_revision', 'cms_resolve_conflict',
                        'cms_restore_revision', 'cms_revision_page_disposition')),
  'every rewritten read and writer (and both classifier forms) stays SECURITY DEFINER, owned by the CMS definer, with an empty search_path [P2-S11-AC-085]');
select ok(
  (select bool_and(not pg_catalog.has_function_privilege('anon', p.oid, 'execute')
                   and not pg_catalog.has_function_privilege('authenticated', p.oid, 'execute')
                   and not pg_catalog.has_function_privilege('service_role', p.oid, 'execute'))
     from pg_catalog.pg_proc p
    where p.pronamespace = 'platform_private'::regnamespace
      and p.proname in ('cms_list_entries', 'cms_list_revisions', 'cms_get_entry_draft',
                        'cms_create_entry', 'cms_create_revision', 'cms_resolve_conflict',
                        'cms_restore_revision', 'cms_revision_page_disposition',
                        'cms_composition_instance_guards')),
  'no API role can execute any of them: the private functions are reachable only through the platform_api wrappers [P2-S11-AC-085]');
select ok(
  (select bool_and(pg_catalog.has_function_privilege('service_role', p.oid, 'execute')
                   and not pg_catalog.has_function_privilege('anon', p.oid, 'execute')
                   and not pg_catalog.has_function_privilege('authenticated', p.oid, 'execute'))
     from pg_catalog.pg_proc p
    where p.pronamespace = 'platform_api'::regnamespace
      and p.proname in ('cms_list_entries', 'cms_list_revisions', 'cms_get_entry_draft',
                        'cms_create_entry', 'cms_create_revision', 'cms_resolve_conflict',
                        'cms_restore_revision')),
  'the platform_api wrappers keep their Worker-only execute grant [P2-S11-AC-085]');

-- --------------------------------- the helper is the single derivation (E2) ----
select is(
  (select pg_catalog.count(*)::integer from pg_catalog.pg_proc p
    where p.pronamespace = 'platform_private'::regnamespace
      and p.proname in ('cms_revision_effective_state', 'cms_revision_effective_states')),
  2, 'one single-id form and one set form of the helper exist [P2-S11-AC-085]');
-- The physical column is read by none of the three Slice 10 readers (the other
-- `.state` references of their bodies belong to other tables: definitions, conflicts,
-- instances, versions).
select is(
  (select string_agg(p.proname, ',' order by p.proname) from pg_catalog.pg_proc p
    where p.pronamespace = 'platform_private'::regnamespace
      and ((p.proname = 'cms_list_entries' and p.prosrc ~ 'revision\.state')
        or (p.proname = 'cms_list_revisions'
            and p.prosrc ~ '(candidate\.state\s*=\s*requested_state|revision_row\.state)')
        or (p.proname = 'cms_get_entry_draft' and p.prosrc ~ 'revision_row\.state'))),
  null, 'none of the three Slice 10 readers reads cms_entry_revisions.state [P2-S11-AC-085]');
select ok(
  (select pg_catalog.count(*) = 1 from pg_catalog.pg_proc p
    where p.pronamespace = 'platform_private'::regnamespace
      and p.proname = 'cms_list_entries_signed'),
  'the signed list wrapper still exists unchanged (the cursor seal is not touched) [P2-S11-AC-086]');
select ok(
  pg_temp.e2_body('cms_list_entries(jsonb)') ~ 'scan_bound' and pg_temp.e2_body('cms_list_entries(jsonb)') ~ 'batch_size'
    and pg_temp.e2_body('cms_list_revisions(jsonb)') ~ 'scan_bound'
    and pg_temp.e2_body('cms_list_revisions(jsonb)') ~ 'batch_size',
  'the bounds are named constants (scan_bound, batch_size), not magic numbers [P2-S11-AC-086]');
select ok(
  not exists (
    select 1 from pg_catalog.pg_proc p
     where p.pronamespace = 'platform_private'::regnamespace
       and p.proname in ('cms_list_entries', 'cms_list_revisions')
       and p.provolatile <> 'v'),
  'the readers stay VOLATILE (they set the CMS RPC context flag) [P2-S11-AC-086]');

select * from finish();
rollback;
