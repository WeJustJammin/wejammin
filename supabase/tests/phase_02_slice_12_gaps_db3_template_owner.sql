-- Slice 12 gap lane claude_s12_gaps_db3: P2-S12-AC-023 clause 1, the "/allowlisted" part of
--   "compatibleTypeIds; 1-64 UUIDs, each active/allowlisted ContentTypeVersion family" (BE03c 380, 422).
-- BE03c 380 names no allowlist object; the sibling pattern row (BE03c 407) states the same membership as "the id of an active
-- content type of the caller's owner scope", and cms_define_template (20261013100200:120-132) enforces exactly that:
-- content_type.owner_id = acting_party_id, state = 'active', and an active version.  This file proves the owner-scope axis that the
-- db1 template suite leaves open: an ACTIVE content type with an ACTIVE version that belongs to ANOTHER owner is refused 422
-- VALIDATION_FAILED, alone and inside an otherwise valid list, and nothing is written.  The fixtures are the db1 template world
-- (type ..0104 is the foreign one; ..0103 the owned control of the same shape).
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_12_gaps_db1_template/000-fixtures.sqlinc

select pg_temp.gt_creator();
select ok(
  (select foreign_type.owner_id is distinct from (select value::uuid from s10_ids where key = 'organization')
      and foreign_type.state = 'active'
      and exists (select 1 from platform_private.cms_content_type_versions v
                   where v.content_type_id = foreign_type.id and v.state = 'active')
      and owned_type.owner_id = (select value::uuid from s10_ids where key = 'organization')
      and owned_type.state = 'active'
      and exists (select 1 from platform_private.cms_content_type_versions v
                   where v.content_type_id = owned_type.id and v.state = 'active')
     from platform_private.cms_content_types foreign_type, platform_private.cms_content_types owned_type
    where foreign_type.id = 'a9121000-0000-4000-8000-000000000104'
      and owned_type.id = 'a9121000-0000-4000-8000-000000000103'),
  'control: the foreign type is active with an active version and differs from the owned type only by its owner [P2-S12-AC-023]');

create temp table g3t_before on commit drop as
select (select count(*) from platform_private.cms_template_versions) as templates,
       (select count(*) from platform_private.idempotency_records where operation = 'CMS-03C-01') as reservations,
       (select count(*) from platform_private.outbox_events) as events,
       (select count(*) from audit_private.audit_events) as audits;

select pg_temp.s10_rpc_exec(pg_temp.gt_template_sql('g3t-foreign',
  jsonb_build_array('a9121000-0000-4000-8000-000000000104'), 'g3t-foreign-0001'));
select is(pg_temp.s10_last_error_message(), 'VALIDATION_FAILED',
  'an ACTIVE content type with an ACTIVE version that belongs to another owner is refused VALIDATION_FAILED [P2-S12-AC-023]');
select is(pg_temp.s10_last_error_state(), 'P0001',
  'the owner-scope refusal is the P0001 contract token the Worker maps to 422 [P2-S12-AC-023]');
select pg_temp.s10_rpc_exec(pg_temp.gt_template_sql('g3t-mixed',
  jsonb_build_array('a9121000-0000-4000-8000-000000000103', 'a9121000-0000-4000-8000-000000000104'), 'g3t-mixed-0002'));
select is(pg_temp.s10_last_error_message(), 'VALIDATION_FAILED',
  'one other-owner member among valid owned members refuses the whole list [P2-S12-AC-023]');
select pg_temp.s10_rpc_exec(pg_temp.gt_template_sql('g3t-mixed-reversed',
  jsonb_build_array('a9121000-0000-4000-8000-000000000104', 'a9121000-0000-4000-8000-000000000103'), 'g3t-mixed-0003'));
select is(pg_temp.s10_last_error_message(), 'VALIDATION_FAILED',
  'the other-owner member refuses the list wherever it stands in it [P2-S12-AC-023]');
select ok(
  (select (select count(*) from platform_private.cms_template_versions) = templates
      and (select count(*) from platform_private.idempotency_records where operation = 'CMS-03C-01') = reservations
      and (select count(*) from platform_private.outbox_events) = events
      and (select count(*) from audit_private.audit_events) = audits
     from g3t_before),
  'the three owner-scope refusals wrote no template, reservation, event or audit record [P2-S12-AC-023]');

select pg_temp.s10_rpc_exec(pg_temp.gt_template_sql('g3t-owned',
  jsonb_build_array('a9121000-0000-4000-8000-000000000103'), 'g3t-owned-0004'));
select is(pg_temp.s10_last_error_state(), '00000',
  'control: the owned type of the identical shape defines a draft template, so only the owner differed [P2-S12-AC-023]');
select is((select count(*)::integer from platform_private.cms_template_versions), (select templates::integer from g3t_before) + 1,
  'control: exactly one template row exists after the accepted call [P2-S12-AC-023]');

select finish();
rollback;
