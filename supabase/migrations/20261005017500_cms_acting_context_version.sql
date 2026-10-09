-- Slice 11 shared helper (lane S11-3s, BE03b "Preview token and verification
-- (CMS-03B-08, CMS-03B-19)"; tracker P2-S11-AC-118): the acting-context version.
--
-- cms_acting_context_version(person, acting_party) is the lowercase SHA-256 of the
-- RFC 8785/JCS object { actingPartyId, capabilities, personId } where
-- `capabilities` is the bytewise-ascending list of the person's active `cms.*`
-- capability keys in the acting party.  It is the preview token's
-- capability_snapshot_hash and the BE04c `actingContextVersion` the verifier
-- (CMS-03B-19) compares with the presented acting context, so a capability that is
-- granted, revoked, lapsed or started changes the version and a forwarded token
-- stops verifying.
--
-- "Active" is exactly the predicate cms_person_holds_capability uses: a confirmed
-- membership tenure in window (starts_on <= today, ends_on null or >= today) and an
-- active actor grant in window (valid_from <= today, valid_through null or >=
-- today).  A person with no tenure in the party, or a null party, hashes the empty
-- list.  Only the `cms.` namespace is part of the snapshot (`cmsx.editor` and
-- `cms-editor` are not).  The function reads committed authority only: STABLE,
-- private, no browser/API grant; the preview wrapper (lane 3c) is its only caller.
-- Forward-only.
begin;

create or replace function platform_private.cms_acting_context_version(
  p_person_id uuid,
  p_acting_party_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  capability_list jsonb;
begin
  if p_person_id is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select coalesce(
           pg_catalog.jsonb_agg(granted.capability_code order by granted.capability_code collate "C"),
           '[]'::jsonb
         )
    into capability_list
    from (
      select distinct actor_grant.capability_code
        from identity_private.membership_tenure tenure
        join identity_private.organization_actor_grant actor_grant
          on actor_grant.organization_id = tenure.organization_id
         and actor_grant.person_id = tenure.person_id
       where p_acting_party_id is not null
         and tenure.organization_id = p_acting_party_id
         and tenure.person_id = p_person_id
         and tenure.state = 'confirmed'
         and tenure.starts_on <= current_date
         and (tenure.ends_on is null or tenure.ends_on >= current_date)
         and actor_grant.active
         and actor_grant.valid_from <= current_date
         and (actor_grant.valid_through is null or actor_grant.valid_through >= current_date)
         and pg_catalog.starts_with(actor_grant.capability_code, 'cms.')
    ) granted;
  return platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'actingPartyId', p_acting_party_id,
    'capabilities', capability_list,
    'personId', p_person_id
  ));
end;
$body$;

comment on function platform_private.cms_acting_context_version(uuid, uuid) is
  'BE03b CMS-03B-08/19: lowercase SHA-256 of the JCS { actingPartyId, capabilities, personId } with the person''s active cms.* capability keys in the acting party sorted bytewise (the preview capability_snapshot_hash and the BE04c actingContextVersion). Private; STABLE.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_acting_context_version(uuid, uuid)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_acting_context_version(uuid, uuid)
  from public, anon, authenticated, service_role;

commit;
