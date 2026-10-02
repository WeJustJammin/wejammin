-- DEC-111 / BE01a "Database Schema, Support Records, and Grants": the protected
-- MFA factor registry, the step-up challenge record and the per-account MFA
-- version.  Supabase Auth stays factor-secret and session authority; these
-- tables hold only the application factor id, the opaque provider references
-- (never returned to a client), lifecycle state and timestamps.  They never
-- store a TOTP secret, an otpauth URI, a code or a token.  Only the named
-- platform_api RPCs write them (later migrations); ENABLE+FORCE RLS and no
-- client grant.  Forward-only.
begin;

alter table identity.auth_user_bindings
  add column mfa_version bigint not null default 1 check (mfa_version > 0);

create type identity.mfa_factor_state as enum
  ('pending', 'verified', 'reconciling', 'removed', 'expired');
create type identity.step_up_challenge_state as enum
  ('pending', 'consumed', 'failed', 'expired');

create table identity.mfa_factor_registry (
  id uuid primary key default extensions.gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  method text not null default 'totp' check (method = 'totp'),
  provider_factor_id uuid not null unique,
  friendly_name text not null check (
    char_length(friendly_name) between 1 and 80
    and friendly_name = pg_catalog.btrim(friendly_name)
    and friendly_name !~ '[[:cntrl:]]'
    and friendly_name is nfc normalized
  ),
  state identity.mfa_factor_state not null default 'pending',
  pending_expires_at timestamptz,
  verified_at timestamptz,
  last_used_at timestamptz,
  removed_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  check (pending_expires_at is null or state in ('pending', 'reconciling')),
  check (pending_expires_at is null or pending_expires_at <= created_at + interval '10 minutes'),
  check (state <> 'pending' or pending_expires_at is not null),
  check (state <> 'pending' or verified_at is null),
  check (state <> 'verified' or verified_at is not null),
  check ((state = 'removed') = (removed_at is not null))
);

create unique index mfa_factor_one_pending_per_user
  on identity.mfa_factor_registry (auth_user_id) where state = 'pending';
create unique index mfa_factor_live_name_per_user
  on identity.mfa_factor_registry (auth_user_id, lower(friendly_name))
  where state in ('pending', 'verified', 'reconciling');
create index mfa_factor_user_state on identity.mfa_factor_registry (auth_user_id, state);
create index mfa_factor_state_pending_expiry
  on identity.mfa_factor_registry (state, pending_expires_at);

create table identity.step_up_challenges (
  id uuid primary key default extensions.gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  session_id uuid not null references identity.auth_session_index(session_id) on delete restrict,
  factor_id uuid not null references identity.mfa_factor_registry(id) on delete restrict,
  provider_challenge_id uuid not null,
  state identity.step_up_challenge_state not null default 'pending',
  expires_at timestamptz not null,
  failed_attempt_count smallint not null default 0 check (failed_attempt_count >= 0),
  consumed_at timestamptz,
  failed_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  check (expires_at <= created_at + interval '10 minutes'),
  check ((state = 'consumed') = (consumed_at is not null)),
  check ((state = 'failed') = (failed_at is not null))
);

create unique index step_up_one_pending_per_session_factor
  on identity.step_up_challenges (session_id, factor_id) where state = 'pending';
create index step_up_user_state on identity.step_up_challenges (auth_user_id, state);
create index step_up_state_expiry on identity.step_up_challenges (state, expires_at);
create index step_up_factor on identity.step_up_challenges (factor_id);

alter table identity.mfa_factor_registry enable row level security;
alter table identity.mfa_factor_registry force row level security;
alter table identity.step_up_challenges enable row level security;
alter table identity.step_up_challenges force row level security;
revoke all on table identity.mfa_factor_registry, identity.step_up_challenges
  from public, anon, authenticated, service_role;

-- State machine and immutability.  A factor row moves
--   pending -> verified | expired | reconciling
--   verified -> reconciling
--   reconciling -> verified | pending | removed | expired
-- (reconciling -> expired only when the reconciler finds the pending window
-- elapsed or superseded) and removed/expired are terminal; every update advances `version` by one.
-- Rows are deleted only by the retention sweep, which raises a local flag.
create function platform_private.mfa_factor_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  if tg_op = 'DELETE' then
    if coalesce(pg_catalog.current_setting('app.mfa_registry_purge', true), '') <> 'on'
       or old.state not in ('removed', 'expired') then
      raise exception 'MFA_REGISTRY_RETENTION_ONLY' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if new.id is distinct from old.id
     or new.auth_user_id is distinct from old.auth_user_id
     or new.method is distinct from old.method
     or new.provider_factor_id is distinct from old.provider_factor_id
     or new.friendly_name is distinct from old.friendly_name
     or new.created_at is distinct from old.created_at then
    raise exception 'MFA_FACTOR_IMMUTABLE' using errcode = 'P0001';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'MFA_FACTOR_VERSION' using errcode = 'P0001';
  end if;
  if old.state in ('removed', 'expired') then
    raise exception 'MFA_FACTOR_TERMINAL' using errcode = 'P0001';
  end if;
  if new.state <> old.state and not (
       (old.state = 'pending' and new.state in ('verified', 'expired', 'reconciling'))
    or (old.state = 'verified' and new.state = 'reconciling')
    or (old.state = 'reconciling' and new.state in ('verified', 'pending', 'removed', 'expired'))
  ) then
    raise exception 'MFA_FACTOR_TRANSITION' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

create trigger mfa_factor_registry_guard
  before update or delete on identity.mfa_factor_registry
  for each row execute function platform_private.mfa_factor_guard();

-- A challenge is bound to its Auth UUID, exact session and factor at creation.
--   pending -> pending (a wrong code) | consumed | failed | expired
-- consumed/failed/expired never reopen.
create function platform_private.step_up_challenge_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  if tg_op = 'DELETE' then
    if coalesce(pg_catalog.current_setting('app.mfa_registry_purge', true), '') <> 'on'
       or old.state = 'pending' then
      raise exception 'MFA_REGISTRY_RETENTION_ONLY' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if new.id is distinct from old.id
     or new.auth_user_id is distinct from old.auth_user_id
     or new.session_id is distinct from old.session_id
     or new.factor_id is distinct from old.factor_id
     or new.provider_challenge_id is distinct from old.provider_challenge_id
     or new.expires_at is distinct from old.expires_at
     or new.created_at is distinct from old.created_at then
    raise exception 'STEP_UP_CHALLENGE_IMMUTABLE' using errcode = 'P0001';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'STEP_UP_CHALLENGE_VERSION' using errcode = 'P0001';
  end if;
  if old.state <> 'pending' then
    raise exception 'STEP_UP_CHALLENGE_TERMINAL' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

create trigger step_up_challenges_guard
  before update or delete on identity.step_up_challenges
  for each row execute function platform_private.step_up_challenge_guard();

revoke all on function platform_private.mfa_factor_guard(), platform_private.step_up_challenge_guard()
  from public, anon, authenticated, service_role;

commit;
