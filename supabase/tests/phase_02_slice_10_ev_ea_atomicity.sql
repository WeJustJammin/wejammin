-- Slice 10 evidence lane EA (P2-S10-AC-009, AC-015, AC-027): the audit and outbox effects of the
-- CMS-03B-01 append, CMS-03B-02 resolve and CMS-03B-04 restore commit atomically with the revision.
--
-- A count that rises by one revision, one audit row and one outbox event on success cannot tell a
-- single transaction from three independent writes.  FAULT INJECTION can: a trigger that raises on
-- the audit insert, on the outbox insert, on the field-value insert or on the completion of the
-- idempotency reservation is installed inside a rolled-back subtransaction, the real command is
-- called, and the database-wide fingerprint (entries, revisions, values, relations, conflicts,
-- reservations, outbox, audit) after the failed call must equal the fingerprint before it.  Every
-- operation also runs the identical call with NO fault as the control: it must change the
-- fingerprint by exactly one revision, one audit row and one outbox event (the restore writes one
-- more outbox event, its chain evidence), so a vacuous setup cannot pass.
--
-- The commands are called through the named worker-facing RPCs exactly as the Worker calls them.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_relation_authoring/000-relation-fixture.sqlinc
\ir phase_02_slice_10_rpc/009-restore-policy-binding.sqlinc

create temp table s10a_calls(label text primary key, state text, message text, response jsonb) on commit drop;
create or replace function pg_temp.s10a_call(p_label text, p_sql text)
returns void
language plpgsql
as $body$
declare result jsonb;
begin
  begin
    execute p_sql into result;
    insert into s10a_calls values (p_label, '00000', null, result)
    on conflict (label) do update set state = excluded.state, message = null, response = excluded.response;
  exception when others then
    insert into s10a_calls values (p_label, sqlstate, sqlerrm, null)
    on conflict (label) do update set state = excluded.state, message = excluded.message, response = null;
  end;
end;
$body$;

create or replace function pg_temp.s10a_counts()
returns jsonb
language sql
stable
as $body$
  select jsonb_build_object(
    'entries', (select count(*) from platform_private.cms_content_entries),
    'revisions', (select count(*) from platform_private.cms_entry_revisions),
    'values', (select count(*) from platform_private.cms_entry_field_values),
    'relations', (select count(*) from platform_private.cms_entry_relations),
    'conflicts', (select count(*) from platform_private.cms_conflict_records),
    'manifests', (select count(*) from platform_private.cms_restore_chain_manifests),
    'reservations', (select count(*) from platform_private.idempotency_records),
    'outbox', (select count(*) from platform_private.outbox_events),
    'audit', (select count(*) from audit_private.audit_events))
$body$;

-- Installs `p_install` (a fault, or `select 1` for the control) in a subtransaction that is always
-- rolled back, calls `p_call`, and reports the fingerprint before and after, the failure message
-- and the response.  Variable assignments survive the rollback; table changes do not.
create or replace function pg_temp.s10a_run(p_install text, p_call text)
returns jsonb
language plpgsql
as $body$
declare
  before_counts jsonb;
  after_counts jsonb;
  failure text;
  result jsonb;
  sentinel constant text := 'S10A_SENTINEL_5b1e9c';
begin
  begin
    execute p_install;
    before_counts := pg_temp.s10a_counts();
    begin
      execute p_call into result;
    exception when others then
      failure := sqlerrm;
    end;
    after_counts := pg_temp.s10a_counts();
    raise exception '%', sentinel using errcode = 'P0001';
  exception when others then
    if sqlerrm <> sentinel then raise; end if;
  end;
  return jsonb_build_object(
    'before', before_counts, 'after', after_counts, 'failure', failure, 'result', result);
end;
$body$;

-- A trigger that raises 'S10A_FAULT' before the given kind of write on the given table.
create or replace function pg_temp.s10a_fault(p_table text, p_event text)
returns text
language sql
immutable
as $body$
  select 'create function public.s10a_fault_trigger() returns trigger language plpgsql as $f$ '
      || 'begin raise exception ''S10A_FAULT'' using errcode = ''P0001''; end $f$; '
      || 'create trigger s10a_fault before ' || p_event || ' on ' || p_table
      || ' for each row execute function public.s10a_fault_trigger();'
$body$;

create or replace function pg_temp.s10a_delta(p_run jsonb, p_key text)
returns integer
language sql
immutable
as $body$
  select ((p_run->'after'->>p_key)::integer - (p_run->'before'->>p_key)::integer)
$body$;

-- ---- an entry with an open conflict ------------------------------------------------------------
select pg_temp.s10a_call('create', pg_temp.s10r_create_sql(
  jsonb_build_object('title', 'A'), 's10-ea-atom-create-0001'));
create temp table s10a_entry on commit drop as
select response->'entry'->>'id' as entry_id, response->'revision'->>'id' as rev1
from s10a_calls where label = 'create';
select pg_temp.s10a_call('theirs', pg_temp.s10r_revision_sql((select entry_id from s10a_entry),
  jsonb_build_object('title', 'B'), '1', '1', 's10-ea-atom-theirs-0001'));
select pg_temp.s10a_call('yours', pg_temp.s10r_revision_sql((select entry_id from s10a_entry),
  jsonb_build_object('title', 'C'), '1', '2', 's10-ea-atom-yours-0001'));
select is((select response->>'kind' from s10a_calls where label = 'yours'), 'conflict',
  'fixture: a stale same-field edit records the open conflict that the resolve probes use');
create temp table s10a_conflict on commit drop as
select id as conflict_id from platform_private.cms_conflict_records
 where entry_id = (select entry_id::uuid from s10a_entry) and state = 'open';

create or replace function pg_temp.s10a_append_sql(p_key text)
returns text language sql stable as $body$
  select pg_temp.s10r_revision_sql((select entry_id from s10a_entry),
    jsonb_build_object('title', 'Z'), '2', '2', p_key)
$body$;

create or replace function pg_temp.s10a_resolve_sql(p_key text)
returns text language sql stable as $body$
  select 'select platform_api.cms_resolve_conflict(' || quote_literal(jsonb_build_object(
    'entryId', (select entry_id from s10a_entry), 'conflictId', (select conflict_id from s10a_conflict),
    'baseRevision', '1',
    'choices', jsonb_build_array(jsonb_build_object('path', '/fields/' || pg_temp.s10r_fid('title'), 'choice', 'theirs')),
    'expectedVersion', '2', 'ifMatch', '2', 'idempotencyKey', p_key,
    'context', jsonb_build_object(
      'actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094',
      'correlationId', 'a9100000-0000-4000-8000-000000000095'))::text) || '::jsonb)'
$body$;

create or replace function pg_temp.s10a_restore_sql(p_key text)
returns text language sql stable as $body$
  select 'select platform_api.cms_restore_revision(' || quote_literal(jsonb_build_object(
    'entryId', (select entry_id from s10a_entry), 'revisionId', (select rev1 from s10a_entry),
    'migrationChainId', platform_private.cms_restore_chain_manifest_id(
      platform_private.cms_restore_chain_derive(
        (select value::uuid from s10r_ids where key = 'typeId'),
        (select value::uuid from s10r_ids where key = 'versionId'),
        (select value::uuid from s10r_ids where key = 'versionId'))->>'hash'),
    'expectedVersion', '2', 'idempotencyKey', p_key,
    'context', jsonb_build_object(
      'actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094',
      'correlationId', 'a9100000-0000-4000-8000-000000000095'))::text) || '::jsonb)'
$body$;

-- ---- controls: the same calls with no fault write exactly the declared effects -------------------
create temp table s10a_control on commit drop as
select 'append' as op, pg_temp.s10a_run('select 1', pg_temp.s10a_append_sql('s10-ea-atom-ctl-append')) as run
union all select 'resolve', pg_temp.s10a_run('select 1', pg_temp.s10a_resolve_sql('s10-ea-atom-ctl-resolve'))
union all select 'restore', pg_temp.s10a_run('select 1', pg_temp.s10a_restore_sql('s10-ea-atom-ctl-restore'));

select is(
  (select array[pg_temp.s10a_delta(run, 'revisions'), pg_temp.s10a_delta(run, 'audit'),
                pg_temp.s10a_delta(run, 'outbox'), pg_temp.s10a_delta(run, 'reservations')]
     from s10a_control where op = 'append'),
  array[1, 1, 1, 1],
  'control: an append with no fault commits one revision, one audit row, one outbox event and one reservation');
select is(
  (select array[pg_temp.s10a_delta(run, 'revisions'), pg_temp.s10a_delta(run, 'audit'),
                pg_temp.s10a_delta(run, 'outbox'), pg_temp.s10a_delta(run, 'reservations')]
     from s10a_control where op = 'resolve'),
  array[1, 1, 1, 1],
  'control: a resolve with no fault commits one revision, one audit row, one outbox event and one reservation');
select is(
  (select array[pg_temp.s10a_delta(run, 'revisions'), pg_temp.s10a_delta(run, 'audit'),
                pg_temp.s10a_delta(run, 'outbox'), pg_temp.s10a_delta(run, 'manifests')]
     from s10a_control where op = 'restore'),
  array[1, 2, 2, 1],
  'control: a restore with no fault commits one revision, two audit rows (entry and chain evidence), two outbox events and one chain manifest');

-- ---- faults: a failure on ANY later effect leaves no earlier effect behind ----------------------
create temp table s10a_faulted on commit drop as
select op || ' / ' || fault.label as label, op, fault.label as fault,
       pg_temp.s10a_run(fault.install, call.sql) as run
from (values
  ('append', pg_temp.s10a_append_sql('s10-ea-atom-flt-append')),
  ('resolve', pg_temp.s10a_resolve_sql('s10-ea-atom-flt-resolve')),
  ('restore', pg_temp.s10a_restore_sql('s10-ea-atom-flt-restore'))
) as call(op, sql)
cross join (values
  ('audit insert', pg_temp.s10a_fault('audit_private.audit_events', 'insert')),
  ('outbox insert', pg_temp.s10a_fault('platform_private.outbox_events', 'insert')),
  ('field value insert', pg_temp.s10a_fault('platform_private.cms_entry_field_values', 'insert')),
  ('reservation completion', pg_temp.s10a_fault('platform_private.idempotency_records', 'update'))
) as fault(label, install);

select is(
  (select count(*)::integer from s10a_faulted
    where run->>'failure' like '%S10A_FAULT%'),
  12,
  'every injected failure surfaced from the real command: none of the 12 (operation x fault) calls swallowed it');

select is(
  (select run->'after' from s10a_faulted where label = 'append / audit insert'),
  (select run->'before' from s10a_faulted where label = 'append / audit insert'),
  'append: a failure on the audit insert rolls back the revision, values, reservation and outbox event');
select is(
  (select run->'after' from s10a_faulted where label = 'append / outbox insert'),
  (select run->'before' from s10a_faulted where label = 'append / outbox insert'),
  'append: a failure on the outbox insert rolls back the revision, values, reservation and audit row');
select is(
  (select run->'after' from s10a_faulted where label = 'append / field value insert'),
  (select run->'before' from s10a_faulted where label = 'append / field value insert'),
  'append: a failure on the field-value insert leaves no revision, audit row, outbox event or reservation');
select is(
  (select run->'after' from s10a_faulted where label = 'append / reservation completion'),
  (select run->'before' from s10a_faulted where label = 'append / reservation completion'),
  'append: a failure completing the idempotency reservation rolls back the revision, audit row and outbox event');

select is(
  (select run->'after' from s10a_faulted where label = 'resolve / audit insert'),
  (select run->'before' from s10a_faulted where label = 'resolve / audit insert'),
  'resolve: a failure on the audit insert rolls back the revision, the conflict closure, the reservation and the outbox event');
select is(
  (select run->'after' from s10a_faulted where label = 'resolve / outbox insert'),
  (select run->'before' from s10a_faulted where label = 'resolve / outbox insert'),
  'resolve: a failure on the outbox insert rolls back the revision, the conflict closure, the reservation and the audit row');
select is(
  (select run->'after' from s10a_faulted where label = 'resolve / field value insert'),
  (select run->'before' from s10a_faulted where label = 'resolve / field value insert'),
  'resolve: a failure on the field-value insert leaves the conflict open and writes no revision, audit row or outbox event');
select is(
  (select run->'after' from s10a_faulted where label = 'resolve / reservation completion'),
  (select run->'before' from s10a_faulted where label = 'resolve / reservation completion'),
  'resolve: a failure completing the idempotency reservation rolls back the revision, the conflict closure, audit row and outbox event');

select is(
  (select run->'after' from s10a_faulted where label = 'restore / audit insert'),
  (select run->'before' from s10a_faulted where label = 'restore / audit insert'),
  'restore: a failure on the audit insert rolls back the revision, the chain manifest, the reservation and both outbox events');
select is(
  (select run->'after' from s10a_faulted where label = 'restore / outbox insert'),
  (select run->'before' from s10a_faulted where label = 'restore / outbox insert'),
  'restore: a failure on the outbox insert rolls back the revision, the chain manifest, the reservation and the audit row');
select is(
  (select run->'after' from s10a_faulted where label = 'restore / field value insert'),
  (select run->'before' from s10a_faulted where label = 'restore / field value insert'),
  'restore: a failure on the field-value insert leaves no revision, chain manifest, audit row or outbox event');
select is(
  (select run->'after' from s10a_faulted where label = 'restore / reservation completion'),
  (select run->'before' from s10a_faulted where label = 'restore / reservation completion'),
  'restore: a failure completing the idempotency reservation rolls back the revision, chain manifest, audit row and both outbox events');

select * from finish();
rollback;
