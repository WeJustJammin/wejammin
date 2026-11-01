-- Slice 12 gap lane claude_s12_db9b, item 5: P2-S12-AC-044 "deletion" (IA03 line 533, CMS-12 Use reusable pattern, third column): "Owner/source deletion or
-- revocation preserves required immutable evidence/tombstone, removes derived access/projection, and queues idempotent dependent invalidation so no
-- orphan remains."
--
-- INVENTORY (every command that deletes or tombstones a pattern lineage, a composition source or an entry; scanned in the migrations and re-proved by
-- the catalog scan below):
--   pattern lineage      CMS-03C-09 `retire` of a pattern version (platform_private.cms_governed_retire_subject / cms_governed_apply_retirement,
--                        20261014160100): the only tombstone.  No DELETE exists: the lifecycle guard rejects DELETE (20260927290000:134-151) and no role holds it.
--   composition source   no command deletes a CompositionInstance (append-only: cms_composition_instances_immutable_guard rejects UPDATE and DELETE,
--                        20260927290000:116-118); a REMOVED ROOT is tombstoned by CMS-03C-15 accept, which APPENDS a `retired` row
--                        (20261014140600_cms_apply_pattern_update.sql:241); that tombstone is covered by phase_02_slice_12_dec193_consumers ("active->retired
--                        append, no in-place tombstone") and phase_02_slice_12_pattern_updates*.
--   entry                NONE.  cms_content_entries.lifecycle admits archived / deletion_pending / held (20260926090000:33-34; BE03b 1964, 1980, 2005) but no
--                        function writes it (catalog scan below); BE03b 1891 `entry_unavailable` is the reader side only.  BOUNDARY: the writer belongs to a later
--                        shard (archive/erasure), not specified in BE03b or BE03c.
-- This file proves the three clauses for the pattern-lineage `retire` (the one deleting command), with a live use, a nested use and an in-flight review
-- of a dependent version, and proves the absence facts for the entry and the composition-instance delete.
--
-- LABELLED FIXTURES: the publication-settings lookup prerequisite and the consumer-only entry bootstrap (../phase_02_slice_12_gaps_db9b_support).
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

select set_config('s12pd.type_count', '2', true);
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_definition/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_placement/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_placement/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_updates_common/000-helpers.sqlinc
\ir phase_02_slice_12_gaps_db9b_support/010-consumer-bootstrap.sqlinc
\ir phase_02_slice_12_gaps_db9b_support/020-provider.sqlinc

set local statement_timeout = '120s';
-- This key exists only inside the rolled-back pgTAP transaction; it is never an operational signing value.
select vault.create_secret(repeat('b2', 32), 'cms_editorial_history_cursor_active', 'pgTAP transaction-only gap lane test key');

-- submit, assign and approve a defined pattern version through the named producers (as governed_recheck_pattern/010-pattern.sqlinc does)
create or replace function pg_temp.d9d_approve(p_label text) returns void language plpgsql as $body$
declare body jsonb := pg_temp.s12pd_body(p_label); review jsonb; decision jsonb;
begin
  perform pg_temp.s12pd_run(p_label || ':submit', jsonb_build_object('subjectKind', 'pattern_version', 'subjectId', body->'id',
    'subjectHash', body->'contentHash', 'idempotencyKey', 'd9d-' || p_label || '-submit', 'context', pg_temp.s09d_context('owner', true)),
    'owner', 'service_role', 'submit');
  review := pg_temp.s12pd_body(p_label || ':submit');
  perform pg_temp.s12pd_run(p_label || ':assign', jsonb_build_object('reviewId', review->'id', 'action', 'create', 'expectedVersion', review->'version',
    'ifMatch', review->'version', 'reviewerPersonId', pg_temp.s09d_actor_id('rev1', 'person'),
    'expiresAt', to_char((clock_timestamp() + interval '1 day') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'reason', 'Deletion fixture', 'idempotencyKey', 'd9d-' || p_label || '-assign', 'context', pg_temp.s09d_context('owner', true)),
    'owner', 'service_role', 'assign');
  perform pg_temp.s12pd_run(p_label || ':decide', jsonb_build_object('reviewId', review->'id', 'decision', 'approve', 'reason', 'Deletion fixture approved',
    'expectedVersion', review->'version', 'ifMatch', review->'version', 'idempotencyKey', 'd9d-' || p_label || '-decide',
    'context', pg_temp.s09d_context('rev1', true)), 'rev1', 'service_role', 'decide');
end;
$body$;
create temp table d9d_call(label text primary key, body jsonb, state text not null, message text) on commit drop;
create or replace function pg_temp.d9d_call(p_label text, p_sql text) returns void language plpgsql security invoker as $body$
declare v_role text := current_setting('role'); v_body jsonb; v_state text := '00000'; v_message text;
begin
  execute 'set local role service_role';
  begin execute p_sql into v_body;
  exception when others then get stacked diagnostics v_state = returned_sqlstate, v_message = message_text; end;
  perform set_config('role', v_role, true);
  insert into d9d_call(label, body, state, message) values (p_label, v_body, v_state, v_message);
end;
$body$;
create or replace function pg_temp.d9d_sel(p_label text) returns void language sql as $body$
  select pg_temp.s12pu_call(p_label, 'platform_api.cms_list_pattern_selector', jsonb_build_object('contentTypeId', (select id from s12pd_types where ordinal = 1),
    'context', pg_temp.s09d_context('owner', true), 'correlationId', 'a9120000-0000-4000-8000-00000000c0d3'), 'owner') $body$;

-- ------------------------------------------------------------------------------------------------------ the world --
select * from pg_temp.s12pl_pattern('inner', 'd9d-inner', pg_temp.s12pd_forest(2));
select * from pg_temp.s12pl_pattern('outer', 'd9d-outer', pg_temp.s12pl_refs('inner', 1, 'n'));
-- an in-flight dependent: a pattern that pins `inner`, approved and NOT activated (it froze `inner` as a dependency)
select pg_temp.s12pd_run('dep', pg_temp.s12pd_request('d9d-dep', pg_temp.s12pl_refs('inner', 1, 'n'), null, 'd9d-dep-create-0001'));
select pg_temp.d9d_approve('dep');
-- live uses: a revision pinning `inner` directly and one pinning `outer` (which pins `inner`), placed by the real CMS-03C-02
select * from pg_temp.s12pu_place('pin-inner', 'inner');
select * from pg_temp.s12pu_place('pin-outer', 'outer');
select ok(pg_temp.s12pd_row('inner')->>'state' = 'active' and pg_temp.s12pd_row('outer')->>'state' = 'active' and pg_temp.s12pd_row('dep')->>'state' = 'approved'
    and exists (select 1 from platform_private.cms_governed_review_dependencies d where d.review_id::text = pg_temp.s12pd_body('dep:submit')->>'id'
                 and d.kind = 'pattern' and d.ref_id::text = pg_temp.s12pd_body('inner')->>'id'),
  'fixture: inner and outer are real ACTIVE patterns; dep is a real approved, unactivated review that froze inner as a pattern dependency [P2-S12-AC-044]');
select pg_temp.d9d_sel('sel-before');
select ok(pg_temp.s12pu_oc('sel-before') = 'ok' and pg_temp.s12pu_body('sel-before')->'items' @> jsonb_build_array(jsonb_build_object('patternKey', 'd9d-inner')),
  'control: before the retirement the selector lists inner [P2-S12-AC-044]');
select ok(pg_temp.d9l_provider('pin-inner')->'pattern'->>'outcome' = 'passed' and pg_temp.d9l_provider('pin-outer')->'pattern'->>'outcome' = 'passed',
  'control: before the retirement both pinned revisions pass the pattern provider [P2-S12-AC-044]');

-- the images the retirement must leave alone
create temp table d9d_pre on commit drop as
select pg_temp.s12pd_row('inner') as inner_row,
       (select to_jsonb(r) from platform_private.cms_governed_reviews r where r.id::text = pg_temp.s12pd_body('inner:submit')->>'id') as review_row,
       (select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text), '[]'::jsonb) from platform_private.cms_governed_review_decisions x where x.review_id::text = pg_temp.s12pd_body('inner:submit')->>'id') as decisions,
       (select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text), '[]'::jsonb) from platform_private.cms_governed_review_assignments x where x.review_id::text = pg_temp.s12pd_body('inner:submit')->>'id') as assignments,
       (select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text), '[]'::jsonb) from platform_private.cms_governed_review_dependencies x where x.review_id::text = pg_temp.s12pd_body('inner:submit')->>'id') as dependencies,
       (select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text), '[]'::jsonb) from platform_private.cms_composition_instances x
         where x.revision_id in (pg_temp.s12pl_rev('pin-inner'), pg_temp.s12pl_rev('pin-outer'))) as composition,
       (select count(*) from platform_private.outbox_events where aggregate_id::text = pg_temp.s12pd_body('inner')->>'id' and event_type = 'cms.pattern.activated.v1') as events,
       (select count(*) from audit_private.audit_events where action = 'cms.governed.retire') as retire_audits;
select ok((select jsonb_array_length(decisions) >= 1 and jsonb_array_length(assignments) >= 1 and jsonb_array_length(dependencies) >= 1 and jsonb_array_length(composition) = 4 and events = 1 and retire_audits = 0 from d9d_pre),
  'fixture: the evidence to preserve exists: the review has decisions, assignments and dependencies, the two revisions hold four composition rows (two roots each), inner has one activation event [P2-S12-AC-044]');

-- ---------------------------------------------------------------------------- the retirement (the only deleting command) --
select pg_temp.s12pd_run('inner:retire', jsonb_build_object('reviewId', pg_temp.s12pd_body('inner:submit')->'id', 'action', 'retire',
    'expectedVersion', pg_temp.s12pd_body('inner:activate')->'reviewVersion', 'ifMatch', pg_temp.s12pd_body('inner:activate')->'reviewVersion',
    'reason', 'Deletion suite retirement', 'idempotencyKey', 'd9d-inner-retire', 'context', pg_temp.s09d_context('owner', true)),
  'owner', 'service_role', 'activate');
select is(pg_temp.s12pd_state('inner:retire'), '00000', 'the owner retires inner through the real CMS-03C-09 command [P2-S12-AC-044]');

-- ------------------------------------------------------------------ clause 1: immutable evidence / tombstone kept --
select ok((select r.state = 'retired' and r.retired_at is not null and r.lifecycle_version = (pre.inner_row->>'lifecycle_version')::bigint + 1
             and (to_jsonb(r) - array['state', 'lifecycle_version', 'retired_at', 'updated_at']) = ((pre.inner_row) - array['state', 'lifecycle_version', 'retired_at', 'updated_at'])
           from platform_private.cms_pattern_versions r, d9d_pre pre where r.id::text = pre.inner_row->>'id'),
  'the pattern row is KEPT as a tombstone: state retired, retired_at set, lifecycle +1, and every definition column (tree, digest, hash, key, version, types) identical [P2-S12-AC-044]');
select ok((select (to_jsonb(r) - array['version', 'updated_at']) = (pre.review_row - array['version', 'updated_at']) and r.version = (pre.review_row->>'version')::bigint + 1
           from platform_private.cms_governed_reviews r, d9d_pre pre where r.id::text = pre.review_row->>'id'),
  'the governed review of the retired version is kept: it differs only in version + 1 and updated_at [P2-S12-AC-044]');
select ok((select (select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text), '[]'::jsonb) from platform_private.cms_governed_review_decisions x where x.review_id::text = pre.review_row->>'id') = pre.decisions
             and (select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text), '[]'::jsonb) from platform_private.cms_governed_review_assignments x where x.review_id::text = pre.review_row->>'id') = pre.assignments
             and (select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text), '[]'::jsonb) from platform_private.cms_governed_review_dependencies x where x.review_id::text = pre.review_row->>'id') = pre.dependencies
           from d9d_pre pre),
  'the decisions, assignments and dependencies of the retired version''s review are byte-identical: the approval evidence survives [P2-S12-AC-044]');
select ok((select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text), '[]'::jsonb) from platform_private.cms_composition_instances x
            where x.revision_id in (pg_temp.s12pl_rev('pin-inner'), pg_temp.s12pl_rev('pin-outer'))) = (select composition from d9d_pre),
  'the composition rows that pin the retired version are byte-identical: no source row is deleted or rewritten, the pins remain as evidence [P2-S12-AC-044]');
select ok((select count(*) = 1 from audit_private.audit_events where action = 'cms.governed.retire' and target_id::text = pg_temp.s12pd_body('inner')->>'id'),
  'one audit record of the retirement was written [P2-S12-AC-044]');

-- ----------------------------------------------------------------------- clause 2: derived access / projection removed --
select pg_temp.d9d_sel('sel-after');
select ok(pg_temp.s12pu_oc('sel-after') = 'ok' and not (pg_temp.s12pu_body('sel-after')->'items' @> jsonb_build_array(jsonb_build_object('patternKey', 'd9d-inner')))
    and pg_temp.s12pu_body('sel-after')->'items' @> jsonb_build_array(jsonb_build_object('patternKey', 'd9d-outer')),
  'the selector projection no longer lists the retired version and still lists the live outer [P2-S12-AC-044]');
select pg_temp.s12pl_entry('pl-after');
select pg_temp.s12pl_run('pl-after', pg_temp.s12pl_request('pl-after', 'inner', '/', '{}'::jsonb, 'd9d-place-after'));
select ok((select state = 'P0001' and message = 'pattern_version_not_active' and detail = '["/patternVersion"]' and before_rows = after_rows from s12pl_out where label = 'pl-after'),
  'CMS-03C-02 refuses a new placement of the retired version: pattern_version_not_active at /patternVersion, nothing written [P2-S12-AC-044]');
select * from pg_temp.s12pd_refused('after-nest', pg_temp.s12pd_request('d9d-after-nest', pg_temp.s12pl_refs('inner', 1, 'n'), null, 'd9d-after-nest'),
  'VALIDATION_FAILED', 'nested_pattern_not_active');
select ok(pg_temp.d9l_provider('pin-inner')->'pattern' @> '{"outcome": "failed", "reasonCode": "pattern_not_active", "blockingCount": 1}'::jsonb,
  'the publication provider refuses the revision that pins the retired version live: pattern_not_active, one blocking unit [P2-S12-AC-044]');
select ok(pg_temp.d9l_provider('pin-outer')->'pattern' @> '{"outcome": "failed", "reasonCode": "nested_pattern_not_active", "blockingCount": 1}'::jsonb,
  'the publication provider refuses the revision whose live pin reaches the retired version through a nested use: nested_pattern_not_active [P2-S12-AC-044]');

-- ------------------------------------------------------------------ clause 3: idempotent dependent invalidation queued --
create temp table d9d_event on commit drop as
select event.id, event.correlation_id, event.payload, event.aggregate_version
  from platform_private.outbox_events event
 where event.event_type = 'cms.pattern.activated.v1' and event.aggregate_id::text = pg_temp.s12pd_body('inner')->>'id'
 order by event.aggregate_version desc, event.id desc limit 1;  -- every event of this transaction shares one occurred_at: the highest lifecycle counter is the newest
select ok((select count(*) from platform_private.outbox_events where aggregate_id::text = pg_temp.s12pd_body('inner')->>'id' and event_type = 'cms.pattern.activated.v1')
        = (select events + 1 from d9d_pre)
    and (select aggregate_version = (pg_temp.s12pd_row('inner')->>'lifecycle_version')::bigint and correlation_id is not null
           and payload = jsonb_build_object('patternId', pg_temp.s12pd_body('inner')->'patternId', 'patternVersionId', pg_temp.s12pd_body('inner')->'id') from d9d_event),
  'the retirement queued exactly one more cms.pattern.activated.v1 event for the version, at its new lifecycle counter, with a correlation id [P2-S12-AC-044]');
-- the retire command is idempotent: an exact replay answers the stored response and queues nothing
select pg_temp.s12pd_run('inner:retire-replay', (select request from s12pd_out where label = 'inner:retire'), 'owner', 'service_role', 'activate');
select ok(pg_temp.s12pd_state('inner:retire-replay') = '00000' and pg_temp.s12pd_body('inner:retire-replay') = pg_temp.s12pd_body('inner:retire')
    and (select count(*) from platform_private.outbox_events where aggregate_id::text = pg_temp.s12pd_body('inner')->>'id' and event_type = 'cms.pattern.activated.v1') = (select events + 1 from d9d_pre)
    and (select count(*) from audit_private.audit_events where action = 'cms.governed.retire') = (select retire_audits + 1 from d9d_pre),
  'an exact replay of the retirement returns the same response and queues no second event and no second audit record [P2-S12-AC-044]');
-- the dependent in-flight review is invalidated by the recheck of that event, once
create temp table d9d_pre_dep on commit drop as
select (select to_jsonb(r) from platform_private.cms_governed_reviews r where r.id::text = pg_temp.s12pd_body('dep:submit')->>'id') as review_row,
       (select count(*) from audit_private.audit_events where action = 'cms.governed.review.invalidate') as audits;
select pg_temp.d9d_call('run-1', format('select platform_api.cms_recheck_governed_reviews(%L::jsonb)',
  jsonb_build_object('eventId', (select id from d9d_event), 'kind', 'pattern', 'refId', (select payload->>'patternVersionId' from d9d_event), 'cursor', null)::text));
select ok((select state = '00000' and (body->>'invalidated')::integer = 1 and (body->>'dependencyChanged')::integer = 1 and (body->>'examined')::integer >= 1
                and (body->>'reviewerAuthorityChanged')::integer = 0 and (body->>'unavailable')::integer = 0 from d9d_call where label = 'run-1'),
  'the recheck of the retirement event finds the in-flight review that froze the retired version and invalidates it dependency_changed [P2-S12-AC-044]');
select ok((select r.state = 'invalidated' and r.invalidated_reason = 'dependency_changed' and r.version = (pre.review_row->>'version')::bigint + 1
           from platform_private.cms_governed_reviews r, d9d_pre_dep pre where r.id::text = pre.review_row->>'id')
    and pg_temp.s12pd_row('dep')->>'state' = 'draft'
    and (select count(*) from audit_private.audit_events where action = 'cms.governed.review.invalidate') = (select audits + 1 from d9d_pre_dep),
  'the dependent review is invalidated at version + 1, its subject returns to draft, and exactly one invalidation audit record is written [P2-S12-AC-044]');
select pg_temp.d9d_call('run-2', format('select platform_api.cms_recheck_governed_reviews(%L::jsonb)',
  jsonb_build_object('eventId', (select id from d9d_event), 'kind', 'pattern', 'refId', (select payload->>'patternVersionId' from d9d_event), 'cursor', null)::text));
select ok((select state = '00000' and (body->>'invalidated')::integer = 0 and (body->>'dependencyChanged')::integer = 0 from d9d_call where label = 'run-2')
    and (select count(*) from audit_private.audit_events where action = 'cms.governed.review.invalidate') = (select audits + 1 from d9d_pre_dep),
  'a repeated run (the job is at least once) invalidates nothing more and writes no second audit record: the invalidation is idempotent [P2-S12-AC-044]');
-- a second retirement is refused and queues nothing
select pg_temp.s12pd_run('inner:retire-again', jsonb_build_object('reviewId', pg_temp.s12pd_body('inner:submit')->'id', 'action', 'retire',
    'expectedVersion', ((select review_row->>'version' from d9d_pre)::bigint + 1)::text, 'ifMatch', ((select review_row->>'version' from d9d_pre)::bigint + 1)::text,
    'reason', 'Deletion suite second retirement', 'idempotencyKey', 'd9d-inner-retire-again', 'context', pg_temp.s09d_context('owner', true)),
  'owner', 'service_role', 'activate');
select ok((select state = 'P0001' and message = 'subject_not_retirable' from s12pd_out where label = 'inner:retire-again')
    and (select count(*) from platform_private.outbox_events where aggregate_id::text = pg_temp.s12pd_body('inner')->>'id' and event_type = 'cms.pattern.activated.v1') = (select events + 1 from d9d_pre),
  'a second retirement with a fresh key is refused subject_not_retirable and queues no event [P2-S12-AC-044]');

-- ----------------------------------------------------------------- the commands that do NOT exist (BOUNDARY facts) --
select ok(not exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('platform_api', 'platform_private') and p.prokind = 'f'
       and p.prosrc ~* 'cms_content_entries'
       and p.prosrc ~* '(set|update)[^;]{0,200}lifecycle[^;]{0,40}=[^;]{0,20}''(archived|deletion_pending|held)'''),
  'BOUNDARY fact: no function of platform_api or platform_private writes an entry lifecycle of archived, deletion_pending or held: no command archives, deletes or holds an entry [P2-S12-AC-044]');
select ok(not exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('platform_api', 'platform_private') and p.prokind = 'f' and p.proname ~* '(delete|tombstone|archive|purge|erase)' and p.proname ~ '^cms_' and p.proname !~ '_guard$'),
  'BOUNDARY fact: no cms_* function other than a trigger guard is named for a delete, tombstone, archive, purge or erase (the only match is cms_definition_delete_guard, a trigger) [P2-S12-AC-044]');
select ok(not exists (select 1 from pg_catalog.pg_class c, unnest(array['service_role', 'authenticated', 'anon', 'wejammin_cms_definer']) role_name
     where c.oid in ('platform_private.cms_pattern_versions'::regclass, 'platform_private.cms_composition_instances'::regclass, 'platform_private.cms_content_entries'::regclass)
       and pg_catalog.has_table_privilege(role_name, c.oid, 'DELETE')),
  'BOUNDARY fact: no application role holds DELETE on the pattern, composition-instance or entry table [P2-S12-AC-044]');
create or replace function pg_temp.d9d_try(p_sql text) returns text language plpgsql as $body$
declare code text := 'none'; msg text;
begin
  perform set_config('app.cms_rpc', 'true', true);
  begin execute p_sql; exception when others then get stacked diagnostics msg = message_text; code := sqlstate || ':' || msg; end;
  perform set_config('app.cms_rpc', '', true);
  return code;
end;
$body$;
select ok(pg_temp.d9d_try(format('delete from platform_private.cms_composition_instances where revision_id = %L::uuid', pg_temp.s12pl_rev('pin-inner'))) ~ '^P0001:',
  'a DELETE of a composition-instance row, even inside the RPC context, is refused by the immutable guard (P0001) [P2-S12-AC-044]');
select ok(pg_temp.d9d_try(format('delete from platform_private.cms_pattern_versions where id = %L::uuid', pg_temp.s12pd_body('inner')->>'id')) ~ '^P0001:',
  'a DELETE of the retired pattern row, even inside the RPC context, is refused by the lifecycle guard (P0001) [P2-S12-AC-044]');
select ok((select count(*) = 4 from platform_private.cms_composition_instances where revision_id in (pg_temp.s12pl_rev('pin-inner'), pg_temp.s12pl_rev('pin-outer')))
    and pg_temp.s12pd_row('inner') is not null,
  'after the refused deletes the composition rows and the retired pattern row all still exist [P2-S12-AC-044]');

select finish();
rollback;
