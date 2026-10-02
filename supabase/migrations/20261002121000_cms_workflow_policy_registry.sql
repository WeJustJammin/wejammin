-- DEC-108 / DEC-109 / DEC-110: code-owned workflow policy registry.
-- One immutable seeded row per registry member replaces the key/version
-- allowlist semantics of cms_workflow_registry_valid.  The member shape is
-- { key, version, riskClass, requiredDecisionCount, requiredCapabilities };
-- policyHash is the lowercase SHA-256 hex of the RFC 8785/JCS canonical JSON of
-- exactly that object (requiredCapabilities in registry order, no hash and no
-- approval evidence inside it).  A policy changes only by shipping a new member
-- version in code plus a forward migration.  Forward-only.
begin;

create table platform_private.cms_workflow_policies (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null,
  state text not null default 'seeded',
  version bigint not null check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  policy_key text not null,
  policy_version bigint not null check (policy_version > 0),
  policy_hash char(64) not null,
  risk_class text not null,
  required_decision_count smallint not null,
  required_capabilities jsonb not null,
  constraint cms_workflow_policies_state_check check (state = 'seeded'),
  constraint cms_workflow_policies_key_check check (policy_key ~ '^[a-z][a-z0-9._-]{0,127}$'),
  constraint cms_workflow_policies_hash_check check (policy_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_workflow_policies_risk_check check (risk_class in ('ordinary', 'protected')),
  constraint cms_workflow_policies_count_check check (required_decision_count between 1 and 8),
  constraint cms_workflow_policies_capabilities_check check (
    pg_catalog.jsonb_typeof(required_capabilities) = 'array'
    and pg_catalog.jsonb_array_length(required_capabilities) between 1 and 16
  ),
  constraint cms_workflow_policies_protected_check check (
    risk_class <> 'protected'
    or (required_decision_count >= 2 and pg_catalog.jsonb_array_length(required_capabilities) >= 2)
  ),
  constraint cms_workflow_policies_version_match_check check (version = policy_version),
  constraint cms_workflow_policies_created_immutable_check check (updated_at = created_at),
  constraint cms_workflow_policies_member_unique unique (policy_key, policy_version)
);

-- The one place the member hash is defined, shared by the seed, the resolver
-- and CI so a drifted row can never validate itself.
create or replace function platform_private.cms_workflow_policy_hash(
  p_key text, p_version bigint, p_risk_class text,
  p_required_decision_count integer, p_required_capabilities jsonb
)
returns text
language sql
immutable
set search_path = ''
as $body$
  select platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'key', p_key,
    'version', p_version,
    'riskClass', p_risk_class,
    'requiredDecisionCount', p_required_decision_count,
    'requiredCapabilities', p_required_capabilities
  ))
$body$;

-- The seeded rows are the DEC-110 members; every member is version 1.  The
-- owner is the release record carrying this migration (a fixed namespaced id).
select pg_catalog.set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_workflow_policies(
  owner_id, version, policy_key, policy_version, policy_hash, risk_class,
  required_decision_count, required_capabilities
)
select '0d6a0d6a-0000-4000-8000-000000000108'::uuid, member.version, member.key,
       member.version,
       platform_private.cms_workflow_policy_hash(
         member.key, member.version, member.risk_class, member.required_decision_count,
         member.required_capabilities),
       member.risk_class, member.required_decision_count, member.required_capabilities
from (values
  ('editorial', 1::bigint, 'ordinary', 1, '["cms.reviewer"]'::jsonb),
  ('editorial.default', 1::bigint, 'ordinary', 1, '["cms.reviewer"]'::jsonb),
  ('cms.content.workflow', 1::bigint, 'ordinary', 1, '["cms.reviewer"]'::jsonb),
  ('cms.standard', 1::bigint, 'ordinary', 1, '["cms.reviewer"]'::jsonb),
  ('cms.disclosure.policy', 1::bigint, 'protected', 2, '["cms.reviewer","cms.reviewer.policy"]'::jsonb),
  ('cms.disclosure.legal', 1::bigint, 'protected', 2, '["cms.reviewer","cms.reviewer.legal"]'::jsonb),
  ('cms.disclosure.security', 1::bigint, 'protected', 2, '["cms.reviewer","cms.reviewer.security"]'::jsonb),
  ('cms.disclosure.financial', 1::bigint, 'protected', 2, '["cms.reviewer","cms.reviewer.financial"]'::jsonb)
) as member(key, version, risk_class, required_decision_count, required_capabilities);

create trigger cms_workflow_policies_write_guard
before insert on platform_private.cms_workflow_policies
for each row execute function platform_private.cms_write_guard();
create trigger cms_workflow_policies_immutable_guard
before update or delete on platform_private.cms_workflow_policies
for each row execute function platform_private.cms_immutable_guard();

alter table platform_private.cms_workflow_policies enable row level security;
alter table platform_private.cms_workflow_policies force row level security;
revoke all on table platform_private.cms_workflow_policies
  from public, anon, authenticated, service_role;
-- Rows are code-owned and immutable: the seeded members are readable by the
-- pinned definer functions (no role has a table grant), and an insert is
-- admitted only inside a CMS migration/RPC context.
create policy cms_workflow_policies_read_policy on platform_private.cms_workflow_policies
  for select to public using (true);
create policy cms_workflow_policies_seed_policy on platform_private.cms_workflow_policies
  for insert to public with check (platform_private.cms_rpc_context_valid());

-- Fail-closed resolver: exactly one seeded row whose stored hash equals the
-- recomputation of the row's own columns, else NULL (absence, ambiguity or a
-- hash mismatch never resolves).  Returns the frozen member plus its hash.
create or replace function platform_private.cms_workflow_policy_member(
  p_key text, p_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  member_row platform_private.cms_workflow_policies%rowtype;
  member_count integer;
begin
  if p_key is null or p_version is null then
    return null;
  end if;
  select count(*) into member_count
    from platform_private.cms_workflow_policies policy
   where policy.policy_key = p_key and policy.policy_version = p_version;
  if member_count <> 1 then
    return null;
  end if;
  select * into member_row
    from platform_private.cms_workflow_policies policy
   where policy.policy_key = p_key and policy.policy_version = p_version;
  if member_row.policy_hash is distinct from platform_private.cms_workflow_policy_hash(
       member_row.policy_key, member_row.policy_version, member_row.risk_class,
       member_row.required_decision_count, member_row.required_capabilities) then
    return null;
  end if;
  return pg_catalog.jsonb_build_object(
    'key', member_row.policy_key,
    'version', member_row.policy_version,
    'riskClass', member_row.risk_class,
    'requiredDecisionCount', member_row.required_decision_count,
    'requiredCapabilities', member_row.required_capabilities,
    'policyHash', member_row.policy_hash
  );
end;
$body$;

-- The allowlist semantics are replaced: a (key, version) is valid exactly when
-- the seeded, hash-verified registry resolves it.
create or replace function platform_private.cms_workflow_registry_valid(
  p_key text, p_version bigint
)
returns boolean
language sql
stable
set search_path = ''
as $body$
  select platform_private.cms_workflow_policy_member(p_key, p_version) is not null
$body$;

-- Risk class of a workflow key's latest registry member ('ordinary' when the
-- key resolves to no member).  The effective class of a successor candidate is
-- the strictest-of resolution the review freeze stores; this is the key-level
-- default.
create or replace function platform_private.cms_activation_risk_class(p_workflow_key text)
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select coalesce((
    select policy.risk_class
      from platform_private.cms_workflow_policies policy
     where policy.policy_key = p_workflow_key
     order by policy.policy_version desc
     limit 1
  ), 'ordinary')
$body$;

revoke all on function platform_private.cms_workflow_policy_hash(text, bigint, text, integer, jsonb),
  platform_private.cms_workflow_policy_member(text, bigint),
  platform_private.cms_workflow_registry_valid(text, bigint),
  platform_private.cms_activation_risk_class(text)
  from public, anon, authenticated, service_role;

commit;
