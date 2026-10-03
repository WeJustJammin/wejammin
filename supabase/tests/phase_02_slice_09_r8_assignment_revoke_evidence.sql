\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 R8 (re-audit AC489, DB WEAK): "CMS-03A-14 commits assignment create or
-- revoke with atomic audit and outbox rows."  Create was proved on the success
-- path and revoke only on the outbox-failure rollback.  Here a successful
-- revoke is shown to commit its own audit row and its own outbox row, none for
-- the refused attempts around it, and a same-key replay writes neither again.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

create or replace function pg_temp.r8v_revoke(p_label text, p_actor text, p_assignment uuid, p_idem text) returns jsonb
language sql as $body$
  select pg_temp.s09d_rpc(p_label, 'platform_api.cms_assign_schema_review', p_actor,
    jsonb_build_object('reviewId', pg_temp.s09d_id('a:review'), 'action', 'revoke',
      'assignmentId', p_assignment, 'reason', 'r8 revoke evidence',
      'expectedVersion', pg_temp.s09d_review_version('a'), 'idempotencyKey', p_idem), true)
$body$;
create or replace function pg_temp.r8v_counts(p_assignment uuid) returns text language sql stable as $body$
  select (select count(*) from audit_private.audit_events where target_id = p_assignment)::text || '/'
      || (select count(*) from platform_private.outbox_events
           where aggregate_id = p_assignment or aggregate_id = pg_temp.s09d_id('a:review'))::text
$body$;

select pg_temp.s09d_create_type('a', 'r8revoke');
select pg_temp.s09d_to_review('a');
select pg_temp.s09d_assign('a', 'rev1');
select is(pg_temp.s09d_outcome('a:assign:rev1'), 'OK', 'fixture: the owner created an assignment through CMS-03A-14 [P2-S09-AC-489]');
create temp table r8v_ids on commit drop as select pg_temp.s09d_id('a:assignment:rev1') as assignment;
create temp table r8v_after_create on commit drop as select pg_temp.r8v_counts((select assignment from r8v_ids)) as counts;

-- refusals write no audit and no outbox row
select pg_temp.r8v_revoke('r8v:nonowner', 'designer2', (select assignment from r8v_ids), 's09d-r8-revoke-nonowner-0001');
select is(pg_temp.s09d_outcome('r8v:nonowner'), 'FORBIDDEN', 'a non-owner revoke is refused [P2-S09-AC-489]');
select pg_temp.r8v_revoke('r8v:unknown', 'owner', extensions.gen_random_uuid(), 's09d-r8-revoke-unknown-0001');
select is(pg_temp.s09d_outcome('r8v:unknown'), 'CONFLICT', 'revoking an unknown assignment is refused [P2-S09-AC-489]');
select is(pg_temp.r8v_counts((select assignment from r8v_ids)), (select counts from r8v_after_create),
  'the two refused revokes committed no audit and no outbox row [P2-S09-AC-489]');

-- the successful revoke commits exactly its own audit and outbox evidence
select pg_temp.r8v_revoke('r8v:ok', 'owner', (select assignment from r8v_ids), 's09d-r8-revoke-ok-0001');
select is(pg_temp.s09d_outcome('r8v:ok'), 'OK', 'the owner revokes the assignment [P2-S09-AC-489]');
select is((select count(*)::integer from audit_private.audit_events where target_id = (select assignment from r8v_ids))
          - split_part((select counts from r8v_after_create), '/', 1)::integer, 1,
  'the successful revoke committed exactly one audit row naming the assignment [P2-S09-AC-489]');
select is((select count(*)::integer from platform_private.outbox_events
            where aggregate_id = (select assignment from r8v_ids) or aggregate_id = pg_temp.s09d_id('a:review'))
          - split_part((select counts from r8v_after_create), '/', 2)::integer, 1,
  'and exactly one outbox row for the revocation [P2-S09-AC-489]');
select is(pg_temp.s09d_read('cms_schema_review_assignments', 'state', (select assignment from r8v_ids)), 'revoked',
  'in the same transaction the assignment row is revoked [P2-S09-AC-489]');
create temp table r8v_after_revoke on commit drop as select pg_temp.r8v_counts((select assignment from r8v_ids)) as counts;

-- a same-key replay returns the stored response and writes nothing again
select pg_temp.r8v_revoke('r8v:replay', 'owner', (select assignment from r8v_ids), 's09d-r8-revoke-ok-0001');
select is(pg_temp.s09d_outcome('r8v:replay') || '/' || (pg_temp.s09d_resp('r8v:replay') = pg_temp.s09d_resp('r8v:ok'))::text, 'OK/true',
  'a same-key replay returns the exact original revoke response [P2-S09-AC-489]');
select is(pg_temp.r8v_counts((select assignment from r8v_ids)), (select counts from r8v_after_revoke),
  'and writes no second audit or outbox row [P2-S09-AC-489]');

select * from finish();
rollback;
