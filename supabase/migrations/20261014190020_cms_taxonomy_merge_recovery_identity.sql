-- DEC-194: durable failed-Q -> accepted-R identity and the shared party enqueue
-- mutex. The identity is independent of BE00 receipt TTL. Only Q has an FK:
-- purging R must not erase the fact that Q was recovered, while purging Q may
-- cascade normally. No custom write/delete guard may obstruct that FK cascade.
-- DEC-212 (review R2-01, BE03c "Merge convergence recovery" and "Database Schema"):
-- the table is a non-aggregate support table, so it lives OUTSIDE the cms_ namespace
-- (platform_private.taxonomy_merge_recoveries, like projection_consumer_state): the cms_
-- aggregate invariants (IA envelope columns, the cms_rpc_context_valid() both-sided policy
-- form, BEFORE-row guard coverage) keep covering only aggregates. It is still RLS-forced
-- with no API-role grant; its two policies keep the RPC-context gate.
-- Private implementation only; forward-only, no new API or role.
begin;
set local lock_timeout = '5s';

create table platform_private.taxonomy_merge_recoveries (
  failed_job_id uuid primary key references platform_private.jobs(id) on delete cascade,
  recovery_job_id uuid not null,
  requested_at timestamp with time zone not null default pg_catalog.clock_timestamp()
);

alter table platform_private.taxonomy_merge_recoveries enable row level security;
alter table platform_private.taxonomy_merge_recoveries force row level security;
revoke all on table platform_private.taxonomy_merge_recoveries
  from public, anon, authenticated, service_role;
grant select, insert on table platform_private.taxonomy_merge_recoveries to wejammin_cms_definer;
create policy taxonomy_merge_recoveries_select
  on platform_private.taxonomy_merge_recoveries for select to wejammin_cms_definer
  using (platform_private.cms_rpc_context_valid());
create policy taxonomy_merge_recoveries_insert
  on platform_private.taxonomy_merge_recoveries for insert to wejammin_cms_definer
  with check (platform_private.cms_rpc_context_valid());

comment on table platform_private.taxonomy_merge_recoveries is
  'DEC-194 / DEC-212 durable recovery identity (non-aggregate support table, outside the cms_ namespace): each failed Job Q names its accepted recovery R, independently of receipt expiry. FK to Q only, ON DELETE CASCADE; R deliberately has no FK. CMS-context SELECT/INSERT only; no API grant or custom cascade-blocking guard.';

-- Lock order: human/continuation position-1 authority locks precede this mutex;
-- CMS receipts, vocabulary/term locks, convergence and BE00 acceptance follow.
-- Recovery takes this mutex before its fresh failed-head/eligibility reads.
-- A merge's late private enqueue call reacquires its already-held key reentrantly.
create or replace function platform_private.cms_taxonomy_merge_enqueue_lock(p_acting_party_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $body$
begin
  -- Preserve the existing enqueue producer's downstream BE00 invalid-input error.
  if p_acting_party_id is null then return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'cms.taxonomy.merge.enqueue:' || p_acting_party_id::text, 0));
end;
$body$;

comment on function platform_private.cms_taxonomy_merge_enqueue_lock(uuid) is
  'DEC-194 party enqueue transaction mutex: hashtextextended(''cms.taxonomy.merge.enqueue:'' || party UUID, 0). Shared by ordinary merge request, fenced continuation and recovery; no API execution grant.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_taxonomy_merge_enqueue_lock(uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_taxonomy_merge_enqueue_lock(uuid)
  from public, anon, authenticated, service_role;

commit;
