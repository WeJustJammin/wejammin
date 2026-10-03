\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 R8 (re-audit AC523): "CMS-03A-15 allows only the receipt-derived
-- owner ... with no capability key and no currently valid CMS grant required."
-- The earlier proof lapsed only cms.schema_designer while the owner still held
-- thirteen valid self-grants, so an implementation that required ANY valid CMS
-- grant would still have passed.  Here every one of the owner's actor-grant
-- rows is deactivated (a negative-control forgery on the projection, rolled back
-- with the test), the owner is shown to hold none of the grantable capabilities,
-- and the owner still grants through CMS-03A-15, while a non-owner schema
-- designer is still refused.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

select pg_temp.s09g_member('rev1');
create temp table r8g_ctx on commit drop as
select pg_temp.s09d_id('ownerOrg') as org, pg_temp.s09d_actor_id('owner', 'person')::uuid as owner_person;
select ok((select count(*) >= 1 from identity_private.organization_actor_grant g, r8g_ctx c
            where g.organization_id = c.org and g.person_id = c.owner_person and g.active)
    and platform_private.cms_person_holds_capability((select org from r8g_ctx), (select owner_person from r8g_ctx), 'cms.schema_designer'),
  'fixture: before the lapse the owner holds active CMS grants, including cms.schema_designer');

set constraints all immediate;
alter table identity_private.organization_actor_grant disable trigger user;
-- TIME-WARP: shifts a grant window to reach a time-dependent branch.
update identity_private.organization_actor_grant g set active = false
  from r8g_ctx c where g.organization_id = c.org and g.person_id = c.owner_person;
alter table identity_private.organization_actor_grant enable trigger user;
set constraints all deferred;

select is((select string_agg(cap, ',' order by cap) from unnest(array[
    'cms.schema_designer', 'cms.template_designer', 'cms.taxonomy_curator', 'cms.editor', 'cms.reviewer',
    'cms.reviewer.policy', 'cms.reviewer.legal', 'cms.reviewer.security', 'cms.reviewer.financial',
    'cms.publisher', 'cms.navigation_editor', 'cms.media_contributor', 'cms.media_curator', 'cms.author']) cap
   where platform_private.cms_person_holds_capability((select org from r8g_ctx), (select owner_person from r8g_ctx), cap)),
  null, 'fixture: after the lapse the owner holds none of the grantable CMS capabilities [P2-S09-AC-523]');
select pg_temp.s09g_grant('r8g:owner', 'owner', 'rev1', 'cms.media_curator', pg_temp.s09g_day(2));
select is(pg_temp.s09d_outcome('r8g:owner'), 'OK',
  'the receipt-derived owner grants while holding no currently valid CMS grant of any kind [P2-S09-AC-523]');
select ok(pg_temp.s09g_holds('rev1', 'cms.media_curator'), 'and the new grant is effective [P2-S09-AC-523]');
select pg_temp.s09g_member('designer2');
select pg_temp.s09g_grant('r8g:designer2', 'designer2', 'rev1', 'cms.author', pg_temp.s09g_day(2));
select is(pg_temp.s09d_outcome('r8g:designer2'), 'FORBIDDEN',
  'control: a non-owner is still refused, so the receipt identity and not a CMS grant authorizes the owner [P2-S09-AC-523]');

select * from finish();
rollback;
