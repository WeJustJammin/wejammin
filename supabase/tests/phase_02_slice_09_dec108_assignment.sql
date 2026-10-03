commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 QA-RED: CMS-03A-14 assign review capability (BE03a route
-- row, SchemaReviewAssignment table, security controls G18, error matrix).
-- Only the server-derived owner (immutable initialization receipt identity AND
-- a currently valid CMS grant) may create or revoke a bounded read+decide
-- assignment on one frozen review.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

create or replace function pg_temp.s09d_assign_raw(
  p_label text, p_tag text, p_actor text, p_body jsonb, p_override jsonb default '{}'::jsonb
) returns jsonb language sql as $body$
  select pg_temp.s09d_rpc(p_label, 'platform_api.cms_assign_schema_review', p_actor,
    jsonb_build_object('reviewId', pg_temp.s09d_id(p_tag || ':review'),
      'expectedVersion', pg_temp.s09d_review_version(p_tag),
      'idempotencyKey', pg_temp.s09d_idem(p_tag, 'raw')) || p_body, true, p_override)
$body$;
create or replace function pg_temp.s09d_iso(p_offset interval) returns text language sql as $body$
  select to_char((clock_timestamp() + p_offset) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$body$;

select pg_temp.s09d_create_type('a', 'dec108asg');
select pg_temp.s09d_to_review('a');
create temp table s09d_identity_before on commit drop as
select (select count(*) from platform_private.person_party) as persons,
       (select count(*) from identity_private.organization_actor_grant) as grants,
       (select count(*) from platform_private.admin_capability_grants) as admin_grants;

-- Refusals first (atomic), against the open review.
select pg_temp.s09d_assign_raw('a:nonowner', 'a', 'designer2', jsonb_build_object('action', 'create',
  'reviewerPersonId', pg_temp.s09d_actor_id('rev1', 'person'), 'expiresAt', pg_temp.s09d_iso(interval '1 day')));
select is(pg_temp.s09d_outcome('a:nonowner'), 'FORBIDDEN',
  'a schema designer who is not the owner-receipt identity cannot assign (403) [P2-S09-AC-484]');
select pg_temp.s09d_assign_raw('a:crossowner', 'a', 'other', jsonb_build_object('action', 'create',
  'reviewerPersonId', pg_temp.s09d_actor_id('rev1', 'person'), 'expiresAt', pg_temp.s09d_iso(interval '1 day')));
select is(pg_temp.s09d_outcome('a:crossowner'), 'NOT_FOUND', 'another organization''s designer sees the review as absent (404) [P2-S09-AC-485]');
select pg_temp.s09d_assign_raw('a:unassigned', 'a', 'rev2', jsonb_build_object('action', 'create',
  'reviewerPersonId', pg_temp.s09d_actor_id('rev3', 'person'), 'expiresAt', pg_temp.s09d_iso(interval '1 day')));
select ok(pg_temp.s09d_outcome('a:unassigned') = 'NOT_FOUND', 'a human with no standing on the review cannot assign');
select pg_temp.s09d_assign_raw('a:self', 'a', 'owner', jsonb_build_object('action', 'create',
  'reviewerPersonId', pg_temp.s09d_actor_id('owner', 'person'), 'expiresAt', pg_temp.s09d_iso(interval '1 day')));
select is(pg_temp.s09d_outcome('a:self'), 'CONFLICT', 'assigning the submitter as a reviewer is a 409 CONFLICT [P2-S09-AC-386] [P2-S09-AC-469]');
select pg_temp.s09d_assign_raw('a:unknown', 'a', 'owner', jsonb_build_object('action', 'create',
  'reviewerPersonId', extensions.gen_random_uuid(), 'expiresAt', pg_temp.s09d_iso(interval '1 day')));
select is(pg_temp.s09d_outcome('a:unknown'), 'CONFLICT', 'an unknown human reference is a 409 CONFLICT; no identity is created [P2-S09-AC-469]');
update auth.users set banned_until = clock_timestamp() + interval '1 year'
 where id = pg_temp.s09d_actor_id('rev3', 'auth')::uuid;
select pg_temp.s09d_assign_raw('a:banned', 'a', 'owner', jsonb_build_object('action', 'create',
  'reviewerPersonId', pg_temp.s09d_actor_id('rev3', 'person'), 'expiresAt', pg_temp.s09d_iso(interval '1 day')));
select is(pg_temp.s09d_outcome('a:banned'), 'CONFLICT', 'a banned human is ineligible: 409 CONFLICT [P2-S09-AC-469]');
update auth.users set banned_until = null where id = pg_temp.s09d_actor_id('rev3', 'auth')::uuid;
update platform_private.acting_context_binding set state = 'revoked'
 where id = pg_temp.s09d_actor_id('rev3', 'binding')::uuid;
select pg_temp.s09d_assign_raw('a:nobinding', 'a', 'owner', jsonb_build_object('action', 'create',
  'reviewerPersonId', pg_temp.s09d_actor_id('rev3', 'person'), 'expiresAt', pg_temp.s09d_iso(interval '1 day')));
select is(pg_temp.s09d_outcome('a:nobinding'), 'CONFLICT', 'a human with no current binding is ineligible: 409 CONFLICT [P2-S09-AC-469]');
update platform_private.acting_context_binding set state = 'active'
 where id = pg_temp.s09d_actor_id('rev3', 'binding')::uuid;
select pg_temp.s09d_assign_raw('a:eight', 'a', 'owner', jsonb_build_object('action', 'create',
  'reviewerPersonId', pg_temp.s09d_actor_id('rev1', 'person'), 'expiresAt', pg_temp.s09d_iso(interval '8 days')));
select is(pg_temp.s09d_outcome('a:eight'), 'CONFLICT', 'an expiry beyond seven days is refused (409 CONFLICT) [P2-S09-AC-471]');
select pg_temp.s09d_assign_raw('a:grantor', 'a', 'owner', jsonb_build_object('action', 'create',
  'reviewerPersonId', pg_temp.s09d_actor_id('rev1', 'person'), 'expiresAt', pg_temp.s09d_iso(interval '6 days')));
select is(pg_temp.s09d_outcome('a:grantor'), 'CONFLICT',
  'an expiry within seven days but beyond the grantor''s own authority end is refused (409 CONFLICT) [P2-S09-AC-472]');
select pg_temp.s09d_assign_raw('a:past', 'a', 'owner', jsonb_build_object('action', 'create',
  'reviewerPersonId', pg_temp.s09d_actor_id('rev1', 'person'), 'expiresAt', pg_temp.s09d_iso(interval '-1 hour')));
select is(pg_temp.s09d_outcome('a:past'), 'CONFLICT', 'an expiry in the past is refused (409 CONFLICT) [P2-S09-AC-471]');
select pg_temp.s09d_assign_raw('a:malformed', 'a', 'owner', jsonb_build_object('action', 'create',
  'reviewerPersonId', pg_temp.s09d_actor_id('rev1', 'person'), 'expiresAt', 'infinity'));
select ok(pg_temp.s09d_outcome('a:malformed') = 'VALIDATION_FAILED', 'a non-finite expiresAt is a schema failure [P2-S09-AC-471]');
select pg_temp.s09d_assign_raw('a:broad:' || k, 'a', 'owner', jsonb_build_object('action', 'create',
  'reviewerPersonId', pg_temp.s09d_actor_id('rev1', 'person'), 'expiresAt', pg_temp.s09d_iso(interval '1 day'), k, v))
from (values ('actions', '["read","decide","assign"]'::jsonb), ('capabilityKey', '"cms.schema_designer"'::jsonb),
  ('scope', '"organization"'::jsonb), ('delegable', 'true'::jsonb)) as t(k, v);
select is(pg_temp.s09d_outcome('a:broad:' || k), 'INVALID_REQUEST',
  'the request cannot widen the fixed read+decide tuple or delegate: " [P2-S09-AC-487]' || k || '" is an unknown key')
from unnest(array['actions', 'capabilityKey', 'scope', 'delegable']) k;
select pg_temp.s09d_assign_raw('a:stale', 'a', 'owner', jsonb_build_object('action', 'create', 'expectedVersion', '999',
  'reviewerPersonId', pg_temp.s09d_actor_id('rev1', 'person'), 'expiresAt', pg_temp.s09d_iso(interval '1 day')));
select is(pg_temp.s09d_outcome('a:stale'), 'CONFLICT', 'a stale review CAS version is a 409 CONFLICT');
update platform_private.acting_context_binding set last_seen_at = clock_timestamp() - interval '11 minutes'
 where id = pg_temp.s09d_actor_id('owner', 'binding')::uuid;
select pg_temp.s09d_assign_raw('a:mfa', 'a', 'owner', jsonb_build_object('action', 'create',
  'reviewerPersonId', pg_temp.s09d_actor_id('rev1', 'person'), 'expiresAt', pg_temp.s09d_iso(interval '1 day')));
select is(pg_temp.s09d_outcome('a:mfa'), 'STEP_UP_REQUIRED', 'a stale owner binding is 401 STEP_UP_REQUIRED [P2-S09-AC-484]');
update platform_private.acting_context_binding set last_seen_at = clock_timestamp()
 where id = pg_temp.s09d_actor_id('owner', 'binding')::uuid;
select ok(pg_temp.s09d_id('a:review') is not null and pg_temp.s09d_scalar(
    'select count(*)::text from platform_private.cms_schema_review_assignments') = '0',
  'every refusal created no assignment');

-- The accepted create.
select pg_temp.s09d_assign('a', 'rev1', interval '1 day', 'owner', 'a:assign');
select is(pg_temp.s09d_outcome('a:assign'), 'OK', 'the owner creates a bounded assignment for an eligible human (201)');
select ok((select r->>'resourceKind' = 'schema_review_assignment' and r->>'reviewId' = pg_temp.s09d_id('a:review')::text
    and r->>'state' = 'active' and r->>'capability' = 'cms.schema_review'
    and r->'actions' = '["read","decide"]'::jsonb and r->>'startsAt' is not null and r->>'expiresAt' is not null
    and coalesce((select bool_and(position(needle in r::text) = 0) from (values
      (pg_temp.s09d_actor_id('rev1', 'person')), (pg_temp.s09d_actor_id('rev1', 'auth')),
      (pg_temp.s09d_actor_id('owner', 'person')), (pg_temp.s09d_actor_id('owner', 'binding'))) n(needle)), false)
    from (select pg_temp.s09d_resp('a:assign') r) s),
  'the safe resource has the fixed read/decide tuple and never echoes reviewer, grantor or binding identities [P2-S09-AC-487]');
select ok(coalesce(pg_temp.s09d_scalar(format($q$select (reviewer_person_ref = %2$L and grantor_person_ref = %3$L
    and capability_key = 'cms.schema_review' and actions = array['read','decide']::text[] and state = 'active'
    and ends_at > starts_at and ends_at <= starts_at + interval '7 days' and version = 1)::text
  from platform_private.cms_schema_review_assignments where id = %1$L$q$, pg_temp.s09d_id('a:assignment:rev1'),
  pg_temp.s09d_actor_id('rev1', 'person'), pg_temp.s09d_actor_id('owner', 'person')))::boolean, false),
  'the persisted assignment names the reviewer and the server-derived grantor and is bounded to seven days');
select ok((select count(*) = (select persons from s09d_identity_before) from platform_private.person_party)
  and (select count(*) = (select grants from s09d_identity_before) from identity_private.organization_actor_grant)
  and (select count(*) = (select admin_grants from s09d_identity_before) from platform_private.admin_capability_grants)
  and pg_temp.s09d_outcome('a:assign') = 'OK',
  'assignment creates no identity and grants no organization or admin capability [P2-S09-AC-487]');
select ok(coalesce(pg_temp.s09d_scalar(format($q$select (
    (select count(*) from audit_private.audit_events where target_id = %1$L) >= 1
    and (select count(*) from platform_private.outbox_events where aggregate_id = %1$L or aggregate_id = %2$L) >= 1)::text$q$,
  pg_temp.s09d_id('a:assignment:rev1'), pg_temp.s09d_id('a:review')))::boolean, false),
  'assignment commits its audit and outbox evidence atomically [P2-S09-AC-489]');
select ok(pg_temp.s09d_replay_pair('a:replay', 'platform_api.cms_assign_schema_review', 'owner',
    jsonb_build_object('reviewId', pg_temp.s09d_id('a:review'), 'action', 'create',
      'expectedVersion', pg_temp.s09d_review_version('a'),
      'reviewerPersonId', pg_temp.s09d_actor_id('rev2', 'person'), 'expiresAt', pg_temp.s09d_iso(interval '1 day'),
      'idempotencyKey', 's09d-assign-replay-0001'), true)
  and pg_temp.s09d_scalar('select count(*)::text from platform_private.cms_schema_review_assignments') = '2',
  'a same-key replay returns the exact original assignment and creates no second one [P2-S09-AC-488]');
select pg_temp.s09d_assign_raw('a:delegate', 'a', 'rev1', jsonb_build_object('action', 'create',
  'reviewerPersonId', pg_temp.s09d_actor_id('rev3', 'person'), 'expiresAt', pg_temp.s09d_iso(interval '1 day')));
select is(pg_temp.s09d_outcome('a:delegate'), 'FORBIDDEN', 'an assigned reviewer cannot delegate or re-assign (403) [P2-S09-AC-484]');

-- Revoke.
select pg_temp.s09d_assign_raw('a:revoke', 'a', 'owner', jsonb_build_object('action', 'revoke',
  'assignmentId', pg_temp.s09d_id('a:assignment:rev1'), 'reason', 'dec108 revoke'));
select ok(pg_temp.s09d_outcome('a:revoke') = 'OK' and (select r->>'state' = 'revoked' and r->>'reviewId' = pg_temp.s09d_id('a:review')::text
    from (select pg_temp.s09d_resp('a:revoke') r) s)
  and pg_temp.s09d_read('cms_schema_review_assignments', 'state', pg_temp.s09d_id('a:assignment:rev1')) = 'revoked',
  'the owner revokes an existing assignment (200, state revoked)');
select pg_temp.s09d_assign_raw('a:revoke404', 'a', 'owner', jsonb_build_object('action', 'revoke',
  'assignmentId', extensions.gen_random_uuid()));
select is(pg_temp.s09d_outcome('a:revoke404'), 'CONFLICT', 'revoking a non-existent assignment is a 409 CONFLICT');
select pg_temp.s09d_assign_raw('a:revoke:mfa', 'a', 'owner', jsonb_build_object('action', 'revoke',
  'assignmentId', pg_temp.s09d_id('a:assignment:rev2')), jsonb_build_object('actingContextId', null));
select is(pg_temp.s09d_outcome('a:revoke:mfa'), 'STEP_UP_REQUIRED', 'a revoke without the binding-bound step-up is 401 STEP_UP_REQUIRED [P2-S09-AC-484]');

-- Owner authority is current, not merely historical (G18).
select pg_temp.s09d_create_type('k', 'dec108asglapse');
select pg_temp.s09d_to_review('k');
update identity_private.organization_actor_grant set valid_from = current_date - 2, valid_through = current_date - 1
 where organization_id = pg_temp.s09d_id('ownerOrg') and person_id = pg_temp.s09d_actor_id('owner', 'person')::uuid;
select pg_temp.s09d_assign_raw('k:lapsed', 'k', 'owner', jsonb_build_object('action', 'create',
  'reviewerPersonId', pg_temp.s09d_actor_id('rev1', 'person'), 'expiresAt', pg_temp.s09d_iso(interval '1 hour')));
select ok(pg_temp.s09d_id('k:review') is not null and pg_temp.s09d_outcome('k:lapsed') = 'NOT_FOUND',
  'the owner receipt identity without a currently valid CMS grant cannot assign [P2-S09-AC-486]');

select ok(pg_temp.s09d_service_only('platform_api.cms_assign_schema_review(jsonb)')
  and to_regprocedure('platform_private.cms_assign_schema_review(jsonb)') is not null
  and not coalesce(has_function_privilege('authenticated', to_regprocedure('platform_private.cms_assign_schema_review(jsonb)'), 'execute'), true),
  'the assignment RPC is service-role only; the private implementation is not browser-executable');

select * from finish();
rollback;
