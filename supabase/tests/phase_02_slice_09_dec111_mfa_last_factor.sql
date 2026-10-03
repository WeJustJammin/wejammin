\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-111 QA-RED (BE01a AUTH-API-19 / "Last verified factor"):
-- removing the last verified factor is refused with LAST_FACTOR_REQUIRED
-- while the account holds any capability whose operations require step-up,
-- read from the protected capability registry's step-up designation against
-- the person's currently effective grants and assignments.  The reads cover:
--   - the immutable owner-initialization receipt identity (CMS-03A-15..17),
--   - a currently effective CMS capability grant (cms.schema_designer, ...),
--   - an active review assignment (cms.schema_review, CMS-03A-12),
--   - an effective admin capability grant (admin.*).
-- Capabilities that gate no step-up operation, lapsed grants, expired
-- assignments and cancelling a pending factor never block removal.

\ir phase_02_slice_09_dec111/00-support.sqlinc
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc

create or replace function pg_temp.m_h(p_byte text) returns text language sql immutable as $body$
  select '\x' || repeat(p_byte, 32) $body$;
create or replace function pg_temp.m_rbegin(
  p_label text, p_n integer, p_factor uuid, p_reason text, p_ver text,
  p_key text default 'a1', p_req text default 'b2')
returns jsonb language sql as $body$
  select pg_temp.m(p_label, 'auth_mfa_removal_begin', jsonb_build_object(
    'p_auth_user_id', pg_temp.m_uid(p_n), 'p_factor_id', p_factor, 'p_reason', p_reason,
    'p_expected_version', p_ver, 'p_session_id', pg_temp.m_sid(p_n),
    'p_key_hash', pg_temp.m_h(p_key), 'p_request_hash', pg_temp.m_h(p_req))) $body$;

-- Aliases: 11 owner, 12 designer2, 13 rev1, 14 rev2, 15 rev3, 16 other.
insert into m_alias values
  (11, pg_temp.s09d_actor_id('owner', 'auth')::uuid), (12, pg_temp.s09d_actor_id('designer2', 'auth')::uuid),
  (13, pg_temp.s09d_actor_id('rev1', 'auth')::uuid), (14, pg_temp.s09d_actor_id('rev2', 'auth')::uuid),
  (15, pg_temp.s09d_actor_id('rev3', 'auth')::uuid), (16, pg_temp.s09d_actor_id('other', 'auth')::uuid);
select pg_temp.m_session(n) from generate_series(11, 16) n;
select pg_temp.m_enroll(n, 'Only') from generate_series(11, 16) n;
select is(pg_temp.m_one($q$select count(*)::text from identity.mfa_factor_registry where state = 'verified'
            and auth_user_id in (select uid from m_alias)$q$)::integer, 6, 'fixture: six humans each hold exactly one verified factor');

-- Review assignments (real producer, CMS-03A-14): rev1 active, rev2 active then expired.
select pg_temp.s09d_create_type('a', 'dec111lf');
select pg_temp.s09d_to_review('a');
select pg_temp.s09d_assign('a', 'rev1', interval '1 day', 'owner', 'a:assign1');
select is(pg_temp.s09d_outcome('a:assign1'), 'OK', 'fixture: rev1 holds a real active review assignment');
select pg_temp.s09d_assign('a', 'rev2', interval '1 day', 'owner', 'a:assign2');
select is(pg_temp.s09d_outcome('a:assign2'), 'OK', 'fixture: rev2 holds a real review assignment');
select pg_temp.m_warp('platform_private.cms_schema_review_assignments',
  $$starts_at = clock_timestamp() - interval '3 hours', ends_at = clock_timestamp() - interval '1 hour'$$,
  format('reviewer_person_ref = %L', pg_temp.s09d_actor_id('rev2', 'person')));
-- rev2 also holds a capability that gates no step-up operation.
-- FIXTURE FORGERY: no command confirms an ungoverned membership (rpc_accept_or_end_membership accepts governed tenures only).
insert into identity_private.membership_tenure(organization_id, person_id, state, provenance, governance_mode,
  starts_on, accepted_at, actor_id, version)
select pg_temp.s09d_id('ownerOrg'), pg_temp.s09d_actor_id('rev2', 'person')::uuid, 'confirmed', 'invitation',
       'ungoverned', current_date, clock_timestamp(), pg_temp.s09d_actor_id('owner', 'person')::uuid, 1;
insert into identity_private.organization_actor_grant(organization_id, person_id, capability_code, valid_from, valid_through, active)
values (pg_temp.s09d_id('ownerOrg'), pg_temp.s09d_actor_id('rev2', 'person')::uuid, 'cms.author', current_date, current_date + 5, true);
-- rev3 holds an effective admin capability grant (CFG-11 record).
-- FIXTURE FORGERY: no command in this repository grants an admin capability (CFG-11 record).
insert into platform_private.admin_capability_grants(subject_person_id, capability_key, resource_type, resource_id, scope,
  actions, starts_at, ends_at, grantor_person_id, reason, purpose_grant, state, version_no)
values (pg_temp.s09d_actor_id('rev3', 'person')::uuid, 'admin.identity.mfa_reset', 'organization', pg_temp.s09d_id('ownerOrg'),
  jsonb_build_object('actingPartyId', pg_temp.s09d_id('ownerOrg')), array['reset'], clock_timestamp() - interval '1 hour',
  clock_timestamp() + interval '1 day', pg_temp.s09d_actor_id('owner', 'person')::uuid, 'dec111 test', false, 'active', 1);

-- Refusals (each leaves the factor verified and nothing else changed).
create temp table m_lf_before on commit drop as select pg_temp.m_ver(n)::bigint v, n from generate_series(11, 16) n;
select pg_temp.m_rbegin('lf:owner', 11, pg_temp.m_fid(11), 'user_request', pg_temp.m_ver(11));
select is(pg_temp.m_out('lf:owner'), 'LAST_FACTOR_REQUIRED', 'the receipt-derived owner (receipt + grant) cannot remove the last factor [P2-S09-AC-802] [P2-S09-AC-814]');
select pg_temp.m_warp('identity_private.organization_actor_grant', 'active = false',
  format('person_id = %L', pg_temp.s09d_actor_id('owner', 'person')));
select pg_temp.m_rbegin('lf:receipt', 11, pg_temp.m_fid(11), 'user_request', pg_temp.m_ver(11), 'a2', 'b3');
select is(pg_temp.m_out('lf:receipt'), 'LAST_FACTOR_REQUIRED', 'the immutable owner-initialization receipt alone is enough to refuse [P2-S09-AC-814]');
select pg_temp.m_rbegin('lf:grant', 12, pg_temp.m_fid(12), 'user_request', pg_temp.m_ver(12));
select is(pg_temp.m_out('lf:grant'), 'LAST_FACTOR_REQUIRED', 'an effective cms.schema_designer grant refuses the last factor removal [P2-S09-AC-802] [P2-S09-AC-814]');
select pg_temp.m_rbegin('lf:assign', 13, pg_temp.m_fid(13), 'user_request', pg_temp.m_ver(13));
select is(pg_temp.m_out('lf:assign'), 'LAST_FACTOR_REQUIRED', 'an active cms.schema_review assignment refuses the last factor removal [P2-S09-AC-802]');
select pg_temp.m_rbegin('lf:admin', 15, pg_temp.m_fid(15), 'user_request', pg_temp.m_ver(15));
select is(pg_temp.m_out('lf:admin'), 'LAST_FACTOR_REQUIRED', 'an effective admin capability grant refuses the last factor removal [P2-S09-AC-802]');
select pg_temp.m_rbegin('lf:other', 16, pg_temp.m_fid(16), 'user_request', pg_temp.m_ver(16));
select is(pg_temp.m_out('lf:other'), 'LAST_FACTOR_REQUIRED', 'a designer grant in another organization refuses as well');
select is(pg_temp.m_one($q$select count(*)::text from identity.mfa_factor_registry where auth_user_id in (select uid from m_alias where n in (11, 12, 13, 15, 16)) and state = 'verified'$q$)::integer, 5,
  'all five refused removals left their factor verified');
select is((select count(*)::integer from m_lf_before b where n in (11, 12, 13, 15, 16) and pg_temp.m_ver(n)::bigint = b.v), 5,
  'and left every MFA version untouched');

-- Permitted removals.
select pg_temp.m_rbegin('lf:expired', 14, pg_temp.m_fid(14), 'user_request', pg_temp.m_ver(14));
select is(pg_temp.m_out('lf:expired'), 'OK', 'an expired assignment plus a non-step-up capability (cms.author) does not block removal [P2-S09-AC-804]');
-- Lapse designer2's grant: valid_through before today.
select pg_temp.m_warp('identity_private.organization_actor_grant', 'valid_from = current_date - 10, valid_through = current_date - 1',
  format($$person_id = %L and capability_code = 'cms.schema_designer'$$, pg_temp.s09d_actor_id('designer2', 'person')));
select pg_temp.m_rbegin('lf:lapsed', 12, pg_temp.m_fid(12), 'user_request', pg_temp.m_ver(12), 'a3', 'b4');
select is(pg_temp.m_out('lf:lapsed'), 'OK', 'a lapsed grant no longer counts (currently effective grants only) [P2-S09-AC-803]');
-- Revoke rev3's admin grant.
select pg_temp.m_warp('platform_private.admin_capability_grants',
  format($$state = 'revoked', revoked_at = clock_timestamp(), revoked_by = %L$$, pg_temp.s09d_actor_id('owner', 'person')),
  format('subject_person_id = %L', pg_temp.s09d_actor_id('rev3', 'person')));
select pg_temp.m_rbegin('lf:revoked', 15, pg_temp.m_fid(15), 'user_request', pg_temp.m_ver(15), 'a4', 'b5');
select is(pg_temp.m_out('lf:revoked'), 'OK', 'a revoked admin grant no longer counts');

-- A second verified factor or a pending cancel is never "last".
select pg_temp.m_enroll(13, 'Second');
select pg_temp.m_rbegin('lf:second', 13, pg_temp.m_fid(13), 'user_request', pg_temp.m_ver(13), 'a5', 'b6');
select is(pg_temp.m_out('lf:second'), 'OK', 'with a second verified factor the assignment holder may remove the first');
select pg_temp.m_pending(16, 'Draft');
select pg_temp.m_rbegin('lf:pending', 16, pg_temp.m_one(format($q$select id::text from identity.mfa_factor_registry where auth_user_id = %L and state = 'pending'$q$, pg_temp.m_uid(16)))::uuid, 'user_request', pg_temp.m_ver(16), 'a6', 'b7');
select is(pg_temp.m_out('lf:pending'), 'OK', 'cancelling a pending factor is allowed for a capability holder');
select is(pg_temp.m_fstate(pg_temp.m_fid(16)), 'verified', 'and the verified factor is untouched');

-- The administrative reset path is not subject to the refusal (see the admin reset suite).

select * from finish();

rollback;
