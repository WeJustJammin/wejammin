-- G2b (P2-S09-AC-693, AC-694, AC-209): the operational alert delivery log and its
-- claim RPC admit the four review-lifecycle condition codes the evaluator now
-- raises (review_open_past_window, decision_denial_spike, assignment_denial_spike,
-- capability_grant_denial_spike) beside the twelve original codes, sixteen in all.
-- Without this a Worker claim for a new code would be refused as an invalid alert
-- claim.  Completion already keys on the stored code and needs no change; the
-- claim function's grants are preserved.  Forward-only.
begin;

alter table platform_private.cms_operational_alert_deliveries
  drop constraint cms_operational_alert_deliveries_alert_code_check,
  add constraint cms_operational_alert_deliveries_alert_code_check check (
    alert_code in (
      'activation_blocked', 'migration_retry_exceeded', 'nonce_rejection_spike',
      'dlq_nonempty', 'outbox_age_exceeded', 'conflict_rate_exceeded',
      'unknown_event_version', 'command_p95_exceeded',
      'protected_rpc_p95_exceeded', 'acceptance_p99_exceeded',
      'queue_first_attempt_p95_exceeded', 'daily_dlq_rate_exceeded',
      'review_open_past_window', 'decision_denial_spike',
      'assignment_denial_spike', 'capability_grant_denial_spike'
    ));

CREATE OR REPLACE FUNCTION platform_api.cms_claim_operational_alert(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_alert_code text;
  v_claim_token text;
  v_release text;
  v_scheduled_at timestamptz;
  v_claim_id uuid;
begin
  if p_request is null
    or pg_catalog.jsonb_typeof(p_request) <> 'object'
    or p_request - array['alertCode', 'claimToken', 'release', 'scheduledAt']::text[] <> '{}'::jsonb
  then
    raise exception using errcode = '22023', message = 'invalid operational alert claim';
  end if;
  v_alert_code := p_request->>'alertCode';
  v_claim_token := p_request->>'claimToken';
  v_release := p_request->>'release';
  begin
    v_scheduled_at := (p_request->>'scheduledAt')::timestamptz;
    perform v_claim_token::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'invalid operational alert claim';
  end;
  if v_alert_code not in (
      'activation_blocked', 'migration_retry_exceeded', 'nonce_rejection_spike',
      'dlq_nonempty', 'outbox_age_exceeded', 'conflict_rate_exceeded',
      'unknown_event_version', 'command_p95_exceeded',
      'protected_rpc_p95_exceeded', 'acceptance_p99_exceeded',
      'queue_first_attempt_p95_exceeded', 'daily_dlq_rate_exceeded',
      'review_open_past_window', 'decision_denial_spike',
      'assignment_denial_spike', 'capability_grant_denial_spike'
    )
    or v_release !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    or v_scheduled_at < now() - interval '10 minutes'
    or v_scheduled_at > now() + interval '5 minutes'
  then
    raise exception using errcode = '22023', message = 'invalid operational alert claim';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_alert_code, 0));
  if exists (
    select 1
      from platform_private.cms_operational_alert_deliveries delivery
     where delivery.alert_code = v_alert_code
       and (
         (delivery.state = 'claimed' and delivery.claimed_at >= now() - interval '5 minutes')
         or (delivery.state = 'delivered' and delivery.delivered_at >= now() - interval '15 minutes')
       )
  ) then
    return pg_catalog.jsonb_build_object('claimed', false);
  end if;

  insert into platform_private.cms_operational_alert_deliveries(
    alert_code, release, claim_token_hash
  ) values (
    v_alert_code,
    v_release,
    extensions.digest(pg_catalog.convert_to(v_claim_token, 'utf8'), 'sha256')
  ) returning id into v_claim_id;
  return pg_catalog.jsonb_build_object('claimed', true, 'claimId', v_claim_id);
end;
$function$;

commit;
