-- BE03c "Slice 12 lock order" position 6 for the assigning writers (V12-01; P2-S12-AC-276): a 03b entry writer that assigns a term takes the
-- cms_terms rows FOR SHARE in ascending id order, after every earlier position (the entry, authority, pinned targets, pattern versions, the
-- content-type version and the live review rows the revision insert invalidates), so that term locks serialize merge and assignment.
-- A single session cannot observe the acquisition order of two transactions, so this is a STATIC check of the stored function sources (the
-- precedent of phase_02_slice_12_gaps_lock_sources.sql): comments stripped, whitespace collapsed, the FIRST occurrence of each anchor must
-- appear in increasing order; each check has a reversed-anchor control.  Two simultaneous transactions (a term merge against an assigning
-- writer, P2-S12-AC-277 (3)) are a race scenario for the root's race lane; no existing module covers it (see the lane report).
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

create or replace function pg_temp.lo_src(p_proc text) returns text language sql stable as $body$
  select pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.regexp_replace(prosrc, '--[^\n]*', '', 'g'), '\s+', ' ', 'g'))
    from pg_catalog.pg_proc where oid = pg_catalog.to_regprocedure(p_proc)
$body$;
create or replace function pg_temp.lo_ordered(p_src text, p_anchors text[]) returns boolean language plpgsql immutable as $body$
declare previous integer := 0; anchor text; at_pos integer;
begin
  if p_src is null then return false; end if;
  foreach anchor in array p_anchors loop
    at_pos := pg_catalog.strpos(p_src, pg_catalog.lower(anchor));
    if at_pos = 0 or at_pos <= previous then return false; end if;
    previous := at_pos;
  end loop;
  return true;
end;
$body$;
create or replace function pg_temp.lo_count(p_src text, p_anchor text) returns integer language sql immutable as $body$
  select (pg_catalog.length(p_src) - pg_catalog.length(pg_catalog.replace(p_src, pg_catalog.lower(p_anchor), ''))) / pg_catalog.length(p_anchor)
$body$;

-- ---- the three value writers: revision insert (position 5 trigger), composition carry, THEN the term lock, THEN the assignment rows
select ok(pg_temp.lo_ordered(pg_temp.lo_src('platform_private.cms_create_entry(jsonb)'),
    array['insert into platform_private.cms_entry_revisions', 'cms_lock_term_plan(', 'cms_record_term_assignments(']),
  'cms_create_entry locks the assigned terms (position 6) after the revision insert and before it appends the assignment rows [P2-S12-AC-276]');
select ok(pg_temp.lo_ordered(pg_temp.lo_src('platform_private.cms_create_revision(jsonb)'),
    array['insert into platform_private.cms_entry_revisions', 'cms_revision_composition_carry(', 'cms_lock_term_plan(', 'cms_record_term_assignments(']),
  'cms_create_revision locks the assigned terms (position 6) after the revision insert and the composition carry, before the assignment rows [P2-S12-AC-276]');
select ok(pg_temp.lo_ordered(pg_temp.lo_src('platform_private.cms_resolve_conflict(jsonb)'),
    array['insert into platform_private.cms_entry_revisions', 'cms_revision_composition_carry(', 'cms_lock_term_plan(', 'cms_record_term_assignments(']),
  'cms_resolve_conflict locks the assigned terms (position 6) after the revision insert and the composition carry, before the assignment rows [P2-S12-AC-276]');
select ok(pg_temp.lo_ordered(pg_temp.lo_src('platform_private.cms_restore_revision(jsonb)'),
    array['insert into platform_private.cms_entry_revisions', 'cms_restore_composition_copy(', 'cms_restore_lock_term_plan(', 'cms_restore_record_term_assignments(']),
  'cms_restore_revision locks the assigned terms (position 6) after the revision insert and the composition copy, before the assignment rows [P2-S12-AC-276]');
select ok(
  (select bool_and(pg_temp.lo_count(pg_temp.lo_src(p), a) = 1)
     from (values ('platform_private.cms_create_entry(jsonb)', 'cms_lock_term_plan('),
                  ('platform_private.cms_create_revision(jsonb)', 'cms_lock_term_plan('),
                  ('platform_private.cms_resolve_conflict(jsonb)', 'cms_lock_term_plan('),
                  ('platform_private.cms_restore_revision(jsonb)', 'cms_restore_lock_term_plan(')) v(p, a)),
  'each assigning writer takes the term lock exactly once [P2-S12-AC-276]');
-- controls: the detector rejects the reversed order
select ok(not pg_temp.lo_ordered(pg_temp.lo_src('platform_private.cms_create_revision(jsonb)'),
    array['cms_record_term_assignments(', 'cms_lock_term_plan(']),
  'control: a lock after the assignment rows is rejected by the detector [P2-S12-AC-276]');
select ok(not pg_temp.lo_ordered(pg_temp.lo_src('platform_private.cms_restore_revision(jsonb)'),
    array['cms_restore_lock_term_plan(', 'insert into platform_private.cms_entry_revisions']),
  'control: a lock before the revision insert is rejected by the detector [P2-S12-AC-276]');

-- ---- the lock helpers: lock FOR SHARE in ascending id order, THEN re-check under the lock
select ok(pg_temp.lo_ordered(pg_temp.lo_src('platform_private.cms_lock_term_plan(uuid,uuid,uuid,jsonb,text[])'),
    array['cms_taxonomy_value_plan(', 'order by term.id for share', 'cms_term_assignable(']),
  'the value-writer helper reads the plan, locks the terms FOR SHARE in ascending id order, then re-checks the authored terms under the lock [P2-S12-AC-276]');
select ok(pg_temp.lo_ordered(pg_temp.lo_src('platform_private.cms_restore_lock_term_plan(uuid,uuid,uuid,jsonb,jsonb)'),
    array['order by term.id for share', 'cms_restore_term_plan(']),
  'the restore helper locks the carried terms FOR SHARE in ascending id order, then re-plans under the lock [P2-S12-AC-276]');
select ok(not pg_temp.lo_ordered(pg_temp.lo_src('platform_private.cms_lock_term_plan(uuid,uuid,uuid,jsonb,text[])'),
    array['cms_term_assignable(', 'order by term.id for share']),
  'control: a re-check before the lock is rejected by the detector [P2-S12-AC-276]');
select ok(pg_catalog.strpos(pg_temp.lo_src('platform_private.cms_lock_term_plan(uuid,uuid,uuid,jsonb,text[])'), 'lock_not_available') > 0
    and pg_catalog.strpos(pg_temp.lo_src('platform_private.cms_lock_term_plan(uuid,uuid,uuid,jsonb,text[])'), '''conflict''') > 0,
  'a lock timeout or deadlock victim is converted to the typed 409 CONFLICT (retry with the same idempotency key) [P2-S12-AC-276]');

select * from finish();
rollback;
