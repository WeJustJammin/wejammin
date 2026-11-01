-- Slice 12 gap lane claude_s12_gaps_db3: P2-S12-AC-056 clause 9 "answers a changed acting party ... under the same key" for
-- CMS-03C-04 (cms_author_locale_variant).  BE03c 149: "the same actor reusing the key with a changed server-resolved acting party,
-- body, path or version returns 409 (BE00 binds (actor_id, operation, key_hash), so a different actor is a distinct binding; DEC-235)".
-- Fixture: the Slice 10 RPC world plus the locale helpers (as gaps_db1_locale_variant), and a SECOND organization of the same actor:
-- the creator owns org B (rpc_create_organization, self_member) and holds cms.author/cms.editor there (a labelled fixture grant, the
-- same forgery the Slice 10 fixture itself uses for org A).
--   1  the actor authors a variant under org A with key K                      (the stored reservation and response)
--   2  the SAME actor replays the same bytes under org B (server-resolved party changed)
--   3  the reservation primitive under org B answers IDEMPOTENCY_MISMATCH       (the fingerprint binds the resolved party)
--   4  control: the primitive under org A, the same bytes, replays the response (party is the only difference)
--   5  control: the same actor, same key, a changed BODY is IDEMPOTENCY_MISMATCH; a different ACTOR with that body is its own binding
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_12_locale_variant/000-helpers.sqlinc

create or replace function pg_temp.g3l_as(p_actor_key text, p_party uuid) returns void language sql as $body$
  select pg_temp.s10_rpc_as((select value::uuid from s10_ids where key = p_actor_key), p_party)
$body$;
create or replace function pg_temp.g3l_org(p_key text) returns uuid language sql stable as $body$
  select value::uuid from s10_ids where key = p_key
$body$;

-- The second organization of the creator.
select pg_temp.s10_rpc_as(pg_temp.g3l_org('creatorAuth'), null);
select set_config('app.correlation_id', 'a9100000-0000-4000-8000-000000000092', true);
select set_config('app.idempotency_key_hash', 'g3l-org-b-create-0001', true);
select set_config('app.request_hash', 'g3l-org-b-create-request-0001', true);
create temp table g3l_org_b on commit drop as
select (platform_api.rpc_create_organization('self_member', '{}'::text[])->>'organizationId')::uuid as id;
insert into identity_private.organization_actor_grant(organization_id, person_id, capability_code, valid_from, valid_through, active)
select (select id from g3l_org_b), pg_temp.g3l_org('creatorPerson'), capability, current_date, current_date + 1, true
  from (values ('cms.author'), ('cms.editor')) c(capability);
select ok(
  (select id is distinct from pg_temp.g3l_org('organization') from g3l_org_b)
  and exists (select 1 from identity_private.membership_tenure t
               where t.organization_id = (select id from g3l_org_b) and t.person_id = pg_temp.g3l_org('creatorPerson')
                 and t.state = 'confirmed')
  and exists (select 1 from identity_private.membership_tenure t
               where t.organization_id = pg_temp.g3l_org('organization') and t.person_id = pg_temp.g3l_org('creatorPerson')
                 and t.state = 'confirmed'),
  'control: the creator is a confirmed member of two organizations, A (owner of the entry) and B [P2-S12-AC-056]');

-- 1. the first write, under org A
select pg_temp.g3l_as('creatorAuth', pg_temp.g3l_org('organization'));
create temp table g3l_req on commit drop as
select pg_temp.l12_req('fr-FR', pg_temp.l12_title_field('Titre'), 'g3l-party-key-0001') as request;
create temp table g3l_first on commit drop as
select pg_temp.l12_author(request) as response from g3l_req;
select ok((select response->>'state' = 'draft' and response->>'locale' = 'fr-FR' from g3l_first),
  'setup: the creator authors the fr-FR variant under organization A and the key is stored [P2-S12-AC-056]');
create temp table g3l_receipt on commit drop as
select to_jsonb(r) as record from platform_private.idempotency_records r
 where r.operation = 'CMS-03C-04' and r.key_hash = platform_private.cms_key_hash('g3l-party-key-0001');
select is((select count(*)::integer from g3l_receipt), 1, 'setup: exactly one stored reservation for the key [P2-S12-AC-056]');
create temp table g3l_before on commit drop as
select (select count(*) from platform_private.cms_locale_variants) as variants,
       (select count(*) from platform_private.cms_entry_revisions) as revisions,
       (select count(*) from platform_private.outbox_events) as events,
       (select count(*) from audit_private.audit_events) as audits,
       (select count(*) from platform_private.idempotency_records) as reservations,
       (select version from platform_private.cms_content_entries where id = pg_temp.l12_entry()) as entry_version;

-- 2. the same actor, the same bytes, a different server-resolved acting party (GUC only: the request carries no context)
select pg_temp.g3l_as('creatorAuth', (select id from g3l_org_b));
create temp table g3l_replay on commit drop as
select pg_temp.l12_try(format('select platform_api.cms_author_locale_variant(%L::jsonb)', request::text)) as outcome from g3l_req;
select diag('same actor under organization B: ' || (select outcome from g3l_replay));
select ok((select outcome <> 'OK' and outcome <> (select response::text from g3l_first) from g3l_replay),
  'the same actor replaying the key under another server-resolved acting party is never served the stored response [P2-S12-AC-056]');
select is((select outcome from g3l_replay), 'P0001:NOT_FOUND',
  'the entry belongs to organization A, so under organization B the entry itself is the concealed NOT_FOUND, answered before the reservation is read (BE03c visibility, then capability, then idempotency) [P2-S12-AC-056]');
select ok(
  (select (select count(*) from platform_private.cms_locale_variants) = variants
      and (select count(*) from platform_private.cms_entry_revisions) = revisions
      and (select count(*) from platform_private.outbox_events) = events
      and (select count(*) from audit_private.audit_events) = audits
      and (select count(*) from platform_private.idempotency_records) = reservations
      and (select version from platform_private.cms_content_entries where id = pg_temp.l12_entry()) = entry_version
     from g3l_before)
  and (select r.record from g3l_receipt r) = (select to_jsonb(i) from platform_private.idempotency_records i
        where i.operation = 'CMS-03C-04' and i.key_hash = platform_private.cms_key_hash('g3l-party-key-0001')),
  'the changed-party replay wrote no variant, revision, event, audit or reservation and left the stored reservation byte-identical [P2-S12-AC-056]');

-- 3. the reservation primitive the command calls, over the real stored key and the same bytes, under organization B
select pg_temp.g3l_as('creatorAuth', (select id from g3l_org_b));
create temp table g3l_prim_b on commit drop as
select pg_temp.l12_try(format('select platform_private.cms_reserve(%L::jsonb, %L::uuid, ''CMS-03C-04'')',
  request::text, pg_temp.g3l_org('creatorAuth'))) as outcome from g3l_req;
select is((select outcome from g3l_prim_b), 'P0001:IDEMPOTENCY_MISMATCH',
  'the reservation of the stored CMS-03C-04 key answers IDEMPOTENCY_MISMATCH when the server-resolved acting party changed and nothing else did [P2-S12-AC-056]');

-- 4. control: the same primitive, the same bytes, party A again, replays the completed reservation
select pg_temp.g3l_as('creatorAuth', pg_temp.g3l_org('organization'));
create temp table g3l_prim_a on commit drop as
select pg_temp.l12_json(format('select to_jsonb(platform_private.cms_reserve(%L::jsonb, %L::uuid, ''CMS-03C-04''))',
  request::text, pg_temp.g3l_org('creatorAuth'))) as reservation from g3l_req;
select ok((select reservation->>'state' = 'completed' and not reservation ? '__error' from g3l_prim_a),
  'control: under the original acting party the identical bytes find the completed reservation, so the acting party was the only difference [P2-S12-AC-056]');

-- 5. controls on the binding itself
create temp table g3l_body on commit drop as
select pg_temp.l12_req('de-DE', pg_temp.l12_title_field('Titel'), 'g3l-party-key-0001') as request;
select pg_temp.g3l_as('creatorAuth', pg_temp.g3l_org('organization'));
create temp table g3l_same_actor on commit drop as
select pg_temp.l12_try(format('select platform_api.cms_author_locale_variant(%L::jsonb)', request::text)) as outcome from g3l_body;
select is((select outcome from g3l_same_actor), 'P0001:IDEMPOTENCY_MISMATCH',
  'control: the same actor and party reusing the key with a changed body is IDEMPOTENCY_MISMATCH [P2-S12-AC-056]');
select pg_temp.g3l_as('editorAuth', pg_temp.g3l_org('organization'));
create temp table g3l_other_actor on commit drop as
select pg_temp.l12_try(format('select platform_api.cms_author_locale_variant(%L::jsonb)', request::text)) as outcome from g3l_body;
select diag('different actor, same key and body: ' || (select outcome from g3l_other_actor));
select is((select outcome from g3l_other_actor), 'OK',
  'control: a DIFFERENT actor sending that same changed body under the same key is its own binding, not IDEMPOTENCY_MISMATCH [P2-S12-AC-056]');
select is(
  (select count(*)::integer from platform_private.idempotency_records
    where operation = 'CMS-03C-04' and key_hash = platform_private.cms_key_hash('g3l-party-key-0001')),
  2, 'control: the key now holds two reservations, one per actor [P2-S12-AC-056]');

select finish();
rollback;
