\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 R8 / R14 (re-audit AC523, SEC-8): "CMS-03A-15 allows only the receipt-derived
-- owner ... with no capability key and no currently valid CMS grant required."
-- The first proof lapsed only cms.schema_designer while the owner still held its other
-- valid grants, and the second deactivated only the organization_actor_grant projection
-- (triggers disabled) while the canonical cms_capability_grants rows stayed valid, so an
-- implementation that required ANY valid cms_capability_grants row still passed.  Here the
-- owner's own grants are ended through the producer path, CMS-03A-17 revocation, one
-- command per aggregate; the owner is then shown to hold no valid aggregate, no
-- projection row and none of the grantable capabilities; and the owner commands (grant,
-- renew, revoke, list) all still succeed.  A non-owner holding a valid CMS grant but no
-- receipt is still refused.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

select pg_temp.s09g_member('rev1');
create temp table r8g_ctx on commit drop as
select pg_temp.s09d_id('ownerOrg') as org, pg_temp.s09d_actor_id('owner', 'person')::uuid as owner_person;
create temp table r8g_caps on commit drop as
select unnest(array['cms.schema_designer', 'cms.template_designer', 'cms.taxonomy_curator', 'cms.editor', 'cms.reviewer',
    'cms.reviewer.policy', 'cms.reviewer.legal', 'cms.reviewer.security', 'cms.reviewer.financial',
    'cms.publisher', 'cms.navigation_editor', 'cms.media_contributor', 'cms.media_curator', 'cms.author']) as capability;

-- The owner's own aggregates before anything is ended: the canonical rows the real commands read.
create temp table r8g_owner_aggregates on commit drop as
select g.id, g.capability_code, g.version::text as version
  from platform_private.cms_capability_grants g, r8g_ctx c
 where g.subject_person_ref = c.owner_person and g.state = 'active';
select ok((select count(*) >= 1 from r8g_owner_aggregates)
    and pg_temp.s09g_holds('owner', 'cms.schema_designer'),
  'fixture: before the owner ends its grants it holds active canonical aggregates, including cms.schema_designer');

-- End every one of them with the producer command (CMS-03A-17), as the owner.
select pg_temp.s09g_revoke('r8g:end:' || a.id, 'owner', a.id, a.version, '{"reason": "end every owner grant"}') is not null as sent
  from r8g_owner_aggregates a;
select is((select count(*) from r8g_owner_aggregates a
            where pg_temp.s09d_outcome('r8g:end:' || a.id) = 'OK'), (select count(*) from r8g_owner_aggregates),
  'every one of the owner''s own aggregates was ended by a CMS-03A-17 revocation (N/N)  [P2-S09-AC-523]');
select is((select count(*) from platform_private.cms_capability_grants g, r8g_ctx c
            where g.subject_person_ref = c.owner_person and g.state = 'active'
              and g.valid_from <= pg_temp.s09g_today() and (g.valid_through is null or g.valid_through >= pg_temp.s09g_today())),
  0::bigint, 'the owner now holds no valid canonical CMS grant aggregate [P2-S09-AC-523]');
select is((select count(*) from identity_private.organization_actor_grant a, r8g_ctx c
            where a.organization_id = c.org and a.person_id = c.owner_person and a.active and a.capability_code like 'cms.%'), 0::bigint,
  'and no active CMS organization actor-grant projection row (the owner''s organization and admin capabilities are not CMS grants) [P2-S09-AC-523]');
select is((select string_agg(capability, ',' order by capability) from r8g_caps
            where pg_temp.s09g_holds('owner', capability)), null,
  'the owner holds none of the grantable capabilities [P2-S09-AC-523]');
select is((select count(*) from platform_private.cms_owner_initialization i, r8g_ctx c where i.person_id = c.owner_person), 1::bigint,
  'the owner is still identified by the immutable owner-initialization receipt [P2-S09-AC-523]');

-- The owner commands all still succeed.
select pg_temp.s09g_grant('r8g:grant', 'owner', 'rev1', 'cms.media_curator', pg_temp.s09g_day(2));
select is(pg_temp.s09d_outcome('r8g:grant'), 'OK',
  'CMS-03A-15: the receipt-derived owner grants while holding no valid CMS grant of any kind [P2-S09-AC-523]');
select ok(pg_temp.s09g_holds('rev1', 'cms.media_curator'), 'and the new grant is effective [P2-S09-AC-523]');
select pg_temp.s09d_remember('r8gGrant', pg_temp.s09g_grant_id(pg_temp.s09d_resp('r8g:grant')));
select pg_temp.s09g_renew('r8g:renew', 'owner', pg_temp.s09d_id('r8gGrant'), (pg_temp.s09d_resp('r8g:grant')->>'version'), pg_temp.s09g_day(9));
select is(pg_temp.s09d_outcome('r8g:renew'), 'OK', 'CMS-03A-16: the owner renews a grant while holding no valid CMS grant [P2-S09-AC-523] [P2-S09-AC-1133]');
select pg_temp.s09g_list('r8g:list', 'owner');
select ok(pg_temp.s09d_outcome('r8g:list') = 'OK'
    and exists (select 1 from jsonb_array_elements(pg_temp.s09d_resp('r8g:list')->'items') item where item->>'id' = pg_temp.s09d_id('r8gGrant')::text),
  'CMS-03A-18: the owner lists its grants and sees the one it just made [P2-S09-AC-523]');
select pg_temp.s09g_revoke('r8g:revoke', 'owner', pg_temp.s09d_id('r8gGrant'), (pg_temp.s09d_resp('r8g:renew')->>'version'));
select is(pg_temp.s09d_outcome('r8g:revoke'), 'OK', 'CMS-03A-17: the owner revokes a grant while holding no valid CMS grant [P2-S09-AC-523]');
select ok(not pg_temp.s09g_holds('rev1', 'cms.media_curator'), 'and the revocation is effective at once [P2-S09-AC-523]');

-- A non-owner holding a valid CMS grant and no receipt is still refused: the receipt, not a grant, authorizes.
select ok(pg_temp.s09g_holds('designer2', 'cms.schema_designer')
    and not exists (select 1 from platform_private.cms_owner_initialization i where i.person_id = pg_temp.s09d_actor_id('designer2', 'person')::uuid),
  'fixture: designer2 holds a valid CMS grant (cms.schema_designer, issued by the owner command) and is not the receipt holder');
select pg_temp.s09g_grant('r8g:designer2', 'designer2', 'rev1', 'cms.author', pg_temp.s09g_day(2));
select is(pg_temp.s09d_outcome('r8g:designer2'), 'FORBIDDEN',
  'regression: a non-owner holding a valid CMS grant and no receipt is refused FORBIDDEN, so the receipt identity and not a CMS grant authorizes the owner [P2-S09-AC-523]');
select ok(not pg_temp.s09g_holds('rev1', 'cms.author'), 'and nothing was granted [P2-S09-AC-523]');

select * from finish();
rollback;
