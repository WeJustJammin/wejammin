-- Slice 12 gap lane claude_s12_gaps_db4: P2-S12-AC-225 clause 0 (BE03c term actions 1369-1377, "Slice 12 lock order" position 6):
-- `merge` locks the survivor and the retired term FOR UPDATE in id order.  A single session cannot observe two transactions' lock
-- acquisition order, so this is the STATIC source oracle of the sibling suites phase_02_slice_12_gaps_lock_sources.sql and
-- phase_02_slice_12_pattern_updates/080-lock-order: the stored source of cms_act_taxonomy_term has comments stripped and whitespace
-- collapsed, and the oracle is anchored to the one statement that locks term rows.  It proves:
--   * the retired term (named by termKey), the survivor (survivorId) and the parent (parentId) are selected in ONE statement over
--     cms_terms, `order by term.id for update`, so the rows lock in ascending id order whichever of the two ids is smaller;
--   * that statement is the only FOR UPDATE and the only ORDER BY of the function, and it precedes both term appliers, so no term row is
--     locked out of order afterwards; the merge applier (cms_term_apply_merge) takes no row lock of its own and reads exactly the retired
--     (termKey) and survivor (survivorId) rows the statement locked.
-- Every detector has an inverse control run on the mutated source text, so each must be able to fail.  It proves the SOURCE order; two
-- opposed merges (A->B and B->A) are a race module of the root.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

create or replace function pg_temp.g4_src(p_proc text) returns text language sql stable as $body$
  select pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.regexp_replace(prosrc, '--[^\n]*', '', 'g'), '\s+', ' ', 'g'))
    from pg_catalog.pg_proc where oid = pg_catalog.to_regprocedure(p_proc)
$body$;
create or replace function pg_temp.g4_occurrences(p_src text, p_needle text) returns integer language sql immutable as $body$
  select (pg_catalog.length(p_src) - pg_catalog.length(pg_catalog.replace(p_src, p_needle, ''))) / pg_catalog.length(p_needle)
$body$;
-- The ids-in-order lock statement, matched LITERALLY with strpos (no wildcards, no LIKE underscore): the vocabulary and owner scope, the three alternatives joined by the
-- literal `or` connectives (the retired term by termKey, the parent, the survivor), then `order by term.id for update`.  A replaced
-- connective (`or` -> `and`), an inserted `and false`, a changed order or lock mode no longer matches.
create or replace function pg_temp.g4_id_order_lock(p_src text) returns boolean language sql immutable as $body$
  select pg_catalog.strpos(p_src, 'select term.id from platform_private.cms_terms term where term.taxonomy_id = lineage_id and term.owner_id = acting_party_id and (term.term_key = p_request->>''termkey'' or term.id = nullif(p_request->>''parentid'', '''')::uuid or term.id = nullif(p_request->>''survivorid'', '''')::uuid) order by term.id for update') > 0
$body$;
-- The merge applier reads exactly the rows that statement locks: the retired term by the same termKey, the survivor by the same survivorId.
create or replace function pg_temp.g4_applier_reads(p_src text) returns boolean language sql immutable as $body$
  select pg_catalog.strpos(p_src, 'survivor_id constant uuid := (p_request->>''survivorid'')::uuid;') > 0
     and pg_catalog.strpos(p_src, 'select * into retired from platform_private.cms_terms where taxonomy_id = active_row.taxonomy_id and term_key = p_request->>''termkey'';') > 0
     and pg_catalog.strpos(p_src, 'select * into survivor from platform_private.cms_terms where id = survivor_id and taxonomy_id = active_row.taxonomy_id and owner_id = p_party_id;') > 0
$body$;

create temp table g4_src on commit drop as select pg_temp.g4_src('platform_private.cms_act_taxonomy_term(jsonb)') as act,
  pg_temp.g4_src('platform_private.cms_term_apply_merge(uuid,uuid,uuid,jsonb,uuid)') as merge_apply;

select ok((select act is not null and merge_apply is not null from g4_src),
  'fixture: the stored sources of cms_act_taxonomy_term and cms_term_apply_merge were read from the catalog [P2-S12-AC-225]');
select ok((select pg_temp.g4_id_order_lock(act) from g4_src),
  'cms_act_taxonomy_term locks the retired term (termKey), the parent and the survivor (survivorId) with one statement over cms_terms ordered by term.id FOR UPDATE: ascending id order [P2-S12-AC-225]');
select is((select pg_temp.g4_occurrences(act, 'for update') from g4_src), 1,
  'that statement holds the only FOR UPDATE of the function: no term row is locked a second time or out of order [P2-S12-AC-225]');
select is((select pg_temp.g4_occurrences(act, 'order by') from g4_src), 1,
  'and the only ORDER BY of the function is the id order of that lock [P2-S12-AC-225]');
select ok((select pg_catalog.strpos(act, 'order by term.id for update') > 0
         and pg_catalog.strpos(act, 'order by term.id for update') < pg_catalog.strpos(act, 'cms_term_apply_merge(')
         and pg_catalog.strpos(act, 'order by term.id for update') < pg_catalog.strpos(act, 'cms_term_apply_write(') from g4_src),
  'both term appliers (merge and write) run after the ordered lock statement, so nothing changes a term row before it is locked [P2-S12-AC-225]');
select ok((select pg_catalog.strpos(act, 'action_value = ''merge''') > pg_catalog.strpos(act, 'order by term.id for update') from g4_src),
  'the merge branch is entered only after the locks are taken [P2-S12-AC-225]');
select is((select pg_temp.g4_occurrences(merge_apply, 'for update') + pg_temp.g4_occurrences(merge_apply, 'for share') from g4_src), 0,
  'cms_term_apply_merge takes no row lock of its own: it works under the ordered locks of the caller [P2-S12-AC-225]');
select ok((select pg_temp.g4_applier_reads(merge_apply) from g4_src),
  'cms_term_apply_merge reads the retired term by the same termKey and the survivor by the same survivorId (within the vocabulary and owner) that the lock statement names [P2-S12-AC-225]');
select ok((select pg_catalog.strpos(act, 'cms_lock_governed_authority(') < pg_catalog.strpos(act, 'order by term.id for update') from g4_src),
  'the position 1 authority lock precedes the term rows (position 6) [P2-S12-AC-225]');

-- ------------------------------------------------------------------ oracle controls (mutated source text) --
select ok(not pg_temp.g4_id_order_lock(replace((select act from g4_src), 'order by term.id for update', 'for update')),
  'control: the detector rejects the lock statement with its ORDER BY removed [P2-S12-AC-225]');
select ok(not pg_temp.g4_id_order_lock(replace((select act from g4_src), 'order by term.id for update', 'order by term.term_key for update')),
  'control: the detector rejects an order by anything but the term id [P2-S12-AC-225]');
select ok(not pg_temp.g4_id_order_lock(replace((select act from g4_src), 'order by term.id for update', 'for update order by term.id')),
  'control: the detector rejects FOR UPDATE written before the ORDER BY [P2-S12-AC-225]');
select ok(not pg_temp.g4_id_order_lock(replace((select act from g4_src), 'term.id = nullif(p_request->>''survivorid'', '''')::uuid', 'false')),
  'control: the detector rejects a lock statement that no longer names the survivor [P2-S12-AC-225]');
select ok(not pg_temp.g4_id_order_lock(replace((select act from g4_src), 'term.term_key = p_request->>''termkey''', 'false')),
  'control: the detector rejects a lock statement that no longer names the retired term [P2-S12-AC-225]');
select ok(not pg_temp.g4_id_order_lock(replace((select act from g4_src), 'term.id = nullif(p_request->>''parentid'', '''')::uuid or term.id', 'term.id = nullif(p_request->>''parentid'', '''')::uuid and term.id')),
  'control: the detector rejects the second `or` connective replaced by `and` (the statement would lock nothing unless parent and survivor coincide) [P2-S12-AC-225]');
select ok(not pg_temp.g4_id_order_lock(replace((select act from g4_src), 'p_request->>''termkey'' or term.id', 'p_request->>''termkey'' and term.id')),
  'control: the detector rejects the first `or` connective replaced by `and` [P2-S12-AC-225]');
select ok(not pg_temp.g4_id_order_lock(replace((select act from g4_src), '::uuid) order by term.id for update', '::uuid and false) order by term.id for update')),
  'control: the detector rejects `and false` inserted into the alternatives [P2-S12-AC-225]');
select ok(not pg_temp.g4_id_order_lock(replace((select act from g4_src), 'term.owner_id = acting_party_id and (', 'term.owner_id = acting_party_id and false and (')),
  'control: the detector rejects `and false` inserted before the alternatives [P2-S12-AC-225]');
select ok(not pg_temp.g4_id_order_lock(replace((select act from g4_src), 'order by term.id for update', 'order by term.id desc for update')),
  'control: the detector rejects descending id order [P2-S12-AC-225]');
select ok(not pg_temp.g4_id_order_lock(replace((select act from g4_src), 'order by term.id for update', 'order by term.id for share')),
  'control: the detector rejects FOR SHARE in place of FOR UPDATE [P2-S12-AC-225]');
select ok(not pg_temp.g4_applier_reads(replace((select merge_apply from g4_src), 'where id = survivor_id and', 'where id <> survivor_id and')),
  'control: the applier detector rejects a survivor read that is not the named survivor [P2-S12-AC-225]');
select ok(not pg_temp.g4_applier_reads(replace((select merge_apply from g4_src), 'term_key = p_request->>''termkey'';', 'term_key = p_request->>''survivorid'';')),
  'control: the applier detector rejects a retired-term read that is not the named termKey [P2-S12-AC-225]');
select is(pg_temp.g4_occurrences((select act from g4_src) || ' for update', 'for update'), 2,
  'control: the occurrence counter sees an added FOR UPDATE [P2-S12-AC-225]');

select * from finish();
rollback;
