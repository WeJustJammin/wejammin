\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 R8 (Codex f3c0736e, high): the decision RPC trusted a reviewer
-- assignment without requiring assignment.owner_id = review.owner_id, and no
-- constraint held that invariant.  A cross-owner assignment row therefore
-- authorized a reviewer of another organization to decide the review through
-- the SECURITY DEFINER path.  The invariant is now enforced three times: the
-- decision lookup, an assignment write guard and the decision append guard.
-- The cross-owner rows below are negative-control forgeries (guard triggers
-- disabled for one statement); every producer path is the real CMS RPC.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

-- Runs one statement inside the RPC write context and always rolls its effects
-- back: ACCEPTED when it would have succeeded, otherwise SQLSTATE:message:detail.
create or replace function pg_temp.r8o_probe(p_sql text) returns text
language plpgsql as $body$
declare
  detail_text text;
  previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  begin
    execute p_sql;
    raise exception 'r8o rollback' using errcode = 'RB999';
  exception when others then
    get stacked diagnostics detail_text = pg_exception_detail;
    perform pg_catalog.set_config('app.cms_rpc', previous, true);
    if sqlstate = 'RB999' then
      return 'ACCEPTED';
    end if;
    return sqlstate || ':' || sqlerrm || ':' || coalesce(detail_text, '');
  end;
end;
$body$;

select pg_temp.s09d_create_type('a', 'r8owner');
select pg_temp.s09d_to_review('a');
select pg_temp.s09d_assign('a', 'rev1');
select pg_temp.s09d_assign('a', 'rev2');
select is(pg_temp.s09d_outcome('a:assign:rev1') || '/' || pg_temp.s09d_outcome('a:assign:rev2'), 'OK/OK',
  'fixture: the owner assigned two reviewers to the frozen review through CMS-03A-14 [P2-S09-AC-414]');
create temp table r8o_ctx on commit drop as
select pg_temp.s09d_id('a:review') as review_id,
       pg_temp.s09d_id('ownerOrg') as owner_org,
       pg_temp.s09d_id('otherOrg') as other_org,
       pg_temp.s09d_id('a:assignment:rev1') as rev1_assignment,
       pg_temp.s09d_id('a:assignment:rev2') as rev2_assignment,
       pg_temp.s09d_actor_id('rev1', 'person')::uuid as rev1_person,
       pg_temp.s09d_actor_id('rev2', 'person')::uuid as rev2_person,
       pg_temp.s09d_actor_id('rev3', 'person')::uuid as rev3_person,
       pg_temp.s09d_actor_id('owner', 'person')::uuid as owner_person;
select ok((select owner_org <> other_org and review_id is not null and rev1_assignment is not null
             and rev2_assignment is not null from r8o_ctx),
  'fixture: two organizations, one frozen review and two real assignments exist');

-- ---------------------------------------------- the assignment write guard ----
select is(pg_temp.r8o_probe(format($q$insert into platform_private.cms_schema_review_assignments(
      owner_id, review_id, reviewer_person_ref, grantor_person_ref, capability_key, actions, state,
      starts_at, ends_at, reason)
    values (%L, %L, %L, %L, 'cms.schema_review', array['read', 'decide'], 'active',
            clock_timestamp(), clock_timestamp() + interval '1 hour', 'forged')$q$,
    (select other_org from r8o_ctx), (select review_id from r8o_ctx), (select rev3_person from r8o_ctx),
    (select owner_person from r8o_ctx))),
  'P0001:CONFLICT:assignment_owner_mismatch',
  'a database write guard refuses an assignment whose owner differs from its review''s owner [P2-S09-AC-414] [P2-S09-AC-431]');
select is(pg_temp.r8o_probe(format($q$insert into platform_private.cms_schema_review_assignments(
      owner_id, review_id, reviewer_person_ref, grantor_person_ref, capability_key, actions, state,
      starts_at, ends_at, reason)
    values (%L, %L, %L, %L, 'cms.schema_review', array['read', 'decide'], 'active',
            clock_timestamp(), clock_timestamp() + interval '1 hour', 'control')$q$,
    (select owner_org from r8o_ctx), (select review_id from r8o_ctx), (select rev3_person from r8o_ctx),
    (select owner_person from r8o_ctx))),
  'ACCEPTED',
  'positive control: the same assignment stamped with the review''s owner passes the guard [P2-S09-AC-414]');

-- -------------------------------------- the decision RPC with a forged row ----
select ok(pg_temp.s09d_timewarp('cms_schema_review_assignments', format(
  $q$update platform_private.cms_schema_review_assignments set owner_id = %L where id = %L$q$,
  (select other_org from r8o_ctx), (select rev2_assignment from r8o_ctx))),
  'fixture: rev2''s real assignment is forged to another organization''s owner_id (guard triggers off for one statement)');
create temp table r8o_baseline on commit drop as select pg_temp.s09d_fingerprint(false) as fingerprint;
select pg_temp.s09d_decide('a', 'rev2', 'approve', '{}'::jsonb, 'a:crossowner:approve');
select is(pg_temp.s09d_outcome('a:crossowner:approve'), 'NOT_FOUND',
  'a reviewer holding only a cross-owner assignment cannot approve: the review is concealed (404) [P2-S09-AC-414] [P2-S09-AC-431]');
select pg_temp.s09d_decide('a', 'rev2', 'reject', '{}'::jsonb, 'a:crossowner:reject');
select is(pg_temp.s09d_outcome('a:crossowner:reject'), 'NOT_FOUND',
  'nor can that reviewer reject it [P2-S09-AC-414] [P2-S09-AC-431]');
select ok(pg_temp.s09d_fingerprint(false) = (select fingerprint from r8o_baseline)
    and (select count(*) = 0 from platform_private.cms_schema_review_decisions
          where review_id = (select review_id from r8o_ctx)),
  'both refusals wrote nothing: no decision, no review or version change, no idempotency or outbox row [P2-S09-AC-414]');

-- ---------------------------------------------- the decision append guard ----
select is(pg_temp.r8o_probe(format($q$insert into platform_private.cms_schema_review_decisions(
      owner_id, review_id, assignment_id, assignment_version, reviewer_person_ref, binding_context_hash,
      capability_key, capability_version, decision, reviewed_hash, mfa_verified_at)
    values (%L, %L, %L, 1, %L, repeat('a', 64), 'cms.schema_review', 1, 'approve', repeat('b', 64),
            clock_timestamp())$q$,
    (select owner_org from r8o_ctx), (select review_id from r8o_ctx), (select rev2_assignment from r8o_ctx),
    (select rev2_person from r8o_ctx))),
  'P0001:CONFLICT:decision_assignment_owner_mismatch',
  'a database append guard refuses a decision that cites an assignment of another owner [P2-S09-AC-414] [P2-S09-AC-431]');
select is(pg_temp.r8o_probe(format($q$insert into platform_private.cms_schema_review_decisions(
      owner_id, review_id, assignment_id, assignment_version, reviewer_person_ref, binding_context_hash,
      capability_key, capability_version, decision, reviewed_hash, mfa_verified_at)
    values (%L, %L, %L, 1, %L, repeat('a', 64), 'cms.schema_review', 1, 'approve', repeat('b', 64),
            clock_timestamp())$q$,
    (select owner_org from r8o_ctx), (select review_id from r8o_ctx), (select rev1_assignment from r8o_ctx),
    (select rev1_person from r8o_ctx))),
  'ACCEPTED',
  'positive control: the same decision citing the owner-consistent assignment passes the guard [P2-S09-AC-414]');

-- ------------------------------------------------------ positive control ----
select pg_temp.s09d_decide('a', 'rev1', 'approve', '{}'::jsonb, 'a:decide:rev1:control');
select is(pg_temp.s09d_outcome('a:decide:rev1:control'), 'OK',
  'positive control: the owner-consistent assignee still records a decision through the RPC [P2-S09-AC-414]');
select is((select count(*)::integer from platform_private.cms_schema_review_decisions
            where review_id = (select review_id from r8o_ctx)
              and reviewer_person_ref = (select rev1_person from r8o_ctx)), 1,
  'exactly the owner-consistent reviewer''s decision is recorded [P2-S09-AC-414]');

select pg_temp.s09d_get_review('a:read:crossowner', 'a', 'rev2');
select is(pg_temp.s09d_outcome('a:read:crossowner'), 'NOT_FOUND',
  'a cross-owner assignment grants no read of the review either: CMS-03A-13 conceals it (404) [P2-S09-AC-181] [P2-S09-AC-431]');
select pg_temp.s09d_get_review('a:read:assignee', 'a', 'rev1');
select is(pg_temp.s09d_outcome('a:read:assignee'), 'OK',
  'positive control: the owner-consistent assignee still reads the review [P2-S09-AC-181]');

select * from finish();
rollback;
