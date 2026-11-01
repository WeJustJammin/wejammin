-- Slice 12 gap lane claude_s12_gaps_db1: P2-S12-AC-161 clauses 1+3+8.  cmsTemplateContextRead rechecks the actor, acting party,
-- confirmed membership and the designer grant on every read, and reserves nothing for a later write.  Fixtures: the shared
-- template fragment (the Slice 10 rolled-back world); nothing here edits an existing suite.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_12_gaps_db1_template/000-fixtures.sqlinc
-- ---------------------------------------------------------------------------------------------- AC-161 --
-- Clause 8: a context read reserves nothing.
create temp table gt_counts_before on commit drop as
select (select count(*) from audit_private.audit_events) as audits,
       (select count(*) from platform_private.outbox_events) as outbox,
       (select count(*) from platform_private.idempotency_records) as idem,
       (select count(*) from platform_private.cms_template_versions) as templates;
select pg_temp.gt_creator();
select pg_temp.s10_rpc_exec(pg_temp.gt_context_sql());
select is(pg_temp.s10_last_error_state(), '00000', 'control: the context read used for the no-effect count succeeds [P2-S12-AC-161]');
select ok(
  (select audits = (select count(*) from audit_private.audit_events)
      and outbox = (select count(*) from platform_private.outbox_events)
      and idem = (select count(*) from platform_private.idempotency_records)
      and templates = (select count(*) from platform_private.cms_template_versions)
   from gt_counts_before),
  'a context read writes no audit, outbox, idempotency or template row [P2-S12-AC-161]');

-- Clauses 1 and 3: each authority input is rechecked on every read.  The read is first proved to succeed, so the
-- refusals below are specific to the one input changed.
update identity_private.membership_tenure set state = 'invited', invite_expires_at = now() + interval '1 day'
 where organization_id = (select value::uuid from s10_ids where key = 'organization')
   and person_id = (select value::uuid from s10_ids where key = 'creatorPerson');
select pg_temp.gt_creator();
select pg_temp.s10_rpc_exec(pg_temp.gt_context_sql());
select is(pg_temp.s10_last_error_message(), 'FORBIDDEN', 'an invited (unconfirmed) tenure is refused FORBIDDEN [P2-S12-AC-161]');
update identity_private.membership_tenure set state = 'ended', revoked_at = now()
 where organization_id = (select value::uuid from s10_ids where key = 'organization')
   and person_id = (select value::uuid from s10_ids where key = 'creatorPerson');
select pg_temp.s10_rpc_exec(pg_temp.gt_context_sql());
select is(pg_temp.s10_last_error_message(), 'FORBIDDEN', 'a tenure in state ended is refused FORBIDDEN [P2-S12-AC-161]');
update identity_private.membership_tenure set state = 'confirmed', revoked_at = null, starts_on = current_date - 5, ends_on = current_date - 1
 where organization_id = (select value::uuid from s10_ids where key = 'organization')
   and person_id = (select value::uuid from s10_ids where key = 'creatorPerson');
select pg_temp.s10_rpc_exec(pg_temp.gt_context_sql());
select is(pg_temp.s10_last_error_message(), 'FORBIDDEN', 'a confirmed tenure whose end date has passed is refused FORBIDDEN [P2-S12-AC-161]');
update identity_private.membership_tenure set ends_on = null
 where organization_id = (select value::uuid from s10_ids where key = 'organization')
   and person_id = (select value::uuid from s10_ids where key = 'creatorPerson');
select pg_temp.s10_rpc_exec(pg_temp.gt_context_sql());
select is(pg_temp.s10_last_error_state(), '00000', 'control: restoring the confirmed unended tenure restores the read [P2-S12-AC-161]');

select pg_temp.s10_rpc_exec(pg_temp.gt_context_sql('a9121000-0000-4000-8000-0000000009ff'));
select is(pg_temp.s10_last_error_message(), 'FORBIDDEN', 'an acting party the actor is not a member of is refused FORBIDDEN [P2-S12-AC-161]');

insert into auth.users(id) values ('a9121000-0000-4000-8000-0000000009a1');
select pg_temp.s10_rpc_as('a9121000-0000-4000-8000-0000000009a1'::uuid, (select value::uuid from s10_ids where key = 'organization'));
select pg_temp.s10_rpc_exec(pg_temp.gt_context_sql());
select is(pg_temp.s10_last_error_message(), 'FORBIDDEN', 'an authenticated user with no person binding is refused FORBIDDEN [P2-S12-AC-161]');
select pg_temp.s10_rpc_as('a9121000-0000-4000-8000-0000000009a2'::uuid, (select value::uuid from s10_ids where key = 'organization'));
select pg_temp.s10_rpc_exec(pg_temp.gt_context_sql());
select is(pg_temp.s10_last_error_message(), 'UNAUTHENTICATED', 'an unknown actor is refused UNAUTHENTICATED [P2-S12-AC-161]');

-- Clause 8, second half: a successful read, then the grant ends, then the POST is decided independently.
select pg_temp.gt_creator();
select pg_temp.s10_rpc_exec(pg_temp.gt_context_sql());
select is(pg_temp.s10_last_error_state(), '00000', 'a successful context read precedes the grant end [P2-S12-AC-161]');
update identity_private.organization_actor_grant set active = false
 where organization_id = (select value::uuid from s10_ids where key = 'organization')
   and person_id = (select value::uuid from s10_ids where key = 'creatorPerson')
   and capability_code = 'cms.template_designer';
select pg_temp.s10_rpc_exec(pg_temp.gt_template_sql('gap-tpl-after-read',
  jsonb_build_array('a9121000-0000-4000-8000-000000000103'), 'gap-tpl-after-read-0005'));
select is(pg_temp.s10_last_error_message(), 'FORBIDDEN',
  'after a successful context read and a grant end, CMS-03C-01 is refused FORBIDDEN: the read reserved no permission [P2-S12-AC-161]');
select is((select count(*)::integer from platform_private.cms_template_versions where template_key = 'gap-tpl-after-read'), 0,
  'the refused POST created no template row [P2-S12-AC-161]');

select finish();
rollback;
