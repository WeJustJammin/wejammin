\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-119/DEC-120 QA-RED: CMS-03A-18 protected CMS capability grant
-- list.  Receipt-derived owner only, read only (no step-up), bounded to the
-- owner's organization, derived lapse state, keyset pagination bound to the
-- query, and zero side effects on success and failure.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

select pg_temp.s09g_member('rev1');
select pg_temp.s09g_member('rev2');
select pg_temp.s09g_grant('s:' || c, 'owner', 'rev1', c, pg_temp.s09g_day(case c when 'cms.author' then 10 when 'cms.editor' then 20
  when 'cms.reviewer' then 30 when 'cms.publisher' then 40 else 50 end))
from unnest(array['cms.author', 'cms.editor', 'cms.reviewer', 'cms.publisher', 'cms.taxonomy_curator']) c;
select pg_temp.s09g_grant('s:rev2', 'owner', 'rev2', 'cms.author', pg_temp.s09g_day(60));
select is((select count(*)::integer from s09d_probe where label like 's:%' and state = '00000'), 6, 'precondition: six aggregates were granted');
-- One lapsed, one revoked.
select pg_temp.s09g_warp('rev1', 'cms.editor', -10, -2) as warped \gset
select pg_temp.s09g_revoke('s:revoke', 'owner', pg_temp.s09g_grant_id(pg_temp.s09d_resp('s:cms.reviewer')), '1');
select is(:'warped'::text, 't'::text, 'precondition: the editor grant is lapsed');

-- Refusals and zero side effects.
select pg_temp.s09g_fingerprint() as before_fp \gset
select pg_temp.s09g_list('q:designer2', 'designer2');
select is(pg_temp.s09d_outcome('q:designer2'), 'FORBIDDEN', 'a non-owner designer cannot list (403) [P2-S09-AC-615]');
select pg_temp.s09g_list('q:other', 'other');
select is(pg_temp.s09d_outcome('q:other'), 'FORBIDDEN', 'another organization''s designer cannot list (403) [P2-S09-AC-616]');
select pg_temp.s09g_list('q:nobinding', 'owner', '{}', false);
select is(pg_temp.s09d_outcome('q:nobinding'), 'UNAUTHENTICATED', 'a list without the acting-context binding is 401 UNAUTHENTICATED');
select pg_temp.s09g_list('q:key', 'owner', '{"idempotencyKey": "s09g-list-key-0001"}');
select is(pg_temp.s09d_outcome('q:key'), 'INVALID_REQUEST', 'a mutation-only field on a read is 400');
select pg_temp.s09g_list('q:unknown', 'owner', '{"unknown": 1}');
select is(pg_temp.s09d_outcome('q:unknown'), 'INVALID_REQUEST', 'an unknown query key is 400');
select pg_temp.s09g_list('q:l0', 'owner', '{"limit": 0}');
select pg_temp.s09g_list('q:l101', 'owner', '{"limit": 101}');
select pg_temp.s09g_list('q:sort', 'owner', '{"sort": "createdAt"}');
select pg_temp.s09g_list('q:dir', 'owner', '{"direction": "up"}');
select pg_temp.s09g_list('q:state', 'owner', '{"state": "expired"}');
select pg_temp.s09g_list('q:cap', 'owner', '{"capability": "cms.schema_review"}');
select pg_temp.s09g_list('q:sub', 'owner', '{"subjectPersonId": "nope"}');
select is((select count(*)::integer from s09d_probe where label in ('q:l0', 'q:l101', 'q:sort', 'q:dir', 'q:state', 'q:cap', 'q:sub')
  and message = 'VALIDATION_FAILED'), 7, 'out-of-range or out-of-vocabulary query values are 422');
select pg_temp.s09g_list('q:cursor', 'owner', '{"cursor": "bm90LWEtY3Vyc29y"}');
select is(pg_temp.s09d_outcome('q:cursor'), 'INVALID_REQUEST', 'a malformed cursor is 400');
select is(pg_temp.s09g_fingerprint(), :'before_fp', 'rejected lists left every effect table unchanged [P2-S09-AC-617]');

-- Default list: owner organization only, derived state, no side effects, MFA not required.
-- TIME-WARP: a stale or recent acting-context binding (heartbeat, MFA recency, expiry) cannot be produced without waiting; the binding itself was selected through identity_context_bind.
update platform_private.acting_context_binding set last_seen_at = clock_timestamp() - interval '20 minutes'
 where id = pg_temp.s09d_actor_id('owner', 'binding')::uuid;
select pg_temp.s09g_list('q:all', 'owner', '{"limit": 100}');
select is(pg_temp.s09d_outcome('q:all'), 'OK', 'the owner lists with a stale MFA instant (read only, no step-up) [P2-S09-AC-615]');
select is(pg_temp.s09g_fingerprint(), :'before_fp', 'a successful list reserves no idempotency key and writes no audit, outbox, event or row [P2-S09-AC-617]');
select is(jsonb_array_length(pg_temp.s09d_resp('q:all')->'items'), 9,
  'two owner-initialization aggregates, the second designer''s grant and six granted aggregates are listed');
select ok(pg_temp.s09d_resp('q:all') ? 'nextCursor' and pg_temp.s09d_resp('q:all')->'nextCursor' = 'null'::jsonb
  and (select count(*) = 2 from jsonb_object_keys(pg_temp.s09d_resp('q:all'))), 'the page is exactly { items, nextCursor } with a null cursor when exhausted');
select ok((select bool_and(i->>'resourceKind' = 'cms_capability_grant' and (select count(*) = 14 from jsonb_object_keys(i))
    and not (i ?| array['ownerId', 'actorId', 'grantorPersonId', 'actingPartyId']))
  from jsonb_array_elements(pg_temp.s09d_resp('q:all')->'items') i), 'every item is a safe CmsCapabilityGrantResource [P2-S09-AC-522]');
select is((select string_agg(i->>'capability', ',' order by i->>'capability') from jsonb_array_elements(pg_temp.s09d_resp('q:all')->'items') i
  where i->>'state' = 'lapsed'), 'cms.editor', 'the lapsed state is derived from valid_through [P2-S09-AC-520] [P2-S09-AC-614]');
select is((select string_agg(i->>'capability', ',') from jsonb_array_elements(pg_temp.s09d_resp('q:all')->'items') i
  where i->>'state' = 'revoked'), 'cms.reviewer', 'the revoked aggregate is listed as revoked [P2-S09-AC-520]');
-- TIME-WARP: a stale or recent acting-context binding (heartbeat, MFA recency, expiry) cannot be produced without waiting; the binding itself was selected through identity_context_bind.
update platform_private.acting_context_binding set last_seen_at = clock_timestamp()
 where id = pg_temp.s09d_actor_id('owner', 'binding')::uuid;

-- Filters.
select pg_temp.s09g_list('f:sub', 'owner', jsonb_build_object('subjectPersonId', pg_temp.s09d_actor_id('rev2', 'person')));
select is(jsonb_array_length(pg_temp.s09d_resp('f:sub')->'items'), 1, 'subjectPersonId filters to one subject');
select pg_temp.s09g_list('f:cap', 'owner', '{"capability": "cms.author"}');
select is(jsonb_array_length(pg_temp.s09d_resp('f:cap')->'items'), 2, 'capability filters to the two author aggregates');
select pg_temp.s09g_list('f:active', 'owner', '{"state": "active"}');
select pg_temp.s09g_list('f:lapsed', 'owner', '{"state": "lapsed"}');
select pg_temp.s09g_list('f:revoked', 'owner', '{"state": "revoked"}');
select is(jsonb_array_length(pg_temp.s09d_resp('f:active')->'items') || '/' || jsonb_array_length(pg_temp.s09d_resp('f:lapsed')->'items')
  || '/' || jsonb_array_length(pg_temp.s09d_resp('f:revoked')->'items'), '7/1/1',
  'state filters partition the aggregates into effective, lapsed and revoked [P2-S09-AC-614]');

-- Sorting and keyset pagination bound to the query.
select pg_temp.s09g_list('p:1', 'owner', '{"limit": 4, "sort": "validThrough", "direction": "asc"}');
select ok(jsonb_array_length(pg_temp.s09d_resp('p:1')->'items') = 4 and pg_temp.s09d_resp('p:1')->>'nextCursor' is not null
  and length(pg_temp.s09d_resp('p:1')->>'nextCursor') <= 512, 'a bounded page returns an opaque cursor of at most 512 characters');
select pg_temp.s09g_list('p:2', 'owner', jsonb_build_object('limit', 4, 'sort', 'validThrough', 'direction', 'asc', 'cursor', pg_temp.s09d_resp('p:1')->>'nextCursor'));
select pg_temp.s09g_list('p:3', 'owner', jsonb_build_object('limit', 4, 'sort', 'validThrough', 'direction', 'asc', 'cursor', pg_temp.s09d_resp('p:2')->>'nextCursor'));
select ok((select count(distinct i->>'id') = 9 and count(*) = 9 from (
    select jsonb_array_elements(pg_temp.s09d_resp(l)->'items') i from unnest(array['p:1', 'p:2', 'p:3']) l) all_items)
  and pg_temp.s09d_resp('p:3')->'nextCursor' = 'null'::jsonb, 'cursor pages cover all nine aggregates exactly once and end with a null cursor');
select ok((select array_agg(i->>'validThrough' order by ord) = array_agg(i->>'validThrough' order by i->>'validThrough', ord)
  from (select i, row_number() over () ord from (
    select jsonb_array_elements(pg_temp.s09d_resp(l)->'items') i from unnest(array['p:1', 'p:2', 'p:3']) l) x) y),
  'validThrough ascending order is stable across pages');
select pg_temp.s09g_list('p:bound', 'owner', jsonb_build_object('limit', 4, 'sort', 'validThrough', 'direction', 'desc', 'cursor', pg_temp.s09d_resp('p:1')->>'nextCursor'));
select is(pg_temp.s09d_outcome('p:bound'), 'INVALID_REQUEST', 'a cursor replayed under a different query is 400');
select pg_temp.s09g_list('p:desc', 'owner', '{"sort": "updatedAt"}');
select ok((select array_agg(i->>'updatedAt' order by ord) = array_agg(i->>'updatedAt' order by (i->>'updatedAt')::timestamptz desc, ord)
  from (select i, row_number() over () ord from jsonb_array_elements(pg_temp.s09d_resp('p:desc')->'items') i) y),
  'the default order is updatedAt descending');

select * from finish();
rollback;
