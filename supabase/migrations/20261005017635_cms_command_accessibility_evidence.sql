-- Slice 11 lane S11-3a (DEC-159 (5); BE03b "Accessibility provider (DEC-134, D25)": the audit record of
-- the command stores only { checkerKey, checkerVersion, outcome, blockingCount, inputHash }; tracker
-- P2-S11-AC-101): the accessibility audit summary of a command.
--
-- audit_private.audit_events carries no payload column and is never altered, so the summary of the
-- Worker's PreflightEvidence is a CMS-owned, append-only side table.  One row per command event: the
-- command (CMS-03B-05 / -07 / -09 / -20), the subject it created (review, schedule or publication
-- version), the revision, the outbox event of the command (event_id) and the correlation id of its audit
-- record (the join to audit_private.audit_events), plus exactly the five summary members.  Nothing
-- else of the evidence is stored: no binding hash, no finding text.
--
-- cms_record_command_accessibility_evidence(...) is the one writer.  A command calls it inside its
-- transaction right after cms_emit_event, passing the evidence it received: NULL evidence writes
-- nothing (a command without evidence cannot succeed: accessibility is then unavailable/checker_failed),
-- anything else must be a complete summary or the command is refused INVALID_REQUEST.  cms_submit_review
-- (this lane) calls it; S11-3b reuses it for schedule, publish and execute.  Private, SECURITY DEFINER,
-- owned by the CMS definer, no API grant.  Forward-only.
begin;

set local lock_timeout = '5s';

create table platform_private.cms_command_accessibility_evidence (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null,
  state text not null,
  version bigint not null default 1,
  operation_id text not null,
  subject_id uuid not null,
  revision_id uuid not null
    references platform_private.cms_entry_revisions(id),
  event_id uuid not null,
  correlation_id uuid not null,
  checker_key text not null,
  checker_version bigint not null,
  outcome text not null,
  blocking_count integer not null,
  input_hash char(64) not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint cms_command_accessibility_evidence_state_check
    check (state = 'recorded'),
  constraint cms_command_accessibility_evidence_version_check
    check (version = 1 and version > 0),
  constraint cms_command_accessibility_evidence_operation_check check (
    operation_id in ('CMS-03B-05', 'CMS-03B-07', 'CMS-03B-09', 'CMS-03B-20')
  ),
  constraint cms_command_accessibility_evidence_checker_key_check
    check (checker_key ~ '^[a-z][a-z0-9._-]{0,127}$'),
  constraint cms_command_accessibility_evidence_checker_version_check
    check (checker_version > 0),
  constraint cms_command_accessibility_evidence_outcome_check
    check (outcome in ('healthy', 'blocked', 'failed')),
  constraint cms_command_accessibility_evidence_blocking_check
    check (blocking_count between 0 and 1000),
  constraint cms_command_accessibility_evidence_input_hash_check
    check (input_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_command_accessibility_evidence_time_check
    check (updated_at = created_at),
  constraint cms_command_accessibility_evidence_event_key unique (event_id)
);

create index cms_command_accessibility_evidence_subject_idx
  on platform_private.cms_command_accessibility_evidence (operation_id, subject_id);
create index cms_command_accessibility_evidence_revision_idx
  on platform_private.cms_command_accessibility_evidence (revision_id, created_at desc);
create index cms_command_accessibility_evidence_owner_idx
  on platform_private.cms_command_accessibility_evidence (owner_id, created_at desc);

create trigger cms_command_accessibility_evidence_write_guard
before insert on platform_private.cms_command_accessibility_evidence
for each row execute function platform_private.cms_write_guard();
create trigger cms_command_accessibility_evidence_immutable_guard
before update or delete on platform_private.cms_command_accessibility_evidence
for each row execute function platform_private.cms_immutable_guard();

alter table platform_private.cms_command_accessibility_evidence enable row level security;
alter table platform_private.cms_command_accessibility_evidence force row level security;
revoke all on table platform_private.cms_command_accessibility_evidence
  from public, anon, authenticated, service_role;
create policy cms_command_accessibility_evidence_rpc_policy
  on platform_private.cms_command_accessibility_evidence
  for all to public
  using (platform_private.cms_rpc_context_valid())
  with check (platform_private.cms_rpc_context_valid());

create or replace function platform_private.cms_record_command_accessibility_evidence(
  p_operation_id text,
  p_subject_id uuid,
  p_revision_id uuid,
  p_event_id uuid,
  p_correlation_id uuid,
  p_evidence jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $body$
declare
  owner_party uuid;
  summary_id uuid := extensions.gen_random_uuid();
  recorded_at timestamptz := pg_catalog.clock_timestamp();
begin
  if p_evidence is null or pg_catalog.jsonb_typeof(p_evidence) = 'null' then
    return null;
  end if;
  if pg_catalog.jsonb_typeof(p_evidence) <> 'object'
     or pg_catalog.jsonb_typeof(p_evidence->'providerKey') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_evidence->'providerVersion') is distinct from 'string'
     or p_evidence->>'providerVersion' !~ '^[1-9][0-9]{0,17}$'
     or pg_catalog.jsonb_typeof(p_evidence->'outcome') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_evidence->'blockingCount') is distinct from 'number'
     or pg_catalog.jsonb_typeof(p_evidence->'inputHash') is distinct from 'string'
     or p_evidence->>'blockingCount' !~ '^[0-9]{1,4}$'
     or p_event_id is null or p_correlation_id is null or p_subject_id is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select revision_item.owner_id into owner_party
    from platform_private.cms_entry_revisions revision_item
   where revision_item.id = p_revision_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into platform_private.cms_command_accessibility_evidence(
    id, owner_id, state, version, operation_id, subject_id, revision_id, event_id,
    correlation_id, checker_key, checker_version, outcome, blocking_count, input_hash,
    created_at, updated_at
  ) values (
    summary_id, owner_party, 'recorded', 1, p_operation_id, p_subject_id, p_revision_id,
    p_event_id, p_correlation_id, p_evidence->>'providerKey',
    (p_evidence->>'providerVersion')::bigint, p_evidence->>'outcome',
    (p_evidence->>'blockingCount')::integer, p_evidence->>'inputHash', recorded_at, recorded_at
  );
  return summary_id;
end;
$body$;

comment on function platform_private.cms_record_command_accessibility_evidence(text, uuid, uuid, uuid, uuid, jsonb) is
  'DEC-159 (5): appends the { checkerKey, checkerVersion, outcome, blockingCount, inputHash } summary of a command''s non-null accessibility PreflightEvidence to cms_command_accessibility_evidence (NULL evidence writes nothing). Called inside the command transaction after cms_emit_event. Private.';

-- SEC-2: held by the definer role alone; no API role may run the recorder.
grant insert, select on table platform_private.cms_command_accessibility_evidence to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_record_command_accessibility_evidence(text, uuid, uuid, uuid, uuid, jsonb)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_record_command_accessibility_evidence(text, uuid, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;

commit;
