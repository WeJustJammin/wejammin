-- CMS-03C-18 RED/GREEN suite: platform_private.cms_canonical_taxonomy_match(p_domain text, p_candidates jsonb).
-- Normative: BE03c 187 (internal operation row), 1373 (canonical projection D10), 1375 (DEC-135), 1298-1304 (503 DEPENDENCY_UNAVAILABLE),
-- 1447 (grants), 1571 (cross-shard direction); tracker P2-S12-AC-136 .. AC-141; contracts canonical-taxonomy-match.ts.
-- Fixtures: three real persons through auth_bootstrap; active/removed role facet assertions are the Shard 01 projection source and are
-- inserted by the test-admin (the facet command belongs to Shard 01). Fault and slowness are injected only inside rolled-back
-- subtransactions by replacing the provider boundary function, never by editing the function under test. Everything rolls back.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Runs a setup statement and a scalar call inside a subtransaction that is always undone; returns the call's text result or
-- '<sqlstate>:<message>[#<detail>]'.  Only the product call is caught, the setup must succeed.
create function pg_temp.s12tc_with(p_setup text, p_call text) returns text
language plpgsql as $body$
declare v_res text; v_state text; v_msg text; v_det text; v_undo boolean := false;
begin
  begin
    execute p_setup;
    begin
      perform set_config('app.cms_rpc', 'true', true);
      execute p_call into v_res;
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text, v_det = pg_exception_detail;
      v_res := v_state || ':' || v_msg || coalesce('#' || nullif(v_det, ''), '');
    end;
    v_undo := true;
    raise exception 'S12TC_UNDO';
  exception when others then
    if not v_undo then raise; end if;
  end;
  return v_res;
end;
$body$;

-- The call's result or refusal, no setup.
create function pg_temp.s12tc_call(p_domain text, p_candidates jsonb) returns text
language plpgsql as $body$
declare v_res jsonb; v_state text; v_msg text;
begin
  perform set_config('app.cms_rpc', 'true', true);
  begin
    v_res := platform_private.cms_canonical_taxonomy_match(p_domain, p_candidates);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    return v_state || ':' || v_msg;
  end;
  return v_res::text;
end;
$body$;

create function pg_temp.s12tc_j(p_domain text, p_candidates jsonb) returns jsonb
language plpgsql as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  return platform_private.cms_canonical_taxonomy_match(p_domain, p_candidates);
end;
$body$;

-- Fixtures ---------------------------------------------------------------------------------------------------------------------
insert into auth.users(id) values
  ('a9186000-0000-4000-8000-000000000001'),
  ('a9186000-0000-4000-8000-000000000002');
select platform_api.auth_bootstrap(
  'a9186000-0000-4000-8000-000000000001', decode(repeat('61', 32), 'hex'),
  decode(repeat('71', 32), 'hex'), 'a9186000-0000-4000-8000-000000000011',
  'a9186000-0000-4000-8000-000000000012');
select platform_api.auth_bootstrap(
  'a9186000-0000-4000-8000-000000000002', decode(repeat('62', 32), 'hex'),
  decode(repeat('72', 32), 'hex'), 'a9186000-0000-4000-8000-000000000021',
  'a9186000-0000-4000-8000-000000000022');

create temp table s12tc_people on commit drop as
select binding.auth_user_id, binding.person_id
  from identity.auth_user_bindings binding
 where binding.auth_user_id in ('a9186000-0000-4000-8000-000000000001', 'a9186000-0000-4000-8000-000000000002');
select is((select count(*)::integer from s12tc_people), 2, 'SETUP two real persons exist');

insert into platform_private.role_facet_assertion(person_id, facet_code, state, source, asserted_at, removed_at)
select person.person_id, facet.code, facet.state::platform_private.facet_state, 'self_asserted'::platform_private.facet_source,
       clock_timestamp() - interval '1 hour', case when facet.state = 'removed' then clock_timestamp() - interval '1 minute' end
  from (select person_id, row_number() over (order by auth_user_id) n from s12tc_people) person
  join (values (1, 'performer', 'active'), (1, 'engineer', 'active'), (1, 'writer', 'removed'), (2, 'performer', 'active')) facet(n, code, state)
    on facet.n = person.n;
select is((select count(*)::integer from platform_private.role_facet_assertion where state = 'active'), 3,
  'SETUP three active and one removed role facet assertion are the provider source');

create temp table s12tc_before on commit drop as
select (select count(*) from audit_private.audit_events) audits, (select count(*) from platform_private.outbox_events) outbox,
       (select count(*) from platform_private.jobs) jobs, (select count(*) from platform_private.idempotency_records) idem,
       (select count(*) from platform_private.cms_terms) terms, (select count(*) from platform_private.cms_canonical_domain_registry) registry,
       (select md5(coalesce(string_agg(to_jsonb(f)::text, '|' order by f.id), '')) from platform_private.role_facet_assertion f) facets;

-- Surface: exactly one database RPC, no API wrapper, closed boundary [AC136, AC138] ------------------------------------------------
select has_function('platform_private', 'cms_canonical_taxonomy_match', array['text', 'jsonb'],
  'CMS-03C-18 is the private RPC cms_canonical_taxonomy_match(p_domain text, p_candidates jsonb) [P2-S12-AC-136]');
select hasnt_function('platform_api', 'cms_canonical_taxonomy_match', array['text', 'jsonb'],
  'CMS-03C-18 has no platform_api wrapper: it is not a browser or Worker route [P2-S12-AC-136]');
select ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where p.proname = 'cms_canonical_taxonomy_match' and n.nspname <> 'platform_private'),
  'no other schema carries a function of this name (no proxy) [P2-S12-AC-136]');
select ok((select p.prosecdef and p.provolatile = 's' and pg_get_userbyid(p.proowner) = 'wejammin_cms_definer'
                  and p.proconfig @> array['search_path=""']
             from pg_proc p where p.oid = to_regprocedure('platform_private.cms_canonical_taxonomy_match(text,jsonb)')),
  'the RPC is SECURITY DEFINER, STABLE (read-only), owned by the CMS definer with an empty search_path [P2-S12-AC-138, AC-139]');
select ok(coalesce((
    select bool_and(not has_function_privilege(role_name, to_regprocedure('platform_private.cms_canonical_taxonomy_match(text,jsonb)'), 'execute'))
      from (values ('public'), ('anon'), ('authenticated'), ('service_role')) roles(role_name)), false),
  'PUBLIC, anon, authenticated and service_role cannot execute the RPC [P2-S12-AC-138]');
select is((select coalesce(array_agg(distinct reference[1] order by reference[1]), array[]::text[])
             from pg_proc p, regexp_matches(p.prosrc, 'platform_private\.([a-z_0-9]+)', 'g') reference
            where p.oid = to_regprocedure('platform_private.cms_canonical_taxonomy_match(text,jsonb)')),
  array['cms_canonical_domain_current', 'cms_canonical_role_facets', 'cms_name_uuid'],
  'the matcher names exactly three platform_private objects, the registry reader, the named provider projection and the id function, and no other shard''s store (BE03c 1373, which cites DEC-100 only for "never reads another shard''s store directly") [P2-S12-AC-138]');
select is((select array_agg(p.proname::text order by p.proname) from pg_proc p
            where p.prosrc ~* 'platform_private\.role_facet_assertion' and pg_get_userbyid(p.proowner) = 'wejammin_cms_definer'),
  array['cms_canonical_role_facets'],
  'among the CMS definer''s functions exactly ONE reads the Shard 01 role facet store: the named projection (BE03c 1373) [P2-S12-AC-138]');
select is((select array_agg(a.attname::text order by a.attname) from pg_attribute a
            where a.attrelid = 'platform_private.role_facet_assertion'::regclass and a.attnum > 0 and not a.attisdropped
              and has_column_privilege('wejammin_cms_definer', 'platform_private.role_facet_assertion', a.attname, 'select')),
  array['facet_code', 'state'], 'the CMS definer may read exactly the columns facet_code and state of the Shard 01 facet store: no person, source or time [P2-S12-AC-138]');
select ok(not has_table_privilege('wejammin_cms_definer', 'platform_private.role_facet_assertion', 'insert')
    and not has_table_privilege('wejammin_cms_definer', 'platform_private.role_facet_assertion', 'update')
    and not has_table_privilege('wejammin_cms_definer', 'platform_private.role_facet_assertion', 'delete')
    and not has_table_privilege('wejammin_cms_definer', 'platform_private.role_facet_assertion', 'truncate')
    and not has_table_privilege('wejammin_cms_definer', 'platform_private.role_facet_assertion', 'references')
    and not has_table_privilege('wejammin_cms_definer', 'platform_private.role_facet_assertion', 'trigger'),
  'the CMS definer has no write verb on the Shard 01 facet store: the provider is read-only (BE03c 1373) [P2-S12-AC-139]');
select is((select jsonb_agg(jsonb_build_object('cmd', policy.polcmd, 'qual', regexp_replace(pg_get_expr(policy.polqual, policy.polrelid), '\s+', ' ', 'g')))
             from pg_policy policy
            where policy.polrelid = 'platform_private.role_facet_assertion'::regclass
              and policy.polroles @> array[(select oid from pg_roles where rolname = 'wejammin_cms_definer')]),
  jsonb_build_array(jsonb_build_object('cmd', 'r', 'qual', '(state = ''active''::platform_private.facet_state)')),
  'exactly one RLS policy admits the CMS definer to the facet store: SELECT of active assertions only (the policy that makes the named projection possible) [P2-S12-AC-138]');
create function pg_temp.s12tc_definer_view() returns jsonb language plpgsql as $body$
declare v_view jsonb; v_prior text := current_setting('role');
begin
  set local role wejammin_cms_definer;
  select jsonb_build_object('rows', count(*), 'states', coalesce(jsonb_agg(distinct state::text), '[]'::jsonb)) into v_view
    from platform_private.role_facet_assertion;
  perform set_config('role', v_prior, true);
  return v_view;
end;
$body$;
select is(pg_temp.s12tc_definer_view(), '{"rows": 3, "states": ["active"]}'::jsonb,
  'as the CMS definer the facet store shows the three active assertions and not the removed one: the policy, not the function, bounds the read [P2-S12-AC-141]');
select has_function('platform_private', 'cms_canonical_role_facets', array['text[]'],
  'the role provider is a named read-only projection function over the Shard 01 assertions [P2-S12-AC-137]');
select ok((select p.provolatile = 's' and p.prosecdef from pg_proc p
             where p.oid = to_regprocedure('platform_private.cms_canonical_role_facets(text[])')),
  'the role provider projection is STABLE (read-only) [P2-S12-AC-139]');
select ok(coalesce((
    select bool_and(not has_function_privilege(role_name, to_regprocedure('platform_private.cms_canonical_role_facets(text[])'), 'execute'))
      from (values ('public'), ('anon'), ('authenticated'), ('service_role')) roles(role_name)), false),
  'API roles cannot execute the role provider projection [P2-S12-AC-138]');

-- Registry control: the real Phase 2 registry, unmutated [AC137] ---------------------------------------------------------------------
select is((select jsonb_object_agg(domain, provider_state order by domain)
             from (select distinct on (domain) domain, provider_state
                     from platform_private.cms_canonical_domain_registry order by domain, version desc) current_rows),
  '{"role":"built","instrument":"unbuilt","gear":"unbuilt","place":"unbuilt","rights":"unbuilt","jurisdiction":"unbuilt"}'::jsonb,
  'SETUP the registry is the Phase 2 seed: role built, the other five unbuilt');

-- The six-domain matrix [AC137, AC140, AC141] ---------------------------------------------------------------------------------------
select is(pg_temp.s12tc_j('role', '["performer"]'::jsonb)->>'outcome', 'match',
  'role provider: a candidate equal to an asserted role facet is a match [P2-S12-AC-141]');
select is((select count(*)::integer from jsonb_object_keys(pg_temp.s12tc_j('role', '["performer"]'::jsonb))), 4,
  'a match carries exactly outcome, domain, canonicalId and canonicalKind [P2-S12-AC-138]');
select is(pg_temp.s12tc_j('role', '["performer"]'::jsonb)->>'domain', 'role', 'the match names the called domain [P2-S12-AC-141]');
select is(pg_temp.s12tc_j('role', '["performer"]'::jsonb)->>'canonicalKind', 'role_facet', 'the canonical kind of a role facet is role_facet [P2-S12-AC-138]');
select matches(pg_temp.s12tc_j('role', '["performer"]'::jsonb)->>'canonicalId',
  '^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  'the canonical id is an RFC 4122 version-5 UUID (variant 8, 9, a or b) the strict contract accepts [P2-S12-AC-136]');
select is(pg_temp.s12tc_j('role', '["performer"]'::jsonb)->>'canonicalId', 'bb613e6b-3281-555a-87f0-0c8b39945cfe',
  'known answer: uuid5(URL namespace, "wejammin.canonical.role:performer") computed by an independent implementation [P2-S12-AC-137]');
select is(pg_temp.s12tc_j('role', '["engineer"]'::jsonb)->>'canonicalId', '5b579f6c-31ff-5289-bd40-c904c68e3731',
  'known answer: uuid5(URL namespace, "wejammin.canonical.role:engineer") [P2-S12-AC-137]');
select is(platform_private.cms_name_uuid('x')::text, '4cd605e7-afa2-5360-b5b9-c5e9fb5c76f4', 'known answer: the name-based UUID of "x" [P2-S12-AC-137]');
select isnt(pg_temp.s12tc_j('role', '["performer"]'::jsonb)->>'canonicalId', pg_temp.s12tc_j('role', '["engineer"]'::jsonb)->>'canonicalId',
  'different role facets have different canonical ids [P2-S12-AC-137]');
select is(pg_temp.s12tc_j('role', '["performer"]'::jsonb)->>'canonicalId',
  (select pg_temp.s12tc_j('role', '["performer"]'::jsonb)->>'canonicalId'),
  'the canonical id of a facet is deterministic across calls (two persons assert performer, one canonical record) [P2-S12-AC-137]');
select is(pg_temp.s12tc_j('role', '["writer"]'::jsonb), '{"outcome":"no_match"}'::jsonb,
  'a role facet whose only assertion was removed is no_match: only asserted facets match [P2-S12-AC-141]');
select is(pg_temp.s12tc_j('role', '["drummer"]'::jsonb), '{"outcome":"no_match"}'::jsonb,
  'an unasserted role facet is no_match, never source_unavailable [P2-S12-AC-141]');
select is(
  (select jsonb_object_agg(domain, pg_temp.s12tc_j(domain, '["performer"]'::jsonb))
     from unnest(array['instrument', 'gear', 'place', 'rights', 'jurisdiction']) domain),
  (select jsonb_object_agg(domain, jsonb_build_object('outcome', 'source_unavailable', 'domain', domain))
     from unnest(array['instrument', 'gear', 'place', 'rights', 'jurisdiction']) domain),
  'every unbuilt domain returns exactly { outcome: source_unavailable, domain }, never no_match [P2-S12-AC-140, AC-141]');
select is(pg_temp.s12tc_j('role', '["drummer","performer","engineer"]'::jsonb)->>'canonicalId',
  pg_temp.s12tc_j('role', '["performer"]'::jsonb)->>'canonicalId',
  'the first candidate (in call order) that matches decides the answer [P2-S12-AC-137]');
select is(pg_temp.s12tc_j('role', '["engineer","performer"]'::jsonb)->>'canonicalKind', 'role_facet',
  'candidate order is the tie-break when several candidates match [P2-S12-AC-137]');
select is(pg_temp.s12tc_j('role', '["engineer","performer"]'::jsonb)->>'canonicalId',
  pg_temp.s12tc_j('role', '["engineer"]'::jsonb)->>'canonicalId',
  'engineer first gives the engineer record, not the performer record [P2-S12-AC-137]');

-- Normalization: NFKC, lowercase, trim, whitespace collapse; exact equality only [AC137] ---------------------------------------------
select is(pg_temp.s12tc_j('role', to_jsonb(array['PERFORMER']))->>'outcome', 'match', 'normalization lowercases the candidate [P2-S12-AC-137]');
select is(pg_temp.s12tc_j('role', to_jsonb(array[E'  \t Performer \n ']))->>'outcome', 'match', 'normalization trims surrounding whitespace [P2-S12-AC-137]');
select is(pg_temp.s12tc_j('role', to_jsonb(array[normalize('ｐｅｒｆｏｒｍｅｒ', NFKC)]))->>'outcome', 'match', 'a normalized form matches [P2-S12-AC-137]');
select is(pg_temp.s12tc_j('role', to_jsonb(array['ｐｅｒｆｏｒｍｅｒ']))->>'outcome', 'match', 'NFKC folds full-width letters before comparing [P2-S12-AC-137]');
select is(pg_temp.s12tc_j('role', to_jsonb(array['per former']))->>'outcome', 'no_match', 'internal whitespace is collapsed, not removed: "per former" is not performer [P2-S12-AC-137]');
select is(pg_temp.s12tc_j('role', to_jsonb(array['perfo' || E' ' || 'rmer']))->>'outcome', 'no_match', 'a non-breaking space inside the word is not silently deleted [P2-S12-AC-137]');
select is(pg_temp.s12tc_j('role', to_jsonb(array['performers']))->>'outcome', 'no_match', 'no fuzzy match: a plural is not the facet [P2-S12-AC-137]');
select is(pg_temp.s12tc_j('role', to_jsonb(array['performe']))->>'outcome', 'no_match', 'no fuzzy match: a prefix is not the facet [P2-S12-AC-137]');
select is(pg_temp.s12tc_j('role', to_jsonb(array['sound-engineer']))->>'outcome', 'no_match', 'no fuzzy match: a compound is not the facet [P2-S12-AC-137]');
select is(pg_temp.s12tc_j('role', to_jsonb(array['perf0rmer']))->>'outcome', 'no_match', 'no fuzzy match: a one-character difference is not the facet [P2-S12-AC-137]');

-- Request bounds: one domain, 1 to 64 candidates of 1 to 160 characters [AC136, AC139] -------------------------------------------------
select is(pg_temp.s12tc_call('role', (select jsonb_agg('candidate-' || n) from generate_series(1, 64) n)), '{"outcome": "no_match"}',
  '64 candidates are accepted [P2-S12-AC-139]');
select is(pg_temp.s12tc_call('role', (select jsonb_agg('candidate-' || n) from generate_series(1, 65) n)), 'P0001:VALIDATION_FAILED',
  '65 candidates are refused: the bound is 64 per call [P2-S12-AC-139]');
select is(pg_temp.s12tc_call('role', '[]'::jsonb), 'P0001:VALIDATION_FAILED', 'an empty candidate list is refused [P2-S12-AC-136]');
select is(pg_temp.s12tc_call('role', to_jsonb(array[repeat('a', 160)])), '{"outcome": "no_match"}', 'a 160-character candidate is accepted [P2-S12-AC-136]');
select is(pg_temp.s12tc_call('role', to_jsonb(array[repeat('a', 161)])), 'P0001:VALIDATION_FAILED', 'a 161-character candidate is refused [P2-S12-AC-136]');
select is(pg_temp.s12tc_call('role', to_jsonb(array[''])), 'P0001:VALIDATION_FAILED', 'an empty candidate is refused [P2-S12-AC-136]');
select is(pg_temp.s12tc_call('role', '[1]'::jsonb), 'P0001:VALIDATION_FAILED', 'a non-string candidate is refused [P2-S12-AC-136]');
select is(pg_temp.s12tc_call('role', '{"a":"b"}'::jsonb), 'P0001:VALIDATION_FAILED', 'a candidate object (not an array) is refused [P2-S12-AC-136]');
select is(pg_temp.s12tc_call('role', null), 'P0001:VALIDATION_FAILED', 'a null candidate list is refused [P2-S12-AC-136]');
select is(pg_temp.s12tc_call('weather', '["performer"]'::jsonb), 'P0001:VALIDATION_FAILED', 'a domain outside the closed set is refused [P2-S12-AC-136]');
select is(pg_temp.s12tc_call(null, '["performer"]'::jsonb), 'P0001:VALIDATION_FAILED', 'a null domain is refused [P2-S12-AC-136]');
select is(pg_temp.s12tc_call('Role', '["performer"]'::jsonb), 'P0001:VALIDATION_FAILED', 'a domain is matched exactly, not case-folded [P2-S12-AC-136]');

-- Provider fault, timeout and registry drift: 503, never a success-shaped body [AC140] -----------------------------------------------
select is(pg_temp.s12tc_with($$alter table platform_private.role_facet_assertion rename to s12tc_gone$$,
    $$select platform_private.cms_canonical_taxonomy_match('role', '["performer"]'::jsonb)::text$$),
  'P0001:DEPENDENCY_UNAVAILABLE',
  'a failing provider read (the projection source is gone) is DEPENDENCY_UNAVAILABLE, not a raw database error and not no_match [P2-S12-AC-140]');
select is(pg_temp.s12tc_with(
    $q$create or replace function platform_private.cms_canonical_role_facets(p_keys text[]) returns table(facet_code text)
      language plpgsql stable security definer set search_path = '' as $f$ begin raise exception 'provider exploded'; end; $f$$q$,
    $$select platform_private.cms_canonical_taxonomy_match('role', '["performer"]'::jsonb)::text$$),
  'P0001:DEPENDENCY_UNAVAILABLE', 'a provider that raises any error is DEPENDENCY_UNAVAILABLE and the message is not leaked [P2-S12-AC-140]');
select is(pg_temp.s12tc_with(
    $q$create or replace function platform_private.cms_canonical_role_facets(p_keys text[]) returns table(facet_code text)
      language plpgsql stable security definer set search_path = '' as $f$ begin perform pg_catalog.pg_sleep(2.3); return query select 'performer'::text; end; $f$$q$,
    $$select platform_private.cms_canonical_taxonomy_match('role', '["performer"]'::jsonb)::text$$),
  'P0001:DEPENDENCY_UNAVAILABLE',
  'a provider read slower than the 2,000 ms deadline is DEPENDENCY_UNAVAILABLE even though it eventually answered [P2-S12-AC-139, AC-140]');
select is(pg_temp.s12tc_with(
    $q$create or replace function platform_private.cms_canonical_role_facets(p_keys text[]) returns table(facet_code text)
      language plpgsql stable security definer set search_path = '' as $f$ begin perform pg_catalog.pg_sleep(0.3); return query select 'performer'::text; end; $f$$q$,
    $$select (platform_private.cms_canonical_taxonomy_match('role', '["performer"]'::jsonb))->>'outcome'$$),
  'match', 'a provider that answers inside the deadline (300 ms) still matches: the deadline is not a blanket slowdown [P2-S12-AC-139]');
select is(pg_temp.s12tc_with(
    $$select set_config('app.cms_rpc', 'true', true);
      insert into platform_private.cms_canonical_domain_registry(owner_id, version, domain, provider_state, provider_key, provider_version)
      values ('0d6a0d6a-0000-4000-8000-000000000135', 2, 'role', 'unbuilt', null, null)$$,
    $$select platform_private.cms_canonical_taxonomy_match('role', '["performer"]'::jsonb)::text$$),
  '{"domain": "role", "outcome": "source_unavailable"}',
  'a provider de-registered by a newer registry row makes the domain source_unavailable (the current row is the greatest version) [P2-S12-AC-140]');
select is(pg_temp.s12tc_with(
    $$select set_config('app.cms_rpc', 'true', true);
      insert into platform_private.cms_canonical_domain_registry(owner_id, version, domain, provider_state, provider_key, provider_version)
      values ('0d6a0d6a-0000-4000-8000-000000000135', 2, 'gear', 'built', 'shard99.unimplemented_provider', 1)$$,
    $$select platform_private.cms_canonical_taxonomy_match('gear', '["amp"]'::jsonb)::text$$),
  'P0001:DEPENDENCY_UNAVAILABLE',
  'a registry row naming a provider this release does not implement is a provider fault (503), never no_match or source_unavailable [P2-S12-AC-140]');

-- Read-only [AC139] ------------------------------------------------------------------------------------------------------------------
select ok((select (select count(*) from audit_private.audit_events) = before.audits
                and (select count(*) from platform_private.outbox_events) = before.outbox
                and (select count(*) from platform_private.jobs) = before.jobs
                and (select count(*) from platform_private.idempotency_records) = before.idem
                and (select count(*) from platform_private.cms_terms) = before.terms
                and (select count(*) from platform_private.cms_canonical_domain_registry) = before.registry
                and (select md5(coalesce(string_agg(to_jsonb(f)::text, '|' order by f.id), '')) from platform_private.role_facet_assertion f) = before.facets
             from s12tc_before before),
  'every call above left audit, outbox, jobs, idempotency, term, registry and facet stores byte-identical: the RPC is read-only [P2-S12-AC-139]');

select finish();
rollback;
