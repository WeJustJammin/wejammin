commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 acceptance evidence (lane e1-db): DEC-119/DEC-120 owner CMS capability
-- grant clauses the lifecycle suites do not pin: ended-membership subjects, stale
-- MFA on renewal, future valid_from, non-owner revocation, revoke replay, the
-- event envelope per version, the cross-organization list boundary, the writer
-- set of the actor-grant projection and the owner-initialization backfill.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

-- AC507: a member whose confirmed membership has ended is not an eligible subject.
select pg_temp.s09g_member('rev2');
update identity_private.membership_tenure set starts_on = current_date - 10, ends_on = current_date - 1
 where person_id = pg_temp.s09d_actor_id('rev2', 'person')::uuid and organization_id = pg_temp.s09d_id('ownerOrg');
select pg_temp.s09g_fingerprint() as ended_before \gset
select pg_temp.s09g_grant('e:ended', 'owner', 'rev2', 'cms.author', pg_temp.s09g_day(3));
select is(pg_temp.s09d_outcome('e:ended'), 'NOT_FOUND',
  'CMS-03A-15 refuses a subject whose membership ended yesterday as an indistinguishable 404 [P2-S09-AC-507]');
select is(pg_temp.s09g_fingerprint(), :'ended_before', 'the refused grant left every effect table unchanged [P2-S09-AC-507]');

-- Lifecycle fixture: grant -> renew -> revoke of one aggregate.
select pg_temp.s09g_member('rev1');
select pg_temp.s09g_grant('l:grant', 'owner', 'rev1', 'cms.editor', pg_temp.s09g_day(10));
select is(pg_temp.s09d_outcome('l:grant'), 'OK', 'fixture: the editor grant is created');
create temp table s09e_grant on commit drop as
select pg_temp.s09g_grant_id(pg_temp.s09d_resp('l:grant')) as id;

-- AC556: renewal needs recent step-up MFA.
update platform_private.acting_context_binding set last_seen_at = clock_timestamp() - interval '11 minutes'
 where id = pg_temp.s09d_actor_id('owner', 'binding')::uuid;
select pg_temp.s09g_fingerprint() as stale_before \gset
select pg_temp.s09g_renew('l:stale', 'owner', (select id from s09e_grant), '1', pg_temp.s09g_day(20));
select is(pg_temp.s09d_outcome('l:stale'), 'STEP_UP_REQUIRED',
  'CMS-03A-16 with a binding whose MFA is older than ten minutes is 401 STEP_UP_REQUIRED [P2-S09-AC-556]');
select is(pg_temp.s09g_fingerprint(), :'stale_before', 'the stale-MFA renewal reserved nothing and changed nothing [P2-S09-AC-556]');
update platform_private.acting_context_binding set last_seen_at = clock_timestamp()
 where id = pg_temp.s09d_actor_id('owner', 'binding')::uuid;
select pg_temp.s09g_renew('l:renew', 'owner', (select id from s09e_grant), '1', pg_temp.s09g_day(20));
select is(pg_temp.s09d_outcome('l:renew'), 'OK', 'fixture: the renewal with recent MFA succeeds');

-- AC585: only the receipt-derived owner revokes; a same-organization designer is a 403.
select pg_temp.s09g_revoke('l:nonowner', 'designer2', (select id from s09e_grant), '2');
select is(pg_temp.s09d_outcome('l:nonowner'), 'FORBIDDEN',
  'CMS-03A-17 by a schema designer of the owner organization who is not the receipt-derived owner is 403 [P2-S09-AC-585]');
select ok(pg_temp.s09g_holds('rev1', 'cms.editor'), 'the refused revocation left the capability effective [P2-S09-AC-585]');

-- AC587: a same-key revoke retry replays the first response and appends nothing.
select ok(pg_temp.s09d_replay_pair('l:revoke', 'platform_api.cms_revoke_capability_grant', 'owner',
    jsonb_build_object('grantId', (select id from s09e_grant), 'expectedVersion', '2',
      'idempotencyKey', 's09e-revoke-replay-0001'), true),
  'an exact same-key revoke retry returns the first response [P2-S09-AC-587]');
select is((select count(*)::integer from platform_private.cms_capability_grant_events where grant_id = (select id from s09e_grant) and action = 'revoked'), 1,
  'the revoke replay appended no second event [P2-S09-AC-587]');

-- AC584: authority needs valid_from <= current UTC date <= valid_through on an active row.
select pg_temp.s09g_grant('l:future', 'owner', 'rev1', 'cms.navigation_editor', pg_temp.s09g_day(10));
select ok(pg_temp.s09g_holds('rev1', 'cms.navigation_editor'), 'precondition: the navigation grant is effective');
select ok(pg_temp.s09g_warp('rev1', 'cms.navigation_editor', 2, 9) and not pg_temp.s09g_holds('rev1', 'cms.navigation_editor'),
  'a grant whose valid_from is still in the future confers no authority in any capability predicate [P2-S09-AC-584]');
select ok(pg_temp.s09g_warp('rev1', 'cms.navigation_editor', -3, -1) and not pg_temp.s09g_holds('rev1', 'cms.navigation_editor'),
  'a lapsed grant (valid_through before today) confers no authority [P2-S09-AC-584]');
select ok(pg_temp.s09g_warp('rev1', 'cms.navigation_editor', -3, 0) and pg_temp.s09g_holds('rev1', 'cms.navigation_editor'),
  'a grant is effective on its first and last valid UTC day (valid_from <= today <= valid_through) [P2-S09-AC-584]');

-- AC522: lastAction, a nullable reason and subjectPersonId (owner-only) on the resource.
select ok(pg_temp.s09d_outcome('l:future') = 'OK'
  and pg_temp.s09d_resp('l:future')->>'lastAction' = 'granted' and pg_temp.s09d_resp('l:future')->'reason' = 'null'::jsonb
  and pg_temp.s09d_resp('l:future')->>'subjectPersonId' = pg_temp.s09d_actor_id('rev1', 'person'),
  'a grant without a reason returns lastAction granted, reason null and subjectPersonId to the receipt-derived owner [P2-S09-AC-522]');
select pg_temp.s09g_list('l:designer-list', 'designer2');
select is(pg_temp.s09d_outcome('l:designer-list'), 'FORBIDDEN',
  'subjectPersonId is never returned to a non-owner: a non-owner designer reads no grant at all [P2-S09-AC-522]');

-- AC687 / AC688 / AC588: the event envelope per committed version.
select ok((select count(*) = 3 from platform_private.outbox_events o
    where o.event_type = 'cms.capability.grant.changed.v1' and o.aggregate_type = 'cms_capability_grant'
      and o.aggregate_id = (select id from s09e_grant)
      and o.aggregate_version in (1, 2, 3)
      and o.payload = jsonb_build_object('grantId', (select id from s09e_grant)::text,
            'subjectPersonId', pg_temp.s09d_actor_id('rev1', 'person'))),
  'grant, renew and revoke each emit cms.capability.grant.changed.v1 with exactly { grantId, subjectPersonId } and aggregateVersion equal to the committed grant version [P2-S09-AC-687]');
select ok((select count(*) = 3 from platform_private.cms_capability_grant_events e
    join platform_private.outbox_events o on o.aggregate_id = e.grant_id and o.aggregate_version = e.aggregate_version
   where e.grant_id = (select id from s09e_grant) and o.event_type = 'cms.capability.grant.changed.v1'
     and (select state from platform_private.cms_capability_grants where id = e.grant_id) = 'revoked'),
  'each event row has its outbox row and each outbox row follows its committed aggregate, event row, projection and audit [P2-S09-AC-688]');
select ok((select count(*) = 1 from platform_private.outbox_events o
    where o.aggregate_id = (select id from s09e_grant) and o.aggregate_version = 3
      and o.event_type = 'cms.capability.grant.changed.v1'),
  'the revocation commits exactly one outbox row at the committed aggregate version 3 [P2-S09-AC-588]');

-- AC616: the owner list omits another organization's rows without a 404.
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_capability_grants(owner_id, state, version, subject_person_ref, capability_code,
    valid_from, valid_through, grantor_person_ref, last_action)
select pg_temp.s09d_id('otherOrg'), 'active', 1, person_id, 'cms.author', current_date, current_date + 5, person_id, 'granted'
from s09d_actor where key = 'other';
select set_config('app.cms_rpc', '', true);
select pg_temp.s09g_list('l:list', 'owner');
select ok(pg_temp.s09d_outcome('l:list') = 'OK'
  and (select count(*) = 0 from jsonb_array_elements(pg_temp.s09d_resp('l:list')->'items') i
        where i->>'subjectPersonId' = pg_temp.s09d_actor_id('other', 'person'))
  and jsonb_array_length(pg_temp.s09d_resp('l:list')->'items') > 0,
  'the owner list returns only the owner organization''s aggregates and omits the other organization''s row without emitting 404 [P2-S09-AC-616]');
select pg_temp.s09g_list('l:otherlist', 'other');
select is(pg_temp.s09d_outcome('l:otherlist'), 'FORBIDDEN',
  'the other organization''s own designer is still not the receipt-derived owner of any organization [P2-S09-AC-616]');

-- AC917: the writers of the actor-grant projection for CMS codes.
select is((select string_agg(n.nspname || '.' || p.proname, ',' order by n.nspname, p.proname)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('platform_private', 'platform_api', 'identity_private', 'identity', 'public_api', 'audit_private')
       and p.prokind = 'f'
       and pg_get_functiondef(p.oid) ~* '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+identity_private\.organization_actor_grant'),
  'identity_private.rpc_create_organization,platform_private.cms_capability_grant_project,platform_private.initialize_cms_owner',
  'only the projection writer, the organization bootstrap and the owner initialization write organization_actor_grant [P2-S09-AC-917]');
select is((select string_agg(p.proname, ',' order by p.proname)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'platform_private' and p.prokind = 'f' and p.proname <> 'cms_capability_grant_project'
       and pg_get_functiondef(p.oid) ~* 'cms_capability_grant_project\('),
  'cms_grant_capability,cms_renew_capability_grant,cms_revoke_capability_grant',
  'only cms_grant_capability, cms_renew_capability_grant and cms_revoke_capability_grant call the projection writer [P2-S09-AC-917]');
select ok(pg_temp.s09d_def('identity_private.rpc_create_organization(text,text[])') <> ''
  and position('cms.' in coalesce((select string_agg(pg_get_functiondef(p.oid), ' ') from pg_proc p
        where p.oid = 'identity_private.rpc_create_organization(text,text[])'::regprocedure), '')) = 0,
  'the organization bootstrap writer names no cms.* capability code [P2-S09-AC-917]');

-- AC659 / AC917: the backfill reads and writes only CMS aggregates of the owner's organization.
select set_config('app.cms_rpc', '', true);
insert into identity_private.organization_actor_grant(organization_id, person_id, capability_code, valid_from, valid_through, active)
select pg_temp.s09d_id('ownerOrg'), person_id, c.code, current_date, current_date + c.days, true
from s09d_actor, (values ('cms.media_curator', 20), ('cms.taxonomy_curator', 100), ('inbox.read', 5)) c(code, days)
where key = 'rev3';
insert into identity_private.organization_actor_grant(organization_id, person_id, capability_code, valid_from, valid_through, active)
select pg_temp.s09d_id('ownerOrg'), person_id, 'cms.publisher', current_date, null, true from s09d_actor where key = 'rev3';
create temp table s09e_backfill_before on commit drop as
select (select count(*) from identity_private.organization_actor_grant) as projection_rows,
       (select md5(coalesce(string_agg(t::text, ',' order by organization_id, person_id, capability_code), ''))
          from identity_private.organization_actor_grant t) as projection_digest,
       (select count(*) from platform_private.cms_capability_grants) as aggregates;
select is(platform_private.cms_backfill_owner_capability_grants(pg_temp.s09d_id('ownerOrg')), 1,
  'the backfill creates exactly one aggregate: the grantable, finite, bounded CMS actor-grant row [P2-S09-AC-659]');
select ok(exists (select 1 from platform_private.cms_capability_grants g
    where g.owner_id = pg_temp.s09d_id('ownerOrg') and g.subject_person_ref = pg_temp.s09d_actor_id('rev3', 'person')::uuid
      and g.capability_code = 'cms.media_curator' and g.version = 1 and g.last_action = 'granted'
      and g.grantor_person_ref = pg_temp.s09d_actor_id('owner', 'person')::uuid and g.state = 'active'),
  'the backfilled aggregate is version 1, last_action granted, grantor the owner initialization receipt person [P2-S09-AC-659]');
select is((select count(*)::integer from platform_private.cms_capability_grants g
    where g.subject_person_ref = pg_temp.s09d_actor_id('rev3', 'person')::uuid
      and g.capability_code in ('cms.taxonomy_curator', 'inbox.read', 'cms.publisher')), 0,
  'an over-long term, a non-CMS code and a row with no end date are left to their projection [P2-S09-AC-659]');
select ok((select projection_rows = (select count(*) from identity_private.organization_actor_grant)
      and projection_digest = (select md5(coalesce(string_agg(t::text, ',' order by organization_id, person_id, capability_code), ''))
                                 from identity_private.organization_actor_grant t)
      and aggregates + 1 = (select count(*) from platform_private.cms_capability_grants)
    from s09e_backfill_before),
  'the backfill wrote only one CMS aggregate and left the actor-grant projection byte-for-byte unchanged [P2-S09-AC-917]');
select is(platform_private.cms_backfill_owner_capability_grants(pg_temp.s09d_id('ownerOrg')), 0,
  'the backfill is idempotent: a second run inserts nothing [P2-S09-AC-659]');
select is(platform_private.cms_backfill_owner_capability_grants(pg_temp.s09d_id('otherOrg')), 0,
  'an organization with no owner initialization receipt is never backfilled [P2-S09-AC-659]');

select * from finish();
rollback;
