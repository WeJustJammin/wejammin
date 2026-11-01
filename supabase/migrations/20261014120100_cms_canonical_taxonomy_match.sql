-- Slice 12 lane taxonomy-terms, CMS-03C-18 (BE03c internal operations table at 187, Canonical taxonomy projection D10 at 1373, DEC-135 at
-- 1375, 503 DEPENDENCY_UNAVAILABLE at 1306, grants at 1447, cross-shard direction at 1571, DEC-100; P2-S12-AC-136 .. AC-141, AC-256):
--
--   platform_private.cms_canonical_taxonomy_match(p_domain text, p_candidates jsonb) returns jsonb   CanonicalTaxonomyMatchResult
--
-- A read-only, database-internal comparison of up to 64 candidate strings (term keys, labels and aliases) with ONE domain's named projection:
--   * a domain outside the closed set, or a candidate list that is not 1 to 64 strings of 1 to 160 characters, is VALIDATION_FAILED;
--   * the CURRENT registry row of the domain (greatest version, 20261013300100) decides: `unbuilt` answers { outcome: source_unavailable,
--     domain } - never no_match - so the caller refuses `canonical_source_unavailable`;
--   * `built` dispatches on the registered provider key.  Phase 2 implements `shard02.role_facet_assertion` for the domain `role`, a read of
--     the Shard 01 role facet assertions through the named projection function cms_canonical_role_facets (the matcher itself names no
--     other shard's store, DEC-100).  A registered provider this release does not implement is a provider fault;
--   * matching is exact equality after normalization (NFKC, lowercase, trim, whitespace collapse), never fuzzy; the first candidate in call
--     order that matches decides the answer; `match` returns only { outcome, domain, canonicalId, canonicalKind };
--   * any provider error, and a provider read that took longer than the 2,000 ms deadline, is P0001 DEPENDENCY_UNAVAILABLE (a 503 for
--     the calling command, which commits nothing); PL/pgSQL cannot interrupt a statement that is already running, so the deadline is measured
--     around the provider read and a late answer is refused.
-- The role canonical record is a role facet CODE; its id is a deterministic RFC 4122 name-based UUID of the domain and the code, so the
-- same facet has one canonical id for every person who asserts it.  STABLE, SECURITY DEFINER, owned by the CMS definer, executable by no
-- API role: only the definer-owned callers (cms_act_taxonomy_term and the taxonomy activation preflight) reach it.  Forward-only.
begin;
set local lock_timeout = '5s';

-- A deterministic RFC 4122 version 5 (SHA-1, name-based) UUID of a name in the URL namespace; the strict contract UUID accepts it.  The
-- version nibble is 5 and the variant bits are 10, set on the first 16 digest octets exactly as RFC 4122 4.3 prescribes.
create or replace function platform_private.cms_name_uuid(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $body$
  select pg_catalog.encode(
           pg_catalog.set_byte(
             pg_catalog.set_byte(digest_octets.value, 6, (pg_catalog.get_byte(digest_octets.value, 6) & 15) | 80),
             8, (pg_catalog.get_byte(digest_octets.value, 8) & 63) | 128),
           'hex')::uuid
    from (select pg_catalog.substr(
                   extensions.digest('\x6ba7b8119dad11d180b400c04fd430c8'::bytea || pg_catalog.convert_to(p_name, 'UTF8'), 'sha1'), 1, 16) as value) digest_octets
$body$;

comment on function platform_private.cms_name_uuid(text) is
  'A deterministic RFC 4122 version 5 (SHA-1) name-based UUID of a text in the URL namespace. Private; IMMUTABLE.';

-- The named read-only projection of the Shard 01 role facet assertions (DEC-100): which of the given normalized keys are asserted role
-- facet codes right now.  Owned by the CMS definer role (SEC-2: no bypass-owned definer function names a forced table), which reads the
-- forced-RLS Shard 01 table through one column-scoped grant and one SELECT policy that admits only active assertions; no API role may call it.
-- WHY A POLICY ON A SHARD 01 TABLE: BE03c 1373 fixes the Phase 2 role provider as "its provider reads the Shard 02 role facet assertion
-- projection" and the promoted registry row (20261013300100, provider_key shard02.role_facet_assertion) names that store; BE03c 1571 and
-- DEC-100 require a NAMED read-only projection and no read of another shard's store by anything else.  role_facet_assertion is forced-RLS
-- and carries only a self-row policy for `authenticated` (20260901030000), so no definer-owned reader can see it without an admitting policy,
-- and a bypass-owned definer function is the SEC-2 violation run 3 caught (sec2_all #3).  Least privilege is therefore the shape below:
-- SELECT of exactly (facet_code, state), one policy admitting `state = 'active'` to the CMS definer only, one function that names the table.
-- The registry's provider_key stays the contract: when Shard 02 ships its own projection function, a forward migration repoints
-- cms_canonical_role_facets at it and drops this grant and policy.  Root: ratify this surface (R3).
create or replace function platform_private.cms_canonical_role_facets(p_keys text[])
returns table (facet_code text)
language sql
stable
security definer
set search_path = ''
as $body$
  select distinct facet.facet_code
    from platform_private.role_facet_assertion facet
   where facet.state = 'active' and facet.facet_code = any (p_keys)
$body$;

comment on function platform_private.cms_canonical_role_facets(text[]) is
  'CMS-03C-18 role provider projection: the asserted (active) Shard 01 role facet codes among the given normalized keys. Read-only; executable by the CMS definer only.';

create or replace function platform_private.cms_canonical_taxonomy_match(p_domain text, p_candidates jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  deadline constant interval := interval '2000 milliseconds';
  provider record;
  normalized text[];
  asserted text[];
  hit text;
  started timestamptz;
begin
  if p_domain is null or p_domain not in ('role', 'instrument', 'gear', 'place', 'rights', 'jurisdiction')
     or pg_catalog.jsonb_typeof(p_candidates) is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_candidates) not between 1 and 64
     or exists (
       select 1 from pg_catalog.jsonb_array_elements(p_candidates) element(value)
        where pg_catalog.jsonb_typeof(element.value) is distinct from 'string'
           or pg_catalog.char_length(element.value #>> '{}') not between 1 and 160) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  select current_row.provider_state, current_row.provider_key into provider
    from platform_private.cms_canonical_domain_current(p_domain) current_row;
  if not found then
    -- The closed set is seeded with every domain; a missing row is a registry fault, not an answer.
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if provider.provider_state = 'unbuilt' then
    return pg_catalog.jsonb_build_object('outcome', 'source_unavailable', 'domain', p_domain);
  end if;
  if p_domain <> 'role' or provider.provider_key is distinct from 'shard02.role_facet_assertion' then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- NFKC, lowercase, whitespace collapse, trim; the candidate order is kept for the tie-break.
  select pg_catalog.array_agg(
           pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.lower(normalize(element.value #>> '{}', NFKC)), '\s+', ' ', 'g'))
           order by element.ord)
    into normalized
    from pg_catalog.jsonb_array_elements(p_candidates) with ordinality element(value, ord);

  started := pg_catalog.clock_timestamp();
  begin
    select pg_catalog.array_agg(provider_row.facet_code)
      into asserted
      from platform_private.cms_canonical_role_facets(normalized) provider_row;
  exception when others then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end;
  if pg_catalog.clock_timestamp() - started > deadline then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select candidate.value into hit
    from pg_catalog.unnest(normalized) with ordinality candidate(value, ord)
   where candidate.value = any (coalesce(asserted, array[]::text[]))
   order by candidate.ord
   limit 1;
  if hit is null then
    return pg_catalog.jsonb_build_object('outcome', 'no_match');
  end if;
  return pg_catalog.jsonb_build_object(
    'outcome', 'match', 'domain', p_domain,
    'canonicalId', platform_private.cms_name_uuid('wejammin.canonical.' || p_domain || ':' || hit),
    'canonicalKind', 'role_facet');
end;
$body$;

comment on function platform_private.cms_canonical_taxonomy_match(text, jsonb) is
  'CMS-03C-18: exact-equality match of up to 64 normalized candidates against one canonical domain''s named read-only projection. no_match, match { domain, canonicalId, canonicalKind } or source_unavailable for an unbuilt domain; a provider fault or a read slower than 2,000 ms is DEPENDENCY_UNAVAILABLE. Read-only; executable only by the definer-owned callers.';

grant execute on function platform_private.cms_name_uuid(text) to wejammin_cms_definer;
grant select (facet_code, state) on table platform_private.role_facet_assertion to wejammin_cms_definer;
create policy role_facet_assertion_cms_definer_projection on platform_private.role_facet_assertion
  for select to wejammin_cms_definer using (state = 'active');
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_canonical_role_facets(text[]) owner to wejammin_cms_definer;
alter function platform_private.cms_canonical_taxonomy_match(text, jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_name_uuid(text) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_canonical_role_facets(text[]) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_canonical_taxonomy_match(text, jsonb) from public, anon, authenticated, service_role;

commit;
