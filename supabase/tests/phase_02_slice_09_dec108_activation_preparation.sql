commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 QA-RED: the CMS-03A-07 detail adds a typed
-- activationPreparation projection (BE03a resources, G11): dry-run, job and
-- review references plus permittedNextActions as the only readiness
-- expression.  Today the DB detail RPC omits it entirely.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

create or replace function pg_temp.s09d_prep(p_tag text, p_actor text default 'owner') returns jsonb
language plpgsql as $body$
declare detail jsonb;
begin
  perform pg_temp.s09d_session(p_actor);
  detail := pg_temp.s09d_call(p_tag || ':prep', 'platform_api.cms_get_content_type_version',
    jsonb_build_object('contentTypeId', pg_temp.s09d_id(p_tag || ':type'),
      'versionId', pg_temp.s09d_id(p_tag || ':version'), 'context', pg_temp.s09d_context(p_actor)));
  return detail->'activationPreparation';
end;
$body$;

select pg_temp.s09d_create_type('a', 'dec108prep');
create temp table s09d_s0 on commit drop as select pg_temp.s09d_prep('a') as prep;
select ok((select prep is not null and (select count(*) from jsonb_object_keys(prep - 'templateCompatibility')) = 4
    and prep ?& array['dryRunRef', 'jobRef', 'reviewRef', 'permittedNextActions']
    from s09d_s0), 'the detail carries activationPreparation with exactly dryRunRef, jobRef, reviewRef and permittedNextActions');
select ok((select prep->'dryRunRef' = 'null'::jsonb and prep->'jobRef' = 'null'::jsonb and prep->'reviewRef' = 'null'::jsonb
    and prep->'permittedNextActions' ? 'start_dry_run' and not (prep->'permittedNextActions' ? 'submit_review')
    from s09d_s0), 'a fresh draft offers only starting a dry-run: no dry-run, job or review reference');

select pg_temp.s09d_dry_run('a');
create temp table s09d_s1 on commit drop as select pg_temp.s09d_prep('a') as prep;
select ok((select prep->'dryRunRef'->>'id' = pg_temp.s09d_id('a:dryRun')::text and prep->'dryRunRef'->>'state' = 'queued'
    and prep->'dryRunRef'->'result' = 'null'::jsonb and prep->'dryRunRef'->>'jobId' = pg_temp.s09d_id('a:job')::text
    and prep->'jobRef'->>'id' = pg_temp.s09d_id('a:job')::text and prep->'jobRef'->>'state' = 'queued'
    and not (prep->'permittedNextActions' ? 'submit_review') and not (prep->'permittedNextActions' ? 'activate')
    from s09d_s1), 'a queued attempt is referenced with result null and its BE00 job state; review is not yet offered');

select pg_temp.s09d_seal('a');
create temp table s09d_s2 on commit drop as select pg_temp.s09d_prep('a') as prep;
select ok((select prep->'dryRunRef'->>'state' = 'completed' and prep->'dryRunRef'->>'result' = 'passed'
    and prep->'jobRef'->>'state' in ('succeeded', 'running', 'queued') and prep->'permittedNextActions' ? 'submit_review'
    from s09d_s2), 'a sealed passed attempt offers submit_review');

select pg_temp.s09d_submit('a');
create temp table s09d_s3 on commit drop as select pg_temp.s09d_prep('a') as prep;
select ok((select prep->'reviewRef'->>'id' = pg_temp.s09d_id('a:review')::text and prep->'reviewRef'->>'state' = 'open'
    and prep->'permittedNextActions' ? 'assign_reviewer' and not (prep->'permittedNextActions' ? 'activate')
    from s09d_s3), 'an open review is referenced and the owner is offered reviewer assignment, not activation');

select pg_temp.s09d_assign('a', 'rev1');
select pg_temp.s09d_decide('a', 'rev1');
create temp table s09d_s4 on commit drop as select pg_temp.s09d_prep('a') as prep;
select ok((select prep->'reviewRef'->>'state' = 'approved' and prep->'permittedNextActions' ? 'activate'
    from s09d_s4), 'an approved review is referenced and activation is offered');
select ok((select jsonb_array_length(prep->'permittedNextActions') <= 6
    and not exists (select 1 from jsonb_array_elements_text(prep->'permittedNextActions') e
      where e not in ('create_successor', 'start_dry_run', 'submit_review', 'assign_reviewer', 'record_decision', 'activate'))
    from s09d_s4), 'permittedNextActions stays inside the closed six-action vocabulary');

create temp table s09d_before_read on commit drop as select pg_temp.s09d_fingerprint() as fingerprint;
select pg_temp.s09d_prep('a');
select pg_temp.s09d_prep('a', 'designer2');
select ok(pg_temp.s09d_outcome('a:prep') = 'OK' and (select prep is not null from s09d_s4)
  and pg_temp.s09d_fingerprint() = (select fingerprint from s09d_before_read),
  'the detail read performs no INSERT, UPDATE, idempotency reservation, audit or outbox write');
select ok(coalesce((select bool_and(position(needle in prep::text) = 0)
    from s09d_s4, (values (pg_temp.s09d_actor_id('owner', 'auth')), (pg_temp.s09d_actor_id('owner', 'person')),
      (pg_temp.s09d_actor_id('owner', 'binding')), (pg_temp.s09d_actor_id('rev1', 'auth')),
      (pg_temp.s09d_actor_id('rev1', 'person')), (pg_temp.s09d_actor_id('rev1', 'binding'))) n(needle)), false),
  'the projection carries no actor, person, party, reviewer or private binding identifier');
select ok((select not (prep ? 'templateCompatibility') or prep->'templateCompatibility' = 'null'::jsonb from s09d_s4),
  'with no template reference to check, the optional templateCompatibility projection is absent or null');

select pg_temp.s09d_activate('a');
create temp table s09d_s5 on commit drop as select pg_temp.s09d_prep('a') as prep;
select ok((select prep->'permittedNextActions' ? 'create_successor' and not (prep->'permittedNextActions' ? 'activate')
    from s09d_s5) and pg_temp.s09d_outcome('a:activate') = 'OK',
  'an activated version offers only a successor draft, never a second activation');

select * from finish();
rollback;
