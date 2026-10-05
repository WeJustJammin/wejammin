-- AC-916 (BE01a security notification seam; architecture-design.md "Transactional
-- email": external delivery disabled, in-app/local-fake notification boundary
-- only).  The in-app notification intent store: an append-only identity table with
-- forced RLS and no table-level grant, one row per notification id (the security
-- event id), holding identifiers and a closed template code only.  The recipient
-- is never accepted from the caller: platform_api.in_app_notification_record
-- resolves the account holder server-side from the immutable outbox request's
-- binding (identity.auth_user_bindings), checks the template against the security
-- event's reason and the operation id against its request id, and is idempotent by
-- notification id (a replay returns the original response, even with a fresh
-- delivery request id; every call, replay included, revalidates the template and
-- operation id against the security event).  A holder reads only their own notifications through a
-- security-invoker view over column-level grants.  Forward-only.
begin;

create table identity.in_app_notification_intents (
  id uuid primary key default extensions.gen_random_uuid(),
  notification_id uuid not null unique,
  recipient_auth_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_class text not null check (recipient_class = 'account_holder'),
  event_type text not null check (event_type = 'identity.security-notification.requested.v1'),
  operation_id uuid not null,
  safe_template_code text not null check (
    safe_template_code in ('mfa_factor_added', 'mfa_factor_removed', 'mfa_factors_reset')),
  delivery_request_id uuid not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index in_app_notification_intents_recipient
  on identity.in_app_notification_intents (recipient_auth_user_id, created_at desc, id);

alter table identity.in_app_notification_intents enable row level security;
alter table identity.in_app_notification_intents force row level security;
revoke all on table identity.in_app_notification_intents
  from public, anon, authenticated, service_role;

create function identity.in_app_notification_immutable()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
end;
$body$;
create trigger in_app_notification_intents_immutable
  before update or delete on identity.in_app_notification_intents
  for each row execute function identity.in_app_notification_immutable();
revoke all on function identity.in_app_notification_immutable()
  from public, anon, authenticated, service_role;

create policy in_app_notification_self_read on identity.in_app_notification_intents
  for select to authenticated
  using (recipient_auth_user_id = (select auth.uid()));

create view api_identity.in_app_notification_self_v1
  with (security_invoker = true) as
  select notification_id, safe_template_code, created_at
    from identity.in_app_notification_intents;
revoke all on table api_identity.in_app_notification_self_v1
  from public, anon, authenticated, service_role;
grant select on table api_identity.in_app_notification_self_v1 to authenticated;
grant select (notification_id, safe_template_code, created_at)
  on identity.in_app_notification_intents to authenticated;

create function platform_api.in_app_notification_record(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  keys constant text[] := array['eventType', 'notificationId', 'operationId', 'recipientClass',
    'requestId', 'safeTemplateCode']::text[];
  notification uuid;
  operation uuid;
  delivery_request uuid;
  template text;
  expected_template text;
  event_row identity.security_events%rowtype;
  holder uuid;
  intent identity.in_app_notification_intents%rowtype;
begin
  if pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or (select pg_catalog.array_agg(k order by k) from pg_catalog.jsonb_object_keys(p_request) k)
        is distinct from keys
     or p_request->>'eventType' is distinct from 'identity.security-notification.requested.v1'
     or p_request->>'recipientClass' is distinct from 'account_holder'
     or p_request->>'safeTemplateCode' is null
     or p_request->>'safeTemplateCode' not in ('mfa_factor_added', 'mfa_factor_removed', 'mfa_factors_reset')
     or p_request->>'notificationId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or p_request->>'operationId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or p_request->>'requestId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  notification := (p_request->>'notificationId')::uuid;
  operation := (p_request->>'operationId')::uuid;
  delivery_request := (p_request->>'requestId')::uuid;
  template := p_request->>'safeTemplateCode';
  select * into event_row from identity.security_events e
   where e.id = notification
     and e.action in ('mfa.enroll.verified', 'mfa.factor.removed', 'mfa.factors.reset');
  select binding.auth_user_id into holder
    from platform_private.outbox_events request_event
    join identity.auth_user_bindings binding
      on binding.id::text = request_event.payload->>'authBindingId'
   where request_event.event_type = 'identity.security-notification.requested.v1'
     and request_event.aggregate_type = 'security_event'
     and request_event.aggregate_id = notification;
  if event_row.id is null or holder is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  expected_template := case event_row.reason_code
    when 'MFA_FACTOR_ADDED' then 'mfa_factor_added'
    when 'MFA_FACTOR_REMOVED' then 'mfa_factor_removed'
    when 'MFA_FACTORS_RESET' then 'mfa_factors_reset' end;
  if event_row.request_id <> operation or template is distinct from expected_template then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  insert into identity.in_app_notification_intents (
    notification_id, recipient_auth_user_id, recipient_class, event_type,
    operation_id, safe_template_code, delivery_request_id
  ) values (
    notification, holder, 'account_holder', 'identity.security-notification.requested.v1',
    operation, template, delivery_request)
  on conflict (notification_id) do nothing;
  select * into intent from identity.in_app_notification_intents where notification_id = notification;
  return pg_catalog.jsonb_build_object(
    'deliveryAttemptId', intent.id,
    'deliveryState', 'recorded',
    'providerReference', 'in-app:' || intent.notification_id::text,
    'acceptedAt', pg_catalog.to_char(intent.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end;
$body$;
revoke all on function platform_api.in_app_notification_record(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.in_app_notification_record(jsonb) to service_role;

commit;
