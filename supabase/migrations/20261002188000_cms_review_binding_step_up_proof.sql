-- Slice 09 audit remediation (R3): "recent binding-bound MFA" is the verified
-- step-up instant, never the acting-context binding heartbeat.
--
-- Before this migration platform_private.cms_review_binding returned
-- acting_context_binding.last_seen_at as mfa_verified_at and treated a
-- heartbeat younger than ten minutes as recent MFA.  auth_session_read
-- refreshes that heartbeat on every session read, so any live session passed
-- the "recent MFA" check and every review decision, grant event and
-- assignment recorded activity time as its MFA time.
--
-- The service-role envelope carries the verified aal2 proof as
-- context.stepUpVerified and context.stepUpAt.  For a recent-MFA operation the
-- proof must be present, verified, an ISO-8601 instant with an explicit zone
-- and fresh by the BE01a rule  -30 s <= now - stepUpAt <= 600 s.  The proof
-- instant is what is returned and recorded as mfa_verified_at.  The binding
-- itself must still be the actor's own active, unexpired acting context, and
-- for a recent-MFA operation it must also show a live heartbeat (at most ten
-- minutes old): that is a separate binding-liveness check and is never an
-- MFA instant.  Forward-only; callers are unchanged.
begin;

create or replace function platform_private.cms_review_binding(
  p_request jsonb, p_actor_id uuid, p_acting_party_id uuid, p_recent boolean
)
returns table (binding_id uuid, mfa_verified_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $body$
declare
  failure text := case when p_recent then 'STEP_UP_REQUIRED' else 'UNAUTHENTICATED' end;
  validation_at timestamptz := pg_catalog.clock_timestamp();
  proof_text text;
  proof_at timestamptz;
begin
  if not platform_private.cms_exact_keys(
       p_request->'context',
       array['actingContextId']::text[],
       array['actingContextId','authUserId','sessionId','actorPersonId','actingPartyId',
             'stepUpVerified','stepUpAt','requestId','correlationId']::text[]
     )
     or not platform_private.cms_valid_uuid(p_request->'context'->>'actingContextId') then
    raise exception '%', failure using errcode = 'P0001';
  end if;
  if p_recent then
    if p_request->'context'->'stepUpVerified' is distinct from pg_catalog.to_jsonb(true) then
      raise exception 'STEP_UP_REQUIRED' using errcode = 'P0001';
    end if;
    proof_text := p_request->'context'->>'stepUpAt';
    if proof_text is null
       or proof_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
      raise exception 'STEP_UP_REQUIRED' using errcode = 'P0001';
    end if;
    begin
      proof_at := proof_text::timestamptz;
    exception when others then
      raise exception 'STEP_UP_REQUIRED' using errcode = 'P0001';
    end;
    if proof_at > validation_at + interval '30 seconds'
       or proof_at < validation_at - interval '600 seconds' then
      raise exception 'STEP_UP_REQUIRED' using errcode = 'P0001';
    end if;
  end if;
  select context_binding.id, proof_at
    into binding_id, mfa_verified_at
    from platform_private.acting_context_binding context_binding
   where context_binding.id = (p_request->'context'->>'actingContextId')::uuid
     and context_binding.person_id = platform_private.identity_actor_person(p_actor_id)
     and context_binding.acting_party_id = p_acting_party_id
     and context_binding.state = 'active'
     and context_binding.expires_at > validation_at
     and (not p_recent or context_binding.last_seen_at >= validation_at - interval '10 minutes');
  if binding_id is null then
    raise exception '%', failure using errcode = 'P0001';
  end if;
  return next;
end;
$body$;

-- The configuration/admin step-up gate (CFG-05B-06 admin MFA reset and the
-- configuration commands) shares the BE01a freshness rule: -30 s <= now -
-- stepUpAt <= p_max_age (600 s by default).  It refused every proof that was even
-- a millisecond ahead of the database clock, so a just-minted proof from a
-- slightly fast Worker clock failed; the forward tolerance is now the same 30 s.
create or replace function platform_private.cfg_require_fresh_step_up(
  p_request jsonb,
  p_max_age interval default interval '10 minutes'
)
returns void
language plpgsql
set search_path = ''
as $body$
declare
  verified_at timestamptz;
begin
  if platform_private.cfg_context_value(p_request, 'stepUpVerified') <> 'true'
     or platform_private.cfg_context_value(p_request, 'stepUpAt') is null then
    raise exception 'STEP_UP_REQUIRED' using errcode = 'P0001';
  end if;
  begin
    verified_at := platform_private.cfg_context_value(p_request, 'stepUpAt')::timestamptz;
  exception when others then
    raise exception 'STEP_UP_REQUIRED' using errcode = 'P0001';
  end;
  if verified_at > pg_catalog.clock_timestamp() + interval '30 seconds'
     or verified_at < pg_catalog.clock_timestamp() - p_max_age then
    raise exception 'STEP_UP_REQUIRED' using errcode = 'P0001';
  end if;
end;
$body$;

comment on function platform_private.cms_review_binding(jsonb, uuid, uuid, boolean) is
  'Binding authority for CMS review/grant commands. p_recent=true returns the verified step-up proof instant (context.stepUpAt, fresh -30..600 s) as mfa_verified_at; the binding heartbeat is only a liveness check and never an MFA instant. p_recent=false returns a null mfa_verified_at.';

commit;
