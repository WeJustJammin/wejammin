commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 G2b (P2-S09-AC-693, AC-694, AC-209): the operational alert delivery log and
-- claim RPC admit exactly the sixteen locked condition codes: the twelve original ones
-- plus review_open_past_window, decision_denial_spike, assignment_denial_spike and
-- capability_grant_denial_spike.  Anything else is refused before a row is written.

create function pg_temp.g2b_claim(p_code text, p_token uuid default extensions.gen_random_uuid()) returns jsonb
language sql as $body$
  select platform_api.cms_claim_operational_alert(jsonb_build_object(
    'alertCode', p_code, 'claimToken', p_token, 'release', 'g2b-release', 'scheduledAt', clock_timestamp())) $body$;

select is((select (pg_temp.g2b_claim(c)->>'claimed')::boolean from unnest(array[
  'activation_blocked', 'migration_retry_exceeded', 'nonce_rejection_spike', 'dlq_nonempty', 'outbox_age_exceeded',
  'conflict_rate_exceeded', 'unknown_event_version', 'command_p95_exceeded', 'protected_rpc_p95_exceeded',
  'acceptance_p99_exceeded', 'queue_first_attempt_p95_exceeded', 'daily_dlq_rate_exceeded']) c limit 1), true,
  'an original condition code is still claimable [P2-S09-AC-209]');

create temp table g2b_claims on commit drop as
select c as code, t as token, pg_temp.g2b_claim(c, t) as claim
  from (select c, extensions.gen_random_uuid() as t from unnest(array['review_open_past_window', 'decision_denial_spike',
    'assignment_denial_spike', 'capability_grant_denial_spike']) c) codes;
select ok((claim->>'claimed')::boolean, code || ' is claimable once [P2-S09-AC-209]') from g2b_claims order by code;
select ok(not (pg_temp.g2b_claim(code)->>'claimed')::boolean,
  code || ' is suppressed while its claim is live (duplicate delivery guard) [P2-S09-AC-209]') from g2b_claims order by code;
select is((select count(*)::integer from platform_private.cms_operational_alert_deliveries
            where alert_code in (select code from g2b_claims)), 4, 'one delivery row per new code [P2-S09-AC-209]');
select ok(platform_api.cms_complete_operational_alert(jsonb_build_object(
    'alertCode', code, 'claimId', claim->>'claimId', 'claimToken', token, 'deliveredAt', clock_timestamp(),
    'receiptId', extensions.gen_random_uuid())),
  'the claim of ' || code || ' completes with its claim token [P2-S09-AC-209]') from g2b_claims order by code;
select is((select count(*)::integer from platform_private.cms_operational_alert_deliveries
            where alert_code in (select code from g2b_claims) and state = 'delivered'), 4,
  'every new code reaches the delivered state [P2-S09-AC-209]');
select ok(not platform_api.cms_complete_operational_alert(jsonb_build_object(
    'alertCode', 'review_open_past_window', 'claimId', (select claim->>'claimId' from g2b_claims where code = 'review_open_past_window'),
    'claimToken', extensions.gen_random_uuid(), 'deliveredAt', clock_timestamp(), 'receiptId', extensions.gen_random_uuid())),
  'completing with a wrong claim token changes nothing [P2-S09-AC-209]');

select throws_ok($$select pg_temp.g2b_claim('review_open_forever')$$, '22023', 'invalid operational alert claim',
  'an unlisted code is refused before any row is written [P2-S09-AC-209]');
select throws_ok($$select pg_temp.g2b_claim('Decision_Denial_Spike')$$, '22023', 'invalid operational alert claim',
  'a differently cased code is refused [P2-S09-AC-209]');
select is((select count(*)::integer from pg_constraint where conrelid = 'platform_private.cms_operational_alert_deliveries'::regclass
    and conname = 'cms_operational_alert_deliveries_alert_code_check'
    and pg_get_constraintdef(oid) like '%review_open_past_window%'
    and pg_get_constraintdef(oid) like '%decision_denial_spike%'
    and pg_get_constraintdef(oid) like '%assignment_denial_spike%'
    and pg_get_constraintdef(oid) like '%capability_grant_denial_spike%'), 1,
  'the delivery table CHECK names all four new codes [P2-S09-AC-209]');

select * from finish();
rollback;
